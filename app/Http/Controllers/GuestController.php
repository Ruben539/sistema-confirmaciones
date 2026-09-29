<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\Guest;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Auth;

class GuestController extends Controller
{
    /**
     * Valida permisos del usuario y si el evento está activo.
     */
    private function validateEventAccess(Event $event, bool $requireActive = false)
    {
        $user = Auth::user();

        // 1. Aislamiento por Planner: solo puede gestionar sus propios eventos asignados
        if ($user && $user->role === 'planner' && $event->user_id !== $user->id) {
            return response()->json([
                'message' => 'Acceso denegado: No tenés permisos para gestionar este evento.'
            ], 403);
        }

        // 2. Validación de evento activo para acciones críticas (envío WhatsApp, carga Excel, alta manual)
        if ($requireActive) {
            if (!$event->isActive()) {
                $reason = 'Este evento no está activo.';
                if (!$event->is_enabled) {
                    $reason = 'Este evento ha sido deshabilitado por el administrador.';
                } elseif ($event->status && $event->status !== 'active') {
                    $reason = 'Este evento ya ha finalizado o está inactivo.';
                } elseif ($event->event_date && \Carbon\Carbon::parse($event->event_date)->endOfDay()->isPast()) {
                    $reason = 'La fecha de este evento ya ha transcurrido.';
                }

                return response()->json([
                    'message' => "Acceso denegado: {$reason} No se permiten envíos de WhatsApp ni carga de invitados."
                ], 403);
            }
        }

        return null;
    }

    public function index($eventId)
    {
        $event = Event::findOrFail($eventId);
        if ($denied = $this->validateEventAccess($event, false)) {
            return $denied;
        }

        $guests = Guest::where('event_id', $eventId)
            ->orderBy('created_at', 'desc')
            ->get();

        $confirmed = $guests->where('status', 'confirmed');
        $pending = $guests->where('status', 'pending');
        $attended = $guests->filter(fn($g) => $g->status === 'attended' || !empty($g->attended_at));
        $confirmedOrAttended = $guests->filter(fn($g) => in_array($g->status, ['confirmed', 'attended']) || !empty($g->attended_at));

        $lactoseCount = 0;
        $celiacCount = 0;
        $veganCount = 0;
        $dietaryGuests = [];

        foreach ($guests as $g) {
            if (!empty($g->dietary_restrictions) && !in_array(mb_strtolower(trim($g->dietary_restrictions)), ['ninguna', 'ninguno', 'sin restricciones', 'normal', 'no'])) {
                $dietLower = mb_strtolower($g->dietary_restrictions);
                if (str_contains($dietLower, 'lactos')) $lactoseCount++;
                if (str_contains($dietLower, 'celiac') || str_contains($dietLower, 'celíac') || str_contains($dietLower, 'gluten')) $celiacCount++;
                if (str_contains($dietLower, 'vege') || str_contains($dietLower, 'vega')) $veganCount++;
                
                $dietaryGuests[] = [
                    'id' => $g->id,
                    'name' => $g->name,
                    'table_number' => $g->table_number ?? 'Sin mesa',
                    'dietary_restrictions' => $g->dietary_restrictions
                ];
            }
        }

        $stats = [
            'total_guests' => $guests->count(),
            'total_passes' => $guests->sum('passes'),
            'total_adults' => $guests->sum('adults'),
            'total_youth' => $guests->sum('youth'),
            'total_children' => $guests->sum('children'),
            'confirmed_guests' => $confirmedOrAttended->count(),
            'confirmed_passes' => $confirmedOrAttended->sum('confirmed_passes'),
            'confirmed_adults' => $confirmedOrAttended->sum('confirmed_adults'),
            'confirmed_youth' => $confirmedOrAttended->sum('confirmed_youth'),
            'confirmed_children' => $confirmedOrAttended->sum('confirmed_children'),
            'attended_guests' => $attended->count(),
            'attended_passes' => $attended->sum(fn($g) => $g->confirmed_passes > 0 ? $g->confirmed_passes : $g->passes),
            'pending_arrival' => max(0, $confirmedOrAttended->count() - $attended->count()),
            'declined_guests' => $guests->where('status', 'declined')->count(),
            'pending_guests' => $pending->count(),
            'pending_passes' => $pending->sum('passes'),
            'messages_sent' => $guests->where('whatsapp_status', 'sent')->count(),
            'dietary_summary' => [
                'total' => count($dietaryGuests),
                'lactose' => $lactoseCount,
                'celiac' => $celiacCount,
                'vegan' => $veganCount,
                'list' => $dietaryGuests
            ]
        ];

        return response()->json([
            'guests' => $guests,
            'stats' => $stats
        ]);
    }

    private function formatParaguayPhone($phone)
    {
        $digits = preg_replace('/[^\d]/', '', $phone);
        if (empty($digits)) return '';

        // Local format with 0 (e.g. 0981630070 -> 595981630070)
        if (str_starts_with($digits, '09') && strlen($digits) === 10) {
            return '595' . substr($digits, 1);
        }

        // Local format without 0 (e.g. 981630070 -> 595981630070)
        if (str_starts_with($digits, '9') && strlen($digits) === 9) {
            return '595' . $digits;
        }

        // Already international 595 format (e.g. 595981630070)
        if (str_starts_with($digits, '595')) {
            return $digits;
        }

        // General fallback for 9-digit mobile numbers starting with 9
        if (strlen($digits) >= 9) {
            $last9 = substr($digits, -9);
            if (str_starts_with($last9, '9')) {
                return '595' . $last9;
            }
        }

        return $digits;
    }

    public function store(Request $request, $eventId)
    {
        $event = Event::findOrFail($eventId);
        if ($denied = $this->validateEventAccess($event, true)) {
            return $denied;
        }

        $currentCount = Guest::where('event_id', $eventId)->count();
        if ($currentCount >= $event->max_guests) {
            return response()->json([
                'message' => "Límite alcanzado: Este evento tiene un plan '{$event->plan_type}' con un máximo de {$event->max_guests} invitados. Llevas {$currentCount} registrados."
            ], 422);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:50',
            'category' => 'nullable|string|in:adult,youth,child,Adulto,Joven,Niño,Jóven',
            'table_number' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
        ]);

        $formattedPhone = $this->formatParaguayPhone($validated['phone']);
        $cleanDigits = preg_replace('/[^\d]/', '', $formattedPhone);
        $phoneKey = strlen($cleanDigits) >= 9 ? substr($cleanDigits, -9) : $cleanDigits;

        // Anti-duplicate protection: check if phone already exists in this event
        $existing = Guest::where('event_id', $eventId)
            ->where(function ($q) use ($formattedPhone, $phoneKey) {
                $q->where('phone', $formattedPhone)
                  ->orWhere('phone', 'LIKE', "%{$phoneKey}%");
            })
            ->first();

        if ($existing) {
            return response()->json([
                'message' => "Ya existe un invitado registrado con el teléfono {$validated['phone']} ({$existing->name})."
            ], 422);
        }

        $cat = strtolower($validated['category'] ?? 'adult');

        $adults = 1;
        $youth = 0;
        $children = 0;

        if (in_array($cat, ['youth', 'joven', 'jóven'])) {
            $adults = 0; $youth = 1; $children = 0;
        } elseif (in_array($cat, ['child', 'niño', 'nino'])) {
            $adults = 0; $youth = 0; $children = 1;
        }

        $guest = Guest::create([
            'event_id' => $eventId,
            'name' => trim($validated['name']),
            'phone' => $formattedPhone,
            'adults' => $adults,
            'youth' => $youth,
            'children' => $children,
            'passes' => 1,
            'table_number' => $validated['table_number'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'status' => 'pending',
            'token' => Str::random(32),
        ]);

        return response()->json([
            'message' => 'Invitado agregado con éxito',
            'guest' => $guest
        ], 201);
    }

    public function importBatch(Request $request, $eventId)
    {
        $event = Event::findOrFail($eventId);
        if ($denied = $this->validateEventAccess($event, true)) {
            return $denied;
        }

        $currentCount = Guest::where('event_id', $eventId)->count();
        $availableSlots = max(0, $event->max_guests - $currentCount);

        $validated = $request->validate([
            'guests' => 'required|array',
            'guests.*.name' => 'required|string',
            'guests.*.phone' => 'required|string',
            'guests.*.category' => 'nullable|string',
            'guests.*.table_number' => 'nullable|string',
            'guests.*.dietary_restrictions' => 'nullable|string',
            'guests.*.restricciones' => 'nullable|string',
            'guests.*.dieta' => 'nullable|string',
            'guests.*.notes' => 'nullable|string',
        ]);

        // Preload all existing guests for this event into a phone index map
        $existingGuests = Guest::where('event_id', $eventId)->get();
        $existingMap = [];
        foreach ($existingGuests as $eg) {
            $digits = preg_replace('/[^\d]/', '', $eg->phone);
            if (!empty($digits)) {
                $key = strlen($digits) >= 9 ? substr($digits, -9) : $digits;
                $existingMap[$key] = $eg;
            }
        }

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $limitReached = false;
        $seenInBatch = [];

        foreach ($validated['guests'] as $item) {
            $name = trim($item['name'] ?? '');
            $phone = trim($item['phone'] ?? '');
            if (empty($name) || empty($phone)) continue;

            $formattedPhone = $this->formatParaguayPhone($phone);
            $cleanDigits = preg_replace('/[^\d]/', '', $formattedPhone);
            $phoneKey = strlen($cleanDigits) >= 9 ? substr($cleanDigits, -9) : $cleanDigits;

            // In-batch duplicate check (if the Excel file repeats the same phone number)
            if (isset($seenInBatch[$phoneKey])) {
                $skipped++;
                continue;
            }
            $seenInBatch[$phoneKey] = true;

            $cat = strtolower(trim($item['category'] ?? 'adult'));

            $adults = 1;
            $youth = 0;
            $children = 0;

            if (str_contains($cat, 'jov') || str_contains($cat, 'jóv') || str_contains($cat, 'youth')) {
                $adults = 0; $youth = 1; $children = 0;
            } elseif (str_contains($cat, 'niñ') || str_contains($cat, 'nin') || str_contains($cat, 'child')) {
                $adults = 0; $youth = 0; $children = 1;
            }

            $dietary = $item['dietary_restrictions'] ?? $item['restricciones'] ?? $item['dieta'] ?? null;
            $tableNumber = isset($item['table_number']) && trim($item['table_number']) !== '' ? trim($item['table_number']) : null;
            $dietaryRestrictions = $dietary && trim($dietary) !== '' ? trim($dietary) : null;
            $notes = $item['notes'] ?? null;

            // Anti-duplicate: Guest already exists in this event
            if (isset($existingMap[$phoneKey])) {
                $existingGuest = $existingMap[$phoneKey];
                $updateFields = [];

                if ($tableNumber !== null && $existingGuest->table_number !== $tableNumber) {
                    $updateFields['table_number'] = $tableNumber;
                }
                if ($dietaryRestrictions !== null && $existingGuest->dietary_restrictions !== $dietaryRestrictions) {
                    $updateFields['dietary_restrictions'] = $dietaryRestrictions;
                }
                if ($notes !== null && $existingGuest->notes !== $notes) {
                    $updateFields['notes'] = $notes;
                }
                if ($existingGuest->adults !== $adults || $existingGuest->youth !== $youth || $existingGuest->children !== $children) {
                    $updateFields['adults'] = $adults;
                    $updateFields['youth'] = $youth;
                    $updateFields['children'] = $children;
                }

                if (!empty($updateFields)) {
                    $existingGuest->update($updateFields);
                    $updated++;
                } else {
                    $skipped++;
                }
                continue;
            }

            // New guest creation - check plan limit
            if ($created >= $availableSlots) {
                $limitReached = true;
                break;
            }

            $newGuest = Guest::create([
                'event_id' => $eventId,
                'name' => $name,
                'phone' => $formattedPhone,
                'adults' => $adults,
                'youth' => $youth,
                'children' => $children,
                'passes' => 1,
                'table_number' => $tableNumber,
                'dietary_restrictions' => $dietaryRestrictions,
                'notes' => $notes,
                'status' => 'pending',
                'token' => Str::random(32),
            ]);

            $existingMap[$phoneKey] = $newGuest;
            $created++;
        }

        $summaryParts = [];
        if ($created > 0) {
            $summaryParts[] = "{$created} nuevos invitados importados";
        }
        if ($updated > 0) {
            $summaryParts[] = "{$updated} actualizados";
        }
        if ($skipped > 0) {
            $summaryParts[] = "{$skipped} duplicados omitidos";
        }

        $unimportedDueToLimit = 0;
        if ($limitReached) {
            $totalInFile = count($validated['guests']);
            $processedCount = $created + $updated + $skipped;
            $unimportedDueToLimit = max(0, $totalInFile - $processedCount);
        }

        if (empty($summaryParts)) {
            $message = $limitReached
                ? "Límite alcanzado: Este evento ya cuenta con {$currentCount} de los {$event->max_guests} invitados permitidos por su plan ('{$event->plan_type}'). No es posible registrar nuevos invitados."
                : "No se encontraron invitados nuevos para importar.";

            return response()->json([
                'message' => $message,
                'count' => 0,
                'created' => 0,
                'updated' => 0,
                'skipped' => $skipped,
                'limit_reached' => true,
                'unimported_due_to_limit' => $unimportedDueToLimit
            ], 422);
        }

        $message = "Operación completada: " . implode(', ', $summaryParts) . '.';
        if ($limitReached) {
            $limitWarning = " (Se alcanzó el límite de {$event->max_guests} invitados de tu plan '{$event->plan_type}'";
            if ($unimportedDueToLimit > 0) {
                $limitWarning .= "; {$unimportedDueToLimit} no pudieron ingresar por falta de cupo";
            }
            $limitWarning .= ")";
            $message .= $limitWarning;
        }

        return response()->json([
            'message' => $message,
            'count' => $created,
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'limit_reached' => $limitReached
        ]);
    }

    public function update(Request $request, $id)
    {
        $guest = Guest::with('event')->findOrFail($id);
        if ($guest->event && ($denied = $this->validateEventAccess($guest->event, false))) {
            return $denied;
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone' => 'sometimes|string|max:50',
            'passes' => 'sometimes|integer|min:1',
            'confirmed_passes' => 'sometimes|integer|min:0',
            'adults' => 'sometimes|integer|min:0',
            'youth' => 'sometimes|integer|min:0',
            'children' => 'sometimes|integer|min:0',
            'confirmed_adults' => 'sometimes|integer|min:0',
            'confirmed_youth' => 'sometimes|integer|min:0',
            'confirmed_children' => 'sometimes|integer|min:0',
            'table_number' => 'nullable|string|max:100',
            'status' => 'sometimes|in:pending,confirmed,declined,attended',
            'dietary_restrictions' => 'nullable|string',
            'notes' => 'nullable|string',
            'whatsapp_status' => 'sometimes|in:not_sent,sent,delivered',
        ]);

        if (isset($validated['phone'])) {
            $validated['phone'] = $this->formatParaguayPhone($validated['phone']);
        }

        $guest->update($validated);

        if (isset($validated['status']) && in_array($validated['status'], ['confirmed', 'attended'])) {
            \App\Services\EventMilestoneService::checkMilestone($guest->event_id);
        }

        return response()->json([
            'message' => 'Invitado actualizado',
            'guest' => $guest
        ]);
    }

    public function markSent(Request $request, $id)
    {
        $guest = Guest::with('event')->findOrFail($id);
        if ($guest->event && ($denied = $this->validateEventAccess($guest->event, true))) {
            return $denied;
        }

        $guest->update([
            'whatsapp_status' => 'sent',
            'last_sent_at' => now(),
        ]);

        return response()->json([
            'message' => 'Estado de WhatsApp actualizado a enviado',
            'guest' => $guest
        ]);
    }

    public function sendWhatsAppApi(Request $request, $id)
    {
        $guest = Guest::with('event')->findOrFail($id);
        $event = $guest->event;

        if ($event && ($denied = $this->validateEventAccess($event, true))) {
            return $denied;
        }

        // Prevenir reenvío si ya figura como enviado
        if ($guest->whatsapp_status === 'sent' && !$request->boolean('force', false)) {
            return response()->json([
                'message' => "El mensaje ya fue enviado previamente a {$guest->name}.",
                'guest' => $guest
            ], 400);
        }

        $rawLocation = $event->location ?? 'Por confirmar';
        if ($rawLocation !== 'Por confirmar' && !str_starts_with($rawLocation, 'http')) {
            $formattedLocation = $rawLocation . "\n🗺️ Ver en Google Maps: https://maps.google.com/?q=" . urlencode($rawLocation);
        } else {
            $formattedLocation = $rawLocation;
        }

        $mode = $request->input('mode', 'invitation');
        if ($mode === 'reminder') {
            $template = "¡Hola {nombre}! ⏰ Recordatorio: Te recordamos que la fecha límite para confirmar tu asistencia al evento de {pareja} vence pronto.\n📍 Lugar: {lugar}\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir";
        } else {
            $template = $event->message_template ?? "¡Hola {nombre}! Te invitamos al evento de {pareja} ✨\n📍 Lugar: {lugar}\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir";
            if (!str_contains($template, '{nombre}')) {
                $template = "¡Hola {nombre}!\n" . $template;
            }
        }

        $rsvpUrl = url('/confirmar/' . $guest->token);
        $message = str_replace(
            ['{nombre}', '{pareja}', '{lugar}', '{link}'],
            [$guest->name, $event->couple_names ?? $event->title, $formattedLocation, $rsvpUrl],
            $template
        );

        $botUrl = env('WHATSAPP_BOT_URL', 'http://127.0.0.1:3001/lead');

        try {
            $response = \Illuminate\Support\Facades\Http::timeout(10)->post($botUrl, [
                'phone' => preg_replace('/[^\d]/', '', $guest->phone),
                'message' => $message,
                'session_id' => $event->user_id ? "planner_{$event->user_id}" : "default"
            ]);

            if ($response->successful()) {
                $guest->update([
                    'whatsapp_status' => 'sent',
                    'last_sent_at' => now(),
                ]);

                return response()->json([
                    'message' => "Mensaje enviado automáticamente por WhatsApp a {$guest->name}",
                    'guest' => $guest
                ]);
            }
        } catch (\Throwable $e) {
            try {
                \Illuminate\Support\Facades\Log::warning('Error conectando con el bot de WhatsApp: ' . $e->getMessage());
            } catch (\Throwable $logError) {
                // Ignore storage log permission issues
            }
        }

        return response()->json([
            'message' => 'No se pudo conectar con el bot Baileys de WhatsApp. Verificá que el servicio esté ejecutándose en el puerto 3001 o enviá el mensaje manualmente.',
            'guest' => $guest
        ], 500);
    }

    public function destroy($id)
    {
        $guest = Guest::with('event')->findOrFail($id);
        if ($guest->event && ($denied = $this->validateEventAccess($guest->event, false))) {
            return $denied;
        }

        $guest->delete();

        return response()->json(['message' => 'Invitado eliminado']);
    }

    public function destroyAll($eventId)
    {
        $event = Event::findOrFail($eventId);
        if ($denied = $this->validateEventAccess($event, false)) {
            return $denied;
        }

        Guest::where('event_id', $eventId)->delete();

        return response()->json(['message' => 'Lista de invitados reiniciada']);
    }

    public function scanQrCheckIn(Request $request, $token = null)
    {
        $inputToken = $token ?? $request->input('token') ?? $request->input('qr_data') ?? $request->input('code');

        if (empty($inputToken)) {
            return response()->json([
                'success' => false,
                'status' => 'error',
                'message' => 'Código QR no proporcionado.'
            ], 400);
        }

        // Clean token if full URL was scanned (e.g. http://192.168.100.20:8000/confirmar/ABC123XYZ)
        $cleanToken = $inputToken;
        if (str_contains($cleanToken, '/confirmar/')) {
            $cleanToken = substr($cleanToken, strrpos($cleanToken, '/') + 1);
        }

        $guest = Guest::with('event')->where('token', $cleanToken)->first();

        if (!$guest) {
            return response()->json([
                'success' => false,
                'status' => 'invalid',
                'message' => '⛔ Entrada Inválida: El código QR no pertenece a ningún invitado registrado.'
            ], 404);
        }

        $event = $guest->event;

        // Check if guest is declined
        if ($guest->status === 'declined') {
            return response()->json([
                'success' => false,
                'status' => 'declined',
                'message' => "⚠️ Invitado Cancelado: {$guest->name} figura como 'No Asistirá'.",
                'guest' => $guest,
                'event' => $event,
            ], 422);
        }

        // Check if already checked in
        if ($guest->attended_at !== null || $guest->status === 'attended') {
            $carbonTime = $guest->attended_at ? \Carbon\Carbon::parse($guest->attended_at)->setTimezone('America/Asuncion') : null;
            $formattedTime = $carbonTime ? $carbonTime->format('H:i') : 'anteriormente';
            $formattedDate = $carbonTime ? $carbonTime->format('d/m/Y') : '';
            return response()->json([
                'success' => false,
                'status' => 'already_used',
                'already_checked_in' => true,
                'message' => "⚠️ ¡PASE YA UTILIZADO! {$guest->name} ya ingresó el {$formattedDate} a las {$formattedTime} hs.",
                'guest' => $guest,
                'event' => $event,
                'attended_at' => $formattedTime,
            ], 409);
        }

        // Valid first-time accreditation!
        $nowLocal = now()->setTimezone('America/Asuncion');
        $guest->update([
            'status' => 'attended',
            'attended_at' => $nowLocal,
        ]);

        return response()->json([
            'success' => true,
            'status' => 'success',
            'message' => "✅ ¡ENTRADA VÁLIDA! Bienvenido/a {$guest->name}.",
            'guest' => $guest->fresh(),
            'event' => $event,
            'passes' => $guest->confirmed_passes > 0 ? $guest->confirmed_passes : $guest->passes,
            'table_number' => $guest->table_number ?? 'Sin mesa asignada',
        ]);
    }

    public function sendBulkQueue(Request $request, $eventId)
    {
        $event = Event::findOrFail($eventId);
        if ($denied = $this->validateEventAccess($event, true)) {
            return $denied;
        }

        $mode = $request->input('mode', 'invitation');
        $guestIds = $request->input('guest_ids');

        $query = Guest::where('event_id', $eventId)->where('whatsapp_status', 'not_sent');
        if (!empty($guestIds) && is_array($guestIds)) {
            $query->whereIn('id', $guestIds);
        }

        $guests = $query->get();

        if ($guests->isEmpty()) {
            return response()->json([
                'message' => 'No hay invitados pendientes seleccionados para programar el envío.'
            ], 422);
        }

        $delayCount = 0;
        foreach ($guests as $guest) {
            \App\Jobs\SendWhatsAppMessageJob::dispatch($guest->id, $mode)->delay(now()->addSeconds($delayCount * 12));
            $delayCount++;
        }

        $estimatedMins = ceil(($delayCount * 12) / 60);

        return response()->json([
            'message' => "⚡ ¡Envío masivo programado con éxito para {$guests->count()} invitados! Los mensajes se enviarán en segundo plano con retardo anti-spam (1 por cada 10-15s). Podés cerrar la página o apagar la laptop sin problemas.",
            'count' => $guests->count(),
            'estimated_minutes' => $estimatedMins
        ]);
    }
}
