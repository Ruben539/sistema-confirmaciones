<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
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
                $query->select('id', 'user_id', 'title', 'couple_names', 'event_date', 'status', 'plan_type', 'max_guests')
                    ->withCount('guests')
                    ->with(['planRequests' => function ($q) {
                        $q->orderBy('created_at', 'desc');
                    }]);
            }])
            ->orderBy('role', 'asc')
            ->orderBy('name', 'asc')
            ->get();

        $pendingRequestsCount = \App\Models\PlanRequest::where('status', 'pending')->count();

        return response()->json([
            'planners' => $users,
            'users' => $users,
            'pending_requests_count' => $pendingRequestsCount,
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
        $whatsappSent = false;
        $directWhatsAppUrl = null;

        // Send Welcome WhatsApp Message if phone is provided
        if (!empty($newUser->phone)) {
            $cleanPhone = $this->formatPhone($newUser->phone);
            $appUrl = config('app.url', url('/'));

            $welcomeMessage = "✨ *¡HOLA {$newUser->name}, BIENVENIDA A TU NUEVO ESPACIO!* 🥂🎉\n\n"
                . "Sabemos que lo que hacés no es simplemente organizar eventos: *creás momentos inolvidables, transformás sueños en realidad y dejás huellas imborrables en los días más importantes en la vida de las personas.* 💫\n\n"
                . "Ya sea una **boda de ensueño**, unos **15 años mágicos**, un **aniversario inolvidable** o una **gran gala corporativa**, esta plataforma fue diseñada para ser tu aliada detrás de escena y permitir que tu talento brille sin límites.\n\n"
                . "━━━━━━━━━━━━━━━━━━━━\n"
                . "🔐 *TUS DATOS DE ACCESO:*\n"
                . "🌐 *Plataforma:* {$appUrl}\n"
                . "📧 *Email:* {$newUser->email}\n"
                . ($newUser->username ? "👤 *Usuario:* @{$newUser->username}\n" : "")
                . "🔑 *Contraseña:* {$validated['password']}\n"
                . "━━━━━━━━━━━━━━━━━━━━\n\n"
                . "✨ *DESDE TU PANEL PODRÁS:*\n"
                . "📋 Gestionar cada una de tus celebraciones y cupos con total control.\n"
                . "💬 Automatizar invitaciones y confirmaciones por WhatsApp con pases QR.\n"
                . "🪑 Diseñar la distribución de mesas y asientos en plano visual.\n"
                . "🚀 Solicitar ampliación de plan cuando tus eventos crezcan.\n\n"
                . "Estamos felices de acompañarte a seguir creando momentos extraordinarios. ¡Muchos éxitos en cada una de tus producciones! 🌟🥂";

            $encodedText = urlencode($welcomeMessage);
            $directWhatsAppUrl = "https://api.whatsapp.com/send?phone=" . preg_replace('/[^\d]/', '', $cleanPhone) . "&text={$encodedText}";

            $botUrl = env('WHATSAPP_BOT_URL', 'http://127.0.0.1:3001/lead');
            try {
                $res = Http::timeout(8)->post($botUrl, [
                    'phone' => preg_replace('/[^\d]/', '', $cleanPhone),
                    'message' => $welcomeMessage
                ]);
                if ($res->successful()) {
                    $whatsappSent = true;
                }
            } catch (\Exception $e) {
                Log::warning("Error enviando WhatsApp de bienvenida a planner {$newUser->name}: " . $e->getMessage());
            }
        }

        return response()->json([
            'message' => $whatsappSent 
                ? "¡Usuario '{$newUser->name}' ({$roleTitle}) registrado! Se enviaron las credenciales de acceso por WhatsApp."
                : "Usuario '{$newUser->name}' ({$roleTitle}) registrado con éxito.",
            'planner' => $newUser,
            'user' => $newUser,
            'whatsapp_sent' => $whatsappSent,
            'direct_whatsapp_url' => $directWhatsAppUrl,
        ], 201);
    }

    private function formatPhone($phone)
    {
        $digits = preg_replace('/[^\d]/', '', $phone);
        if (empty($digits)) return '';

        if (str_starts_with($digits, '09') && strlen($digits) === 10) {
            return '595' . substr($digits, 1);
        }
        if (str_starts_with($digits, '9') && strlen($digits) === 9) {
            return '595' . $digits;
        }
        if (str_starts_with($digits, '595')) {
            return $digits;
        }
        if (strlen($digits) >= 9) {
            $last9 = substr($digits, -9);
            if (str_starts_with($last9, '9')) {
                return '595' . $last9;
            }
        }
        return $digits;
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
            'message' => "Usuario '{$target->name}' eliminado y sus eventos han sido reasignados al administrador."
        ]);
    }
}
