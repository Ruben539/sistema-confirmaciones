<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\Guest;
use App\Models\Table;
use App\Jobs\SendWhatsAppMessageJob;
use App\Services\WhatsAppMessage;
use App\Services\WhatsAppThrottle;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

class GuestController extends Controller
{
    /**
     * Valida permisos del usuario y si el evento está activo.
     */
    private function validateEventAccess(Event $event, bool $requireActive = false)
    {
        $user = Auth::user();

        // 1. Aislamiento: planner solo sus eventos, anfitriona solo los asignados (User::canAccessEvent)
        if ($user && !$user->canAccessEvent($event)) {
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

        // People of a confirmed invitation: what they confirmed, or the invited composition when the
        // confirmation has no detail (e.g. marked as confirmed by hand from the panel)
        $confirmedPeople = function ($g) {
            $detail = (int) $g->confirmed_adults + (int) $g->confirmed_youth + (int) $g->confirmed_children;
            if ($detail > 0) {
                return ['adults' => (int) $g->confirmed_adults, 'youth' => (int) $g->confirmed_youth, 'children' => (int) $g->confirmed_children, 'passes' => $detail];
            }
            $adults = (int) $g->adults;
            $youth = (int) $g->youth;
            $children = (int) $g->children;
            if ($adults + $youth + $children === 0) {
                $adults = 1; // invitation without composition: the invited person
            }
            return ['adults' => $adults, 'youth' => $youth, 'children' => $children, 'passes' => $adults + $youth + $children];
        };

        $stats = [
            'total_guests' => $guests->count(),
            'total_passes' => $guests->sum('passes'),
            'total_adults' => $guests->sum('adults'),
            'total_youth' => $guests->sum('youth'),
            'total_children' => $guests->sum('children'),
            'confirmed_guests' => $confirmedOrAttended->count(),
            'confirmed_passes' => $confirmedOrAttended->sum(fn ($g) => $confirmedPeople($g)['passes']),
            'confirmed_adults' => $confirmedOrAttended->sum(fn ($g) => $confirmedPeople($g)['adults']),
            'confirmed_youth' => $confirmedOrAttended->sum(fn ($g) => $confirmedPeople($g)['youth']),
            'confirmed_children' => $confirmedOrAttended->sum(fn ($g) => $confirmedPeople($g)['children']),
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
            'adults' => 'nullable|integer|min:0|max:20',
            'youth' => 'nullable|integer|min:0|max:20',
            'children' => 'nullable|integer|min:0|max:20',
            'companions' => 'nullable|string|max:255',
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

        // Explicit counts (invited person + companions) take precedence over the single category
        if (isset($validated['adults']) || isset($validated['youth']) || isset($validated['children'])) {
            $adults = (int)($validated['adults'] ?? 0);
            $youth = (int)($validated['youth'] ?? 0);
            $children = (int)($validated['children'] ?? 0);
            if ($adults + $youth + $children < 1) {
                return response()->json(['message' => 'La invitación debe incluir al menos una persona.'], 422);
            }
        }

        $companions = trim($validated['companions'] ?? '');

        // Same naming rule as the seating plan; creates the table if it doesn't exist yet
        [$table] = Table::ensureExists($eventId, $validated['table_number'] ?? null, $adults + $youth + $children);

        $guest = Guest::create([
            'event_id' => $eventId,
            'name' => trim($validated['name']),
            'phone' => $formattedPhone,
            'adults' => $adults,
            'youth' => $youth,
            'children' => $children,
            'companions' => $companions !== '' ? $companions : null,
            'table_number' => $table?->name,
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
            'guests.*.companion_adults' => 'nullable|integer|min:0|max:20',
            'guests.*.companion_children' => 'nullable|integer|min:0|max:20',
            'guests.*.companions' => 'nullable|string|max:255',
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
        $unimportedDueToLimit = 0;
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

            // Only overwrite the category of existing guests when the file actually provides one
            $hasCategory = trim($item['category'] ?? '') !== '';
            $cat = mb_strtolower(trim($item['category'] ?? 'adult'));

            $adults = 1;
            $youth = 0;
            $children = 0;

            if (str_contains($cat, 'jov') || str_contains($cat, 'jóv') || str_contains($cat, 'youth')) {
                $adults = 0; $youth = 1; $children = 0;
            } elseif (str_contains($cat, 'niñ') || str_contains($cat, 'nin') || str_contains($cat, 'child')) {
                $adults = 0; $youth = 0; $children = 1;
            }

            // Companions travel on the same invitation (e.g. a mother bringing her daughter)
            $hasCompanionCounts = isset($item['companion_adults']) || isset($item['companion_children']);
            $adults += (int)($item['companion_adults'] ?? 0);
            $children += (int)($item['companion_children'] ?? 0);
            $companions = trim($item['companions'] ?? '');
            $companions = $companions !== '' ? $companions : null;

            $dietary = $item['dietary_restrictions'] ?? $item['restricciones'] ?? $item['dieta'] ?? null;
            $tableNumber = Table::normalizeName($item['table_number'] ?? null);
            $dietaryRestrictions = $dietary && trim($dietary) !== '' ? trim($dietary) : null;
            $notes = $item['notes'] ?? null;

            // Anti-duplicate: Guest already exists in this event
            if (isset($existingMap[$phoneKey])) {
                $existingGuest = $existingMap[$phoneKey];
                $updateFields = [];

                if ($tableNumber !== null && Table::nameKey($existingGuest->table_number) !== Table::nameKey($tableNumber)) {
                    $updateFields['table_number'] = $tableNumber;
                }
                if ($dietaryRestrictions !== null && $existingGuest->dietary_restrictions !== $dietaryRestrictions) {
                    $updateFields['dietary_restrictions'] = $dietaryRestrictions;
                }
                if ($notes !== null && $existingGuest->notes !== $notes) {
                    $updateFields['notes'] = $notes;
                }
                if ($companions !== null && $existingGuest->companions !== $companions) {
                    $updateFields['companions'] = $companions;
                }
                if (($hasCategory || $hasCompanionCounts) && ((int) $existingGuest->adults !== $adults || (int) $existingGuest->youth !== $youth || (int) $existingGuest->children !== $children)) {
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

            // New guest creation - check plan limit (keep looping so existing guests further down still get updated)
            if ($created >= $availableSlots) {
                $limitReached = true;
                $unimportedDueToLimit++;
                continue;
            }

            $newGuest = Guest::create([
                'event_id' => $eventId,
                'name' => $name,
                'phone' => $formattedPhone,
                'adults' => $adults,
                'youth' => $youth,
                'children' => $children,
                'companions' => $companions,
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

        // Create missing tables for the imported table numbers (same naming rule as the seating plan),
        // and make guests use each table's exact name
        $guestTables = Guest::where('event_id', $eventId)
            ->whereNotNull('table_number')
            ->get()
            ->groupBy(fn($g) => Table::nameKey($g->table_number))
            ->filter(fn($group, $key) => $key !== '');

        $createdTablesCount = 0;
        foreach ($guestTables as $group) {
            $totalPasses = (int) $group->sum('passes');
            [$tableRecord, $created] = Table::ensureExists($eventId, $group->first()->table_number, $totalPasses);
            if ($created) {
                $createdTablesCount++;
            } elseif ($tableRecord->capacity < $totalPasses) {
                $tableRecord->update(['capacity' => $totalPasses]);
            }
            $group->where('table_number', '!=', $tableRecord->name)
                ->each(fn($g) => $g->update(['table_number' => $tableRecord->name]));
        }

        if ($createdTablesCount > 0) {
            $summaryParts[] = "{$createdTablesCount} mesas creadas en distribución de salón";
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
                'limit_reached' => $limitReached,
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
            'limit_reached' => $limitReached,
            'unimported_due_to_limit' => $unimportedDueToLimit
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
            'companions' => 'nullable|string|max:255',
            'confirmed_adults' => 'sometimes|integer|min:0',
            'confirmed_youth' => 'sometimes|integer|min:0',
            'confirmed_children' => 'sometimes|integer|min:0',
            'table_number' => 'nullable|string|max:100',
            'status' => 'sometimes|in:pending,confirmed,declined,attended',
            'dietary_restrictions' => 'nullable|string',
            'notes' => 'nullable|string',
            'whatsapp_status' => 'sometimes|in:not_sent,sent,delivered',
            // Status the client saw before changing it (door devices): if another device already
            // changed the guest, the change is rejected instead of silently overwriting it
            'expected_status' => 'sometimes|in:pending,confirmed,declined,attended',
        ]);

        // Anfitriona: solo el ingreso en puerta (confirmado <-> ingresó) y la mesa
        if (Auth::user()?->isHostess()) {
            $notAllowed = array_diff(array_keys($validated), ['status', 'expected_status', 'table_number']);
            $statusChange = $validated['status'] ?? null;
            if ($notAllowed || ($statusChange && (!in_array($statusChange, ['attended', 'confirmed']) || !in_array($guest->status, ['attended', 'confirmed'])))) {
                return response()->json([
                    'message' => 'Como anfitriona solo podés registrar el ingreso y cambiar la mesa de invitados confirmados.',
                ], 403);
            }
        }

        $expectedStatus = $validated['expected_status'] ?? null;
        unset($validated['expected_status']);
        if ($expectedStatus && $guest->status !== $expectedStatus) {
            $when = $guest->status === 'attended' && $guest->attended_at
                ? ' a las ' . \Carbon\Carbon::parse($guest->attended_at)->format('H:i')
                : '';
            $label = ['attended' => 'INGRESADO', 'confirmed' => 'CONFIRMADO (sin ingresar)', 'pending' => 'PENDIENTE', 'declined' => 'NO ASISTE'][$guest->status] ?? $guest->status;
            return response()->json([
                'status' => 'conflict',
                'message' => "{$guest->name} ya figura como {$label}{$when}: lo actualizó otro dispositivo.",
                'guest' => $guest,
            ], 409);
        }

        // Door check-in by hand: keep attended_at in sync with the status (the QR scan already does it)
        if (isset($validated['status'])) {
            if ($validated['status'] === 'attended' && $guest->status !== 'attended') {
                $validated['attended_at'] = $guest->attended_at ?? now();
            } elseif ($validated['status'] !== 'attended' && $guest->status === 'attended') {
                $validated['attended_at'] = null;
            }
        }

        if (isset($validated['phone'])) {
            $validated['phone'] = $this->formatParaguayPhone($validated['phone']);
        }

        if (array_key_exists('table_number', $validated)) {
            [$table] = Table::ensureExists($guest->event_id, $validated['table_number'], (int) $guest->passes);
            $validated['table_number'] = $table?->name;
        }

        $previousStatus = $guest->status;
        $guest->update($validated);

        if (isset($validated['status']) && in_array($validated['status'], ['confirmed', 'attended'])) {
            \App\Services\EventMilestoneService::checkMilestone($guest->event_id);
        }

        // Si se acaba de confirmar el invitado desde la web: enviar automáticamente el Pase QR por WhatsApp
        // (only a real new confirmation: undoing a door check-in, attended -> confirmed, must not resend it)
        if (isset($validated['status']) && $validated['status'] === 'confirmed' && in_array($previousStatus, ['pending', 'declined']) && !empty($guest->phone)) {
            $this->sendWhatsAppQrPass($guest);
        }

        return response()->json([
            'message' => 'Invitado actualizado',
            'guest' => $guest
        ]);
    }

    /**
     * Re-sends the QR entry pass to a confirmed guest's WhatsApp (e.g. they deleted the message).
     * Same QR (guest token) and same bot as the automatic send on confirmation.
     */
    public function resendQrPass($id)
    {
        $guest = Guest::with('event')->findOrFail($id);
        if ($guest->event && ($denied = $this->validateEventAccess($guest->event, true))) {
            return $denied;
        }

        if (!in_array($guest->status, ['confirmed', 'attended'])) {
            return response()->json([
                'message' => "{$guest->name} todavía no confirmó su asistencia: el QR se envía solo cuando confirma.",
            ], 422);
        }

        if (empty(preg_replace('/[^\d]/', '', (string) $guest->phone))) {
            return response()->json([
                'message' => "{$guest->name} no tiene un teléfono registrado.",
            ], 422);
        }

        // Avoid double taps sending the pass twice
        if (!Cache::add("qr_resend:{$guest->id}", true, now()->addMinutes(2))) {
            return response()->json([
                'message' => "El QR de {$guest->name} se acaba de enviar. Esperá un par de minutos antes de reenviarlo.",
            ], 429);
        }

        if (!$this->sendWhatsAppQrPass($guest, true)) {
            Cache::forget("qr_resend:{$guest->id}");
            return response()->json([
                'message' => 'No se pudo enviar por el WhatsApp del sistema. Verificá que el bot esté conectado e intentá de nuevo.',
            ], 502);
        }

        return response()->json([
            'message' => "Se reenvió el pase QR a {$guest->name} por WhatsApp.",
        ]);
    }

    public function sendWhatsAppQrPass(Guest $guest, bool $isResend = false): bool
    {
        try {
            $event = $guest->event;
            $botUrl = config('whatsapp.bot_url') ?: 'http://127.0.0.1:3001/lead';
            $coupleNames = $event ? ($event->couple_names ?? $event->title) : 'los novios';
            $locationText = ($event && !empty($event->location)) ? "\n📍 *Lugar:* {$event->location}" : "";
            $qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" . urlencode($guest->token);

            $intro = $isResend
                ? "¡Hola {$guest->name}! 👋 Te reenviamos tu pase para el evento de {$coupleNames}.{$locationText}"
                : "¡Hola {$guest->name}! 🎉 Tu asistencia al evento de {$coupleNames} ha sido confirmada.{$locationText}";
            $message = "{$intro}\n\n🎟️ *PASE DE INGRESO DIGITAL*\nAquí tenés tu código QR para la entrada al evento. Presentalo en la recepción para tu ingreso rápido. ¡Te esperamos!";

            $cleanPhone = preg_replace('/[^\d]/', '', $guest->phone);

            $response = \Illuminate\Support\Facades\Http::timeout(10)->post($botUrl, [
                'phone' => $cleanPhone,
                'message' => $message,
                'mediaUrl' => $qrUrl,
                'session_id' => ($event && $event->user_id) ? "planner_{$event->user_id}" : "default"
            ]);
            \App\Models\GuestActivity::record(
                $guest,
                $response->successful() ? 'qr_sent' : 'qr_failed',
                $response->successful()
                    ? ($isResend ? 'Pase QR reenviado por WhatsApp' : 'Pase QR enviado por WhatsApp')
                    : 'No se pudo enviar el pase QR (el bot no respondió)'
            );
            return $response->successful();
        } catch (\Throwable $e) {
            \App\Models\GuestActivity::record($guest, 'qr_failed', 'No se pudo enviar el pase QR: sin conexión con el bot');
            \Illuminate\Support\Facades\Log::warning("[GuestController] No se pudo enviar WhatsApp con QR: " . $e->getMessage());
            return false;
        }
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

        $mode = $request->input('mode', 'invitation');
        $message = WhatsAppMessage::build($guest, $mode);
        $botUrl = config('whatsapp.bot_url');

        // Manual sends count against the same per-number pacing and daily limit as bulk sends
        $throttle = WhatsAppThrottle::forSession(WhatsAppThrottle::sessionForEvent($event));
        $lock = $throttle->lock();
        $skipThrottle = $request->boolean('skip_throttle', false);
        $wait = $lock ? $throttle->secondsUntilAllowed() : 30;
        if ($wait > 0 && !$skipThrottle) {
            $lock?->release();
            return response()->json([
                'message' => $throttle->waitReason() . ' Intentá de nuevo en ' . ($wait >= 120 ? ceil($wait / 60) . ' minutos' : "{$wait} segundos") . '.',
                'retry_after' => $wait,
                'guest' => $guest
            ], 429);
        }

        $mediaUrl = null;
        if (!empty($event->cover_photo_path)) {
            $disk = \Illuminate\Support\Facades\Storage::disk('public');
            if ($disk->exists($event->cover_photo_path)) {
                $mediaUrl = $disk->path($event->cover_photo_path);
            } elseif ($event->cover_photo_url) {
                $mediaUrl = $event->cover_photo_url;
            }
        }

        try {
            $payload = [
                'phone' => preg_replace('/[^\d]/', '', $guest->phone),
                'message' => $message,
                'session_id' => $event->user_id ? "planner_{$event->user_id}" : "default"
            ];
            if ($mediaUrl) {
                $payload['mediaUrl'] = $mediaUrl;
            }

            $response = \Illuminate\Support\Facades\Http::timeout(15)->post($botUrl, $payload);

            if ($response->successful()) {
                $throttle->recordSent();
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
        } finally {
            $lock->release();
        }

        return response()->json([
            'message' => 'No se pudo conectar con el bot Baileys de WhatsApp. Verificá que el servicio esté ejecutándose en el puerto 3001 o enviá el mensaje manualmente.',
            'guest' => $guest
        ], 500);
    }

    /**
     * Sends a confirmation reminder to one pending guest through the bot (same queue, pacing and
     * sending window as the automatic reminders). The guest can answer 1 / 2 and it's processed
     * automatically; reminder_sent_at / reminder_count are updated when it goes out.
     */
    public function sendReminder($id)
    {
        $guest = Guest::with('event')->findOrFail($id);
        $event = $guest->event;

        if ($event && ($denied = $this->validateEventAccess($event, true))) {
            return $denied;
        }

        if ($guest->status !== 'pending') {
            return response()->json([
                'message' => "{$guest->name} ya respondió, no necesita recordatorio.",
                'guest' => $guest,
            ], 422);
        }

        if (empty(preg_replace('/[^\d]/', '', (string) $guest->phone))) {
            return response()->json([
                'message' => "{$guest->name} no tiene un teléfono registrado.",
                'guest' => $guest,
            ], 422);
        }

        $deadline = $event?->rsvpDeadline();
        if ($deadline && now()->greaterThan($deadline)) {
            return response()->json([
                'message' => 'El plazo para confirmar ya venció (' . $deadline->format('d/m/Y') . ').',
                'guest' => $guest,
            ], 422);
        }

        // Avoid double taps / several devices sending the same reminder
        if ($guest->reminder_sent_at && $guest->reminder_sent_at->gt(now()->subHours(12))) {
            return response()->json([
                'message' => "A {$guest->name} ya se le envió un recordatorio el " . $guest->reminder_sent_at->format('d/m H:i') . '.',
                'guest' => $guest,
            ], 409);
        }

        // Mark as queued (the job keeps it on success and clears it if the bot rejects it)
        $guest->update(['reminder_sent_at' => now()]);
        \App\Jobs\SendWhatsAppMessageJob::dispatch($guest->id, 'reminder');

        return response()->json([
            'message' => "Recordatorio en camino a {$guest->name}. Se envía por el WhatsApp del sistema respetando las pausas entre mensajes y el horario de envío (" . config('whatsapp.window_start') . ' a ' . config('whatsapp.window_end') . ' h).',
            'guest' => $guest->fresh(),
        ], 202);
    }

    /**
     * Movement history of a guest (newest first) for the app and the panel.
     */
    public function activity($id)
    {
        $guest = Guest::with('event')->findOrFail($id);
        if ($guest->event && ($denied = $this->validateEventAccess($guest->event, false))) {
            return $denied;
        }

        $activities = \App\Models\GuestActivity::with('user:id,name,role')
            ->where('guest_id', $guest->id)
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        return response()->json([
            'guest' => $guest->only(['id', 'name', 'status', 'whatsapp_status', 'last_sent_at', 'reminder_count', 'attended_at']),
            'activities' => $activities,
        ]);
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

        // Clean token if full URL was scanned (e.g. https://confirmaciones.factosystem.com.py/confirmar/ABC123XYZ)
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

        // Only staff of this event can accredit its guests
        $user = Auth::user();
        if ($user && $event && !$user->canAccessEvent($event)) {
            return response()->json([
                'success' => false,
                'status' => 'invalid',
                'message' => '⛔ Este QR pertenece a otro evento.',
            ], 403);
        }

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
            \App\Models\GuestActivity::record($guest, 'scan_repeated', 'Se volvió a escanear un QR ya utilizado');
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
        \App\Models\GuestActivity::withContext(['via' => 'scan'], fn () => $guest->update([
            'status' => 'attended',
            'attended_at' => $nowLocal,
        ]));

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

        // A new bulk send lifts any previous cancellation for this event
        Cache::forget(SendWhatsAppMessageJob::cancelKey($eventId));

        // Stagger jobs with random gaps; the job itself enforces the real per-number pacing,
        // daily limit and sending window (see WhatsAppThrottle)
        $delay = 0;
        foreach ($guests as $guest) {
            SendWhatsAppMessageJob::dispatch($guest->id, $mode)->delay(now()->addSeconds($delay));
            $delay += random_int(config('whatsapp.min_delay'), config('whatsapp.max_delay'));
        }

        $count = $guests->count();
        $throttle = WhatsAppThrottle::forSession(WhatsAppThrottle::sessionForEvent($event));
        $remainingToday = max(0, config('whatsapp.daily_limit') - $throttle->sentToday());
        $avgGap = (config('whatsapp.min_delay') + config('whatsapp.max_delay')) / 2;
        $estimatedMins = (int) ceil(min($count, $remainingToday) * $avgGap / 60);

        $message = "⚡ Envío programado para {$count} invitados. Los mensajes salen en segundo plano, de a uno cada "
            . config('whatsapp.min_delay') . '-' . config('whatsapp.max_delay') . ' segundos, con pausas para proteger tu número. Podés cerrar la página.';
        if ($count > $remainingToday) {
            $message .= " Hoy se pueden enviar {$remainingToday} más (límite diario de " . config('whatsapp.daily_limit') . '); el resto sale mañana automáticamente.';
        }

        return response()->json([
            'message' => $message,
            'count' => $count,
            'estimated_minutes' => $estimatedMins,
            'remaining_today' => $remainingToday,
        ]);
    }

    public function cancelBulkQueue($eventId)
    {
        $event = Event::findOrFail($eventId);
        if ($denied = $this->validateEventAccess($event, true)) {
            return $denied;
        }

        // Jobs queued before this moment will skip themselves
        Cache::put(SendWhatsAppMessageJob::cancelKey($eventId), now()->timestamp, now()->addDays(4));

        return response()->json([
            'message' => 'Envío masivo detenido. Los mensajes pendientes no se enviarán.'
        ]);
    }
}
