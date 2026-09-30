<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class EventController extends Controller
{
    public function index()
    {
        $user = Auth::user();

        if ($user && $user->role === 'admin') {
            // Admin receives all events with assigned planner info
            $events = Event::with('planner')->orderBy('created_at', 'desc')->get();
        } else if ($user && $user->role === 'planner') {
            // Planner receives ONLY events assigned to them
            $events = Event::where('user_id', $user->id)
                ->orderBy('created_at', 'desc')
                ->get();
        } else {
            $events = Event::orderBy('created_at', 'desc')->get();
        }

        $activeEvent = $events->first();

        return response()->json([
            'events' => $events,
            'activeEvent' => $activeEvent
        ]);
    }

    public function store(Request $request)
    {
        $user = Auth::user();

        // ONLY Admin users can create events and assign them to planners
        if (!$user || $user->role !== 'admin') {
            return response()->json([
                'message' => 'Acceso denegado. Solo un Administrador puede crear y asignar nuevos eventos a las Wedding Planners.'
            ], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'event_type' => 'nullable|string|max:50',
            'couple_names' => 'required|string|max:255',
            'event_date' => 'nullable|date',
            'location' => 'nullable|string|max:255',
            'user_id' => 'required|exists:users,id', // Assigned Wedding Planner
            'message_template' => 'nullable|string',
            'is_enabled' => 'nullable|boolean',
            'plan_type' => 'nullable|string|in:' . Event::planKeys(),
            'max_guests' => 'nullable|integer|min:1|required_if:plan_type,custom',
            'payment_status' => 'nullable|string|in:pending,paid',
            'rsvp_deadline_days' => 'nullable|integer|min:0|max:180',
            'auto_decline_expired' => 'nullable|boolean',
        ]);

        // Fixed plans always use their own capacity; only 'custom' takes a hand-set max_guests
        $planType = $validated['plan_type'] ?? 'initial';
        $maxGuests = $planType === 'custom'
            ? (int) $validated['max_guests']
            : Event::planMaxGuests($planType);

        $event = Event::create([
            'title' => $validated['title'],
            'event_type' => $validated['event_type'] ?? 'boda',
            'couple_names' => $validated['couple_names'],
            'event_date' => $validated['event_date'] ?? null,
            'location' => $validated['location'] ?? null,
            'user_id' => $validated['user_id'],
            'message_template' => $validated['message_template'] ?? "¡Hola {nombre}! Te invitamos al evento de {pareja} ✨\n📍 Lugar: {lugar}\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir",
            'status' => 'active',
            'is_enabled' => $validated['is_enabled'] ?? true,
            'plan_type' => $planType,
            'max_guests' => $maxGuests,
            'payment_status' => $validated['payment_status'] ?? 'paid',
            'rsvp_deadline_days' => $validated['rsvp_deadline_days'] ?? 7,
            'auto_decline_expired' => $validated['auto_decline_expired'] ?? true,
        ]);

        return response()->json([
            'message' => 'Evento creado y asignado exitosamente al Wedding Planner',
            'event' => $event->load('planner')
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $user = Auth::user();
        $event = Event::findOrFail($id);

        // A planner can only update their own event
        if ($user && $user->role === 'planner' && $event->user_id !== $user->id) {
            return response()->json([
                'message' => 'No tenés permisos para modificar este evento.'
            ], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'event_type' => 'nullable|string|max:50',
            'couple_names' => 'nullable|string|max:255',
            'event_date' => 'nullable|date',
            'location' => 'nullable|string|max:255',
            'user_id' => 'nullable|exists:users,id',
            'message_template' => 'nullable|string',
            'status' => 'nullable|in:active,completed,archived',
            'is_enabled' => 'nullable|boolean',
            'plan_type' => 'nullable|string|in:' . Event::planKeys(),
            'max_guests' => 'nullable|integer|min:1',
            'payment_status' => 'nullable|string|in:pending,paid',
            'rsvp_deadline_days' => 'nullable|integer|min:0|max:180',
            'auto_decline_expired' => 'nullable|boolean',
        ]);

        // Only admin can reassign event ownership, change plan capacity, or toggle enablement/payment
        if ($user && $user->role !== 'admin') {
            unset($validated['user_id']);
            unset($validated['plan_type']);
            unset($validated['max_guests']);
            unset($validated['payment_status']);
            unset($validated['is_enabled']);
        }

        // Fixed plans always use their own capacity; only 'custom' takes a hand-set max_guests
        if (isset($validated['plan_type'])) {
            if ($validated['plan_type'] === 'custom') {
                $validated['max_guests'] = $validated['max_guests'] ?? $event->max_guests;
            } else {
                $validated['max_guests'] = Event::planMaxGuests($validated['plan_type']);
            }
        } elseif (isset($validated['max_guests']) && (int) $validated['max_guests'] !== Event::planMaxGuests($event->plan_type)) {
            // A capacity that doesn't match the current plan turns it into a custom plan
            $validated['plan_type'] = 'custom';
        }

        $event->update($validated);

        return response()->json([
            'message' => 'Evento actualizado correctamente',
            'event' => $event->load('planner')
        ]);
    }

    public function destroy($id)
    {
        $user = Auth::user();
        $event = Event::findOrFail($id);

        if ($user && $user->role === 'planner' && $event->user_id !== $user->id) {
            return response()->json([
                'message' => 'No tenés permisos para eliminar este evento.'
            ], 403);
        }

        $event->guests()->delete();
        $event->delete();

        return response()->json([
            'message' => 'Evento eliminado correctamente'
        ]);
    }

    public function planners()
    {
        $user = Auth::user();

        if ($user && $user->role !== 'admin') {
            return response()->json([
                'message' => 'Solo administradores pueden consultar la lista de planners'
            ], 403);
        }

        $planners = User::where('role', 'planner')->select('id', 'name', 'email', 'role')->orderBy('name')->get();

        return response()->json($planners);
    }
}
