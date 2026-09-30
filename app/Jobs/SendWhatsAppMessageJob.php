<?php

namespace App\Jobs;

use App\Models\Guest;
use App\Services\WhatsAppMessage;
use App\Services\WhatsAppThrottle;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SendWhatsAppMessageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 30;

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

        $throttle = WhatsAppThrottle::forSession(WhatsAppThrottle::sessionForEvent($event));

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

            $this->send($guest, $throttle);
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
        if ($this->messageMode === 'reminder') {
            // Guest answered in the meantime: no reminder needed
            return $guest->status !== 'pending';
        }
        return $guest->whatsapp_status === 'sent';
    }

    private function send(Guest $guest, WhatsAppThrottle $throttle): void
    {
        $cleanPhone = preg_replace('/[^\d]/', '', $guest->phone);

        try {
            $response = Http::timeout(10)->post(config('whatsapp.bot_url'), [
                'phone' => $cleanPhone,
                'message' => WhatsAppMessage::build($guest, $this->messageMode),
                'session_id' => WhatsAppThrottle::sessionForEvent($guest->event),
            ]);
        } catch (ConnectionException $e) {
            if (str_contains($e->getMessage(), 'cURL error 7')) {
                // Bot not reachable: nothing was sent, safe to retry later
                Log::warning("WhatsApp Job: bot unreachable, retrying {$guest->name} in 5 min.");
                $this->release(300);
                return;
            }

            // Timeout: the bot may have sent it anyway. Don't retry to avoid a duplicate message.
            $throttle->recordSent();
            Log::warning("WhatsApp Job: timeout sending to {$guest->name} ({$cleanPhone}); not retrying to avoid a duplicate. Check manually. " . $e->getMessage());
            return;
        }

        if ($response->successful()) {
            $throttle->recordSent();
            if ($this->messageMode === 'reminder') {
                $guest->update(['reminder_sent_at' => now()]);
            } else {
                $guest->update([
                    'whatsapp_status' => 'sent',
                    'last_sent_at' => now(),
                ]);
            }
            Log::info("WhatsApp Job: Sent {$this->messageMode} to {$guest->name} ({$cleanPhone})");
            return;
        }

        if ($response->serverError()) {
            // Bot up but session disconnected / busy: retry later
            Log::warning("WhatsApp Job: bot error for {$guest->name}, retrying in 10 min: " . $response->body());
            $this->release(600);
            return;
        }

        Log::warning("WhatsApp Job: rejected for {$guest->name}: " . $response->body());
        $this->clearReminderMark($guest);
    }

    private function clearReminderMark(Guest $guest): void
    {
        if ($this->messageMode === 'reminder' && $guest->reminder_sent_at) {
            $guest->update(['reminder_sent_at' => null]);
        }
    }
}
