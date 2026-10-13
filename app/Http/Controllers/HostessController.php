<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

/**
 * Anfitrionas (role "hostess"): the planner creates them and assigns them to her events.
 * They log in to the app and the web with limited access (see EnforceRoleAccess).
 * Admins can see and manage every planner's hostesses.
 */
class HostessController extends Controller
{
    private function authorizeManager(): User
    {
        $user = Auth::user();
        abort_unless($user && ($user->isAdmin() || $user->isPlanner()), 403, 'Solo las planners y el administrador gestionan anfitrionas.');
        return $user;
    }

    private function findManagedHostess(User $manager, $id): User
    {
        $hostess = User::where('role', 'hostess')->findOrFail($id);
        abort_unless($manager->isAdmin() || (int) $hostess->planner_id === (int) $manager->id, 403, 'Esta anfitriona no trabaja para vos.');
        return $hostess;
    }

    private function present(User $hostess): array
    {
        return [
            'id' => $hostess->id,
            'name' => $hostess->name,
            'username' => $hostess->username,
            'phone' => $hostess->phone,
            'is_active' => $hostess->is_active !== false,
            'planner_id' => $hostess->planner_id,
            'planner_name' => $hostess->planner?->name,
            'event_ids' => $hostess->hostessEvents->pluck('id')->values(),
            'events' => $hostess->hostessEvents->map(fn ($e) => [
                'id' => $e->id,
                'title' => $e->couple_names ?: $e->title,
                'event_date' => $e->event_date,
            ])->values(),
        ];
    }

    public function index()
    {
        $manager = $this->authorizeManager();

        $query = User::where('role', 'hostess')->with(['hostessEvents', 'planner:id,name'])->orderBy('name');
        if (!$manager->isAdmin()) {
            $query->where('planner_id', $manager->id);
        }

        return response()->json([
            'hostesses' => $query->get()->map(fn ($h) => $this->present($h))->values(),
        ]);
    }

    public function store(Request $request)
    {
        $manager = $this->authorizeManager();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'username' => 'required|string|max:255|alpha_dash|unique:users,username',
            'phone' => 'nullable|string|max:50',
            'password' => 'required|string|min:6',
            // Admin creates hostesses on behalf of a planner
            'planner_id' => [Rule::requiredIf($manager->isAdmin()), 'nullable', Rule::exists('users', 'id')->where('role', 'planner')],
        ]);

        $username = strtolower($validated['username']);
        $hostess = User::create([
            'name' => $validated['name'],
            'username' => $username,
            // Login is by username; email is only required by the users table
            'email' => "{$username}@anfitrionas.local",
            'phone' => $validated['phone'] ?? null,
            'password' => $validated['password'],
            'role' => 'hostess',
            'planner_id' => $manager->isAdmin() ? $validated['planner_id'] : $manager->id,
            'is_active' => true,
        ]);

        return response()->json([
            'message' => "Anfitriona {$hostess->name} creada. Ingresa con el usuario \"{$username}\".",
            'hostess' => $this->present($hostess->load(['hostessEvents', 'planner:id,name'])),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $manager = $this->authorizeManager();
        $hostess = $this->findManagedHostess($manager, $id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone' => 'nullable|string|max:50',
            'password' => 'nullable|string|min:6',
            'is_active' => 'sometimes|boolean',
        ]);

        if (empty($validated['password'])) {
            unset($validated['password']);
        }

        $hostess->update($validated);

        // Deactivated or new password: close her open sessions in the app
        if (($validated['is_active'] ?? true) === false || isset($validated['password'])) {
            $hostess->tokens()->delete();
        }

        return response()->json([
            'message' => 'Anfitriona actualizada.',
            'hostess' => $this->present($hostess->fresh(['hostessEvents', 'planner:id,name'])),
        ]);
    }

    /**
     * Replaces the events assigned to a hostess. Only events of her own planner can be assigned.
     */
    public function syncEvents(Request $request, $id)
    {
        $manager = $this->authorizeManager();
        $hostess = $this->findManagedHostess($manager, $id);

        $validated = $request->validate([
            'event_ids' => 'present|array',
            'event_ids.*' => 'integer',
        ]);

        $eventIds = Event::whereIn('id', $validated['event_ids'])
            ->where('user_id', $hostess->planner_id)
            ->pluck('id');

        if ($eventIds->count() !== count(array_unique($validated['event_ids']))) {
            return response()->json(['message' => 'Solo se pueden asignar eventos de la planner de esta anfitriona.'], 422);
        }

        $hostess->hostessEvents()->sync($eventIds);

        return response()->json([
            'message' => 'Eventos asignados actualizados.',
            'hostess' => $this->present($hostess->fresh(['hostessEvents', 'planner:id,name'])),
        ]);
    }

    public function destroy($id)
    {
        $manager = $this->authorizeManager();
        $hostess = $this->findManagedHostess($manager, $id);

        $hostess->tokens()->delete();
        $hostess->delete();

        return response()->json(['message' => 'Anfitriona eliminada.']);
    }
}
