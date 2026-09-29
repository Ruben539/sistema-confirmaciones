<?php

namespace App\Http\Controllers;

use App\Models\EventType;
use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class EventTypeController extends Controller
{
    private static function defaultTypes(): array
    {
        return [
            ['id' => 1, 'name' => 'Boda / Casamiento', 'slug' => 'boda', 'icon' => '💍', 'description' => 'Celebración nupcial y casamientos', 'is_active' => true, 'events_count' => 0],
            ['id' => 2, 'name' => '15 Años / Fiesta de XV', 'slug' => 'xv_anos', 'icon' => '👑', 'description' => 'Fiestas de quinceañeras y debutantes', 'is_active' => true, 'events_count' => 0],
            ['id' => 3, 'name' => 'Cumpleaños', 'slug' => 'cumpleanos', 'icon' => '🎂', 'description' => 'Cumpleaños infantiles, adultos o temáticos', 'is_active' => true, 'events_count' => 0],
            ['id' => 4, 'name' => 'Aniversario', 'slug' => 'aniversario', 'icon' => '❤️', 'description' => 'Bodas de plata, oro o aniversarios de pareja', 'is_active' => true, 'events_count' => 0],
            ['id' => 5, 'name' => 'Evento Corporativo', 'slug' => 'corporativo', 'icon' => '🏢', 'description' => 'Cenas de fin de año, conferencias y lanzamientos', 'is_active' => true, 'events_count' => 0],
            ['id' => 6, 'name' => 'Graduación / Colación', 'slug' => 'graduacion', 'icon' => '🎓', 'description' => 'Fiestas de egresados, colaciones y graduaciones', 'is_active' => true, 'events_count' => 0],
            ['id' => 7, 'name' => 'Baby Shower / Fiesta', 'slug' => 'baby_shower', 'icon' => '🎈', 'description' => 'Baby showers, revelación de género y bautismos', 'is_active' => true, 'events_count' => 0],
            ['id' => 8, 'name' => 'Otro Evento Especial', 'slug' => 'otro', 'icon' => '🎉', 'description' => 'Celebraciones generales y reuniones privadas', 'is_active' => true, 'events_count' => 0],
        ];
    }

    /**
     * Listar tipos de eventos.
     * Si es admin, retorna todos con conteo de eventos vinculados.
     * Si es planner, retorna solo los activos ordenados.
     */
    public function index(Request $request)
    {
        try {
            if (!Schema::hasTable('event_types')) {
                return response()->json(self::defaultTypes());
            }

            $user = Auth::user();
            $isAdmin = $user && $user->role === 'admin';

            $query = EventType::query();

            if ($isAdmin && $request->boolean('all', true)) {
                $types = $query->withCount('events')
                    ->orderBy('sort_order', 'asc')
                    ->orderBy('name', 'asc')
                    ->get();
            } else {
                $types = $query->where('is_active', true)
                    ->orderBy('sort_order', 'asc')
                    ->orderBy('name', 'asc')
                    ->get();
            }

            return response()->json($types);
        } catch (\Throwable $e) {
            return response()->json(self::defaultTypes());
        }
    }

    /**
     * Crear un nuevo tipo de evento (Solo Administrador).
     */
    public function store(Request $request)
    {
        $user = Auth::user();
        if (!$user || $user->role !== 'admin') {
            return response()->json(['message' => 'Acceso denegado. Solo administradores pueden crear tipos de eventos.'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:event_types,name',
            'slug' => 'nullable|string|max:100|unique:event_types,slug',
            'icon' => 'nullable|string|max:50',
            'description' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $slug = !empty($validated['slug']) 
            ? Str::slug($validated['slug'], '_') 
            : Str::slug($validated['name'], '_');

        // Check again after sanitizing slug
        if (EventType::where('slug', $slug)->exists()) {
            $slug .= '_' . time();
        }

        $eventType = EventType::create([
            'name' => $validated['name'],
            'slug' => $slug,
            'icon' => $validated['icon'] ?: '🎉',
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        $eventType->loadCount('events');

        return response()->json([
            'message' => '¡Tipo de evento creado correctamente!',
            'event_type' => $eventType,
        ], 201);
    }

    /**
     * Actualizar un tipo de evento existente (Solo Administrador).
     */
    public function update(Request $request, $id)
    {
        $user = Auth::user();
        if (!$user || $user->role !== 'admin') {
            return response()->json(['message' => 'Acceso denegado. Solo administradores pueden modificar tipos de eventos.'], 403);
        }

        $eventType = EventType::findOrFail($id);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('event_types')->ignore($eventType->id)],
            'slug' => ['nullable', 'string', 'max:100', Rule::unique('event_types')->ignore($eventType->id)],
            'icon' => 'nullable|string|max:50',
            'description' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $oldSlug = $eventType->slug;
        $newSlug = !empty($validated['slug']) 
            ? Str::slug($validated['slug'], '_') 
            : $oldSlug;

        // If slug changed, cascade update to existing events using the old slug
        if ($newSlug !== $oldSlug) {
            Event::where('event_type', $oldSlug)->update(['event_type' => $newSlug]);
        }

        $eventType->update([
            'name' => $validated['name'],
            'slug' => $newSlug,
            'icon' => $validated['icon'] ?: '🎉',
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? $eventType->is_active,
            'sort_order' => $validated['sort_order'] ?? $eventType->sort_order,
        ]);

        $eventType->loadCount('events');

        return response()->json([
            'message' => '¡Tipo de evento actualizado correctamente!',
            'event_type' => $eventType,
        ]);
    }

    /**
     * Eliminar un tipo de evento (Solo Administrador).
     */
    public function destroy($id)
    {
        $user = Auth::user();
        if (!$user || $user->role !== 'admin') {
            return response()->json(['message' => 'Acceso denegado. Solo administradores pueden eliminar tipos de eventos.'], 403);
        }

        $eventType = EventType::findOrFail($id);

        // Check if there are events using this event_type
        $eventsCount = Event::where('event_type', $eventType->slug)->count();
        if ($eventsCount > 0) {
            return response()->json([
                'message' => "No podés eliminar este tipo de evento porque hay {$eventsCount} evento(s) vinculados a él. Podés desactivarlo en su lugar para que no aparezca en nuevas creaciones."
            ], 422);
        }

        $eventType->delete();

        return response()->json([
            'message' => '¡Tipo de evento eliminado correctamente!',
        ]);
    }
}
