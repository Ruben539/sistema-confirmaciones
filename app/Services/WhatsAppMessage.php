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
        '¡Hola {nombre}! ¿Cómo estás? 😊',
        '¡Qué tal, {nombre}! 👋',
        '¡Hola, {nombre}! Te escribimos con mucha alegría ✨',
        '¡Hola {nombre}! Qué gusto saludarte 😊',
    ];

    // $mapsLink false: only the address, without the automatic Google Maps link (writing first through the bot)
    public static function build(Guest $guest, string $mode = 'invitation', bool $mapsLink = true): string
    {
        $event = $guest->event;
        $greeting = self::GREETINGS[array_rand(self::GREETINGS)];

        $places = max(1, (int) $guest->passes);
        $placesText = $places > 1 ? "{$places} personas" : '1 persona';

        if ($mode === 'reminder') {
            $deadline = $event->rsvpDeadline();
            $template = GuestMessages::reminder($event, $greeting, $deadline ? $deadline->locale('es')->isoFormat('D [de] MMMM') : '');
        } else {
            if ($places === 1 && !empty($event->message_template_single)) {
                $template = $event->message_template_single;
            } else {
                $template = $event->message_template;
            }
            if (!$template) {
                $template = "{$greeting} Te invitamos al evento de {pareja} ✨\n📍 Lugar: {lugar}\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir";
            }
            if (!str_contains($template, '{nombre}')) {
                $template = "{$greeting}\n" . $template;
            }
            $template = self::filterConditionalTags($template, $places);
            if ($places === 1 && empty($event->message_template_single)) {
                $template = self::adaptSinglePluralPhrases($template, 1);
            }
        }

        $rawLocation = $event->location ?? 'Por confirmar';
        if ($mapsLink && $rawLocation !== 'Por confirmar' && !str_starts_with($rawLocation, 'http')) {
            $formattedLocation = $rawLocation . "\n🗺️ Ver en Google Maps: https://maps.google.com/?q=" . urlencode($rawLocation);
        } else {
            $formattedLocation = $rawLocation;
        }

        // Group invitation: say how many places are reserved (custom templates can place it with {lugares})
        // Reminders always say it: it may come after correcting how many people the invitation is for
        if (($places > 1 || $mode === 'reminder') && !str_contains($template, '{lugares}')) {
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

    public static function filterConditionalTags(string $text, int $places): string
    {
        if ($places === 1) {
            $text = preg_replace('/\[(?:grupo|grupal|familia)\][\s\S]*?\[\/(?:grupo|grupal|familia)\]/iu', '', $text);
            $text = preg_replace('/\[individual\]([\s\S]*?)\[\/individual\]/iu', '$1', $text);
        } else {
            $text = preg_replace('/\[individual\][\s\S]*?\[\/individual\]/iu', '', $text);
            $text = preg_replace('/\[(?:grupo|grupal|familia)\]([\s\S]*?)\[\/(?:grupo|grupal|familia)\]/iu', '$1', $text);
        }
        return trim($text);
    }

    public static function adaptSinglePluralPhrases(string $text, int $places): string
    {
        if ($places === 1) {
            $text = preg_replace('/\s*e\s+indicarnos\s+cu[aá]ntas\s+(?:de\s+las\s+)?personas\s+(?:incluidas\s+en\s+su\s+invitaci[oó]n\s+)?asistir[aá]n\s*,?\s*/iu', ' ', $text);
            $text = preg_replace('/\s*recibirlos\s+de\s+la\s+mejor\s+manera/iu', ' recibirte de la mejor manera', $text);
            $text = preg_replace('/compartir\s+con\s+ustedes/iu', 'compartir contigo', $text);
        }
        return $text;
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
