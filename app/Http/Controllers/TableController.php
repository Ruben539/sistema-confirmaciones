<?php

namespace App\Http\Controllers;

use App\Models\Table;
use App\Models\Guest;
use App\Models\Event;
use Illuminate\Http\Request;

class TableController extends Controller
{
    public function index($eventId)
    {
        $event = Event::findOrFail($eventId);
        $tables = Table::where('event_id', $eventId)->orderBy('id', 'asc')->get();
        $guests = Guest::where('event_id', $eventId)->get();

        $tableData = $tables->map(function ($table) use ($guests) {
            $assignedGuests = $guests->filter(function ($g) use ($table) {
                return trim(mb_strtolower($g->table_number ?? '')) === trim(mb_strtolower($table->name));
            })->values();

            $occupiedPasses = $assignedGuests->sum('passes');
            $youth = $assignedGuests->sum('youth');
            $adults = $assignedGuests->sum('adults');
            $children = $assignedGuests->sum('children');

            return [
                'id' => $table->id,
                'event_id' => $table->event_id,
                'name' => $table->name,
                'capacity' => $table->capacity,
                'notes' => $table->notes,
                'occupied_passes' => $occupiedPasses,
                'youth' => $youth,
                'adults' => $adults,
                'children' => $children,
                'guests' => $assignedGuests,
            ];
        });

        // Unassigned guests (no table_number or table_number doesn't match any table)
        $tableNames = $tables->pluck('name')->map(fn($n) => trim(mb_strtolower($n)))->toArray();
        $unassignedGuests = $guests->filter(function ($g) use ($tableNames) {
            if (!$g->table_number || trim($g->table_number) === '') return true;
            return !in_array(trim(mb_strtolower($g->table_number)), $tableNames);
        })->values();

        $totalCapacity = $tables->sum('capacity');
        $assignedPasses = $tableData->sum('occupied_passes');
        $unassignedPasses = $unassignedGuests->sum('passes');

        return response()->json([
            'tables' => $tableData,
            'unassigned_guests' => $unassignedGuests,
            'stats' => [
                'total_tables' => $tables->count(),
                'total_capacity' => $totalCapacity,
                'assigned_passes' => $assignedPasses,
                'unassigned_passes' => $unassignedPasses,
                'total_guests' => $guests->count(),
            ]
        ]);
    }

    public function store(Request $request, $eventId)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'capacity' => 'nullable|integer|min:1',
            'notes' => 'nullable|string|max:255',
        ]);

        $table = Table::create([
            'event_id' => $eventId,
            'name' => trim($validated['name']),
            'capacity' => isset($validated['capacity']) ? (int)$validated['capacity'] : 10,
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json([
            'message' => "Mesa '{$table->name}' creada con éxito",
            'table' => $table
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $table = Table::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'capacity' => 'sometimes|integer|min:1',
            'notes' => 'nullable|string|max:255',
        ]);

        $oldName = $table->name;

        $table->update($validated);

        // If name changed, update table_number for guests assigned to old table name
        if (isset($validated['name']) && trim($validated['name']) !== $oldName) {
            Guest::where('event_id', $table->event_id)
                ->where('table_number', $oldName)
                ->update(['table_number' => trim($validated['name'])]);
        }

        return response()->json([
            'message' => 'Mesa actualizada correctamente',
            'table' => $table
        ]);
    }

    public function destroy($id)
    {
        $table = Table::findOrFail($id);
        $tableName = $table->name;
        $eventId = $table->event_id;

        // Unassign guests
        Guest::where('event_id', $eventId)
            ->where('table_number', $tableName)
            ->update(['table_number' => null]);

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

        $guest = Guest::findOrFail($validated['guest_id']);
        $guest->table_number = $validated['table_name'] ? trim($validated['table_name']) : null;
        $guest->save();

        return response()->json([
            'message' => 'Invitado asignado correctamente',
            'guest' => $guest
        ]);
    }

    public function autoCreateFromGuests($eventId)
    {
        $uniqueTables = Guest::where('event_id', $eventId)
            ->whereNotNull('table_number')
            ->where('table_number', '!=', '')
            ->pluck('table_number')
            ->map(fn($t) => trim($t))
            ->unique();

        $createdCount = 0;
        foreach ($uniqueTables as $tableName) {
            $exists = Table::where('event_id', $eventId)
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($tableName)])
                ->exists();

            if (!$exists) {
                Table::create([
                    'event_id' => $eventId,
                    'name' => $tableName,
                    'capacity' => 10,
                ]);
                $createdCount++;
            }
        }

        return response()->json([
            'message' => $createdCount > 0 ? "Se crearon {$createdCount} mesas automáticamente." : "Todas las mesas existentes ya estaban creadas."
        ]);
    }
}
