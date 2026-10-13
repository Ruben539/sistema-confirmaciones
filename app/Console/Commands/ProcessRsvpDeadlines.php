<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Event;
use App\Models\Guest;
use App\Jobs\SendWhatsAppMessageJob;
use Carbon\Carbon;

class ProcessRsvpDeadlines extends Command
{
    protected $signature = 'rsvp:process-deadlines';
    protected $description = 'Envía un recordatorio 1 día antes del límite de confirmación y autocancela los invitados no confirmados una vez expirado el plazo.';

    public function handle()
    {
        $this->info('Iniciando procesamiento de plazos y recordatorios de confirmación...');

        $events = Event::where(fn ($q) => $q->whereNotNull('event_date')->orWhereNotNull('rsvp_deadline_date'))
            ->whereIn('status', ['active', 'confirmed'])
            ->get();

        $remindersCount = 0;
        $autoDeclinedCount = 0;

        foreach ($events as $event) {
            $deadlineDate = $event->rsvpDeadline();

            // 1. Escenario A: El plazo límite HA VENCIDO -> Autocancelar pendientes
            if (now()->greaterThan($deadlineDate) && ($event->auto_decline_expired ?? true)) {
                $pendingGuests = Guest::where('event_id', $event->id)
                    ->where('status', 'pending')
                    ->get();

                foreach ($pendingGuests as $guest) {
                    $oldNote = $guest->notes ? $guest->notes . ' | ' : '';
                    \App\Models\GuestActivity::withContext(['via' => 'deadline'], fn () => $guest->update([
                        'status' => 'declined',
                        'notes' => $oldNote . 'Cancelado automáticamente por plazo de confirmación vencido (' . $deadlineDate->format('d/m/Y') . ')',
                        'confirmed_adults' => 0,
                        'confirmed_youth' => 0,
                        'confirmed_children' => 0,
                        'confirmed_passes' => 0,
                    ]));
                    $autoDeclinedCount++;
                }
            }

            // 2. Escenario B: Plazo vigente -> Enviar recordatorios según la frecuencia configurada en el evento
            if (now()->lessThanOrEqualTo($deadlineDate) && $event->is_enabled) {
                $guestsToRemind = $this->guestsDueForReminder($event, $deadlineDate);

                // Queue reminders through the throttled job (per-number pacing, daily limit,
                // sending window) instead of firing them all at once
                $delay = 0;
                foreach ($guestsToRemind as $guest) {
                    // Mark as queued so the next run doesn't queue it again; the job clears it if it fails
                    $guest->update(['reminder_sent_at' => now()]);
                    SendWhatsAppMessageJob::dispatch($guest->id, 'reminder')->delay(now()->addSeconds($delay));
                    $delay += random_int(config('whatsapp.min_delay'), config('whatsapp.max_delay'));
                    $remindersCount++;
                }
            }
        }

        $this->info("Procesamiento completado: {$remindersCount} recordatorios programados, {$autoDeclinedCount} invitados autocancelados.");
        return 0;
    }

    /**
     * Invitados pendientes a los que les toca un recordatorio en esta ejecución.
     * - reminder_interval_days null: un solo recordatorio desde el día anterior al límite (comportamiento original).
     * - 0: el evento no envía recordatorios.
     * - N: cada N días desde la invitación o el último recordatorio, hasta reminder_max_count por invitado.
     */
    private function guestsDueForReminder(Event $event, Carbon $deadlineDate)
    {
        $interval = $event->reminder_interval_days;

        if ($interval === 0) {
            return collect();
        }

        $query = Guest::where('event_id', $event->id)->where('status', 'pending');

        if ($interval === null) {
            if (now()->lessThan($deadlineDate->copy()->subDay()->startOfDay())) {
                return collect();
            }
            return $query->whereNull('reminder_sent_at')->get();
        }

        // Solo a quienes ya recibieron la invitación: el intervalo se cuenta desde el último contacto
        $cutoff = now()->subDays($interval);

        return $query
            ->where('whatsapp_status', 'sent')
            ->where('reminder_count', '<', $event->reminder_max_count ?? 3)
            ->where(function ($q) use ($cutoff) {
                $q->where(fn ($q) => $q->whereNull('reminder_sent_at')->where('last_sent_at', '<=', $cutoff))
                  ->orWhere('reminder_sent_at', '<=', $cutoff);
            })
            ->get();
    }
}
