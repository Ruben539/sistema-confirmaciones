<?php

namespace App\Services;

use App\Models\Event;
use App\Models\Guest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class EventMilestoneService
{
    /**
     * Check if the event has reached any new confirmation milestone and notify the planner.
     */
    public static function checkMilestone(Event|int $event): void
    {
        try {
            if (is_numeric($event)) {
                $event = Event::with('planner')->find($event);
            } else {
                $event->loadMissing('planner');
            }

            if (!$event || !$event->planner || empty($event->planner->phone)) {
                return;
            }

            $totalGuests = Guest::where('event_id', $event->id)->count();
            if ($totalGuests < 4) {
                // Need a representative list size before celebrating percentage milestones
                return;
            }

            $confirmedGuests = Guest::where('event_id', $event->id)
                ->whereIn('status', ['confirmed', 'attended'])
                ->count();

            $pendingGuests = Guest::where('event_id', $event->id)
                ->where('status', 'pending')
                ->count();

            $pct = round(($confirmedGuests / $totalGuests) * 100);

            // Milestones descending so we pick the highest newly reached
            $milestoneLevels = [100, 90, 75, 50, 25];

            $notified = $event->milestones_notified ?? [];
            if (!is_array($notified)) {
                $notified = json_decode($notified, true) ?? [];
            }

            foreach ($milestoneLevels as $threshold) {
                if ($pct >= $threshold && !in_array($threshold, $notified)) {
                    self::sendMilestoneNotification($event, $threshold, $confirmedGuests, $pendingGuests, $totalGuests);
                    
                    $notified[] = $threshold;

                    if (Schema::hasColumn('events', 'milestones_notified')) {
                        $event->milestones_notified = array_unique($notified);
                        $event->saveQuietly();
                    }
                    break;
                }
            }
        } catch (\Exception $e) {
            Log::warning("Error checking event milestones for Event #{$event->id}: " . $e->getMessage());
        }
    }

    private static function sendMilestoneNotification(Event $event, int $threshold, int $confirmed, int $pending, int $total): void
    {
        $planner = $event->planner;
        $eventTitle = $event->couple_names ?? $event->title;
        $cleanPhone = self::formatPhone($planner->phone);

        $dietaryCount = Guest::where('event_id', $event->id)
            ->whereNotNull('dietary_restrictions')
            ->whereNotIn('dietary_restrictions', ['Ninguna', 'ninguna', 'Sin restricciones', 'normal', 'no', ''])
            ->count();

        $message = match ($threshold) {
            25 => "🎯 *¡PRIMER HITO ALCANZADO! (25% CONFIRMADO)* 🥂\n\n"
                . "¡Hola {$planner->name}! Tu evento *{$eventTitle}* ya alcanzó el *25%* de confirmaciones ({$confirmed} de {$total} invitados).\n\n"
                . "📊 *Estado Actual:*\n"
                . "✅ Confirmados: *{$confirmed}*\n"
                . "⏳ Pendientes de responder: *{$pending}*\n\n"
                . "💡 *Tip Pro de Organización:*\n"
                . "Excelente arranque. Podés enviar un primer recordatorio amable a los invitados que aún no hayan abierto su invitación para mantener el ritmo alto.",

            50 => "🔥 *¡MITAD DEL CAMINO! (50% CONFIRMADO)* 💍✨\n\n"
                . "¡Gran avance, {$planner->name}! El *50%* de la lista de *{$eventTitle}* ya confirmó su presencia ({$confirmed} de {$total} invitados).\n\n"
                . "📊 *Estado Actual:*\n"
                . "✅ Confirmados: *{$confirmed}*\n"
                . ($dietaryCount > 0 ? "🍽️ Menús especiales detectados: *{$dietaryCount}*\n" : "")
                . "⏳ Restan responder: *{$pending}*\n\n"
                . "💡 *Tip Pro de Organización:*\n"
                . "¡Momento clave! Ya contás con masa crítica para comenzar a diseñar el primer borrador de la mesa principal y familiares en el plano visual de mesas.",

            75 => "🚀 *¡TRES CUARTOS DE LISTA! (75% CONFIRMADO)* 🌟\n\n"
                . "¡Impresionante ritmo, {$planner->name}! El *75%* de los invitados de *{$eventTitle}* ya están confirmados ({$confirmed} de {$total} personas).\n\n"
                . "📊 *Estado Actual:*\n"
                . "✅ Confirmados: *{$confirmed}*\n"
                . ($dietaryCount > 0 ? "🍽️ Menús especiales: *{$dietaryCount}*\n" : "")
                . "⏳ Solo faltan: *{$pending}* invitados\n\n"
                . "💡 *Tip Pro de Organización:*\n"
                . "Es el momento ideal para coordinar con el servicio de catering las cantidades preliminares y los requerimientos de dietas (celíacos, vegetarianos).",

            90 => "⚡ *¡RECTA FINAL! (90% CONFIRMADO)* 🎪\n\n"
                . "¡Casi todo listo, {$planner->name}! El *90%* de los invitados de *{$eventTitle}* ya han respondido ({$confirmed} de {$total} personas).\n\n"
                . "📊 *Estado Actual:*\n"
                . "✅ Confirmados: *{$confirmed}*\n"
                . "⏳ Restan solo: *{$pending}* personas\n\n"
                . "💡 *Tip Pro de Organización:*\n"
                . "¡Estás en la recta final! Ya podés cerrar la distribución casi definitiva de mesas y preparar la acreditación con código QR para el día del evento.",

            100 => "🏆 *¡MISIÓN CUMPLIDA! (100% DE ASISTENCIA DEFINIDA)* 🥂🎉\n\n"
                . "¡Felicitaciones, {$planner->name}! La totalidad de los invitados de *{$eventTitle}* han respondido su invitación ({$confirmed} confirmados de {$total} invitados).\n\n"
                . "📊 *Resumen Final:*\n"
                . "✅ Asistencias confirmadas: *{$confirmed}*\n"
                . ($dietaryCount > 0 ? "🍽️ Menús especiales totales: *{$dietaryCount}*\n" : "")
                . "\n💡 *Tip Pro de Organización:*\n"
                . "La lista está 100% cerrada. Ya podés imprimir las tarjetas de ubicación de mesas y exportar el listado final para el equipo de recepción en puerta. ¡Impecable trabajo de producción! 👏✨",

            default => null,
        };

        if (!$message) return;

        $botUrl = env('WHATSAPP_BOT_URL', 'http://127.0.0.1:3001/lead');
        try {
            Http::timeout(8)->post($botUrl, [
                'phone' => preg_replace('/[^\d]/', '', $cleanPhone),
                'message' => $message
            ]);
            Log::info("Milestone WhatsApp sent to planner {$planner->name} for event '{$eventTitle}' at {$threshold}%");
        } catch (\Exception $e) {
            Log::warning("Error sending milestone WhatsApp to planner: " . $e->getMessage());
        }
    }

    private static function formatPhone($phone): string
    {
        $digits = preg_replace('/[^\d]/', '', $phone);
        if (empty($digits)) return '';

        if (str_starts_with($digits, '09') && strlen($digits) === 10) {
            return '595' . substr($digits, 1);
        }
        if (str_starts_with($digits, '9') && strlen($digits) === 9) {
            return '595' . $digits;
        }
        if (str_starts_with($digits, '595')) {
            return $digits;
        }
        if (strlen($digits) >= 9) {
            $last9 = substr($digits, -9);
            if (str_starts_with($last9, '9')) {
                return '595' . $last9;
            }
        }
        return $digits;
    }
}
