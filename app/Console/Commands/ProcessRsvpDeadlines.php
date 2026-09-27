<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Event;
use App\Models\Guest;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ProcessRsvpDeadlines extends Command
{
    protected $signature = 'rsvp:process-deadlines';
    protected $description = 'Envía un recordatorio 1 día antes del límite de confirmación y autocancela los invitados no confirmados una vez expirado el plazo.';

    public function handle()
    {
        $this->info('Iniciando procesamiento de plazos y recordatorios de confirmación...');

        $events = Event::whereNotNull('event_date')
            ->whereIn('status', ['active', 'confirmed'])
            ->get();

        $remindersCount = 0;
        $autoDeclinedCount = 0;

        foreach ($events as $event) {
            $deadlineDays = $event->rsvp_deadline_days ?? 7;
            $eventDate = Carbon::parse($event->event_date)->startOfDay();
            $deadlineDate = $eventDate->copy()->subDays($deadlineDays)->endOfDay();
            $reminderStartDate = $deadlineDate->copy()->subDay()->startOfDay();

            // 1. Escenario A: El plazo límite HA VENCIDO -> Autocancelar pendientes
            if (now()->greaterThan($deadlineDate) && ($event->auto_decline_expired ?? true)) {
                $pendingGuests = Guest::where('event_id', $event->id)
                    ->where('status', 'pending')
                    ->get();

                foreach ($pendingGuests as $guest) {
                    $oldNote = $guest->notes ? $guest->notes . ' | ' : '';
                    $guest->update([
                        'status' => 'declined',
                        'notes' => $oldNote . 'Cancelado automáticamente por plazo de confirmación vencido (' . $deadlineDate->format('d/m/Y') . ')',
                        'confirmed_adults' => 0,
                        'confirmed_youth' => 0,
                        'confirmed_children' => 0,
                        'confirmed_passes' => 0,
                    ]);
                    $autoDeclinedCount++;
                }
            }

            // 2. Escenario B: Faltan 1 día o menos para el vencimiento (y aún no ha pasado el plazo) -> Enviar recordatorio
            if (now()->greaterThanOrEqualTo($reminderStartDate) && now()->lessThanOrEqualTo($deadlineDate) && $event->is_enabled) {
                $guestsToRemind = Guest::where('event_id', $event->id)
                    ->where('status', 'pending')
                    ->whereNull('reminder_sent_at')
                    ->get();

                $botUrl = env('WHATSAPP_BOT_URL', 'http://127.0.0.1:3001/lead');
                $coupleNames = $event->couple_names ?? $event->title;

                foreach ($guestsToRemind as $guest) {
                    $message = "¡Hola {$guest->name}! ⏰ Te recordamos que el plazo para confirmar tu asistencia a la boda de {$coupleNames} vence pronto ({$deadlineDate->format('d/m/Y')}).\n\nPor favor, respondé a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir";

                    try {
                        $response = Http::timeout(10)->post($botUrl, [
                            'phone' => preg_replace('/[^\d]/', '', $guest->phone),
                            'message' => $message
                        ]);

                        if ($response->successful()) {
                            $guest->update(['reminder_sent_at' => now()]);
                            $remindersCount++;
                        }
                    } catch (\Exception $e) {
                        Log::warning("Error al enviar recordatorio WhatsApp a {$guest->name}: " . $e->getMessage());
                    }
                }
            }
        }

        $this->info("Procesamiento completado: {$remindersCount} recordatorios enviados, {$autoDeclinedCount} invitados autocancelados.");
        return 0;
    }
}
