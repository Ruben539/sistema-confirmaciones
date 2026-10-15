<?php

namespace App\Jobs;

use App\Http\Controllers\RsvpController;
use App\Services\WhatsAppGateway;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Http\Request;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * A guest's WhatsApp message received through the official Cloud API: the same conversation logic as with
 * the Baileys bot (RsvpController::handleIncomingWhatsApp), and its answer goes back through the API.
 * Runs in the queue so Meta's webhook gets its 200 right away.
 */
class ProcessIncomingWhatsAppJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 1;
    public $timeout = 60;

    public function __construct(public string $phone, public string $text, public ?string $messageId = null)
    {
    }

    public function handle(): void
    {
        if ($this->messageId) {
            WhatsAppGateway::markRead($this->messageId);
        }

        $request = Request::create('/api/rsvp/incoming-whatsapp', 'POST', [
            'phone' => $this->phone,
            'message' => $this->text,
            'channel' => 'cloud',
        ]);
        // Internal call: the bot's shared secret (if any) does not apply here
        $request->headers->set('X-Webhook-Secret', (string) config('whatsapp.webhook_secret'));

        $response = app(RsvpController::class)->handleIncomingWhatsApp($request);
        $data = $response->getData(true);

        $reply = $data['reply'] ?? null;
        if (!$reply) {
            return;
        }

        $result = WhatsAppGateway::sendText($this->phone, $reply, $data['media_url'] ?? null, ['channel' => 'cloud']);
        if (!$result['ok']) {
            Log::warning("[WhatsApp Cloud] No se pudo responder a {$this->phone}: " . ($result['error'] ?? ''));
        }
    }
}
