<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\Guest;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class GuestController extends Controller
{
    public function index($eventId)
    {
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
        $currentCount = Guest::where('event_id', $eventId)->count();
        $availableSlots = max(0, $event->max_guests - $currentCount);

        if ($availableSlots <= 0) {
            return response()->json([
                'message' => "Límite alcanzado: Este evento alcanzó el número máximo de {$event->max_guests} invitados permitido por su plan ('{$event->plan_type}')."
            ], 422);
        }

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

        $created = 0;
        $guestsData = [];
        $limitReached = false;

        foreach ($validated['guests'] as $item) {
            if ($created >= $availableSlots) {
                $limitReached = true;
                break;
            }
            $name = trim($item['name']);
            $phone = trim($item['phone']);
            if (empty($name) || empty($phone)) continue;

            $formattedPhone = $this->formatParaguayPhone($phone);
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

            $guest = Guest::create([
                'event_id' => $eventId,
                'name' => $name,
                'phone' => $formattedPhone,
                'adults' => $adults,
                'youth' => $youth,
                'children' => $children,
                'passes' => 1,
                'table_number' => isset($item['table_number']) && trim($item['table_number']) !== '' ? trim($item['table_number']) : null,
                'dietary_restrictions' => $dietary && trim($dietary) !== '' ? trim($dietary) : null,
                'notes' => $item['notes'] ?? null,
                'status' => 'pending',
                'token' => Str::random(32),
            ]);

            $created++;
            $guestsData[] = $guest;
        }

        $message = "Se importaron {$created} invitados correctamente";
        if ($limitReached) {
            $message .= " (Se alcanzó el límite de {$event->max_guests} invitados de tu plan)";
        }

        return response()->json([
            'message' => $message,
            'count' => $created,
            'limit_reached' => $limitReached
        ]);
    }

    public function update(Request $request, $id)
    {
        $guest = Guest::findOrFail($id);

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

        return response()->json([
            'message' => 'Invitado actualizado',
            'guest' => $guest
        ]);
    }

    public function markSent(Request $request, $id)
    {
        $guest = Guest::findOrFail($id);
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

        if ($event && !$event->is_enabled) {
            return response()->json([
                'message' => 'Este evento se encuentra deshabilitado. No se pueden enviar mensajes de WhatsApp hasta habilitarlo.'
            ], 403);
        }

        $template = $event->message_template ?? "¡Hola {nombre}! Te invitamos a la boda de {pareja} 💍\n📍 Lugar: {lugar}\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir";

        $message = str_replace(
            ['{nombre}', '{pareja}', '{lugar}'],
            [$guest->name, $event->couple_names ?? $event->title, $event->location ?? 'Por confirmar'],
            $template
        );

        $botUrl = env('WHATSAPP_BOT_URL', 'http://127.0.0.1:3001/lead');

        try {
            $response = \Illuminate\Support\Facades\Http::timeout(10)->post($botUrl, [
                'phone' => preg_replace('/[^\d]/', '', $guest->phone),
                'message' => $message
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
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning('Error conectando con el bot de WhatsApp: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'No se pudo conectar con el bot Baileys de WhatsApp. Verificá que el servicio esté ejecutándose en el puerto 3001 o enviá el mensaje manualmente.',
            'guest' => $guest
        ], 500);
    }

    public function destroy($id)
    {
        $guest = Guest::findOrFail($id);
        $guest->delete();

        return response()->json(['message' => 'Invitado eliminado']);
    }

    public function destroyAll($eventId)
    {
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
}
