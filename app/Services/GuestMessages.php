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

    // Who to talk to once the automatic chat is over: the event's planner, if she has a phone loaded
    private static function contactLine(?Event $event): string
    {
        $planner = $event?->planner;
        $digits = preg_replace('/[^\d]/', '', (string) ($planner->phone ?? ''));
        if ($planner && strlen($digits) >= 8) {
            $local = str_starts_with($digits, '595') ? '0' . substr($digits, 3) : $digits;
            return "Para cualquier consulta, comunicate con {$planner->name} al {$local}.";
        }
        return 'Para cualquier consulta, comunicate directamente con los organizadores del evento.';
    }

    private static function automaticChatNote(?Event $event): string
    {
        return "\n\n🤖 _Este es un chat automático de confirmación y finaliza acá._ " . self::contactLine($event);
    }

    // The guest writes again after answering: one clear notice that nobody answers this chat
    public static function chatFinished(Guest $guest, ?Event $event): string
    {
        return "¡Hola, " . self::firstName($guest) . "! 🤖 Este es un *chat automático* de confirmación y ya finalizó: tu respuesta quedó registrada ✅"
            . "\n\nPor este chat no podemos responder mensajes. " . self::contactLine($event);
    }

    // ───────── Attendance ─────────

    public static function confirmed(Guest $guest, Event $event, bool $askHeadcount = false): string
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

        $text = $opening
            . "\n\n🎟️ *Tu pase de ingreso*\nTe lo dejamos en esta imagen: mostralo en la recepción y vas a poder entrar sin filas.";

        // Group invitation: first how many are coming (the menu question comes after)
        $places = (int) $guest->passes;
        if ($places > 1 && $askHeadcount) {
            return $text . "\n\n" . self::headcountQuestion($places);
        }
        if ((int) $guest->confirmed_passes > 1) {
            $text .= " Sirve para las *{$guest->confirmed_passes} personas*.";
        }

        return $text . "\n\n" . self::menuQuestion();
    }

    private static function menuQuestion(): string
    {
        return "🍽️ Una última cosita: ¿tenés alguna restricción alimentaria? (celíaco, vegetariano, sin lactosa…). Contanos, o respondé *Ninguna*.";
    }

    // ───────── How many people of a group invitation are coming ─────────

    private static function headcountQuestion(int $places): string
    {
        return "👥 Tu invitación es para *{$places} personas*. ¿Cuántos van a ir? Respondé con el número (del 1 al {$places}) o *Todos*.";
    }

    public static function askHeadcountAgain(Guest $guest): string
    {
        return "¡Perdón, " . self::firstName($guest) . "! 😊 No llegamos a entender cuántos van a ir.\n\n" . self::headcountQuestion((int) $guest->passes);
    }

    public static function headcountSaved(Guest $guest, int $people): string
    {
        $places = (int) $guest->passes;
        $text = $people === 1
            ? "¡Perfecto, " . self::firstName($guest) . "! Anotamos *1 persona* 🙌"
            : "¡Perfecto, " . self::firstName($guest) . "! Anotamos *{$people} personas* 🙌 El mismo pase sirve para todos.";
        if ($people < $places) {
            $text .= "\nSi al final se suma alguien, avisanos (tenés hasta {$places} lugares).";
        }

        return $text . "\n\n" . self::menuQuestion();
    }

    // Didn't understand twice: keep the whole invitation and move on
    public static function headcountKeptAll(Guest $guest): string
    {
        $places = (int) $guest->passes;

        return "¡Gracias, " . self::firstName($guest) . "! 😊 Dejamos reservados los *{$places} lugares*. Si van menos, escribinos por ejemplo *Somos 2* y lo actualizamos."
            . "\n\n" . self::menuQuestion();
    }

    // "Somos 2" after having confirmed
    public static function headcountUpdated(Guest $guest, int $people): string
    {
        return "¡Listo, " . self::firstName($guest) . "! 👥 Actualizamos tu confirmación a *{$people} " . ($people === 1 ? 'persona' : 'personas') . "*. Tu pase sigue siendo el mismo.";
    }

    public static function headcountTooMany(Guest $guest, Event $event): string
    {
        $places = (int) $guest->passes;
        $hosts = self::hosts($event);

        return "¡Gracias por avisar, " . self::firstName($guest) . "! 💛 Tu invitación es para *{$places} " . ($places === 1 ? 'persona' : 'personas') . "*."
            . ($places > 1 ? " ¿Cuántos van a ir? (del 1 al {$places})" : '')
            . "\nSi necesitás sumar a alguien más, se lo consultamos a {$hosts} y te respondemos por acá.";
    }

    // They say more people are coming than the invitation has (often a confusion: another number of the same
    // family, a list that was corrected...): no contradicting them, a person checks it and answers
    public static function headcountReview(Guest $guest, Event $event): string
    {
        return "¡Gracias por avisar, " . self::firstName($guest) . "! 💛 Lo revisamos con " . self::hosts($event)
            . " y te confirmamos por acá en breve.";
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
            $text .= "\n\nSi al final podés ir, avisá a los organizadores antes del {$changeUntil->format('d/m')} y lo actualizan con mucho gusto.";
        }

        return $text . self::automaticChatNote($event);
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
            . "\n\nTe dejamos de nuevo tu pase 🎟️ por las dudas. ¡Nos vemos en la fiesta! 🥂"
            . self::automaticChatNote($event);
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
        $people = $guest->groupSize();

        return $intro
            . "\n\n🎟️ *Tu pase de ingreso*" . ($people > 1 ? " (válido para {$people} personas)" : '')
            . "\nMostralo en la recepción y vas a poder entrar sin filas. ¡Te esperamos!";
    }

    // The number of people was wrong in an earlier message (corrected list): apology with the right amount
    public static function countCorrection(Guest $guest, Event $event): string
    {
        $places = max(1, (int) $guest->passes);
        $text = "¡Hola, " . self::firstName($guest) . "! 🙏 Te pedimos disculpas por la confusión: revisamos la lista de invitados de la celebración de "
            . self::hosts($event) . " y tu invitación es para *{$places} " . ($places === 1 ? 'persona' : 'personas') . "*.";

        $confirmed = (int) $guest->confirmed_passes;
        if ($confirmed > 0 && $confirmed !== $places) {
            $text .= "\n\nTenemos confirmadas *{$confirmed}*. Si cambia, respondé este mensaje y lo actualizamos.";
        }

        return $text . "\n\nTu pase de ingreso sigue siendo el mismo. ¡Gracias por tu comprensión! 💛";
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
