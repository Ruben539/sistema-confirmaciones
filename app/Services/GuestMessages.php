<?php

namespace App\Services;

use App\Models\Event;
use App\Models\Guest;

/**
 * Every WhatsApp text a guest receives from the bot, in one voice: warm, personal and on behalf of the
 * hosts (never "the system", "registered", "rejected"...). Some answers have several versions picked at
 * random so the conversation doesn't feel like a machine repeating itself.
 * WhatsApp formatting: *bold* uses ONE asterisk.
 */
class GuestMessages
{
    public static function hosts(?Event $event): string
    {
        return $event ? ($event->couple_names ?: $event->title) : 'los anfitriones';
    }

    // "Lorena y Claudio" -> plural verbs; "Candela" -> singular
    public static function isPlural(string $hosts): bool
    {
        return (bool) preg_match('/\s(y|e)\s|&|,/iu', $hosts);
    }

    private static function pick(array $options): string
    {
        return $options[array_rand($options)];
    }

    private static function firstName(Guest $guest): string
    {
        return trim(explode(' ', trim($guest->name))[0]) ?: $guest->name;
    }

    // ───────── Attendance ─────────

    public static function confirmed(Guest $guest, Event $event): string
    {
        $hosts = self::hosts($event);
        $name = self::firstName($guest);
        $count = self::isPlural($hosts) ? 'cuentan' : 'cuenta';

        $opening = self::pick([
            "¡Qué alegría, {$name}! 🎉 {$hosts} ya {$count} con vos para celebrar juntos.",
            "¡Genial, {$name}! 🥂 Tu lugar en la fiesta de {$hosts} ya está reservado.",
            "¡Qué lindo que vengas, {$name}! ✨ {$hosts} se van a poner muy felices.",
        ]);
        if (!self::isPlural($hosts)) {
            $opening = str_replace("{$hosts} se van a poner muy felices", "{$hosts} se va a poner muy feliz", $opening);
        }

        return $opening
            . "\n\n🎟️ *Tu pase de ingreso*\nTe lo dejamos en esta imagen: mostralo en la recepción y vas a poder entrar sin filas."
            . "\n\n🍽️ Una última cosita: ¿tenés alguna restricción alimentaria? (celíaco, vegetariano, sin lactosa…). Contanos, o respondé *Ninguna*.";
    }

    public static function declined(Guest $guest, Event $event, ?\Carbon\Carbon $changeUntil = null): string
    {
        $hosts = self::hosts($event);
        $name = self::firstName($guest);
        $plural = self::isPlural($hosts);
        $them = $plural ? 'acompañarlos' : 'acompañarla';

        $text = self::pick([
            "Muchas gracias por avisarnos, {$name} 💛 {$hosts} " . ($plural ? 'lamentan' : 'lamenta') . " que no puedas {$them} y " . ($plural ? 'agradecen' : 'agradece') . " mucho tu cariño.",
            "Gracias por contarnos, {$name} 💛 Te vamos a extrañar. {$hosts} " . ($plural ? 'valoran' : 'valora') . " muchísimo que te hayas tomado el tiempo de avisar.",
            "Entendemos, {$name} 💛 Gracias por avisar con tanto cariño. Se lo hacemos llegar a {$hosts}.",
        ]);

        if ($changeUntil) {
            $text .= "\n\nSi al final podés ir, escribinos *1* antes del {$changeUntil->format('d/m')} y lo actualizamos con mucho gusto.";
        }

        return $text;
    }

    // Unknown answer before responding: a friendly question, not "send only the number of your option"
    public static function askAttendance(Guest $guest, Event $event): string
    {
        $hosts = self::hosts($event);
        $name = self::firstName($guest);
        $them = self::isPlural($hosts) ? 'acompañarlos' : 'acompañarla';

        return "¡Hola, {$name}! 😊 Nos encantaría saber si vas a poder {$them} en su celebración."
            . "\n\nRespondé con:\n*1* — ¡Sí, voy!\n*2* — No voy a poder";
    }

    // Long personal message we couldn't read as yes/no
    public static function thanksAndAskAttendance(Guest $guest, Event $event): string
    {
        $name = self::firstName($guest);
        $hosts = self::hosts($event);

        return "¡Gracias por tu mensaje, {$name}! 💌 Se lo hacemos llegar a {$hosts}."
            . "\n\nPara dejar anotada tu respuesta, escribinos *1* si vas a poder ir o *2* si no vas a poder.";
    }

    // ───────── Menu ─────────

    public static function askMenu(Guest $guest): string
    {
        $name = self::firstName($guest);

        return "¡Hola, {$name}! 😊 Ya te estamos esperando 🎉"
            . "\n\nPara que la comida sea perfecta para vos: ¿tenés alguna restricción alimentaria? (celíaco, vegetariano, sin lactosa…). Contanos, o respondé *Ninguna*.";
    }

    public static function thanksAndAskMenu(Guest $guest, Event $event): string
    {
        $name = self::firstName($guest);
        $hosts = self::hosts($event);

        return "¡Gracias por tu mensaje, {$name}! 💌 Se lo hacemos llegar a {$hosts}."
            . "\n\nY para que la comida sea perfecta para vos: ¿tenés alguna restricción alimentaria? Contanos, o respondé *Ninguna*.";
    }

    public static function menuSaved(Guest $guest, Event $event, ?string $diet): string
    {
        $name = self::firstName($guest);
        $menu = $diet
            ? "Anotamos tu menú: *{$diet}* 🍽️ Le avisamos a la cocina."
            : "Perfecto, menú estándar para vos 🍽️";

        return "¡Gracias, {$name}! {$menu}"
            . "\n\nTe dejamos de nuevo tu pase 🎟️ por las dudas. ¡Nos vemos en la fiesta! 🥂";
    }

    // ───────── After answering ─────────

    public static function thanksForComment(Guest $guest, Event $event, bool $attending): string
    {
        $name = self::firstName($guest);
        $hosts = self::hosts($event);

        return $attending
            ? self::pick([
                "¡Gracias por tu mensaje, {$name}! 💛 Se lo hacemos llegar a {$hosts}. ¡Te esperamos!",
                "¡Qué lindo mensaje, {$name}! 💛 Se lo pasamos a {$hosts}. ¡Nos vemos en la fiesta!",
            ])
            : self::pick([
                "Gracias por tu cariño, {$name} 💛 Se lo vamos a hacer llegar a {$hosts}.",
                "Qué lindas palabras, {$name} 💛 Se las pasamos a {$hosts}, " . (self::isPlural($hosts) ? 'les' : 'le') . " va a llegar al corazón.",
            ]);
    }

    public static function eventInfo(Guest $guest, Event $event): string
    {
        $name = self::firstName($guest);
        $hosts = self::hosts($event);
        $day = $event->event_date ? \Carbon\Carbon::parse($event->event_date)->locale('es')->isoFormat('dddd D [de] MMMM') : null;

        return "¡Hola, {$name}! 😊 Te dejamos los datos de la celebración de {$hosts}:"
            . ($day ? "\n📅 " . ucfirst($day) : '')
            . (!empty($event->location) ? "\n📍 {$event->location}" : '')
            . "\n\nSi tu consulta es sobre otra cosa, se la pasamos a los organizadores para que te respondan.";
    }

    public static function passAgain(Guest $guest): string
    {
        return "¡Claro, " . self::firstName($guest) . "! 🎟️ Acá tenés tu pase de ingreso: mostralo en la recepción el día de la fiesta.";
    }

    // Pass sent when the planner confirms the guest from the panel, or re-sent from the app
    public static function passMessage(Guest $guest, Event $event, bool $isResend): string
    {
        $name = self::firstName($guest);
        $hosts = self::hosts($event);

        $intro = $isResend
            ? "¡Hola, {$name}! 👋 Te reenviamos tu pase para la celebración de {$hosts}."
            : "¡Hola, {$name}! 🎉 ¡Qué alegría que vengas a la celebración de {$hosts}!";

        return $intro
            . "\n\n🎟️ *Tu pase de ingreso*\nMostralo en la recepción y vas a poder entrar sin filas. ¡Te esperamos!";
    }

    // ───────── Other situations ─────────

    public static function eventPassed(Guest $guest, Event $event): string
    {
        $day = $event->event_date ? \Carbon\Carbon::parse($event->event_date)->format('d/m/Y') : null;

        return "¡Hola, " . self::firstName($guest) . "! 💛 La celebración de " . self::hosts($event) . ($day ? " fue el {$day}" : ' ya pasó') . "."
            . "\n\n¡Muchas gracias por tu mensaje y por tanto cariño!";
    }

    public static function eventPaused(Guest $guest): string
    {
        return "¡Hola, " . self::firstName($guest) . "! 😊 Por el momento no estamos recibiendo confirmaciones para este evento."
            . " Si necesitás algo, comunicate directamente con los organizadores.";
    }

    // Reminder sent automatically (or from the app) to guests who haven't answered yet
    public static function reminder(Event $event, string $greeting, string $deadlineText): string
    {
        $wait = self::isPlural(self::hosts($event)) ? 'esperan' : 'espera';

        return "{$greeting} 💌 {pareja} todavía {$wait} tu respuesta para su celebración, ¡y nos encantaría contar con vos!"
            . ($deadlineText ? "\n\n⏰ Podés confirmar hasta el {$deadlineText}." : '')
            . "\n📍 {lugar}"
            . "\n\nRespondé este mensaje con:\n*1* — ¡Sí, voy!\n*2* — No voy a poder";
    }
}
