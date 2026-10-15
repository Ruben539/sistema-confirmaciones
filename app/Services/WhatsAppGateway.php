<?php

namespace App\Services;

use App\Models\Guest;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Every outgoing WhatsApp message goes through here. Two numbers can work at the same time:
 *  - "baileys": our Node bot (POST to WHATSAPP_BOT_URL). Free, but writing first is what gets numbers
 *               banned, so invitations through it have a small daily quota.
 *  - "cloud":   the official WhatsApp Cloud API. Free text only inside the 24 h after the person last
 *               wrote to us; otherwise an approved template (invitation, reminder, pass or notice).
 * Each guest talks to one number (guests.whatsapp_channel) and everything else goes through it.
 *
 * Result: ['ok' => bool, 'retry' => bool (safe to try again later), 'uncertain' => bool (may have been
 * sent anyway: don't retry, it would duplicate), 'retry_after' => seconds, 'error' => string].
 */
class WhatsAppGateway
{
    // Payload of the "Ver invitación" button of the greeting template
    public const VIEW_INVITATION = 'VER_INVITACION';

    // Default channel (planner / admin notices, guests not contacted yet)
    public static function defaultChannel(): string
    {
        return config('whatsapp.driver') === 'cloud' && self::cloudConfigured() ? 'cloud' : 'baileys';
    }

    public static function cloudConfigured(): bool
    {
        return config('whatsapp.cloud.enabled', true)
            && !empty(config('whatsapp.cloud.phone_number_id'))
            && !empty(config('whatsapp.cloud.token'));
    }

    // The number a guest talks to (the one that invited them or that they wrote to last)
    public static function channelFor(?Guest $guest): string
    {
        $channel = $guest?->whatsapp_channel;
        if ($channel === 'cloud' && !self::cloudConfigured()) {
            return 'baileys';
        }
        return in_array($channel, ['baileys', 'cloud'], true) ? $channel : self::defaultChannel();
    }

    /**
     * Channel for writing first to a guest (invitation / reminder). A guest who already talks to a number
     * keeps it. Otherwise by the event: "baileys", "cloud" or "auto" (the bot up to its safe daily quota,
     * then the official API).
     */
    public static function channelForInvitation(Guest $guest): string
    {
        if ($guest->whatsapp_channel && ($guest->whatsapp_channel !== 'cloud' || self::cloudConfigured())) {
            return $guest->whatsapp_channel;
        }
        $mode = $guest->event?->whatsapp_channel ?: 'auto';
        if ($mode === 'cloud' && self::cloudConfigured()) {
            return 'cloud';
        }
        if ($mode === 'baileys' || !self::cloudConfigured()) {
            return 'baileys';
        }
        return self::baileysQuotaLeft() > 0 ? 'baileys' : 'cloud';
    }

    // Invitations / reminders the bot can still send today (shared by all events: it is one number)
    public static function baileysQuotaLeft(): int
    {
        return max(0, (int) config('whatsapp.baileys_daily_limit', 30) - (int) Cache::get(self::baileysQuotaKey(), 0));
    }

    public static function countBaileysColdSend(): void
    {
        Cache::add(self::baileysQuotaKey(), 0, now()->addDays(2));
        Cache::increment(self::baileysQuotaKey());
    }

    private static function baileysQuotaKey(): string
    {
        return 'wa:baileys:cold:' . now()->format('Ymd');
    }

    // The person wrote to us in the last 24 h: free text is allowed (set by the Cloud webhook)
    public static function markInbound(string $phone): void
    {
        Cache::put('wa:in:' . self::digits($phone), now()->timestamp, now()->addHours(23));
    }

    public static function inWindow(string $phone): bool
    {
        return Cache::has('wa:in:' . self::digits($phone));
    }

    /**
     * Free text (with an optional image: URL or local file). Cloud: outside the 24 h window it goes as the
     * "notice" template ("Hola {{1}} 👋 ... {{2}}"), unless $opts['outside_window'] === 'fail'.
     * $opts: channel ("baileys" / "cloud", default: WHATSAPP_DRIVER), name (for the notice greeting),
     * session_id (Baileys), timeout.
     */
    public static function sendText(string $phone, string $text, ?string $media = null, array $opts = []): array
    {
        $phone = self::digits($phone);
        $channel = $opts['channel'] ?? self::defaultChannel();
        if ($channel !== 'cloud') {
            return self::baileys(array_filter([
                'phone' => $phone,
                'message' => $text,
                'mediaUrl' => $media,
                'session_id' => $opts['session_id'] ?? null,
            ]), $opts['timeout'] ?? 15);
        }

        if (self::inWindow($phone)) {
            return $media ? self::cloudImage($phone, $media, $text) : self::cloudText($phone, $text);
        }
        if (($opts['outside_window'] ?? 'template') === 'fail') {
            return ['ok' => false, 'retry' => false, 'error' => 'window_closed'];
        }

        return self::template($phone, config('whatsapp.cloud.templates.notice'), [($opts['name'] ?? '') ?: 'qué tal', $text]);
    }

    /**
     * Invitation or reminder to a guest. Baileys: the text built from the event's message. Cloud: approved
     * templates (invitation = greeting + "Ver invitación"; reminder with "Sí, voy" / "No voy a poder").
     */
    public static function sendInvitation(Guest $guest, string $mode, string $text, ?string $media, ?string $sessionId = null, ?string $channel = null): array
    {
        $channel = $channel ?: self::channelForInvitation($guest);
        if ($channel !== 'cloud') {
            return self::sendText($guest->phone, $text, $media, ['channel' => 'baileys', 'session_id' => $sessionId]);
        }

        $event = $guest->event;
        $hosts = GuestMessages::hosts($event);
        $buttons = ['1', '2'];

        if ($mode === 'reminder') {
            $deadline = $event?->rsvpDeadline();
            return self::template($guest->phone, config('whatsapp.cloud.templates.reminder'), [
                self::firstName($guest),
                $hosts,
                $deadline ? $deadline->locale('es')->isoFormat('D [de] MMMM') : 'la fecha indicada',
            ], null, $buttons);
        }

        // Greeting with a "Ver invitación" button: tapping it opens the 24 h window and the bot answers with the
        // invitation configured in the event (free text, photo...). "No voy a poder" declines right away.
        return self::template($guest->phone, config('whatsapp.cloud.templates.invitation'), [
            self::firstName($guest),
            $hosts,
        ], null, [self::VIEW_INVITATION, '2']);
    }

    // Entry pass (QR image). Cloud outside the 24 h window: the "pass" template with the QR as header
    public static function sendPass(Guest $guest, string $text, string $qrUrl, ?string $sessionId = null): array
    {
        $channel = self::channelFor($guest);
        if ($channel !== 'cloud' || self::inWindow($guest->phone)) {
            return self::sendText($guest->phone, $text, $qrUrl, ['channel' => $channel, 'session_id' => $sessionId, 'timeout' => 10]);
        }

        $people = $guest->groupSize();
        return self::template($guest->phone, config('whatsapp.cloud.templates.pass'), [
            self::firstName($guest),
            GuestMessages::hosts($guest->event),
            $people === 1 ? '1 persona' : "{$people} personas",
        ], $qrUrl);
    }

    // Blue ticks on the guest's message (Cloud only)
    public static function markRead(string $messageId): void
    {
        if (self::cloudConfigured()) {
            self::cloudPost(['status' => 'read', 'message_id' => $messageId]);
        }
    }

    // ───────── Baileys ─────────

    private static function baileys(array $payload, int $timeout): array
    {
        // The bot waits like a person ("escribiendo...", pauses, its queue of 15 s between first messages):
        // a short timeout would take a message that is on its way as failed
        $timeout = max($timeout, 55);
        try {
            $res = Http::timeout($timeout)->post(config('whatsapp.bot_url'), $payload);
        } catch (ConnectionException $e) {
            // cURL 7: the bot is down, nothing was sent. A timeout may have been sent anyway.
            $down = str_contains($e->getMessage(), 'cURL error 7');
            return ['ok' => false, 'retry' => $down, 'uncertain' => !$down, 'retry_after' => 300, 'error' => $e->getMessage()];
        }

        if ($res->successful()) {
            return ['ok' => true];
        }
        // Bot up but its WhatsApp session is disconnected / busy
        return ['ok' => false, 'retry' => $res->serverError(), 'retry_after' => 600, 'error' => $res->body()];
    }

    // ───────── Cloud API ─────────

    private static function cloudText(string $phone, string $text): array
    {
        return self::cloudPost([
            'to' => $phone,
            'type' => 'text',
            'text' => ['body' => mb_substr($text, 0, 4096), 'preview_url' => true],
        ]);
    }

    private static function cloudImage(string $phone, string $media, string $caption): array
    {
        $image = self::mediaRef($media);
        if (!$image) {
            return self::cloudText($phone, $caption);
        }
        // Captions are limited to 1024 characters: longer texts go right after the image
        if (mb_strlen($caption) <= 1024) {
            return self::cloudPost(['to' => $phone, 'type' => 'image', 'image' => $image + ['caption' => $caption]]);
        }
        $sent = self::cloudPost(['to' => $phone, 'type' => 'image', 'image' => $image]);
        return $sent['ok'] ? self::cloudText($phone, $caption) : $sent;
    }

    private static function template(string $phone, ?string $name, array $bodyParams, ?string $headerImage = null, array $quickReplies = []): array
    {
        if (!$name) {
            return ['ok' => false, 'retry' => false, 'error' => 'Plantilla de WhatsApp no configurada'];
        }

        $components = [];
        if ($headerImage && ($image = self::mediaRef($headerImage))) {
            $components[] = ['type' => 'header', 'parameters' => [['type' => 'image', 'image' => $image]]];
        }
        $components[] = [
            'type' => 'body',
            'parameters' => array_map(fn ($p) => ['type' => 'text', 'text' => self::templateParam($p)], $bodyParams),
        ];
        foreach (array_values($quickReplies) as $i => $payload) {
            $components[] = [
                'type' => 'button',
                'sub_type' => 'quick_reply',
                'index' => (string) $i,
                'parameters' => [['type' => 'payload', 'payload' => $payload]],
            ];
        }

        return self::cloudPost([
            'to' => self::digits($phone),
            'type' => 'template',
            'template' => [
                'name' => $name,
                'language' => ['code' => config('whatsapp.cloud.language', 'es')],
                'components' => $components,
            ],
        ]);
    }

    private static function cloudPost(array $payload): array
    {
        $cfg = config('whatsapp.cloud');
        if (empty($cfg['phone_number_id']) || empty($cfg['token'])) {
            return ['ok' => false, 'retry' => false, 'error' => 'Faltan WHATSAPP_CLOUD_PHONE_NUMBER_ID / WHATSAPP_CLOUD_TOKEN en el .env'];
        }
        $url = "https://graph.facebook.com/{$cfg['graph_version']}/{$cfg['phone_number_id']}/messages";

        try {
            $res = Http::withToken($cfg['token'])->timeout(20)->post($url, ['messaging_product' => 'whatsapp'] + $payload);
        } catch (ConnectionException $e) {
            // Couldn't connect: nothing sent. A timeout after connecting may have been sent.
            $notConnected = str_contains($e->getMessage(), 'cURL error 6') || str_contains($e->getMessage(), 'cURL error 7');
            return ['ok' => false, 'retry' => $notConnected, 'uncertain' => !$notConnected, 'retry_after' => 300, 'error' => $e->getMessage()];
        }

        if ($res->successful()) {
            return ['ok' => true, 'id' => $res->json('messages.0.id')];
        }

        $code = (int) $res->json('error.code');
        $message = $res->json('error.error_data.details') ?: $res->json('error.message') ?: $res->body();
        // Rate limits / temporary problems on Meta's side: try again later
        $retry = $res->serverError() || in_array($code, [4, 80007, 130429, 131016, 131048, 131056], true);
        Log::warning("[WhatsApp Cloud] {$code}: {$message}");

        return ['ok' => false, 'retry' => $retry, 'retry_after' => 900, 'code' => $code, 'error' => "{$code}: {$message}"];
    }

    // Public URL as a link; a local file (event photo stored on the server) is uploaded to Meta first
    private static function mediaRef(string $media): ?array
    {
        if (preg_match('#^https?://#i', $media)) {
            return ['link' => $media];
        }
        if (!is_file($media)) {
            return null;
        }

        $cfg = config('whatsapp.cloud');
        try {
            $res = Http::withToken($cfg['token'])->timeout(60)
                ->attach('file', fopen($media, 'r'), basename($media))
                ->post("https://graph.facebook.com/{$cfg['graph_version']}/{$cfg['phone_number_id']}/media", [
                    'messaging_product' => 'whatsapp',
                    'type' => mime_content_type($media) ?: 'image/jpeg',
                ]);
            if ($res->successful() && $res->json('id')) {
                return ['id' => $res->json('id')];
            }
            Log::warning('[WhatsApp Cloud] No se pudo subir la imagen: ' . $res->body());
        } catch (\Throwable $e) {
            Log::warning('[WhatsApp Cloud] No se pudo subir la imagen: ' . $e->getMessage());
        }
        return null;
    }

    // Meta rejects template parameters with line breaks, tabs or 4+ spaces in a row
    private static function templateParam($value): string
    {
        $text = preg_replace('/\s*[\r\n\t]+\s*/u', ' · ', trim((string) $value));
        $text = preg_replace('/ {2,}/', ' ', $text);
        $text = mb_substr($text, 0, 1000);
        return $text !== '' ? $text : '-';
    }

    private static function firstName(Guest $guest): string
    {
        return trim(explode(' ', trim($guest->name))[0]) ?: $guest->name;
    }

    private static function digits(string $phone): string
    {
        return preg_replace('/[^\d]/', '', $phone);
    }
}
