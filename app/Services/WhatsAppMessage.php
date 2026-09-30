<?php

namespace App\Services;

use App\Models\Guest;
use Carbon\Carbon;

/**
 * Builds the invitation / reminder text sent to a guest, shared by the queue job
 * and the single "send now" endpoint so both produce the same message.
 */
class WhatsAppMessage
{
    // Greeting variations so bulk sends aren't byte-identical (anti-spam)
    private const GREETINGS = [
        '¡Hola {nombre}! 👋',
        '¡Buenas {nombre}! 👋',
        '¡Hola {nombre}, qué tal! 👋',
        '¡Hola {nombre}! Espero que estés muy bien 👋',
    ];

    public static function build(Guest $guest, string $mode = 'invitation'): string
    {
        $event = $guest->event;
        $greeting = self::GREETINGS[array_rand(self::GREETINGS)];

        if ($mode === 'reminder') {
            $deadline = self::deadlineText($event);
            $template = "{$greeting} ⏰ Recordatorio: el plazo para confirmar tu asistencia al evento de {pareja} vence pronto{$deadline}.\n📍 Lugar: {lugar}\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir";
        } else {
            $template = $event->message_template ?? "{$greeting} Te invitamos al evento de {pareja} ✨\n📍 Lugar: {lugar}\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir";
            if (!str_contains($template, '{nombre}')) {
                $template = "{$greeting}\n" . $template;
            }
        }

        $rawLocation = $event->location ?? 'Por confirmar';
        if ($rawLocation !== 'Por confirmar' && !str_starts_with($rawLocation, 'http')) {
            $formattedLocation = $rawLocation . "\n🗺️ Ver en Google Maps: https://maps.google.com/?q=" . urlencode($rawLocation);
        } else {
            $formattedLocation = $rawLocation;
        }

        return str_replace(
            ['{nombre}', '{pareja}', '{lugar}', '{link}'],
            [$guest->name, $event->couple_names ?? $event->title, $formattedLocation, url('/confirmar/' . $guest->token)],
            $template
        );
    }

    private static function deadlineText($event): string
    {
        if (!$event->event_date) {
            return '';
        }
        $deadline = Carbon::parse($event->event_date)->subDays($event->rsvp_deadline_days ?? 7);
        return ' (' . $deadline->format('d/m/Y') . ')';
    }
}
