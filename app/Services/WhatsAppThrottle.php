<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Contracts\Cache\Lock;
use Illuminate\Support\Facades\Cache;

/**
 * Paces automated WhatsApp messages per session (one session = one phone number)
 * to reduce the risk of the number being banned: random gaps between messages,
 * longer breaks after bursts, a daily cap and a sending window.
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

    public static function sessionForEvent($event): string
    {
        return $event && $event->user_id ? "planner_{$event->user_id}" : 'default';
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

        $windowWait = $this->secondsUntilWindowOpens($now);
        if ($windowWait > 0) {
            return $windowWait;
        }

        if ($this->sentToday() >= config('whatsapp.daily_limit')) {
            $tomorrowOpen = $now->copy()->addDay()->startOfDay()->setHour(config('whatsapp.window_start'));
            return max(60, (int) $now->diffInSeconds($tomorrowOpen, false) + random_int(0, 600));
        }

        $nextAt = Cache::get("wa:{$this->sessionId}:next_at");
        return $nextAt ? max(0, $nextAt - $now->timestamp) : 0;
    }

    /**
     * Human-readable reason for the current wait, for API responses.
     */
    public function waitReason(): string
    {
        if ($this->secondsUntilWindowOpens(now()) > 0) {
            return sprintf('Fuera del horario de envío (%02d:00 a %02d:00).', config('whatsapp.window_start'), config('whatsapp.window_end'));
        }
        if ($this->sentToday() >= config('whatsapp.daily_limit')) {
            return 'Se alcanzó el límite diario de ' . config('whatsapp.daily_limit') . ' mensajes para este número. Se reanuda mañana.';
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

        if ($burst >= config('whatsapp.burst_size')) {
            $gap = config('whatsapp.burst_pause') + random_int(0, 120);
            $burst = 0;
        } else {
            $gap = random_int(config('whatsapp.min_delay'), config('whatsapp.max_delay'));
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

    private function secondsUntilWindowOpens(Carbon $now): int
    {
        $start = config('whatsapp.window_start');
        $end = config('whatsapp.window_end');

        if ($now->hour >= $start && $now->hour < $end) {
            return 0;
        }

        $open = $now->copy()->startOfDay()->setHour($start);
        if ($now->hour >= $end) {
            $open->addDay();
        }

        // Spread the restart so queued messages don't all fire at opening time
        return (int) $now->diffInSeconds($open, false) + random_int(0, 900);
    }
}
