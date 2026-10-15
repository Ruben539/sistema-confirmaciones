<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessIncomingWhatsAppJob;
use App\Services\WhatsAppGateway;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Webhook of the official WhatsApp Cloud API (Meta): verification when it's configured (GET) and the
 * guests' messages (POST), signed with the app secret.
 */
class WhatsAppCloudWebhookController extends Controller
{
    public function verify(Request $request)
    {
        $token = config('whatsapp.cloud.verify_token');
        if ($token && $request->query('hub_mode') === 'subscribe' && hash_equals($token, (string) $request->query('hub_verify_token'))) {
            return response((string) $request->query('hub_challenge'), 200)->header('Content-Type', 'text/plain');
        }
        return response('Forbidden', 403);
    }

    public function receive(Request $request)
    {
        $secret = config('whatsapp.cloud.app_secret');
        $signature = (string) $request->header('X-Hub-Signature-256');
        if (!$secret || !hash_equals('sha256=' . hash_hmac('sha256', $request->getContent(), $secret), $signature)) {
            return response('Invalid signature', 401);
        }

        foreach ($request->input('entry', []) as $entry) {
            foreach ($entry['changes'] ?? [] as $change) {
                $value = $change['value'] ?? [];

                foreach ($value['messages'] ?? [] as $message) {
                    $this->handleMessage($message);
                }

                // Delivery problems of what we sent (number without WhatsApp, template rejected...)
                foreach ($value['statuses'] ?? [] as $status) {
                    if (($status['status'] ?? null) === 'failed') {
                        $error = $status['errors'][0] ?? [];
                        Log::warning('[WhatsApp Cloud] Mensaje no entregado a ' . ($status['recipient_id'] ?? '?') . ': '
                            . ($error['code'] ?? '') . ' ' . ($error['error_data']['details'] ?? $error['title'] ?? ''));
                    }
                }
            }
        }

        return response()->json(['ok' => true]);
    }

    private function handleMessage(array $message): void
    {
        $id = $message['id'] ?? null;
        // Meta may deliver the same message twice
        if ($id && !Cache::add("wa:msg:{$id}", true, now()->addDay())) {
            return;
        }

        $phone = preg_replace('/[^\d]/', '', (string) ($message['from'] ?? ''));
        if ($phone === '') {
            return;
        }
        WhatsAppGateway::markInbound($phone);

        $text = match ($message['type'] ?? '') {
            'text' => $message['text']['body'] ?? '',
            // Template quick reply buttons: "Ver invitación", "1" (Sí, voy) / "2" (No voy a poder)
            'button' => ($message['button']['payload'] ?? null) === WhatsAppGateway::VIEW_INVITATION
                ? 'Ver invitación'
                : ($message['button']['payload'] ?? $message['button']['text'] ?? ''),
            'interactive' => $message['interactive']['button_reply']['id']
                ?? $message['interactive']['list_reply']['id']
                ?? $message['interactive']['button_reply']['title'] ?? '',
            'reaction' => '',
            // Photos / videos: only their caption is a message for the bot
            'image', 'video', 'document' => $message[$message['type']]['caption'] ?? '',
            default => '',
        };

        if (trim($text) !== '') {
            ProcessIncomingWhatsAppJob::dispatch($phone, trim($text), $id);
        }
    }
}
