<?php

namespace App\Http\Controllers;

use App\Models\Guest;
use App\Services\EventMilestoneService;
use App\Services\GuestMessages;
use Illuminate\Http\Request;

class RsvpController extends Controller
{
    public function show($token)
    {
        $guest = Guest::with('event')->where('token', $token)->firstOrFail();
        $event = $guest->event;

        $isExpired = false;
        $deadlineDateFormatted = null;

        if ($event && ($deadlineDate = $event->rsvpDeadline())) {
            $deadlineDateFormatted = $deadlineDate->format('d/m/Y');
            $isExpired = now()->greaterThan($deadlineDate);

            if ($isExpired && $guest->status === 'pending' && ($event->auto_decline_expired ?? true)) {
                \App\Models\GuestActivity::withContext(['via' => 'deadline'], fn () => $guest->update([
                    'status' => 'declined',
                    'notes' => ($guest->notes ? $guest->notes . ' | ' : '') . "Cancelado automáticamente por fecha límite expirada ({$deadlineDateFormatted})",
                    'confirmed_adults' => 0,
                    'confirmed_youth' => 0,
                    'confirmed_children' => 0,
                    'confirmed_passes' => 0,
                ]));
            }
        }

        $dedications = [];
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('event_dedications')) {
                $dedications = \App\Models\EventDedication::where('event_id', $event->id)
                    ->where('is_approved', true)
                    ->latest()
                    ->take(30)
                    ->get();
            }
        } catch (\Throwable $e) {
            $dedications = [];
        }

        $songRequests = [];
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('event_song_requests')) {
                $songRequests = \App\Models\EventSongRequest::where('event_id', $event->id)
                    ->latest()
                    ->take(25)
                    ->get();
            }
        } catch (\Throwable $e) {
            $songRequests = [];
        }

        // Sin Invitación Digital en el plan: el invitado ve solo la página básica de confirmación
        if ($event && !$event->hasDigitalInvitation()) {
            $event->withoutDigitalInvitation();
            $dedications = [];
            $songRequests = [];
        }

        return response()->json([
            'guest' => $guest->fresh(),
            'event' => $event?->toPublicArray(),
            'is_expired' => $isExpired,
            'deadline_date' => $deadlineDateFormatted,
            'dedications' => $dedications,
            'song_requests' => $songRequests,
        ]);
    }

    public function submit(Request $request, $token)
    {
        $guest = Guest::with('event')->where('token', $token)->firstOrFail();
        $event = $guest->event;

        if ($event && ($deadlineDate = $event->rsvpDeadline())) {
            if (now()->greaterThan($deadlineDate)) {
                $formattedDeadline = $deadlineDate->format('d/m/Y');
                return response()->json([
                    'message' => "El plazo límite para confirmar asistencia a este evento venció el {$formattedDeadline}. Para cualquier modificación, por favor contactá a la organización."
                ], 422);
            }
        }

        $validated = $request->validate([
            'status' => 'required|in:confirmed,declined',
            'confirmed_passes' => 'nullable|integer|min:0',
            'confirmed_adults' => 'nullable|integer|min:0',
            'confirmed_youth' => 'nullable|integer|min:0',
            'confirmed_children' => 'nullable|integer|min:0',
            'dietary_restrictions' => 'nullable|string',
            'notes' => 'nullable|string',
            'song_suggestion' => 'nullable|string|max:255',
        ]);

        $updateData = [
            'dietary_restrictions' => $validated['dietary_restrictions'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ];

        if (array_key_exists('song_suggestion', $validated)) {
            $updateData['song_suggestion'] = $validated['song_suggestion'];
        }

        if ($validated['status'] === 'confirmed') {
            $confAdults = isset($validated['confirmed_adults']) ? (int)$validated['confirmed_adults'] : $guest->adults;
            $confYouth = isset($validated['confirmed_youth']) ? (int)$validated['confirmed_youth'] : $guest->youth;
            $confChildren = isset($validated['confirmed_children']) ? (int)$validated['confirmed_children'] : $guest->children;
            $confPasses = isset($validated['confirmed_passes']) ? (int)$validated['confirmed_passes'] : ($confAdults + $confYouth + $confChildren);

            $updateData['status'] = 'confirmed';
            $updateData['confirmed_adults'] = $confAdults;
            $updateData['confirmed_youth'] = $confYouth;
            $updateData['confirmed_children'] = $confChildren;
            $updateData['confirmed_passes'] = $confPasses;
        } else {
            $updateData['status'] = 'declined';
            $updateData['confirmed_adults'] = 0;
            $updateData['confirmed_youth'] = 0;
            $updateData['confirmed_children'] = 0;
            $updateData['confirmed_passes'] = 0;
        }

        $guest->update($updateData);

        if ($validated['status'] === 'confirmed') {
            EventMilestoneService::checkMilestone($guest->event_id);

            // Enviar Pase Digital con QR al WhatsApp del invitado si tiene teléfono
            if (!empty($guest->phone)) {
                $this->sendWhatsAppQrPass($guest);
            }
        }

        return response()->json([
            'message' => '¡Gracias! Ya recibimos tu respuesta 💛',
            'guest' => $guest->fresh()
        ]);
    }

    private function sendWhatsAppQrPass(Guest $guest)
    {
        // Automatic WhatsApp off: the pass isn't sent by itself (it can be sent by hand from the panel)
        if (!\App\Services\WhatsAppGateway::automationEnabled()) {
            return ;
        }
        try {
            $event = $guest->event;
            $qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" . urlencode($guest->token);
            $message = GuestMessages::passMessage($guest, $event, false);

            $result = \App\Services\WhatsAppGateway::sendPass($guest, $message, $qrUrl, \App\Services\WhatsAppThrottle::sessionForEvent($event));
            if ($result['ok']) {
                \App\Models\GuestMessage::logOutgoing($guest, $message . "\n[Pase QR adjunto]");
            }
            \App\Models\GuestActivity::record($guest, $result['ok'] ? 'qr_sent' : 'qr_failed', $result['ok'] ? 'Pase QR enviado por WhatsApp' : 'No se pudo enviar el pase QR por WhatsApp');
        } catch (\Throwable $e) {
            \App\Models\GuestActivity::record($guest, 'qr_failed', 'No se pudo enviar el pase QR por WhatsApp');
            \Illuminate\Support\Facades\Log::warning("[RsvpController] No se pudo enviar WhatsApp con QR al confirmar desde el formulario web: " . $e->getMessage());
        }
    }

    public function uploadDedication(Request $request, $token)
    {
        $guest = Guest::with('event')->where('token', $token)->firstOrFail();
        $event = $guest->event;
        $event->ensureDigitalInvitation();

        $validated = $request->validate([
            'message' => 'nullable|string|max:1000',
            'type' => 'required|in:photo,video,text',
            'media' => 'nullable|file|mimes:jpg,jpeg,png,webp,mp4,mov,webm,quicktime|max:40960',
        ]);

        $mediaPath = null;
        if ($request->hasFile('media')) {
            $file = $request->file('media');
            if (\App\Services\GoogleDriveService::isConfigured()) {
                $drive = new \App\Services\GoogleDriveService();
                $ext = $file->getClientOriginalExtension() ?: 'jpg';
                $driveResult = $drive->uploadEventFile($event, $file, 'dedicatoria_' . $event->id . '_' . time() . '.' . $ext);
                if ($driveResult && !empty($driveResult['direct_url'])) {
                    $mediaPath = $driveResult['direct_url'];
                }
            }

            if (!$mediaPath) {
                $mediaPath = $file->store('dedications', 'public');
            }
        }

        $dedication = \App\Models\EventDedication::create([
            'event_id' => $event->id,
            'guest_id' => $guest->id,
            'author_name' => $guest->name,
            'type' => $validated['type'],
            'media_path' => $mediaPath,
            'message' => $validated['message'] ?? null,
            'is_approved' => !$event->dedications_require_approval,
        ]);

        return $this->dedicationCreatedResponse($dedication);
    }

    public function uploadPublicDedication(Request $request, $code)
    {
        $event = \App\Models\Event::findByPublicCodeOrFail($code);
        $event->ensureDigitalInvitation();

        $validated = $request->validate([
            'author_name' => 'required|string|max:120',
            'message' => 'nullable|string|max:1000',
            'type' => 'required|in:photo,video,text',
            'media' => 'nullable|file|mimes:jpg,jpeg,png,webp,mp4,mov,webm,quicktime|max:40960',
        ]);

        $mediaPath = null;
        if ($request->hasFile('media')) {
            $file = $request->file('media');
            if (\App\Services\GoogleDriveService::isConfigured()) {
                $drive = new \App\Services\GoogleDriveService();
                $ext = $file->getClientOriginalExtension() ?: 'jpg';
                $driveResult = $drive->uploadEventFile($event, $file, 'dedicatoria_publica_' . $event->id . '_' . time() . '.' . $ext);
                if ($driveResult && !empty($driveResult['direct_url'])) {
                    $mediaPath = $driveResult['direct_url'];
                }
            }

            if (!$mediaPath) {
                $mediaPath = $file->store('dedications', 'public');
            }
        }

        $dedication = \App\Models\EventDedication::create([
            'event_id' => $event->id,
            'guest_id' => null,
            'author_name' => $validated['author_name'],
            'type' => $validated['type'],
            'media_path' => $mediaPath,
            'message' => $validated['message'] ?? null,
            'is_approved' => !$event->dedications_require_approval,
        ]);

        return $this->dedicationCreatedResponse($dedication);
    }

    private function dedicationCreatedResponse(\App\Models\EventDedication $dedication)
    {
        $pending = !$dedication->is_approved;

        return response()->json([
            'message' => $pending
                ? '¡Gracias! Tu dedicatoria se mostrará en la pantalla cuando el equipo del evento la apruebe.'
                : '¡Dedicatoria publicada con éxito!',
            'pending_approval' => $pending,
            'dedication' => $dedication,
        ]);
    }

    public function publicInvitation($code)
    {
        $event = \App\Models\Event::findByPublicCodeOrFail($code);
        $event->ensureDigitalInvitation();

        $dedications = [];
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('event_dedications')) {
                $dedications = \App\Models\EventDedication::where('event_id', $event->id)
                    ->where('is_approved', true)
                    ->latest()
                    ->take(30)
                    ->get();
            }
        } catch (\Throwable $e) {
            $dedications = [];
        }

        $songRequests = [];
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('event_song_requests')) {
                $songRequests = \App\Models\EventSongRequest::where('event_id', $event->id)
                    ->latest()
                    ->take(25)
                    ->get();
            }
        } catch (\Throwable $e) {
            $songRequests = [];
        }

        return response()->json([
            'event' => $event->toPublicArray(),
            'dedications' => $dedications,
            'song_requests' => $songRequests,
        ]);
    }

    public function suggestDedication(Request $request)
    {
        $guestName = $request->input('guest_name', 'Un invitado');
        $coupleNames = $request->input('couple_names', 'los anfitriones');
        $eventType = $request->input('event_type', 'evento');
        $tone = $request->input('tone', 'cariñoso');

        $gemini = new \App\Services\GoogleGeminiService();
        $suggestion = $gemini->suggestDedication($guestName, $coupleNames, $eventType, $tone);

        if (!$suggestion) {
            return response()->json([
                'message' => 'No se pudo generar la dedicatoria con IA en este momento.'
            ], 500);
        }

        return response()->json([
            'suggestion' => $suggestion
        ]);
    }

    public function handleIncomingWhatsApp(Request $request)
    {
        // Optional: only enforced if WHATSAPP_WEBHOOK_SECRET is set (on Laravel and on the bot)
        $secret = config('whatsapp.webhook_secret');
        if ($secret && !hash_equals($secret, (string) $request->header('X-Webhook-Secret'))) {
            return response()->json(['processed' => false, 'reason' => 'Unauthorized'], 401);
        }
        \App\Models\GuestActivity::setSource('whatsapp');

        $rawDigits = preg_replace('/[^\d]/', '', $request->input('phone', ''));
        $message = trim($request->input('message', ''));

        if (empty($rawDigits) || empty($message)) {
            return response()->json(['processed' => false, 'reason' => 'Empty phone or message']);
        }

        // 0. Administrator Chatbot Commands (e.g. "APROBAR 1" or "RECHAZAR 1")
        // Only from an administrator's phone: otherwise any guest could approve requests by texting the bot
        if (\App\Services\WhatsAppGateway::automationEnabled() && preg_match('/^(aprobar|autorizar|rechazar)\s+(\d+)$/i', $message, $matches) && $this->isAdminPhone($rawDigits)) {
            $action = strtolower($matches[1]);
            $reqId = (int)$matches[2];
            $planReq = \App\Models\PlanRequest::with(['event', 'planner'])->find($reqId);

            if ($planReq) {
                if (in_array($action, ['aprobar', 'autorizar'])) {
                    $planReq->applyToEvent();
                    $planReq->update([
                        'status' => 'approved',
                        'admin_notes' => 'Aprobado vía WhatsApp Bot',
                        'reviewed_at' => now(),
                    ]);

                    $eventTitle = $planReq->event->couple_names ?? $planReq->event->title;
                    $reply = $planReq->isDigitalInvitation()
                        ? "✅ *SOLICITUD #{$reqId} APROBADA EXITOSAMENTE*\n\nEl evento '{$eventTitle}' ya tiene la *Invitación Digital* habilitada.\nLa Wedding Planner ya puede configurarla desde el panel."
                        : "✅ *SOLICITUD #{$reqId} APROBADA EXITOSAMENTE*\n\nEl evento '{$eventTitle}' ahora cuenta con el *" . (\App\Models\Event::PLANS[$planReq->requested_plan]["label"] ?? $planReq->requested_plan) . "* y una capacidad de *{$planReq->requested_guests} invitados máx*.\nLa Wedding Planner ya puede continuar cargando su lista.";

                    return response()->json([
                        'processed' => true,
                        'reason' => 'Admin plan request approved via WhatsApp',
                        'reply' => $reply
                    ]);
                } else if ($action === 'rechazar') {
                    $planReq->update([
                        'status' => 'rejected',
                        'admin_notes' => 'Rechazado vía WhatsApp Bot',
                        'reviewed_at' => now(),
                    ]);

                    return response()->json([
                        'processed' => true,
                        'reason' => 'Admin plan request rejected via WhatsApp',
                        'reply' => "❌ La solicitud #{$reqId} (" . $planReq->summary() . ") ha sido rechazada."
                    ]);
                }
            }
        }

        // El bot avisa con is_lid cuando WhatsApp envió el contacto como @lid sin su número real:
        // en ese caso "phone" es el LID y se resuelve con la relación LID -> invitado guardada.
        if ($request->boolean('is_lid')) {
            $guest = Guest::with('event')
                ->where('whatsapp_lid', $rawDigits)
                ->orderBy('created_at', 'desc')
                ->first();

            if (!$guest) {
                $resolved = $this->linkGuestByWhatsappLid($rawDigits, $message);
                if ($resolved instanceof \Illuminate\Http\JsonResponse) {
                    // Automation off: nobody answers automatically (not even to ask for the number)
                    return \App\Services\WhatsAppGateway::automationEnabled()
                        ? $resolved
                        : response()->json(['processed' => false, 'reason' => 'WhatsApp automation disabled']);
                }
                $guest = $resolved;

                // Retomar el mensaje original que llegó antes de identificar al invitado (ej: "1")
                $pending = \Illuminate\Support\Facades\Cache::pull("wa_lid_pending:{$rawDigits}");
                if (empty($pending) && !\App\Services\WhatsAppGateway::automationEnabled()) {
                    $pending = $message; // just save it (below), without the automatic greeting
                }
                if (empty($pending)) {
                    $menu = ($guest->conversation_state ?? 'awaiting_attendance') === 'awaiting_attendance'
                        ? "\n\n¿Vas a poder acompañarnos? Respondé con:\n*1* — ¡Sí, voy!\n*2* — No voy a poder"
                        : "";
                    return response()->json([
                        'processed' => true,
                        'reason' => 'WhatsApp LID linked to guest',
                        'reply' => "¡Gracias, {$guest->name}! 😊 Ya encontramos tu invitación.{$menu}"
                    ]);
                }
                $message = trim($pending);
            }
        } else {
            $guest = $this->findGuestByPhone($rawDigits);
        }

        if (!$guest) {
            \Illuminate\Support\Facades\Log::warning("[RSVP WhatsApp] Invitado no encontrado para teléfono entrante: {$rawDigits}");
            return response()->json(['processed' => false, 'reason' => 'Guest not found']);
        }

        \Illuminate\Support\Facades\Log::info("[RSVP WhatsApp] Mensaje entrante de {$guest->name} ({$rawDigits}): '{$message}'");

        // The conversation is kept per guest (guest_messages) and shown to the planner in "Mensajes" of
        // the panel: everything goes through one WhatsApp number, so that is where a person reads and answers
        $this->needsPerson = false;
        // Automation off: nothing answers automatically; the message is saved for the panel's "WhatsApp" module
        $response = \App\Services\WhatsAppGateway::automationEnabled()
            ? $this->replyToGuest($guest, $message)
            : response()->json(['processed' => false, 'reason' => 'WhatsApp automation disabled']);
        if (!\App\Services\WhatsAppGateway::automationEnabled()) {
            $this->needsPerson = true;
        }
        $botReply = $response->getData(true)['reply'] ?? null;

        // Long messages are personal notes (excuses, questions, gifts...): also kept in the guest's notes
        $isLong = mb_strlen($message) >= self::LONG_MESSAGE_CHARS;
        $guest->refresh();
        $updates = [
            // The number the guest writes to is the one that answers from now on
            'whatsapp_channel' => $request->input('channel') === 'cloud' ? 'cloud' : 'baileys',
            'last_message_at' => now(),
            'unread_messages' => (int) $guest->unread_messages + 1,
            'needs_reply' => $guest->needs_reply || $isLong || $this->needsPerson,
        ];
        if ($isLong) {
            $note = '[WhatsApp ' . now()->format('d/m H:i') . '] ' . mb_substr($message, 0, 1000);
            $updates['notes'] = $guest->notes ? $guest->notes . "\n" . $note : $note;
        }
        $guest->update($updates);

        \App\Models\GuestMessage::create([
            'event_id' => $guest->event_id,
            'guest_id' => $guest->id,
            'direction' => 'in',
            'author' => 'guest',
            'body' => mb_substr($message, 0, 4000),
        ]);
        if ($botReply) {
            \App\Models\GuestMessage::create([
                'event_id' => $guest->event_id,
                'guest_id' => $guest->id,
                'direction' => 'out',
                'author' => 'bot',
                'body' => mb_substr($botReply, 0, 4000),
            ]);
        }

        return $response;
    }

    // From this length a guest's WhatsApp message is treated as a personal note (saved and forwarded)
    private const LONG_MESSAGE_CHARS = 80;

    // Set by replyToGuest when the message needs a person (comment or question after answering):
    // it is highlighted in the panel's "Mensajes" inbox
    private bool $needsPerson = false;

    private const HEADCOUNT_WORDS = ['uno' => 1, 'una' => 1, 'dos' => 2, 'tres' => 3, 'cuatro' => 4, 'cinco' => 5, 'seis' => 6, 'siete' => 7, 'ocho' => 8, 'nueve' => 9, 'diez' => 10];

    /**
     * How many people the guest says are coming: "somos 3", "vamos los dos", "2 personas", "solo yo"...
     * $bareAnswer also accepts a plain number ("3") and "todos": only when the bot just asked how many.
     */
    private function headcountFrom(string $msgClean, int $places, bool $bareAnswer): ?int
    {
        $num = '(\d{1,2}|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)';
        $toInt = fn ($v) => is_numeric($v) ? (int) $v : (self::HEADCOUNT_WORDS[$v] ?? null);

        if ($bareAnswer) {
            if (preg_match('/^\s*' . $num . '\s*(personas?|adultos?|lugares?)?\s*[.!]*\s*$/u', $msgClean, $m)) {
                return $toInt($m[1]) ?: null;
            }
            if (preg_match('/\b(todos|todas|todo el grupo|completos?)\b/u', $msgClean)) {
                return $places;
            }
        }
        if (preg_match('/\b(s[oó]lo yo|yo s[oó]lo|yo sola|solamente yo|voy s[oó]lo|voy sola|s[oó]lo voy yo)\b/u', $msgClean)) {
            return 1;
        }
        if (preg_match('/\b(vamos|iremos|vamos a ir|somos|venimos|vendremos) (ambos|ambas)\b|\b(ambos|ambas) (vamos|iremos|asistiremos)\b/u', $msgClean)) {
            return 2;
        }
        if (preg_match('/\b(somos|seremos|vamos|iremos|vendremos|venimos|asistimos|asistiremos|estaremos|confirmamos|van|ir[aá]n)\s+(?:a\s+(?:ser|ir)\s+)?(?:s[oó]lo\s+|solamente\s+)?(?:los\s+|las\s+)?' . $num . '\b/u', $msgClean, $m)) {
            return $toInt($m[2]) ?: null;
        }
        if (preg_match('/(?<!de )\b' . $num . '\s+(personas|adultos|lugares|pases)\b/u', $msgClean, $m)) {
            return $toInt($m[1]) ?: null;
        }

        return null;
    }

    // Confirmed people of the invitation: adults first, then youth, then children
    private function applyHeadcount(Guest $guest, int $people): void
    {
        $adults = min($people, (int) $guest->adults);
        $youth = min($people - $adults, (int) $guest->youth);
        $children = min($people - $adults - $youth, (int) $guest->children);
        if ($adults + $youth + $children < $people) {
            $adults = $people - $youth - $children; // invitation without composition
        }

        $guest->update([
            'confirmed_adults' => $adults,
            'confirmed_youth' => $youth,
            'confirmed_children' => $children,
            'confirmed_passes' => $people,
        ]);
    }

    // "Lorena y Claudio lamentan" / "Candela lamenta"
    private function hostsVerb(string $hosts, string $singular, string $plural): string
    {
        return preg_match('/\s(y|e)\s|&|,/iu', $hosts) ? $plural : $singular;
    }

    /**
     * Decides the bot's answer to a guest's WhatsApp message (confirm / decline / menu / reminder
     * of the options) and applies the change to the guest.
     */
    private function replyToGuest(Guest $guest, string $message)
    {
        $event = $guest->event;

        // Already answered (confirmed with menu, or declined): the automatic conversation is over. People
        // thought a person was writing, so the bot says clearly it's an automatic chat that ended
        // A person of the organization is chatting with this guest (wrote from the panel in the last 24 h):
        // the bot doesn't interrupt that conversation with automatic notices
        $humanChat = \App\Models\GuestMessage::where('guest_id', $guest->id)->where('author', 'planner')
            ->where('created_at', '>=', now()->subDay())->exists();
        if ($humanChat && ($guest->conversation_state ?? null) === 'completed') {
            $this->needsPerson = true;
            return response()->json(['processed' => false, 'reason' => 'Chat with a person from the panel']);
        }

        if (($guest->conversation_state ?? null) === 'completed') {
            // Once (per day): it's an automatic chat and it's over, with who to contact. Then nothing more.
            if (\Illuminate\Support\Facades\Cache::add("chat_closed:{$guest->id}", true, now()->addDay())) {
                return response()->json([
                    'processed' => true,
                    'reason' => 'Conversation finished: automatic notice',
                    'reply' => GuestMessages::chatFinished($guest, $event),
                ]);
            }
            return response()->json(['processed' => false, 'reason' => 'Conversation finished: no answer']);
        }

        if ($event && !$event->is_enabled) {
            return response()->json([
                'processed' => false,
                'reason' => 'Event is disabled',
                'reply' => GuestMessages::eventPaused($guest)
            ]);
        }

        $coupleNames = $event ? ($event->couple_names ?? $event->title) : 'los novios';
        $locationText = ($event && !empty($event->location)) ? "\n📍 *Lugar:* {$event->location}" : "";
        $msgClean = mb_strtolower(trim($message));

        // "Ver invitación" (button of the official API greeting): the invitation configured in the event,
        // with its photo, exactly as it is sent through the Baileys bot
        if (preg_match('/^ver (la |mi )?invitaci[oó]n$/u', $msgClean)) {
            $media = null;
            if ($event && !empty($event->cover_photo_path)) {
                $disk = \Illuminate\Support\Facades\Storage::disk('public');
                $media = $disk->exists($event->cover_photo_path) ? $disk->path($event->cover_photo_path) : $event->cover_photo_url;
            }
            return response()->json(array_filter([
                'processed' => true,
                'reason' => 'Invitation requested',
                'reply' => \App\Services\WhatsAppMessage::build($guest, 'invitation'),
                'media_url' => $media,
            ]));
        }
        $currentState = $guest->conversation_state ?? 'awaiting_attendance';

        // 1. Escenario: Si la fecha del evento ya pasó
        if ($event && $event->event_date) {
            try {
                $eventDate = \Carbon\Carbon::parse($event->event_date)->endOfDay();
                if (now()->greaterThan($eventDate)) {
                    $formattedDate = \Carbon\Carbon::parse($event->event_date)->format('d/m/Y');
                    $reply = GuestMessages::eventPassed($guest, $event);
                    return response()->json([
                        'processed' => true,
                        'reason' => 'Event date has passed',
                        'reply' => $reply
                    ]);
                }
            } catch (\Exception $e) {
                // Ignore date parsing error
            }
        }

        // 2. Guest who already answered and writes again: a conversation, not the same status card every time
        if ($currentState === 'completed') {
            $isAttending = in_array($guest->status, ['confirmed', 'attended']);
            $deadline = $event?->rsvpDeadline();
            $canChange = $guest->status !== 'attended' && (!$deadline || now()->lessThanOrEqualTo($deadline));
            $saysYes = in_array($msgClean, ['1', '1️⃣', 'si', 'sí', 'confirmo']);
            $saysNo = in_array($msgClean, ['2', '2️⃣', 'no']);

            if ($canChange && (($saysYes && !$isAttending) || ($saysNo && $isAttending))) {
                // Changed their mind before the deadline: process it as a new answer (steps 3 / 4 below)
                $currentState = 'awaiting_attendance';
            } else {

                // "Somos 2" / "al final vamos 4": change how many are coming
                $people = $isAttending ? $this->headcountFrom($msgClean, (int) $guest->passes, false) : null;
                if ($people !== null) {
                    if ($people > (int) $guest->passes) {
                        $this->needsPerson = true;
                        return response()->json(['processed' => true, 'reason' => 'Headcount over invitation', 'reply' => GuestMessages::headcountReview($guest, $event)]);
                    }
                    if ($canChange) {
                        $this->applyHeadcount($guest, $people);
                        return response()->json(['processed' => true, 'reason' => 'Headcount updated', 'reply' => GuestMessages::headcountUpdated($guest, $people)]);
                    }
                    $this->needsPerson = true; // after the deadline a person decides
                }

                // Asks for the entry pass
                if ($isAttending && preg_match('/\b(qr|pase|entrada|c[oó]digo)\b/iu', $msgClean)) {
                    return response()->json([
                        'processed' => true,
                        'reason' => 'QR requested',
                        'reply' => GuestMessages::passAgain($guest),
                        'media_url' => "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" . urlencode($guest->token),
                    ]);
                }

                // A question about the event: answer it (and the planner gets it too)
                if (str_contains($message, '?') || preg_match('/\b(hora|horario|direcci[oó]n|ubicaci[oó]n|d[oó]nde|lugar|vestimenta|dress|estacionamiento)\b/iu', $msgClean)) {
                    $this->needsPerson = true;
                    return response()->json([
                        'processed' => true,
                        'reason' => 'Question after answering',
                        'reply' => GuestMessages::eventInfo($guest, $event),
                    ]);
                }

                // Any other comment: thank them warmly ONCE (then stay quiet for a while) and flag it for a
                // person (the planner, in "Mensajes"), instead of repeating the automatic card on every message
                $this->needsPerson = true;
                if (!\Illuminate\Support\Facades\Cache::add("guest_ack:{$guest->id}", true, now()->addHours(6))) {
                    return response()->json(['processed' => true, 'reason' => 'Comment after answering (already acknowledged)']);
                }

                $reply = GuestMessages::thanksForComment($guest, $event, $isAttending);

                return response()->json([
                    'processed' => true,
                    'reason' => 'Comment after answering',
                    'reply' => $reply,
                ]);
            }
        }

        // Clear "we can't go" phrases (valid in any state, even while asking the menu or how many)
        $strongDecline = (bool) preg_match('/(no (voy|vamos) a (poder|ir|asistir|estar)|no (podre|podré|podremos|podria|podría|podriamos|podríamos) (ir|asistir|estar|acompa)|no poder (asistir|ir|estar|acompa)|no podemos (ir|asistir|estar)|(me|nos) es imposible|imposible (asistir|ir)|lamentablemente no|no (asistiremos|iremos|ire|iré)\b)/iu', $msgClean);

        // Group invitation just confirmed: how many are coming ("3", "todos", "somos 2"...)
        if ($currentState === 'awaiting_count' && !$strongDecline) {
            $places = (int) $guest->passes;
            $people = $this->headcountFrom($msgClean, $places, true);

            if ($people !== null && $people > $places) {
                $this->needsPerson = true;
                return response()->json(['processed' => true, 'reason' => 'Headcount over invitation', 'reply' => GuestMessages::headcountTooMany($guest, $event)]);
            }
            if ($people !== null) {
                $this->applyHeadcount($guest, $people);
                $guest->update(['conversation_state' => 'awaiting_dietary']);
                return response()->json(['processed' => true, 'reason' => 'Headcount saved', 'reply' => GuestMessages::headcountSaved($guest, $people)]);
            }

            // Not understood: ask once more, then keep the whole invitation and move on
            if (mb_strlen($message) >= self::LONG_MESSAGE_CHARS) {
                $this->needsPerson = true;
            }
            if (\Illuminate\Support\Facades\Cache::add("headcount_ask:{$guest->id}", true, now()->addDays(2))) {
                return response()->json(['processed' => false, 'reason' => 'Headcount not understood', 'reply' => GuestMessages::askHeadcountAgain($guest)]);
            }
            \Illuminate\Support\Facades\Cache::forget("headcount_ask:{$guest->id}");
            $guest->update(['conversation_state' => 'awaiting_dietary']);
            return response()->json(['processed' => true, 'reason' => 'Headcount kept as invited', 'reply' => GuestMessages::headcountKeptAll($guest)]);
        }

        // While asking the menu, "No" means "no restrictions", not "I'm not going"
        $answeringMenu = $currentState === 'awaiting_dietary' && $guest->status === 'confirmed';

        // 3. Check for direct decline first to avoid positive matching on phrases like "no confirmo"
        // "Starts with 2 / no" only counts in very short answers ("2", "No", "No, gracias"): "2 personas vamos" or "No sé si llego, pero voy" are not a decline
        $isShortAnswer = mb_strlen($msgClean) <= 15 && !preg_match('/^no s[eé]\b/u', $msgClean);
        $isDecline = $strongDecline || !$answeringMenu && (in_array($msgClean, ['2', '2️⃣', 'no', 'cancelar', 'rechazar', 'no podre', 'no podré', 'no voy', 'no asisto'])
            || ($isShortAnswer && preg_match('/^(2\b|2️⃣|cancelar|rechazar|no\b)/iu', $msgClean))
            || preg_match('/\b(no puedo|no podre|no podré|no voy|no asisto|no asistire|no asistiré|no podremos)\b/iu', $msgClean));

        if ($isDecline) {
            $guest->update([
                'status' => 'declined',
                'conversation_state' => 'completed',
                'confirmed_adults' => 0,
                'confirmed_youth' => 0,
                'confirmed_children' => 0,
                'confirmed_passes' => 0,
            ]);

            $deadline = $event?->rsvpDeadline();
            $reply = GuestMessages::declined($guest, $event, $deadline && now()->lessThanOrEqualTo($deadline) ? $deadline : null);

            return response()->json([
                'processed' => true,
                'status' => 'declined',
                'conversation_state' => 'completed',
                'guest' => $guest,
                'reply' => $reply
            ]);
        }

        // 4. Check for direct confirm command ("1", "si", "confirmar", "confirmo", "confirm", "confirn", etc.)
        $isConfirm = in_array($msgClean, ['1', '1️⃣', 'confirmar', 'confirmo', 'confirm', 'confirn', 'si', 'sí', 'asistire', 'asistiré', 'asisto', 'voy', 'claro', 'obvio'])
            || ($isShortAnswer && preg_match('/^(1\b|1️⃣|confirm|confirn|si\b|sí\b|asist|voy\b)/iu', $msgClean))
            || preg_match('/\b(confirmar|confirmo|confirmamos|confirmacion|confirmación|confirm|confirn|asistire|asistiré|asisto|asistiremos)\b/i', $msgClean)
            // "Vamos 3" / "somos 2 personas" as the first answer is a yes with a headcount
            || ($currentState === 'awaiting_attendance' && $this->headcountFrom($msgClean, max(1, (int) $guest->passes), false) !== null);

        // Already confirmed and being asked the menu: "sí" is not a new confirmation
        if ($isConfirm && $answeringMenu) {
            return response()->json(['processed' => false, 'reason' => 'Yes while asking the menu', 'reply' => GuestMessages::askMenu($guest)]);
        }

        if ($isConfirm) {
            $confAdults = $guest->adults > 0 ? $guest->adults : 1;
            $confPasses = max(1, (int)$guest->adults + (int)$guest->youth + (int)$guest->children);

            // Group invitation: the whole group is confirmed until they say how many ("sí, vamos 3" says it already)
            $people = $confPasses > 1 ? $this->headcountFrom($msgClean, $confPasses, false) : null;
            $askHeadcount = $confPasses > 1 && ($people === null || $people > $confPasses);
            // Invited alone but says they are more: a person (the planner) has to decide
            if ($confPasses === 1 && ($this->headcountFrom($msgClean, 1, false) ?? 0) > 1) {
                $this->needsPerson = true;
            }
            \Illuminate\Support\Facades\Cache::forget("headcount_ask:{$guest->id}");

            $guest->update([
                'status' => 'confirmed',
                'conversation_state' => $askHeadcount ? 'awaiting_count' : 'awaiting_dietary',
                'confirmed_adults' => $confAdults,
                'confirmed_youth' => $guest->youth,
                'confirmed_children' => $guest->children,
                // Confirm the whole invitation, including companions
                'confirmed_passes' => $confPasses,
            ]);
            if (!$askHeadcount && $people !== null) {
                $this->applyHeadcount($guest, $people);
            }

            $qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" . urlencode($guest->token);

            $reply = GuestMessages::confirmed($guest, $event, $askHeadcount);

            EventMilestoneService::checkMilestone($guest->event_id);

            return response()->json([
                'processed' => true,
                'status' => 'confirmed',
                'conversation_state' => $guest->conversation_state,
                'guest' => $guest,
                'reply' => $reply,
                'media_url' => $qrUrl
            ]);
        }

        // 5. Handle thread state machine if awaiting_dietary
        if ($currentState === 'awaiting_dietary') {
            $isGreeting = in_array($msgClean, ['hola', 'buenas', 'buen dia', 'buenas tardes', 'buenas noches', 'info', 'hola!', 'holaa', 'como estas', 'quien habla']);
            if ($isGreeting) {
                $reply = GuestMessages::askMenu($guest);
                return response()->json([
                    'processed' => false,
                    'reason' => 'Greeting in dietary state',
                    'reply' => $reply
                ]);
            }

            // A long message here is a personal note, not a menu preference: keep asking for the menu
            if (mb_strlen($message) >= self::LONG_MESSAGE_CHARS) {
                return response()->json([
                    'processed' => false,
                    'reason' => 'Long message in dietary state',
                    'reply' => GuestMessages::thanksAndAskMenu($guest, $event),
                ]);
            }

            // "Somos 2 personas" is not a menu: it is how many are coming
            $people = $this->headcountFrom($msgClean, (int) $guest->passes, false);
            if ($people !== null) {
                if ($people > (int) $guest->passes) {
                    $this->needsPerson = true;
                    return response()->json(['processed' => true, 'reason' => 'Headcount over invitation', 'reply' => GuestMessages::headcountReview($guest, $event)]);
                }
                $this->applyHeadcount($guest, $people);
                return response()->json(['processed' => true, 'reason' => 'Headcount updated in menu step', 'reply' => GuestMessages::headcountSaved($guest, $people)]);
            }

            $noDietary = in_array($msgClean, ['ninguna', 'ninguno', 'ningun', 'no', 'ninguna restriccion', 'normal', 'sin restriccion']);
            $dietaryText = $noDietary ? 'Sin restricciones' : trim($message);

            $guest->update([
                'dietary_restrictions' => $dietaryText,
                'conversation_state' => 'completed',
            ]);

            $qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" . urlencode($guest->token);

            $reply = GuestMessages::menuSaved($guest, $event, $noDietary ? null : $dietaryText);

            return response()->json([
                'processed' => true,
                'status' => $guest->status,
                'conversation_state' => 'completed',
                'guest' => $guest,
                'reply' => $reply,
                'media_url' => $qrUrl
            ]);
        }

        // Default: awaiting_attendance fallback for greetings or unknown text.
        // A long message is answered as such (it is forwarded to the planner by handleIncomingWhatsApp)
        $reply = mb_strlen($message) >= self::LONG_MESSAGE_CHARS
            ? GuestMessages::thanksAndAskAttendance($guest, $event)
            : GuestMessages::askAttendance($guest, $event);

        return response()->json([
            'processed' => false,
            'reason' => 'Awaiting valid attendance option',
            'reply' => $reply
        ]);
    }


    // Compares the last 9 digits so 0981..., 981... and 595981... all match
    private function isAdminPhone(string $rawDigits): bool
    {
        $last9 = fn ($phone) => substr(preg_replace('/[^\d]/', '', (string) $phone), -9);
        $incoming = $last9($rawDigits);
        if (strlen($incoming) < 9) {
            return false;
        }

        $adminPhones = \App\Models\User::where('role', 'admin')->whereNotNull('phone')->pluck('phone')->all();
        if (env('ADMIN_WHATSAPP_PHONE')) {
            $adminPhones[] = env('ADMIN_WHATSAPP_PHONE');
        }

        foreach ($adminPhones as $phone) {
            if ($last9($phone) === $incoming) {
                return true;
            }
        }
        return false;
    }

    private function findGuestByPhone(string $rawDigits): ?Guest
    {
        // Use last 9 digits to match phone numbers regardless of country code (595, +54) or leading zeros
        $cleanPhone = strlen($rawDigits) >= 9 ? substr($rawDigits, -9) : $rawDigits;
        $last8 = strlen($rawDigits) >= 8 ? substr($rawDigits, -8) : $rawDigits;

        return Guest::with('event')
            ->where(function ($q) use ($rawDigits, $cleanPhone, $last8) {
                $q->where('phone', 'LIKE', "%{$cleanPhone}%")
                  ->orWhere('phone', 'LIKE', "%{$last8}%")
                  ->orWhere('phone', 'LIKE', "%{$rawDigits}%")
                  ->orWhereRaw("REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') LIKE ?", ["%{$cleanPhone}%"])
                  // Another number of a shared invitation (couple / family): the same invitation
                  ->orWhere('alt_phones', 'LIKE', "%{$cleanPhone}%");
            })
            ->orderBy('created_at', 'desc')
            ->first();
    }

    /**
     * Contacto @lid desconocido: si el mensaje es un número de teléfono, se busca al invitado y se guarda
     * su LID; si no, se guarda el mensaje (ej: "1") para retomarlo y se le pide su número.
     * Devuelve el Guest vinculado o la respuesta JSON a enviar.
     */
    private function linkGuestByWhatsappLid(string $lid, string $message)
    {
        $phoneDigits = preg_replace('/[^\d]/', '', $message);
        $looksLikePhone = preg_match('/^[\d\s\+\-\(\)\.]+$/', $message) && strlen($phoneDigits) >= 8 && strlen($phoneDigits) <= 15;

        if ($looksLikePhone) {
            $guest = $this->findGuestByPhone($phoneDigits);
            if ($guest) {
                $guest->update(['whatsapp_lid' => $lid]);
                \Illuminate\Support\Facades\Log::info("[RSVP WhatsApp] LID {$lid} vinculado a {$guest->name} ({$guest->phone})");
                return $guest;
            }

            \Illuminate\Support\Facades\Log::warning("[RSVP WhatsApp] LID {$lid} envió un número que no está en la lista: {$phoneDigits}");
            return response()->json([
                'processed' => false,
                'reason' => 'LID phone not found',
                'reply' => "Mmm, no encontramos ese número en la lista de invitados 🤔\n¿Nos pasás el número exacto al que te llegó la invitación? (ej: *0981 123456*)"
            ]);
        }

        \Illuminate\Support\Facades\Cache::put("wa_lid_pending:{$lid}", $message, now()->addDay());
        \Illuminate\Support\Facades\Log::info("[RSVP WhatsApp] LID desconocido {$lid}, se pide número de teléfono (mensaje guardado: '{$message}')");

        return response()->json([
            'processed' => false,
            'reason' => 'Unknown WhatsApp LID, asked for phone',
            'reply' => "¡Hola! 😊 Para encontrar tu invitación, ¿nos pasás tu *número de teléfono*? (el mismo al que te llegó la invitación, ej: *0981 123456*)"
        ]);
    }

    public function storeSongRequest(Request $request, $token)
    {
        $guest = \App\Models\Guest::where('token', $token)->firstOrFail();
        $event = $guest->event;
        $event->ensureDigitalInvitation();

        $validated = $request->validate([
            'song_title' => 'required|string|max:255',
            'artist' => 'nullable|string|max:255',
            'spotify_id' => 'nullable|string|max:100',
            'spotify_uri' => 'nullable|string|max:150',
            'image_url' => 'nullable|string|max:500',
            'external_url' => 'nullable|string|max:500',
            'note' => 'nullable|string|max:500',
        ]);

        $songRequest = null;
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('event_song_requests')) {
                $songRequest = \App\Models\EventSongRequest::create([
                    'event_id' => $event->id,
                    'guest_id' => $guest->id,
                    'requester_name' => $guest->name,
                    'song_title' => $validated['song_title'],
                    'artist' => $validated['artist'] ?? null,
                    'spotify_id' => $validated['spotify_id'] ?? null,
                    'spotify_uri' => $validated['spotify_uri'] ?? null,
                    'image_url' => $validated['image_url'] ?? null,
                    'external_url' => $validated['external_url'] ?? null,
                    'note' => $validated['note'] ?? null,
                    'is_played' => false,
                ]);
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Error creating song request: ' . $e->getMessage());
        }

        $guest->update([
            'song_suggestion' => trim(($validated['song_title'] ?? '') . ($validated['artist'] ? ' - ' . $validated['artist'] : '')),
        ]);

        return response()->json([
            'success' => true,
            'message' => '¡Canción sugerida al DJ con éxito! 🎧',
            'song_request' => $songRequest
        ]);
    }

    public function storePublicSongRequest(Request $request, $code)
    {
        $event = \App\Models\Event::findByPublicCodeOrFail($code);
        $event->ensureDigitalInvitation();

        $validated = $request->validate([
            'requester_name' => 'required|string|max:150',
            'song_title' => 'required|string|max:255',
            'artist' => 'nullable|string|max:255',
            'spotify_id' => 'nullable|string|max:100',
            'spotify_uri' => 'nullable|string|max:150',
            'image_url' => 'nullable|string|max:500',
            'external_url' => 'nullable|string|max:500',
            'note' => 'nullable|string|max:500',
        ]);

        $songRequest = null;
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('event_song_requests')) {
                $songRequest = \App\Models\EventSongRequest::create([
                    'event_id' => $event->id,
                    'guest_id' => null,
                    'requester_name' => $validated['requester_name'],
                    'song_title' => $validated['song_title'],
                    'artist' => $validated['artist'] ?? null,
                    'spotify_id' => $validated['spotify_id'] ?? null,
                    'spotify_uri' => $validated['spotify_uri'] ?? null,
                    'image_url' => $validated['image_url'] ?? null,
                    'external_url' => $validated['external_url'] ?? null,
                    'note' => $validated['note'] ?? null,
                    'is_played' => false,
                ]);
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Error creating public song request: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => '¡Canción sugerida al DJ con éxito! 🎧',
            'song_request' => $songRequest
        ]);
    }
}

