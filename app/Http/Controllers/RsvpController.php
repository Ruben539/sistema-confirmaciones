<?php

namespace App\Http\Controllers;

use App\Models\Guest;
use App\Services\EventMilestoneService;
use Illuminate\Http\Request;

class RsvpController extends Controller
{
    public function show($token)
    {
        $guest = Guest::with('event')->where('token', $token)->firstOrFail();
        $event = $guest->event;

        $isExpired = false;
        $deadlineDateFormatted = null;

        if ($event && $event->event_date) {
            $deadlineDays = $event->rsvp_deadline_days ?? 7;
            $deadlineDate = \Carbon\Carbon::parse($event->event_date)->subDays($deadlineDays)->endOfDay();
            $deadlineDateFormatted = \Carbon\Carbon::parse($event->event_date)->subDays($deadlineDays)->format('d/m/Y');
            $isExpired = now()->greaterThan($deadlineDate);

            if ($isExpired && $guest->status === 'pending' && ($event->auto_decline_expired ?? true)) {
                $guest->update([
                    'status' => 'declined',
                    'notes' => ($guest->notes ? $guest->notes . ' | ' : '') . "Cancelado automáticamente por fecha límite expirada ({$deadlineDateFormatted})",
                    'confirmed_adults' => 0,
                    'confirmed_youth' => 0,
                    'confirmed_children' => 0,
                    'confirmed_passes' => 0,
                ]);
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

        return response()->json([
            'guest' => $guest->fresh(),
            'event' => $event,
            'is_expired' => $isExpired,
            'deadline_date' => $deadlineDateFormatted,
            'dedications' => $dedications,
        ]);
    }

    public function submit(Request $request, $token)
    {
        $guest = Guest::with('event')->where('token', $token)->firstOrFail();
        $event = $guest->event;

        if ($event && $event->event_date) {
            $deadlineDays = $event->rsvp_deadline_days ?? 7;
            $deadlineDate = \Carbon\Carbon::parse($event->event_date)->subDays($deadlineDays)->endOfDay();
            if (now()->greaterThan($deadlineDate)) {
                $formattedDeadline = \Carbon\Carbon::parse($event->event_date)->subDays($deadlineDays)->format('d/m/Y');
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
        }

        return response()->json([
            'message' => '¡Gracias! Tu respuesta ha sido registrada con éxito.',
            'guest' => $guest->fresh()
        ]);
    }

    public function uploadDedication(Request $request, $token)
    {
        $guest = Guest::with('event')->where('token', $token)->firstOrFail();
        $event = $guest->event;

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
            'is_approved' => true,
        ]);

        return response()->json([
            'message' => '¡Dedicatoria publicada con éxito!',
            'dedication' => $dedication
        ]);
    }

    public function uploadPublicDedication(Request $request, $eventId)
    {
        $event = \App\Models\Event::findOrFail($eventId);

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
            'is_approved' => true,
        ]);

        return response()->json([
            'message' => '¡Dedicatoria publicada con éxito!',
            'dedication' => $dedication
        ]);
    }

    public function publicInvitation($eventId)
    {
        $event = \App\Models\Event::findOrFail($eventId);

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

        return response()->json([
            'event' => $event,
            'dedications' => $dedications,
        ]);
    }

    public function handleIncomingWhatsApp(Request $request)
    {
        $rawDigits = preg_replace('/[^\d]/', '', $request->input('phone', ''));
        $message = trim($request->input('message', ''));

        if (empty($rawDigits) || empty($message)) {
            return response()->json(['processed' => false, 'reason' => 'Empty phone or message']);
        }

        // 0. Administrator Chatbot Commands (e.g. "APROBAR 1" or "RECHAZAR 1")
        if (preg_match('/^(aprobar|autorizar|rechazar)\s+(\d+)$/i', $message, $matches)) {
            $action = strtolower($matches[1]);
            $reqId = (int)$matches[2];
            $planReq = \App\Models\PlanRequest::with(['event', 'planner'])->find($reqId);

            if ($planReq) {
                if (in_array($action, ['aprobar', 'autorizar'])) {
                    $planReq->event->update([
                        'plan_type' => $planReq->requested_plan,
                        'max_guests' => $planReq->requested_guests,
                    ]);
                    $planReq->update([
                        'status' => 'approved',
                        'admin_notes' => 'Aprobado vía WhatsApp Bot',
                        'reviewed_at' => now(),
                    ]);

                    $eventTitle = $planReq->event->couple_names ?? $planReq->event->title;
                    $reply = "✅ *SOLICITUD #{$reqId} APROBADA EXITOSAMENTE*\n\nEl evento '{$eventTitle}' ahora cuenta con el *" . (\App\Models\Event::PLANS[$planReq->requested_plan]["label"] ?? $planReq->requested_plan) . "* y una capacidad de *{$planReq->requested_guests} invitados máx*.\nLa Wedding Planner ya puede continuar cargando su lista.";

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
                        'reply' => "❌ La solicitud de ampliación #{$reqId} ha sido rechazada."
                    ]);
                }
            }
        }

        // Use last 9 digits to match phone numbers regardless of country code (595, +54) or leading zeros
        $cleanPhone = strlen($rawDigits) >= 9 ? substr($rawDigits, -9) : $rawDigits;

        $guest = Guest::with('event')
            ->where('phone', 'LIKE', "%{$cleanPhone}%")
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$guest) {
            return response()->json(['processed' => false, 'reason' => 'Guest not found']);
        }

        $event = $guest->event;

        if ($event && !$event->is_enabled) {
            return response()->json([
                'processed' => false,
                'reason' => 'Event is disabled',
                'reply' => "¡Hola {$guest->name}! El evento no se encuentra activo o habilitado en este momento."
            ]);
        }

        $coupleNames = $event ? ($event->couple_names ?? $event->title) : 'los novios';
        $locationText = ($event && !empty($event->location)) ? "\n📍 *Lugar:* {$event->location}" : "";
        $msgClean = mb_strtolower(trim($message));
        $currentState = $guest->conversation_state ?? 'awaiting_attendance';

        // 1. Escenario: Si la fecha del evento ya pasó
        if ($event && $event->event_date) {
            try {
                $eventDate = \Carbon\Carbon::parse($event->event_date)->endOfDay();
                if (now()->greaterThan($eventDate)) {
                    $formattedDate = \Carbon\Carbon::parse($event->event_date)->format('d/m/Y');
                    $reply = "¡Hola {$guest->name}! 👋 El evento de {$coupleNames} ya se ha realizado el {$formattedDate}.{$locationText}\n\n¡Muchas gracias por tu mensaje!";
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

        // 2. Escenario: Si el invitado ya completó toda su confirmación previamente
        if ($currentState === 'completed') {
            $statusText = $guest->status === 'confirmed' ? 'Confirmada ✅' : 'Rechazada ❌';
            $dietaryNote = ($guest->status === 'confirmed' && !empty($guest->dietary_restrictions))
                ? "\n🍽️ Preferencia registrada: *{$guest->dietary_restrictions}*"
                : "";

            $qrUrl = ($guest->status === 'confirmed')
                ? "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" . urlencode($guest->token)
                : null;

            $reply = "¡Hola {$guest->name}! 👋 Tu respuesta ya se encuentra registrada como *{$statusText}* para el evento de {$coupleNames}.{$locationText}{$dietaryNote}\n\n¡Muchas gracias!";

            return response()->json([
                'processed' => true,
                'status' => $guest->status,
                'conversation_state' => 'completed',
                'guest' => $guest,
                'reply' => $reply,
                'media_url' => $qrUrl
            ]);
        }

        // 3. Check for direct confirm command ("1", "si", "confirmar")
        if (in_array($msgClean, ['1', '1️⃣', 'confirmar', 'confirmo', 'si', 'sí', 'asistire', 'asistiré'])) {
            $guest->update([
                'status' => 'confirmed',
                'conversation_state' => 'awaiting_dietary',
                'confirmed_adults' => $guest->adults > 0 ? $guest->adults : 1,
                'confirmed_youth' => $guest->youth,
                'confirmed_children' => $guest->children,
                // Confirm the whole invitation, including companions
                'confirmed_passes' => max(1, (int)$guest->adults + (int)$guest->youth + (int)$guest->children),
            ]);

            $reply = "¡Excelente {$guest->name}! Confirmamos tu asistencia al evento de {$coupleNames} 🎉{$locationText}\n\n¿Tenés alguna restricción alimentaria o menú especial (ej: celíaco, vegetariano)? Respondé con la restricción o escribí 'Ninguna'.";

            EventMilestoneService::checkMilestone($guest->event_id);

            return response()->json([
                'processed' => true,
                'status' => 'confirmed',
                'conversation_state' => 'awaiting_dietary',
                'guest' => $guest,
                'reply' => $reply
            ]);
        }

        // 4. Check for direct decline command ("2", "no", "cancelar")
        if (in_array($msgClean, ['2', '2️⃣', 'no', 'cancelar', 'rechazar', 'no podre', 'no podré'])) {
            $guest->update([
                'status' => 'declined',
                'conversation_state' => 'completed',
                'confirmed_adults' => 0,
                'confirmed_youth' => 0,
                'confirmed_children' => 0,
                'confirmed_passes' => 0,
            ]);

            $reply = "Muchas gracias por avisarnos, {$guest->name}. Lamentamos que no puedas acompañarnos al evento de {$coupleNames} 😔";

            return response()->json([
                'processed' => true,
                'status' => 'declined',
                'conversation_state' => 'completed',
                'guest' => $guest,
                'reply' => $reply
            ]);
        }

        // 5. Handle thread state machine if awaiting_dietary
        if ($currentState === 'awaiting_dietary') {
            $isGreeting = in_array($msgClean, ['hola', 'buenas', 'buen dia', 'buenas tardes', 'buenas noches', 'info', 'hola!', 'holaa', 'como estas', 'quien habla']);
            if ($isGreeting) {
                $reply = "¡Hola {$guest->name}! 👋 Tu asistencia ya está *Confirmada* al evento de {$coupleNames}.{$locationText}\n\nPara completar tu confirmación, decinos si tenés alguna restricción alimentaria o menú especial:\n• Escribí tu restricción (ej: *Celíaco*, *Vegetariano*)\n• O respondé *Ninguna*";
                return response()->json([
                    'processed' => false,
                    'reason' => 'Greeting in dietary state',
                    'reply' => $reply
                ]);
            }

            $noDietary = in_array($msgClean, ['ninguna', 'ninguno', 'ningun', 'no', 'ninguna restriccion', 'normal', 'sin restriccion']);
            $dietaryText = $noDietary ? 'Sin restricciones' : trim($message);

            $guest->update([
                'dietary_restrictions' => $dietaryText,
                'conversation_state' => 'completed',
            ]);

            $qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" . urlencode($guest->token);

            $reply = "¡Perfecto {$guest->name}! Registramos tu preferencia: '{$dietaryText}' 🍽️\n\n🎟️ *PASE DE INGRESO DIGITAL*\nAquí tenés tu código QR para la entrada al evento de {$coupleNames}.{$locationText}\nPresentá este código en la recepción para tu ingreso rápido. ¡Te esperamos!";

            return response()->json([
                'processed' => true,
                'status' => $guest->status,
                'conversation_state' => 'completed',
                'guest' => $guest,
                'reply' => $reply,
                'media_url' => $qrUrl
            ]);
        }

        // Default: awaiting_attendance fallback for greetings or unknown text
        $reply = "¡Hola {$guest->name}! 👋 Para confirmar tu asistencia al evento de {$coupleNames}, por favor respondé enviando únicamente el número de tu opción:{$locationText}\n\n1️⃣ Escribí *1* para **Confirmar Asistencia**\n2️⃣ Escribí *2* si **No podés asistir**";

        return response()->json([
            'processed' => false,
            'reason' => 'Awaiting valid attendance option',
            'reply' => $reply
        ]);
    }
}
