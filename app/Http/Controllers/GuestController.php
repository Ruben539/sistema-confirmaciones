<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\Guest;
use App\Models\GuestMember;
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

        $guests = Guest::with('members')
            ->where('event_id', $eventId)
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
            'attended_passes' => $attended->sum(fn($g) => (int) $g->attended_people > 0 ? (int) $g->attended_people : $g->groupSize()),
            // Groups with people still to arrive (came in parts)
            'partial_groups' => $attended->filter(fn($g) => (int) $g->attended_people > 0 && (int) $g->attended_people < $g->groupSize())->count(),
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
            'members' => 'nullable|array|max:19',
            'members.*.name' => 'required|string|max:120',
            'members.*.category' => 'nullable|in:adult,youth,child',
            'notes' => 'nullable|string',
        ]);

        $formattedPhone = $this->formatParaguayPhone($validated['phone']);
        $cleanDigits = preg_replace('/[^\d]/', '', $formattedPhone);
        $phoneKey = strlen($cleanDigits) >= 9 ? substr($cleanDigits, -9) : $cleanDigits;

        // Anti-duplicate protection: check if phone already exists in this event
        $existing = Guest::where('event_id', $eventId)
            ->where(function ($q) use ($formattedPhone, $phoneKey) {
                $q->where('phone', $formattedPhone)
                  ->orWhere('phone', 'LIKE', "%{$phoneKey}%")
                  ->orWhere('alt_phones', 'LIKE', "%{$phoneKey}%");
            })
            ->first();

        if ($existing) {
            return response()->json([
                'message' => "Ya existe un invitado registrado con el teléfono {$validated['phone']} ({$existing->name})."
                    . ($existing->altPhoneList() ? ' Es uno de los números de esa invitación compartida.' : ''),
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

        if (!empty($validated['members'])) {
            $this->saveMembers($guest, $validated['members']);
        } else {
            $this->membersFromText($guest);
        }

        return response()->json([
            'message' => 'Invitado agregado con éxito',
            'guest' => $guest->load('members')
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
            'guests.*.alt_phones' => 'nullable|array|max:5',
            'guests.*.alt_phones.*' => 'string|max:50',
            'guests.*.members' => 'nullable|array|max:19',
            'guests.*.members.*.name' => 'required|string|max:120',
            'guests.*.members.*.category' => 'nullable|in:adult,youth,child',
            'guests.*.dietary_restrictions' => 'nullable|string',
            'guests.*.restricciones' => 'nullable|string',
            'guests.*.dieta' => 'nullable|string',
            'guests.*.notes' => 'nullable|string',
        ]);

        // Preload all existing guests for this event into a phone index map
        $existingGuests = Guest::where('event_id', $eventId)->get();
        $corrections = [];
        $existingMap = [];
        foreach ($existingGuests as $eg) {
            // The main phone and the other numbers of a shared invitation lead to the same guest
            foreach (array_merge([$eg->phone], $eg->altPhoneList()) as $number) {
                $digits = preg_replace('/[^\d]/', '', (string) $number);
                if (!empty($digits)) {
                    $key = strlen($digits) >= 9 ? substr($digits, -9) : $digits;
                    $existingMap[$key] = $existingMap[$key] ?? $eg;
                }
            }
        }

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $merged = 0;
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

            // Other numbers of the same invitation (couple / family with one phone each)
            $altPhones = [];
            foreach ((array) ($item['alt_phones'] ?? []) as $alt) {
                $altFormatted = preg_replace('/[^\d]/', '', $this->formatParaguayPhone($alt));
                $altKey = strlen($altFormatted) >= 9 ? substr($altFormatted, -9) : $altFormatted;
                if ($altFormatted !== '' && $altKey !== $phoneKey) {
                    $altPhones[$altKey] = $altFormatted;
                    $seenInBatch[$altKey] = true;
                }
            }

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

            // The invitation may already exist under one of its other numbers
            if (!isset($existingMap[$phoneKey])) {
                foreach (array_keys($altPhones) as $altKey) {
                    if (isset($existingMap[$altKey])) {
                        $existingMap[$phoneKey] = $existingMap[$altKey];
                        break;
                    }
                }
            }

            // Anti-duplicate: Guest already exists in this event
            if (isset($existingMap[$phoneKey])) {
                $existingGuest = $existingMap[$phoneKey];
                // Its other numbers: records that were separate invitations of the same people are joined
                $joinedHere = false;
                if ($altPhones) {
                    foreach ($altPhones as $altKey => $altDigits) {
                        $other = $existingMap[$altKey] ?? null;
                        if ($other && $other->id !== $existingGuest->id) {
                            $this->mergeInto($existingGuest, $other);
                            $merged++;
                            $joinedHere = true;
                        }
                        $existingMap[$altKey] = $existingGuest;
                    }
                    $existingGuest->addAltPhones(array_values($altPhones));
                    $existingGuest->save();
                }
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
                    $previousPasses = (int) $existingGuest->passes;
                    $existingGuest->update($updateFields);
                    $this->importMembers($existingGuest, $item['members'] ?? []);
                    $updated++;

                    // The amount changed for someone who already got the invitation or confirmed: they must be told
                    $wasContacted = $existingGuest->whatsapp_status === 'sent' || in_array($existingGuest->status, ['confirmed', 'attended'], true);
                    if ($wasContacted && (int) $existingGuest->passes !== $previousPasses) {
                        if ($existingGuest->pending_correction_from === null) {
                            $existingGuest->update(['pending_correction_from' => $previousPasses]);
                        }
                        $corrections[] = [
                            'id' => $existingGuest->id,
                            'name' => $existingGuest->name,
                            'from' => $previousPasses,
                            'to' => (int) $existingGuest->passes,
                            'action' => $existingGuest->correctionAction(),
                        ];
                    }
                } elseif (!empty($item['members']) && !$existingGuest->members()->exists()) {
                    $this->importMembers($existingGuest, $item['members']);
                    $updated++;
                } elseif (!$joinedHere) {
                    $skipped++;
                }

                // Joined invitations that had answered: the confirmation covers everyone of the invitation
                if ($joinedHere && in_array($existingGuest->status, ['confirmed', 'attended'], true)) {
                    $existingGuest->refresh();
                    $existingGuest->update([
                        'confirmed_adults' => (int) $existingGuest->adults,
                        'confirmed_youth' => (int) $existingGuest->youth,
                        'confirmed_children' => (int) $existingGuest->children,
                        'confirmed_passes' => (int) $existingGuest->passes,
                        'pending_correction_from' => null,
                    ]);
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

            $this->importMembers($newGuest, $item['members'] ?? []);
            if ($altPhones) {
                $newGuest->addAltPhones(array_values($altPhones));
                $newGuest->save();
                foreach (array_keys($altPhones) as $altKey) {
                    $existingMap[$altKey] = $newGuest;
                }
            }

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
        if ($merged > 0) {
            $summaryParts[] = "{$merged} invitaciones separadas unidas en una sola (mismas personas con otro número)";
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
            'unimported_due_to_limit' => $unimportedDueToLimit,
            // Guests whose number of people changed after being contacted (to send them the correction)
            'corrections' => array_values(array_filter($corrections, fn ($c) => $c['action'] !== null)),
        ]);
    }

    /**
     * Sends the pending corrections of an event: a reminder with the current places to those who didn't
     * answer, an apology with the right amount to those who confirmed. Queued with the usual pauses.
     */
    public function sendCorrections(Request $request, $eventId)
    {
        $event = Event::findOrFail($eventId);
        if ($denied = $this->validateEventAccess($event, true)) {
            return $denied;
        }

        // Only the guests left checked in the review window (all pending ones if none is given)
        $ids = array_filter((array) $request->input('guest_ids', []), 'is_numeric');
        $guests = Guest::with('event')->where('event_id', $eventId)->whereNotNull('pending_correction_from')
            ->when(!empty($ids), fn ($q) => $q->whereIn('id', $ids))
            ->get()
            ->filter(fn ($g) => $g->correctionAction() !== null);
        if ($guests->isEmpty()) {
            return response()->json(['message' => 'No hay correcciones pendientes de enviar.'], 422);
        }

        Cache::forget(SendWhatsAppMessageJob::cancelKey($eventId));
        $delay = 0;
        $counts = ['reminder' => 0, 'correction' => 0];
        foreach ($guests as $guest) {
            $action = $guest->correctionAction();
            if ($action === 'reminder') {
                $guest->update(['reminder_sent_at' => now()]);
            }
            SendWhatsAppMessageJob::dispatch($guest->id, $action)->delay(now()->addSeconds($delay));
            $delay += \App\Services\WhatsAppThrottle::randomGap();
            $counts[$action]++;
        }

        $this->trackBulk($eventId, 'corrections', $guests->pluck('id')->all());

        $parts = [];
        if ($counts['reminder']) $parts[] = "{$counts['reminder']} recordatorios con los lugares corregidos";
        if ($counts['correction']) $parts[] = "{$counts['correction']} mensajes de disculpa con la cantidad correcta";

        return response()->json([
            'message' => '📨 Correcciones programadas: ' . implode(' y ', $parts) . '. Salen de a uno, con pausas para proteger el número.',
            'count' => $guests->count(),
        ]);
    }

    /**
     * Joins several invitations of the same people (a couple / family loaded once per phone) into ONE: the
     * first confirmed one (or the first given) stays, the others' numbers become its other phones. Messages
     * then go once, and the bot recognizes any of the numbers as this invitation.
     */
    public function mergeGuests(Request $request, $eventId)
    {
        $event = Event::findOrFail($eventId);
        if ($denied = $this->validateEventAccess($event, false)) {
            return $denied;
        }
        $validated = $request->validate([
            'guest_ids' => 'required|array|min:2|max:10',
            'guest_ids.*' => 'integer',
            'total' => 'required|integer|min:1|max:40',
        ]);

        $guests = Guest::where('event_id', $eventId)->whereIn('id', $validated['guest_ids'])->get()
            ->sortBy(fn ($g) => array_search($g->id, $validated['guest_ids']));
        if ($guests->count() < 2) {
            return response()->json(['message' => 'Elegí al menos dos invitaciones del evento.'], 422);
        }
        $holder = $guests->first(fn ($g) => in_array($g->status, ['confirmed', 'attended'], true)) ?? $guests->first();

        foreach ($guests as $other) {
            if ($other->id !== $holder->id) {
                $this->mergeInto($holder, $other);
            }
        }

        // The joined invitation is for the people it really has; if they had confirmed, for all of them
        $total = (int) $validated['total'];
        $holder->refresh();
        $fields = ['adults' => max(0, $total - (int) $holder->youth - (int) $holder->children)];
        if ($fields['adults'] + (int) $holder->youth + (int) $holder->children < 1) {
            $fields['adults'] = 1;
        }
        $holder->update($fields);
        if (in_array($holder->status, ['confirmed', 'attended'], true)) {
            $holder->update([
                'confirmed_adults' => (int) $holder->adults,
                'confirmed_youth' => (int) $holder->youth,
                'confirmed_children' => (int) $holder->children,
                'confirmed_passes' => (int) $holder->passes,
            ]);
        }
        $holder->update(['pending_correction_from' => null]);

        return response()->json([
            'message' => "Listo: ahora es una sola invitación, {$holder->name} para {$holder->passes} personas, con " . (count($holder->altPhoneList()) + 1) . ' números.',
            'guest' => $holder->fresh('members'),
        ]);
    }

    /**
     * $other is the same people as $holder (another phone): its number, conversation, history, companions and
     * answer move to $holder, and $other is removed.
     */
    private function mergeInto(Guest $holder, Guest $other): void
    {
        $holder->addAltPhones(array_merge([$other->phone], $other->altPhoneList()));

        // The most advanced answer wins: attended > confirmed > declined > pending
        $rank = ['pending' => 0, 'declined' => 1, 'confirmed' => 2, 'attended' => 3];
        if (($rank[$other->status] ?? 0) > ($rank[$holder->status] ?? 0)) {
            foreach (['status', 'conversation_state', 'confirmed_adults', 'confirmed_youth', 'confirmed_children', 'confirmed_passes', 'attended_at', 'attended_people', 'holder_attended_at'] as $field) {
                $holder->{$field} = $other->{$field};
            }
        }
        foreach (['dietary_restrictions', 'table_number', 'whatsapp_channel'] as $field) {
            if (empty($holder->{$field}) && !empty($other->{$field})) {
                $holder->{$field} = $other->{$field};
            }
        }
        if ($other->whatsapp_status === 'sent') {
            $holder->whatsapp_status = 'sent';
            $holder->last_sent_at = $holder->last_sent_at ?? $other->last_sent_at;
        }
        $holder->unread_messages = (int) $holder->unread_messages + (int) $other->unread_messages;
        $holder->needs_reply = $holder->needs_reply || $other->needs_reply;
        if ($other->last_message_at && (!$holder->last_message_at || $other->last_message_at->gt($holder->last_message_at))) {
            $holder->last_message_at = $other->last_message_at;
        }
        $holder->save();

        \App\Models\GuestMessage::where('guest_id', $other->id)->update(['guest_id' => $holder->id]);
        \App\Models\GuestActivity::where('guest_id', $other->id)->update(['guest_id' => $holder->id]);
        GuestMember::where('guest_id', $other->id)->update(['guest_id' => $holder->id]);
        \App\Models\GuestActivity::record($holder, 'merged', "Unificada con la invitación de {$other->name} ({$other->phone}): es la misma, con otro número");

        $other->delete();
    }

    /**
     * Apology with the right number of people, to confirmed guests (one or a selection). Only that text:
     * no QR. Queued with the usual pauses; the same guest is not sent it twice within 12 h.
     */
    public function sendCountCorrection(Request $request, $eventId)
    {
        $event = Event::findOrFail($eventId);
        if ($denied = $this->validateEventAccess($event, true)) {
            return $denied;
        }
        $validated = $request->validate(['guest_ids' => 'required|array|min:1', 'guest_ids.*' => 'integer']);

        $guests = Guest::where('event_id', $eventId)
            ->whereIn('id', $validated['guest_ids'])
            ->whereIn('status', ['confirmed', 'attended'])
            ->whereNotNull('phone')
            ->get()
            ->filter(fn ($g) => Cache::add("count_fix:{$g->id}", true, now()->addHours(12)));

        if ($guests->isEmpty()) {
            return response()->json(['message' => 'No hay invitados confirmados a los que enviar la corrección (o ya se les envió en las últimas 12 h).'], 422);
        }

        $delay = 0;
        foreach ($guests as $guest) {
            SendWhatsAppMessageJob::dispatch($guest->id, 'correction')->delay(now()->addSeconds($delay));
            $delay += \App\Services\WhatsAppThrottle::randomGap();
        }

        $count = $guests->count();
        $this->trackBulk($eventId, 'corrections', $guests->pluck('id')->all());
        return response()->json([
            'message' => $count === 1
                ? "Corrección en camino a {$guests->first()->name}."
                : "📨 Corrección programada para {$count} invitados. Sale de a uno, con pausas para proteger el número.",
            'count' => $count,
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
            'alt_phones' => 'sometimes|nullable|array|max:5',
            'alt_phones.*' => 'nullable|string|max:50',
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

        // Other numbers of the same invitation (couple / family), replaced as a whole from the form
        if (array_key_exists('alt_phones', $validated)) {
            $guest->alt_phones = null;
            if (isset($validated['phone'])) {
                $guest->phone = $validated['phone'];
            }
            $guest->addAltPhones(array_map(fn ($p) => $this->formatParaguayPhone((string) $p), array_filter((array) $validated['alt_phones'])));
            unset($validated['alt_phones']);
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
            $qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" . urlencode($guest->token);
            $message = \App\Services\GuestMessages::passMessage($guest, $event, $isResend);

            $result = \App\Services\WhatsAppGateway::sendPass($guest, $message, $qrUrl, WhatsAppThrottle::sessionForEvent($event));
            if ($result['ok']) {
                \App\Models\GuestMessage::logOutgoing($guest, $message . "\n[Pase QR adjunto]");
                if ($guest->pending_correction_from !== null) {
                    $guest->update(['pending_correction_from' => null]);
                }
            }
            \App\Models\GuestActivity::record(
                $guest,
                $result['ok'] ? 'qr_sent' : 'qr_failed',
                $result['ok']
                    ? ($isResend ? 'Pase QR reenviado por WhatsApp' : 'Pase QR enviado por WhatsApp')
                    : 'No se pudo enviar el pase QR por WhatsApp'
            );
            return $result['ok'];
        } catch (\Throwable $e) {
            \App\Models\GuestActivity::record($guest, 'qr_failed', 'No se pudo enviar el pase QR por WhatsApp');
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
        $channel = \App\Services\WhatsAppGateway::channelForInvitation($guest);
        if ($channel === 'baileys' && \App\Services\WhatsAppGateway::baileysQuotaLeft() === 0) {
            return response()->json([
                'message' => 'El bot ya envió hoy todas las invitaciones permitidas para proteger su número (' . config('whatsapp.baileys_daily_limit') . ' por día). Se puede enviar mañana o elegir el WhatsApp oficial en la configuración del evento.',
                'guest' => $guest
            ], 429);
        }
        $message = WhatsAppMessage::build($guest, $mode, $channel === 'cloud');

        // Manual sends count against the same per-number pacing and daily limit as bulk sends
        $throttle = WhatsAppThrottle::forChannel($channel, $event);
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
            $result = \App\Services\WhatsAppGateway::sendInvitation($guest, $mode, $message, $mediaUrl, WhatsAppThrottle::sessionForEvent($event), $channel);

            if ($result['ok']) {
                $throttle->recordSent();
                if ($channel === 'baileys') {
                    \App\Services\WhatsAppGateway::countBaileysColdSend();
                }
                \App\Models\GuestMessage::logOutgoing($guest, $message);
                $guest->update([
                    'whatsapp_status' => 'sent',
                    'last_sent_at' => now(),
                    'whatsapp_channel' => $channel,
                ]);

                return response()->json([
                    'message' => "Mensaje enviado automáticamente por WhatsApp a {$guest->name}",
                    'guest' => $guest
                ]);
            }
            \Illuminate\Support\Facades\Log::warning('No se pudo enviar el WhatsApp: ' . ($result['error'] ?? ''));
        } catch (\Throwable $e) {
            try {
                \Illuminate\Support\Facades\Log::warning('Error enviando WhatsApp: ' . $e->getMessage());
            } catch (\Throwable $logError) {
                // Ignore storage log permission issues
            }
        } finally {
            $lock?->release();
        }

        return response()->json([
            'message' => 'No se pudo enviar por el WhatsApp del sistema. Intentá de nuevo en unos minutos o enviá el mensaje manualmente.',
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
            'message' => "Recordatorio en camino a {$guest->name}. Se envía por el WhatsApp del sistema respetando las pausas entre mensajes.",
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

    /**
     * Named companions written in the "Acompañantes" text become people of the invitation, but only when
     * they are exactly the companions invited ("Ana y Carlos" for 3 people). "Esposa y padres" for 4 people
     * stays as a note: the planner can name them from the guest form.
     */
    private function membersFromText(Guest $guest): void
    {
        if ($guest->members()->exists()) {
            return;
        }
        $people = GuestMember::parseNames($guest->companions);
        if (count($people) === 0 || count($people) !== max(1, (int) $guest->passes) - 1) {
            return;
        }
        foreach ($people as $i => $person) {
            $guest->members()->create(['event_id' => $guest->event_id, 'name' => $person['name'], 'category' => $person['category'], 'position' => $i]);
        }
    }

    /**
     * Companions that came with a name in the import (rows without phone under the guest): only when the
     * invitation has none loaded yet, and never more than its places. Otherwise, names from the free text.
     */
    private function importMembers(Guest $guest, array $members): void
    {
        $members = array_values(array_filter($members, fn ($m) => trim($m['name'] ?? '') !== ''));
        if (empty($members)) {
            $this->membersFromText($guest);
            return;
        }
        if ($guest->members()->exists()) {
            return;
        }
        $places = max(1, (int) $guest->fresh()->passes) - 1;
        foreach (array_slice($members, 0, $places) as $i => $m) {
            $guest->members()->create([
                'event_id' => $guest->event_id,
                'name' => mb_substr(trim($m['name']), 0, 120),
                'category' => $m['category'] ?? 'adult',
                'position' => $i,
            ]);
        }
    }

    // Replaces the named companions of an invitation (keeps table / check-in of the ones that stay)
    private function saveMembers(Guest $guest, array $members): void
    {
        $keep = [];
        foreach (array_values($members) as $i => $data) {
            $fields = [
                'event_id' => $guest->event_id,
                'name' => trim($data['name']),
                'category' => $data['category'] ?? 'adult',
                'position' => $i,
            ];
            if (array_key_exists('table_number', $data)) {
                $fields['table_number'] = Table::normalizeName($data['table_number']);
            }
            $member = !empty($data['id']) ? $guest->members()->whereKey($data['id'])->first() : null;
            $member ? $member->update($fields) : ($member = $guest->members()->create($fields));
            $keep[] = $member->id;
        }
        $guest->members()->whereNotIn('id', $keep ?: [0])->delete();

        // The free text follows the names, so searches and exports show them
        $names = $guest->members()->pluck('name')->implode(', ');
        $guest->update(['companions' => $names !== '' ? mb_substr($names, 0, 255) : $guest->companions]);
    }

    public function updateMembers(Request $request, $id)
    {
        $guest = Guest::with('event')->findOrFail($id);
        if ($denied = $this->validateEventAccess($guest->event, false)) {
            return $denied;
        }

        $validated = $request->validate([
            'members' => 'present|array|max:19',
            'members.*.id' => 'nullable|integer',
            'members.*.name' => 'required|string|max:120',
            'members.*.category' => 'nullable|in:adult,youth,child',
            'members.*.table_number' => 'nullable|string|max:100',
        ]);

        $places = max(1, (int) $guest->passes) - 1;
        if (count($validated['members']) > $places) {
            return response()->json([
                'message' => $places === 0
                    ? 'Esta invitación es para 1 persona: no tiene acompañantes. Aumentá la cantidad de personas primero.'
                    : "Esta invitación tiene {$places} " . ($places === 1 ? 'acompañante' : 'acompañantes') . ': no se pueden cargar más nombres.',
            ], 422);
        }
        foreach ($validated['members'] as $m) {
            if (!empty($m['table_number']) && !Table::findByName($guest->event_id, $m['table_number'])) {
                return response()->json(['message' => "La mesa '{$m['table_number']}' no existe."], 422);
            }
        }

        $this->saveMembers($guest, $validated['members']);

        return response()->json(['message' => 'Acompañantes guardados.', 'guest' => $guest->fresh('members')]);
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

        $guest = Guest::with(['event', 'members'])->where('token', $cleanToken)->first();

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

        // Group invitations can come in parts: the same QR is valid until the whole group went in.
        // At the door the whole invitation counts, even if the holder confirmed fewer people
        $group = max($guest->groupSize(), (int) $guest->passes);
        $inside = $guest->status === 'attended' ? ((int) $guest->attended_people > 0 ? (int) $guest->attended_people : $group) : 0;
        $remaining = max(0, $group - $inside);

        if ($remaining === 0) {
            \App\Models\GuestActivity::record($guest, 'scan_repeated', 'Se volvió a escanear un QR ya utilizado');
            $carbonTime = $guest->attended_at ? \Carbon\Carbon::parse($guest->attended_at)->setTimezone('America/Asuncion') : null;
            $formattedTime = $carbonTime ? $carbonTime->format('H:i') : 'anteriormente';
            $formattedDate = $carbonTime ? $carbonTime->format('d/m/Y') : '';
            $who = $group > 1 ? "Las {$group} personas de {$guest->name} ya ingresaron" : "{$guest->name} ya ingresó";
            return response()->json([
                'success' => false,
                'status' => 'already_used',
                'already_checked_in' => true,
                'message' => "⚠️ ¡PASE YA UTILIZADO! {$who} (primer ingreso el {$formattedDate} a las {$formattedTime} hs).",
                'guest' => $guest,
                'event' => $event,
                'attended_at' => $formattedTime,
            ], 409);
        }

        // Who of the group is already inside, by name (holder + named companions)
        $peopleList = collect([[
            'key' => 'holder',
            'name' => $guest->name,
            'category' => null,
            'table_number' => $guest->table_number,
            'inside' => $inside > 0 && ($guest->holder_attended_at !== null || $guest->members->isEmpty()),
        ]])->concat($guest->members->map(fn ($m) => [
            'key' => (string) $m->id,
            'name' => $m->name,
            'category' => $m->category,
            'table_number' => $m->table_number ?: $guest->table_number,
            'inside' => $m->attended_at !== null,
        ]))->values();

        // Every person of the invitation is listed, also the companions without a name loaded
        // ("Acompañante 3"): those are only counted, so the first ones already counted show as inside
        $unnamed = max(0, $group - $peopleList->count());
        $unnamedInside = max(0, $inside - $peopleList->where('inside', true)->count());
        for ($i = 1; $i <= $unnamed; $i++) {
            $peopleList->push([
                'key' => "u{$i}",
                'name' => 'Acompañante ' . ($peopleList->count()),
                'category' => null,
                'table_number' => $guest->table_number,
                'inside' => $i <= $unnamedInside,
                'unnamed' => true,
            ]);
        }

        // The app asks how many are entering now (apps without this ask let the whole remaining group in)
        $people = $request->input('people');
        $chosen = collect((array) $request->input('members', []))->map(fn ($k) => (string) $k);
        // Group invitation: the app shows everyone of the invitation and the hostess ticks who is here
        if ($people === null && $chosen->isEmpty() && $request->boolean('partial') && $group > 1) {
            return response()->json([
                'success' => false,
                'status' => 'ask_people',
                'message' => $inside > 0
                    ? "Ya ingresaron {$inside} de {$group} personas de {$guest->name}. Marcá quiénes llegaron."
                    : "La invitación de {$guest->name} es para {$group} personas. Marcá quiénes llegaron.",
                'guest' => $guest,
                'group' => $group,
                'confirmed' => (int) $guest->confirmed_passes,
                'inside' => $inside,
                'remaining' => $remaining,
                'people' => $peopleList->values(),
            ]);
        }
        $entering = $people === null && $chosen->isEmpty()
            ? $remaining
            : max(1, min($remaining, $people !== null ? (int) $people : $chosen->count()));

        // Named people going in: the ones chosen, or everyone still outside when the whole rest enters
        $enteringNames = ($chosen->isEmpty() && $entering === $remaining)
            ? $peopleList->where('inside', false)->pluck('key')
            : $chosen->intersect($peopleList->where('inside', false)->pluck('key'))->take($entering);
        $memberIds = $enteringNames->reject(fn ($k) => $k === 'holder' || str_starts_with($k, 'u'))->map(fn ($k) => (int) $k)->values();

        $nowLocal = now()->setTimezone('America/Asuncion');
        if ($memberIds->isNotEmpty()) {
            $guest->members()->whereIn('id', $memberIds)->whereNull('attended_at')->update(['attended_at' => $nowLocal]);
        }
        \App\Models\GuestActivity::withContext(['via' => 'scan'], fn () => $guest->update(array_filter([
            'status' => 'attended',
            'attended_at' => $guest->attended_at ?? $nowLocal,
            'attended_people' => $inside + $entering,
            'holder_attended_at' => $enteringNames->contains('holder') ? $nowLocal : null,
        ], fn ($v) => $v !== null)));
        $enteringList = $peopleList->whereIn('key', $enteringNames->all())->pluck('name')->values();

        $insideNow = $inside + $entering;
        $groupText = $group > 1
            ? ($insideNow < $group ? " Ingresan {$entering} · {$insideNow} de {$group} (faltan " . ($group - $insideNow) . ").": " Grupo completo: {$group} de {$group}.")
            : '';

        return response()->json([
            'success' => true,
            'status' => 'success',
            'message' => "✅ ¡ENTRADA VÁLIDA! Bienvenido/a {$guest->name}.{$groupText}",
            'entering' => $entering,
            'entering_names' => $enteringList,
            'inside' => $insideNow,
            'group' => $group,
            'guest' => $guest->fresh('members'),
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

        $mode = $request->input('mode', 'invitation') === 'reminder' ? 'reminder' : 'invitation';
        $guestIds = $request->input('guest_ids');

        if ($mode === 'reminder') {
            $deadline = $event->rsvpDeadline();
            if ($deadline && now()->greaterThan($deadline)) {
                return response()->json(['message' => 'El plazo para confirmar ya venció (' . $deadline->format('d/m/Y') . ').'], 422);
            }
            // Invited but didn't answer yet (and no reminder in the last 12 h)
            $query = Guest::where('event_id', $eventId)
                ->where('status', 'pending')
                ->where('whatsapp_status', 'sent')
                ->whereNotNull('phone')
                ->where(fn ($q) => $q->whereNull('reminder_sent_at')->orWhere('reminder_sent_at', '<', now()->subHours(12)));
        } else {
            $query = Guest::where('event_id', $eventId)->where('whatsapp_status', 'not_sent');
        }
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
            if ($mode === 'reminder') {
                // Marked as queued: the job keeps it on success and clears it if it can't be sent
                $guest->update(['reminder_sent_at' => now()]);
            }
            SendWhatsAppMessageJob::dispatch($guest->id, $mode)->delay(now()->addSeconds($delay));
            $delay += \App\Services\WhatsAppThrottle::randomGap();
        }

        $count = $guests->count();

        $this->trackBulk($eventId, $mode, $guests->pluck('id')->all());

        // How many can go out today, by the event's channel (the bot's safe quota and/or the official limit)
        $channelMode = $event->whatsapp_channel ?: 'auto';
        $cloudOk = \App\Services\WhatsAppGateway::cloudConfigured();
        $botLeft = \App\Services\WhatsAppGateway::baileysQuotaLeft();
        $cloudLeft = $cloudOk ? max(0, config('whatsapp.cloud_daily_limit') - WhatsAppThrottle::forChannel('cloud', $event)->sentToday()) : 0;
        $remainingToday = match (true) {
            $channelMode === 'cloud' && $cloudOk => $cloudLeft,
            $channelMode === 'baileys' || !$cloudOk => $botLeft,
            default => $botLeft + $cloudLeft,
        };
        $avgGap = (config('whatsapp.min_delay') + config('whatsapp.max_delay')) / 2;
        $estimatedMins = (int) ceil(min($count, $remainingToday) * $avgGap / 60);

        $message = ($mode === 'reminder' ? "🔔 Recordatorio programado para {$count} invitados que todavía no respondieron." : "⚡ Envío programado para {$count} invitados.") . " Los mensajes salen en segundo plano, con pausas para proteger el número. Podés cerrar la página.";
        if ($channelMode === 'auto' && $cloudOk) {
            $message .= " Hoy salen hasta {$botLeft} por el bot y el resto por el WhatsApp oficial.";
        }
        if ($count > $remainingToday) {
            $message .= " Hoy se pueden enviar {$remainingToday}; el resto sale mañana automáticamente.";
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
        Cache::forget("bulk:{$eventId}");

        return response()->json([
            'message' => 'Envío masivo detenido. Los mensajes pendientes no se enviarán.'
        ]);
    }

    /**
     * Progress of the background bulk send of an event (invitations or reminders): sent / failed / left and
     * why it is waiting (sending window, the bot's daily quota). It goes on with the browser closed.
     */
    public function bulkStatus($eventId)
    {
        $event = Event::findOrFail($eventId);
        if ($denied = $this->validateEventAccess($event, false)) {
            return $denied;
        }

        return response()->json($this->bulkProgress($eventId));
    }

    // Remembers a background send so the panel can show its progress (it goes on with the browser closed).
    // A new send of the same kind while one is running joins it; another kind starts a new count.
    private function trackBulk($eventId, string $mode, array $ids): void
    {
        $previous = Cache::get("bulk:{$eventId}");
        $join = $previous && ($previous['mode'] ?? null) === $mode && !empty($this->bulkProgress($eventId)['active']);
        Cache::put("bulk:{$eventId}", [
            'mode' => $mode,
            'ids' => $join ? array_values(array_unique(array_merge($previous['ids'], $ids))) : array_values($ids),
            'started' => $join ? $previous['started'] : now()->timestamp,
        ], now()->addDays(4));
    }

    private function bulkProgress($eventId): array
    {
        $bulk = Cache::get("bulk:{$eventId}");
        if (!$bulk || empty($bulk['ids'])) {
            return ['active' => false];
        }

        $since = \Carbon\Carbon::createFromTimestamp($bulk['started']);
        $ids = $bulk['ids'];
        // Sent = an outgoing message logged for the guest after the start (invitation or reminder)
        $sent = \App\Models\GuestMessage::whereIn('guest_id', $ids)->where('direction', 'out')->where('author', 'bot')
            ->where('created_at', '>=', $since)->distinct()->count('guest_id');
        $failed = \App\Models\GuestActivity::whereIn('guest_id', $ids)
            ->whereIn('action', ['invitation_failed', 'reminder_failed', 'send_uncertain'])
            ->where('created_at', '>=', $since)->distinct()->count('guest_id');
        // Guests that no longer need it (answered meanwhile, removed...) don't wait for anything
        $skipped = $bulk['mode'] === 'reminder'
            ? Guest::whereIn('id', $ids)->where('status', '!=', 'pending')->count()
            : count($ids) - Guest::whereIn('id', $ids)->count();

        $total = count($ids);
        $left = max(0, $total - $sent - $failed - $skipped);
        if ($left === 0) {
            Cache::forget("bulk:{$eventId}");
        }

        $now = now();
        $waiting = null;
        if ($left > 0) {
            // Corrections / passes go to guests who already talk to us: the first-message quota doesn't apply
            if ($bulk['mode'] !== 'corrections' && !\App\Services\WhatsAppGateway::cloudConfigured() && \App\Services\WhatsAppGateway::baileysQuotaLeft() === 0) {
                $waiting = 'Se alcanzó el cupo diario del bot: sigue mañana.';
            }
        }

        // When the next message may go out (the pause after the previous one, on the event's number)
        $nextAt = null;
        if ($left > 0) {
            $event = Event::find($eventId);
            $sessions = [WhatsAppThrottle::sessionForEvent($event), 'cloud'];
            $next = collect($sessions)->map(fn ($sid) => (int) Cache::get("wa:{$sid}:next_at", 0))->filter()->min();
            $nextAt = $next && $next > $now->timestamp ? \Carbon\Carbon::createFromTimestamp($next)->toIso8601String() : null;
        }

        return [
            'active' => $left > 0,
            'percent' => $total ? (int) round(($sent + $failed + $skipped) * 100 / $total) : 0,
            'next_at' => $nextAt,
            'mode' => $bulk['mode'],
            'total' => $total,
            'sent' => $sent,
            'failed' => $failed,
            'left' => $left,
            'started_at' => $since->toIso8601String(),
            'waiting' => $waiting,
            'gap_minutes' => [round(config('whatsapp.min_delay') / 60, 1), round(config('whatsapp.max_delay') / 60, 1)],
        ];
    }
}
