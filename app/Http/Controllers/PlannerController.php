<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class PlannerController extends Controller
{
    public function index()
    {
        $user = Auth::user();

        if (!$user || $user->role !== 'admin') {
            return response()->json([
                'message' => 'Acceso denegado. Solo administradores pueden gestionar usuarios.'
            ], 403);
        }

        $users = User::withCount('events')
            ->with(['events' => function ($query) {
                $query->select('id', 'user_id', 'title', 'couple_names', 'event_date', 'status');
            }])
            ->orderBy('role', 'asc')
            ->orderBy('name', 'asc')
            ->get();

        return response()->json([
            'planners' => $users,
            'users' => $users
        ]);
    }

    public function store(Request $request)
    {
        $user = Auth::user();

        if (!$user || $user->role !== 'admin') {
            return response()->json([
                'message' => 'Acceso denegado. Solo administradores pueden registrar nuevos usuarios.'
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'phone' => 'nullable|string|max:50',
            'username' => 'nullable|string|max:255|unique:users',
            'password' => 'required|string|min:6',
            'role' => 'required|string|in:admin,planner',
        ]);

        $newUser = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'username' => $validated['username'] ?? null,
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
        ]);

        $roleTitle = $newUser->role === 'admin' ? 'Administrador' : 'Wedding Planner';

        return response()->json([
            'message' => "Usuario '{$newUser->name}' ({$roleTitle}) registrado con éxito.",
            'planner' => $newUser,
            'user' => $newUser
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $admin = Auth::user();

        if (!$admin || $admin->role !== 'admin') {
            return response()->json([
                'message' => 'Acceso denegado.'
            ], 403);
        }

        $targetUser = User::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($targetUser->id)],
            'phone' => 'nullable|string|max:50',
            'username' => ['nullable', 'string', 'max:255', Rule::unique('users')->ignore($targetUser->id)],
            'role' => 'required|string|in:admin,planner',
            'password' => 'nullable|string|min:6',
        ]);

        $updateData = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'username' => $validated['username'] ?? null,
            'role' => $validated['role'],
        ];

        if (!empty($validated['password'])) {
            $updateData['password'] = Hash::make($validated['password']);
        }

        $targetUser->update($updateData);

        return response()->json([
            'message' => "Usuario '{$targetUser->name}' actualizado exitosamente.",
            'user' => $targetUser->fresh()
        ]);
    }

    public function destroy($id)
    {
        $user = Auth::user();

        if (!$user || $user->role !== 'admin') {
            return response()->json([
                'message' => 'Acceso denegado.'
            ], 403);
        }

        if ((int)$id === (int)$user->id) {
            return response()->json([
                'message' => 'No podés eliminar tu propia cuenta de administrador.'
            ], 400);
        }

        $target = User::findOrFail($id);

        // Reassign events to current admin before deleting
        Event::where('user_id', $target->id)->update(['user_id' => $user->id]);

        $target->delete();

        return response()->json([
            'message' => "Usuario '{$target->name}' eliminado y sus bodas han sido reasignadas al administrador."
        ]);
    }
}
