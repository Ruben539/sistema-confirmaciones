<?php

namespace App\Jobs;

use App\Models\Guest;
use App\Services\WhatsAppGateway;
use App\Services\WhatsAppMessage;
use App\Services\WhatsAppThrottle;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class SendWhatsAppMessageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    // Below the queue retry_after (90 s), or a slow send would run twice
    public $timeout = 85;

    // Releases for throttling don't count as failures; only real exceptions do
    public $maxExceptions = 3;

    protected $guestId;
    protected $messageMode;
    protected $queuedAt;

    public function __construct($guestId, $messageMode = 'invitation')
    {
        $this->guestId = $guestId;
        $this->messageMode = $messageMode;
        $this->queuedAt = now()->timestamp;
    }

    /**
     * Throttled messages may wait for the daily limit / sending window, so keep
     * retrying for a few days instead of a fixed number of attempts.
     */
    public function retryUntil()
    {
        return now()->addDays(3);
    }

    public static function cancelKey($eventId): string
    {
        return "wa:cancel:event:{$eventId}";
    }

    public function handle(): void
    {
        $guest = Guest::with('event')->find($this->guestId);

        if (!$guest) {
            Log::warning("WhatsApp Job: Guest ID {$this->guestId} not found.");
            return;
        }

        $event = $guest->event;

        if ($event && !$event->isActive()) {
            Log::info("WhatsApp Job: Event ID {$event->id} is inactive, disabled, or past date. Skipping guest {$guest->name}.");
            return;
        }

        // Bulk send cancelled by the planner after this job was queued
        if ((int) Cache::get(self::cancelKey($guest->event_id), 0) >= $this->queuedAt) {
            Log::info("WhatsApp Job: Bulk send cancelled for event {$guest->event_id}. Skipping guest {$guest->name}.");
            $this->clearReminderMark($guest);
            return;
        }

        // Which number writes: the guest's own, or by the event (auto = the bot up to its daily quota).
        // The QR pass goes to someone who already talks to us: their number, outside the first-message quota.
        $toKnownGuest = in_array($this->messageMode, ['pass', 'correction'], true);
        $channel = $toKnownGuest
            ? WhatsAppGateway::channelFor($guest)
            : WhatsAppGateway::channelForInvitation($guest);
        if (!$toKnownGuest && $channel === 'baileys' && WhatsAppGateway::baileysQuotaLeft() === 0) {
            // The bot already wrote first to as many people as is safe today
            $tomorrow = now()->addDay()->startOfDay();
            $this->release(max(60, (int) now()->diffInSeconds($tomorrow, false) + random_int(0, 900)));
            return;
        }
        $throttle = WhatsAppThrottle::forChannel($channel, $event);

        // Only one message at a time per phone number, even with several workers
        $lock = $throttle->lock();
        if (!$lock) {
            $this->release(random_int(15, 45));
            return;
        }

        try {
            $wait = $throttle->secondsUntilAllowed();
            if ($wait > 0) {
                $this->release($wait);
                return;
            }

            // Re-check after waiting: a duplicate job may already have sent it
            $guest->refresh();
            if ($this->alreadyHandled($guest)) {
                return;
            }

            $this->send($guest, $throttle, $channel);
        } finally {
            $lock->release();
        }
    }

    public function failed(\Throwable $e): void
    {
        $guest = Guest::find($this->guestId);
        if ($guest) {
            // Let the next reminder run pick it up again
            $this->clearReminderMark($guest);
        }
        Log::error("WhatsApp Job failed for guest {$this->guestId}: " . $e->getMessage());
    }

    private function alreadyHandled(Guest $guest): bool
    {
        if ($this->messageMode === 'correction') {
            // Apology with the right number of people: only to guests who confirmed, and once (the same
            // correction queued twice, e.g. the button pressed again, goes out one time)
            return !in_array($guest->status, ['confirmed', 'attended'], true)
                || Cache::has("count_fix_done:{$guest->id}");
        }
        if ($this->messageMode === 'pass') {
            // QR with a corrected amount: only while it is still pending and the guest is still confirmed
            return $guest->pending_correction_from === null || !in_array($guest->status, ['confirmed', 'attended'], true);
        }
        if ($this->messageMode === 'reminder') {
            // Guest answered in the meantime: no reminder needed
            if ($guest->status !== 'pending') {
                return true;
            }
            // A newer reminder was queued or sent after this one (job delayed longer than the interval)
            if ($guest->reminder_sent_at && $guest->reminder_sent_at->timestamp > $this->queuedAt) {
                return true;
            }
            // The throttle may have delayed it past the RSVP deadline: a reminder no longer makes sense
            $deadline = $guest->event?->rsvpDeadline();
            return $deadline !== null && now()->greaterThan($deadline);
        }
        return $guest->whatsapp_status === 'sent';
    }

    private function send(Guest $guest, WhatsAppThrottle $throttle, string $channel, bool $allowFallback = true): void
    {
        if ($this->messageMode === 'correction') {
            $text = \App\Services\GuestMessages::countCorrection($guest, $guest->event);
            $result = WhatsAppGateway::sendText($guest->phone, $text, null, [
                'channel' => $channel,
                'session_id' => WhatsAppThrottle::sessionForEvent($guest->event),
                'name' => trim(explode(' ', trim($guest->name))[0]),
            ]);
            if ($result['ok']) {
                $throttle->recordSent();
                \App\Models\GuestMessage::logOutgoing($guest, $text);
                \App\Models\GuestActivity::record($guest, 'count_corrected', "Se le envió la cantidad correcta ({$guest->passes} personas) con una disculpa");
                Cache::put("count_fix_done:{$guest->id}", true, now()->addHours(12));
                if ($guest->pending_correction_from !== null) {
                    $guest->update(['pending_correction_from' => null]);
                }
            } elseif (!empty($result['retry']) && empty($result['uncertain'])) {
                $this->release($result['retry_after'] ?? 600);
            } else {
                Log::warning("WhatsApp Job: count correction not sent to {$guest->name}: " . ($result['error'] ?? ''));
            }
            return;
        }

        if ($this->messageMode === 'pass') {
            // Same pass as the "Reenviar QR" button (it logs the message / activity and clears the correction)
            app(\App\Http\Controllers\GuestController::class)->sendWhatsAppQrPass($guest, true);
            $throttle->recordSent();
            return;
        }

        $cleanPhone = preg_replace('/[^\d]/', '', $guest->phone);

        $mediaUrl = null;
        if (!empty($guest->event?->cover_photo_path)) {
            $disk = \Illuminate\Support\Facades\Storage::disk('public');
            if ($disk->exists($guest->event->cover_photo_path)) {
                $mediaUrl = $disk->path($guest->event->cover_photo_path);
            } elseif ($guest->event->cover_photo_url) {
                $mediaUrl = $guest->event->cover_photo_url;
            }
        }

        // Through the bot, no automatic Maps link: links to people who don't have the number saved are what
        // gets reported as spam
        $message = WhatsAppMessage::build($guest, $this->messageMode, $channel === 'cloud');
        $result = WhatsAppGateway::sendInvitation($guest, $this->messageMode, $message, $mediaUrl, WhatsAppThrottle::sessionForEvent($guest->event), $channel);

        // "Auto" event and the bot is down / disconnected: send it through the official API instead of waiting
        if (!$result['ok'] && !empty($result['retry']) && empty($result['uncertain']) && $allowFallback
            && $channel === 'baileys' && !$guest->whatsapp_channel
            && ($guest->event?->whatsapp_channel ?: 'auto') === 'auto' && WhatsAppGateway::cloudConfigured()) {
            Log::info("WhatsApp Job: bot unavailable, sending {$guest->name} through the official API.");
            $this->send($guest, WhatsAppThrottle::forChannel('cloud', $guest->event), 'cloud', false);
            return;
        }

        if (!$result['ok'] && !empty($result['uncertain'])) {
            // Timeout: it may have been sent anyway. Don't retry to avoid a duplicate message.
            $throttle->recordSent();
            \App\Models\GuestActivity::record($guest, 'send_uncertain', ($this->messageMode === 'reminder' ? 'Recordatorio' : 'Invitación') . ': WhatsApp tardó en responder, puede que no se haya enviado');
            Log::warning("WhatsApp Job: timeout sending to {$guest->name} ({$cleanPhone}); not retrying to avoid a duplicate. Check manually. " . ($result['error'] ?? ''));
            return;
        }

        if ($result['ok']) {
            $throttle->recordSent();
            if ($channel === 'baileys') {
                WhatsAppGateway::countBaileysColdSend();
            }
            \App\Models\GuestMessage::logOutgoing($guest, $channel === 'cloud' && $this->messageMode !== 'reminder'
                ? "[Saludo con botón «Ver invitación»]\n\n" . $message
                : $message);
            if ($this->messageMode === 'reminder') {
                $guest->update([
                    'reminder_sent_at' => now(),
                    'reminder_count' => (int) $guest->reminder_count + 1,
                    'whatsapp_channel' => $channel,
                    // The reminder says the current places: the correction is done
                    'pending_correction_from' => null,
                ]);
            } else {
                $guest->update([
                    'whatsapp_status' => 'sent',
                    'last_sent_at' => now(),
                    'whatsapp_channel' => $channel,
                ]);
            }
            Log::info("WhatsApp Job: Sent {$this->messageMode} to {$guest->name} ({$cleanPhone}) via {$channel}");
            return;
        }

        if (!empty($result['retry'])) {
            // Bot down / session disconnected / Meta rate limit: nothing was sent, try again later
            Log::warning("WhatsApp Job: could not send to {$guest->name}, retrying in " . ($result['retry_after'] ?? 600) . "s: " . ($result['error'] ?? ''));
            $this->release($result['retry_after'] ?? 600);
            return;
        }

        Log::warning("WhatsApp Job: rejected for {$guest->name}: " . ($result['error'] ?? ''));
        \App\Models\GuestActivity::record($guest, $this->messageMode === 'reminder' ? 'reminder_failed' : 'invitation_failed', 'El WhatsApp del sistema rechazó el envío (revisar el número)');
        $this->clearReminderMark($guest);
    }

    private function clearReminderMark(Guest $guest): void
    {
        if ($this->messageMode === 'reminder' && $guest->reminder_sent_at) {
            $guest->update(['reminder_sent_at' => null]);
        }
    }
}
