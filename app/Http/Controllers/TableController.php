<?php

namespace App\Http\Controllers;

use App\Models\Table;
use App\Models\Guest;
use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TableController extends Controller
{
    private function checkEventAccess(Event $event)
    {
        $user = Auth::user();
        if ($user && $user->role === 'planner' && $event->user_id !== $user->id) {
            abort(403, 'Acceso denegado: No tenés permisos sobre este evento.');
        }
    }

    /**
     * Seats a guest actually takes: what they confirmed if they answered, otherwise what was invited.
     */
    private function seatsFor(Guest $guest): int
    {
        $answered = in_array($guest->status, ['confirmed', 'attended']) || !empty($guest->attended_at);
        if ($answered && (int) $guest->confirmed_passes > 0) {
            return (int) $guest->confirmed_passes;
        }
        return max(1, (int) $guest->passes);
    }

    private function guestsAtTable($eventId, string $tableName)
    {
        $key = Table::nameKey($tableName);
        return Guest::where('event_id', $eventId)->whereNotNull('table_number')->get()
            ->filter(fn($g) => Table::nameKey($g->table_number) === $key);
    }

    public function index($eventId)
    {
        $event = Event::findOrFail($eventId);
        $this->checkEventAccess($event);

        $tables = Table::where('event_id', $eventId)->orderBy('id', 'asc')->get();
        // Guests who declined don't take a seat
        $allGuests = Guest::where('event_id', $eventId)->get();
        $guests = $allGuests->where('status', '!=', 'declined')->values();
        $guests->each(fn($g) => $g->setAttribute('seats', $this->seatsFor($g)));

        // Same rule everywhere: a guest belongs to the table whose normalized name matches
        $guestsByTable = $guests->groupBy(fn($g) => Table::nameKey($g->table_number) ?? '');

        $tableData = $tables->map(function ($table) use ($guestsByTable) {
            $assignedGuests = ($guestsByTable->get(Table::nameKey($table->name)) ?? collect())->values();

            $occupiedPasses = $assignedGuests->sum('seats');
            $youth = $assignedGuests->sum('youth');
            $adults = $assignedGuests->sum('adults');
            $children = $assignedGuests->sum('children');

            return [
                'id' => $table->id,
                'event_id' => $table->event_id,
                'name' => $table->name,
                'capacity' => $table->capacity,
                'notes' => $table->notes,
                'pos_x' => $table->pos_x,
                'pos_y' => $table->pos_y,
                'shape' => $table->shape,
                'rotation' => $table->rotation ?? 0,
                'occupied_passes' => $occupiedPasses,
                'youth' => $youth,
                'adults' => $adults,
                'children' => $children,
                'guests' => $assignedGuests,
            ];
        });

        // Unassigned guests (guests not assigned to any existing table)
        $allAssignedGuestIds = $tableData->flatMap(fn($t) => $t['guests']->pluck('id'))->flip();
        $unassignedGuests = $guests->filter(fn($g) => !$allAssignedGuestIds->has($g->id))->values();

        $totalCapacity = $tables->sum('capacity');
        $assignedPasses = $tableData->sum('occupied_passes');
        $unassignedPasses = $unassignedGuests->sum('seats');

        return response()->json([
            'tables' => $tableData,
            'unassigned_guests' => $unassignedGuests,
            'venue_layout' => $event->venue_layout,
            'stats' => [
                'total_tables' => $tables->count(),
                'total_capacity' => $totalCapacity,
                'assigned_passes' => $assignedPasses,
                'unassigned_passes' => $unassignedPasses,
                'total_guests' => $guests->count(),
                'declined_guests' => $allGuests->count() - $guests->count(),
            ]
        ]);
    }

    public function store(Request $request, $eventId)
    {
        $this->checkEventAccess(Event::findOrFail($eventId));

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'capacity' => 'nullable|integer|min:1',
            'notes' => 'nullable|string|max:255',
            'pos_x' => 'nullable|numeric',
            'pos_y' => 'nullable|numeric',
            'shape' => 'nullable|in:round,imperial,square',
            'rotation' => 'nullable|in:0,90',
        ]);

        $name = Table::normalizeName($validated['name']);
        if ($name === null || Table::findByName($eventId, $name)) {
            return response()->json(['message' => "Ya existe una mesa llamada '{$name}' en este evento."], 422);
        }

        $table = Table::create([
            'event_id' => $eventId,
            'name' => $name,
            'capacity' => isset($validated['capacity']) ? (int)$validated['capacity'] : 10,
            'notes' => $validated['notes'] ?? null,
            'pos_x' => $validated['pos_x'] ?? null,
            'pos_y' => $validated['pos_y'] ?? null,
            'shape' => $validated['shape'] ?? null,
            'rotation' => (int) ($validated['rotation'] ?? 0),
        ]);

        return response()->json([
            'message' => "Mesa '{$table->name}' creada con éxito",
            'table' => $table
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $table = Table::findOrFail($id);
        $this->checkEventAccess($table->event);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'capacity' => 'sometimes|integer|min:1',
            'notes' => 'nullable|string|max:255',
            'pos_x' => 'nullable|numeric',
            'pos_y' => 'nullable|numeric',
            'shape' => 'nullable|in:round,imperial,square',
            'rotation' => 'sometimes|in:0,90',
        ]);

        $oldName = $table->name;

        if (isset($validated['name'])) {
            $validated['name'] = Table::normalizeName($validated['name']);
            $existing = Table::findByName($table->event_id, $validated['name']);
            if ($validated['name'] === null || ($existing && $existing->id !== $table->id)) {
                return response()->json(['message' => "Ya existe una mesa llamada '{$validated['name']}' en este evento."], 422);
            }
        }

        $table->update($validated);

        // Renamed: move every guest seated there (whatever casing/format they were saved with)
        if (isset($validated['name']) && $validated['name'] !== $oldName) {
            $this->guestsAtTable($table->event_id, $oldName)
                ->each(fn($g) => $g->update(['table_number' => $validated['name']]));
        }

        return response()->json([
            'message' => 'Mesa actualizada correctamente',
            'table' => $table
        ]);
    }

    public function destroy($id)
    {
        $table = Table::findOrFail($id);
        $this->checkEventAccess($table->event);
        $tableName = $table->name;
        $eventId = $table->event_id;

        // Unassign every guest seated there, so the table can't come back from their table_number
        $this->guestsAtTable($eventId, $tableName)->each(fn($g) => $g->update(['table_number' => null]));

        $table->delete();

        return response()->json([
            'message' => "Mesa '{$tableName}' eliminada"
        ]);
    }

    public function assignGuest(Request $request)
    {
        $validated = $request->validate([
            'guest_id' => 'required|exists:guests,id',
            'table_name' => 'nullable|string|max:100',
        ]);

        $guest = Guest::with('event')->findOrFail($validated['guest_id']);
        $this->checkEventAccess($guest->event);

        $tableName = null;
        if (!empty($validated['table_name'])) {
            $table = Table::findByName($guest->event_id, $validated['table_name']);
            if (!$table) {
                return response()->json(['message' => "La mesa '{$validated['table_name']}' no existe."], 422);
            }
            $tableName = $table->name;
        }

        $guest->table_number = $tableName;
        $guest->save();

        return response()->json([
            'message' => 'Invitado asignado correctamente',
            'guest' => $guest
        ]);
    }

    public function autoCreateFromGuests($eventId)
    {
        $this->checkEventAccess(Event::findOrFail($eventId));

        $guestsByTable = Guest::where('event_id', $eventId)
            ->whereNotNull('table_number')
            ->where('status', '!=', 'declined')
            ->get()
            ->groupBy(fn($g) => Table::nameKey($g->table_number))
            ->filter(fn($group, $key) => $key !== '');

        $createdCount = 0;
        foreach ($guestsByTable as $group) {
            [$table, $created] = Table::ensureExists($eventId, $group->first()->table_number, (int) $group->sum('passes'));
            if ($created) {
                $createdCount++;
            }
            // Guests adopt the table's exact name
            $group->where('table_number', '!=', $table->name)->each(fn($g) => $g->update(['table_number' => $table->name]));
        }

        return response()->json([
            'message' => $createdCount > 0 ? "Se crearon {$createdCount} mesas automáticamente." : "Todas las mesas existentes ya estaban creadas."
        ]);
    }

    /**
     * Saves the venue plan in one go: table positions/shapes plus dance floor, stage and entrance.
     */
    public function saveLayout(Request $request, $eventId)
    {
        $event = Event::findOrFail($eventId);
        $this->checkEventAccess($event);

        $validated = $request->validate([
            'tables' => 'array',
            'tables.*.id' => 'required|integer',
            'tables.*.pos_x' => 'required|numeric',
            'tables.*.pos_y' => 'required|numeric',
            'tables.*.shape' => 'nullable|in:round,imperial,square',
            'tables.*.rotation' => 'nullable|in:0,90',
            // Venue elements placed by the planner (stage, dance floor, bar, buffet...)
            'venue' => 'nullable|array|max:150',
            'venue.*.id' => 'required|string|max:60',
            'venue.*.type' => 'required|string|max:30|regex:/^[a-z_]+$/',
            'venue.*.label' => 'nullable|string|max:40',
            'venue.*.x' => 'required|numeric|between:-10000,10000',
            'venue.*.y' => 'required|numeric|between:-10000,10000',
            'venue.*.w' => 'required|numeric|between:20,800',
            'venue.*.h' => 'required|numeric|between:20,800',
            'venue.*.rotation' => 'nullable|in:0,90,180,270',
        ]);

        $tables = Table::where('event_id', $eventId)->get()->keyBy('id');
        foreach ($validated['tables'] ?? [] as $item) {
            $table = $tables->get($item['id']);
            if (!$table) continue; // ignore tables from other events

            $table->update([
                'pos_x' => round($item['pos_x'], 1),
                'pos_y' => round($item['pos_y'], 1),
                'shape' => $item['shape'] ?? $table->shape,
                'rotation' => (int) ($item['rotation'] ?? $table->rotation),
            ]);
        }

        if (array_key_exists('venue', $validated)) {
            $venue = collect($validated['venue'] ?? [])
                ->map(fn($item) => [
                    'id' => $item['id'],
                    'type' => $item['type'],
                    'label' => trim($item['label'] ?? '') ?: null,
                    'x' => round($item['x'], 1),
                    'y' => round($item['y'], 1),
                    'w' => round($item['w'], 1),
                    'h' => round($item['h'], 1),
                    'rotation' => (int) ($item['rotation'] ?? 0),
                ])
                ->values()
                ->all();
            $event->update(['venue_layout' => $venue]);
        }

        return response()->json(['message' => 'Plano del salón guardado']);
    }
}
