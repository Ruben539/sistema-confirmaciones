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
            $deadline = $event->rsvpDeadline();
            $template = GuestMessages::reminder($event, $greeting, $deadline ? $deadline->locale('es')->isoFormat('D [de] MMMM') : '');
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

        // Group invitation: say how many places are reserved (custom templates can place it with {lugares})
        $places = max(1, (int) $guest->passes);
        $placesText = $places > 1 ? "{$places} personas" : '1 persona';
        if ($places > 1 && !str_contains($template, '{lugares}')) {
            $line = "🎟️ Lugares reservados: *{lugares}*";
            $template = preg_match('/^.*respond/imu', $template)
                ? preg_replace('/^(.*respond)/imu', $line . "\n\n$1", $template, 1)
                : $template . "\n\n" . $line;
        }

        return str_replace(
            ['{nombre}', '{pareja}', '{lugar}', '{link}', '{lugares}'],
            [$guest->name, $event->couple_names ?? $event->title, $formattedLocation, url('/confirmar/' . $guest->token), $placesText],
            $template
        );
    }

    private static function deadlineText($event): string
    {
        $deadline = $event->rsvpDeadline();
        if (!$deadline) {
            return '';
        }
        return ' (' . $deadline->format('d/m/Y') . ')';
    }
}
