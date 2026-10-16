<?php

namespace App\Services;

use Illuminate\Contracts\Cache\Lock;
use Illuminate\Support\Facades\Cache;

/**
 * Paces automated WhatsApp messages per session (one session = one phone number)
 * to reduce the risk of the number being banned: random gaps between messages,
 * longer breaks after bursts and a daily cap (at any hour of the day).
 */
class WhatsAppThrottle
{
    public function __construct(private string $sessionId)
    {
    }

    public static function forSession(string $sessionId): self
    {
        return new self($sessionId);
    }

    /**
     * Random pause in seconds between two values of the config, tolerant to a bad .env (only the minimum
     * set, or both swapped): never fails, the pause just uses the bigger value as the top.
     */
    public static function randomGap(string $minKey = 'whatsapp.min_delay', string $maxKey = 'whatsapp.max_delay'): int
    {
        $a = max(0, (int) config($minKey));
        $b = max(0, (int) config($maxKey));
        return random_int(min($a, $b), max($a, $b));
    }

    // Average pause (for the estimates shown in the panel)
    public static function averageGap(): float
    {
        return ((int) config('whatsapp.min_delay') + (int) config('whatsapp.max_delay')) / 2;
    }

    // Bot session of an event (the Baileys bot paces each planner separately)
    public static function sessionForEvent($event): string
    {
        return $event && $event->user_id ? "planner_{$event->user_id}" : 'default';
    }

    // Official Cloud API: one number for everyone, one shared pace and daily limit
    public static function forChannel(string $channel, $event): self
    {
        return new self($channel === 'cloud' ? 'cloud' : self::sessionForEvent($event));
    }

    private function isCloud(): bool
    {
        return $this->sessionId === 'cloud';
    }

    private function dailyLimit(): int
    {
        return (int) config($this->isCloud() ? 'whatsapp.cloud_daily_limit' : 'whatsapp.daily_limit');
    }

    /**
     * Lock that serializes sending for this session, so two queue workers never
     * send from the same number at once. Returns null if it's already taken.
     */
    public function lock(): ?Lock
    {
        $lock = Cache::lock("wa:{$this->sessionId}:lock", 60);
        return $lock->get() ? $lock : null;
    }

    /**
     * Seconds to wait before the next message may go out (0 = send now).
     */
    public function secondsUntilAllowed(): int
    {
        $now = now();

        // No time-of-day restriction: messages go out at any hour, only paced and within the daily limit
        if ($this->sentToday() >= $this->dailyLimit()) {
            $tomorrow = $now->copy()->addDay()->startOfDay();
            return max(60, (int) $now->diffInSeconds($tomorrow, false) + random_int(0, 600));
        }

        $nextAt = Cache::get("wa:{$this->sessionId}:next_at");
        return $nextAt ? max(0, $nextAt - $now->timestamp) : 0;
    }

    /**
     * Human-readable reason for the current wait, for API responses.
     */
    public function waitReason(): string
    {
        if ($this->sentToday() >= $this->dailyLimit()) {
            return 'Se alcanzó el límite diario de ' . $this->dailyLimit() . ' mensajes para este número. Se reanuda mañana.';
        }
        return 'Pausa anti-bloqueo entre mensajes.';
    }

    public function recordSent(): void
    {
        $dayKey = $this->dayKey();
        Cache::add($dayKey, 0, now()->addDays(2));
        Cache::increment($dayKey);

        $burstKey = "wa:{$this->sessionId}:burst";
        $burst = (int) Cache::get($burstKey, 0) + 1;

        if ($this->isCloud()) {
            $gap = self::randomGap('whatsapp.cloud_min_delay', 'whatsapp.cloud_max_delay');
        } elseif ($burst >= config('whatsapp.burst_size')) {
            $gap = config('whatsapp.burst_pause') + random_int(0, 120);
            $burst = 0;
        } else {
            $gap = self::randomGap();
        }

        Cache::put($burstKey, $burst, now()->addHours(6));
        Cache::put("wa:{$this->sessionId}:next_at", now()->timestamp + $gap, now()->addDay());
    }

    public function sentToday(): int
    {
        return (int) Cache::get($this->dayKey(), 0);
    }

    private function dayKey(): string
    {
        return "wa:{$this->sessionId}:day:" . now()->format('Ymd');
    }
}
