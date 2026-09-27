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
                'message' => 'Acceso denegado. Solo administradores pueden gestionar Wedding Planners.'
            ], 403);
        }

        $planners = User::whereIn('role', ['planner', 'admin'])
            ->withCount('events')
            ->with(['events' => function ($query) {
                $query->select('id', 'user_id', 'title', 'couple_names', 'event_date', 'status');
            }])
            ->orderBy('name', 'asc')
            ->get();

        return response()->json([
            'planners' => $planners
        ]);
    }

    public function store(Request $request)
    {
        $user = Auth::user();

        if (!$user || $user->role !== 'admin') {
            return response()->json([
                'message' => 'Acceso denegado. Solo administradores pueden registrar Wedding Planners.'
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:6',
        ]);

        $planner = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => 'planner',
        ]);

        return response()->json([
            'message' => 'Wedding Planner registrado con éxito.',
            'planner' => $planner
        ], 201);
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

        // Reassign events to current admin or null before deleting
        Event::where('user_id', $target->id)->update(['user_id' => $user->id]);

        $target->delete();

        return response()->json([
            'message' => 'Wedding Planner eliminado y sus bodas han sido reasignadas al administrador.'
        ]);
    }
}
