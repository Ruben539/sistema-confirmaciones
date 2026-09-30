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
            'spotify_url' => 'nullable|string|max:500',
            'background_music_path' => 'nullable|string|max:500',
            'gift_settings' => 'nullable',
            'dress_code' => 'nullable|string|max:100',
            'dress_code_notes' => 'nullable|string',
            'welcome_message' => 'nullable|string',
            'features_enabled' => 'nullable',
            'invitation_styles' => 'nullable',
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

    public function uploadCoverPhoto(Request $request, $id)
    {
        $event = Event::findOrFail($id);
        $request->validate([
            'photo' => 'required|image|mimes:jpeg,png,jpg,webp|max:15360',
        ]);

        $file = $request->file('photo');
        $path = null;
        $photoUrl = null;

        if (\App\Services\GoogleDriveService::isConfigured()) {
            $drive = new \App\Services\GoogleDriveService();
            $ext = $file->getClientOriginalExtension() ?: 'jpg';
            $driveResult = $drive->uploadEventFile($event, $file, 'portada_evento_' . $event->id . '_' . time() . '.' . $ext);
            if ($driveResult && !empty($driveResult['direct_url'])) {
                $path = $driveResult['direct_url'];
                $photoUrl = $driveResult['direct_url'];
            }
        }

        if (!$path) {
            $path = $file->store('covers', 'public');
            $photoUrl = \Illuminate\Support\Facades\Storage::disk('public')->url($path);
        }

        $event->update(['cover_photo_path' => $path]);

        return response()->json([
            'message' => 'Foto de portada actualizada con éxito',
            'cover_photo_path' => $path,
            'cover_photo_url' => $photoUrl,
            'event' => $event->fresh()
        ]);
    }

    public function uploadBackgroundMusic(Request $request, $id)
    {
        $event = Event::findOrFail($id);
        $request->validate([
            'music' => 'required|file|mimes:mp3,wav,ogg,m4a,aac,webm|max:30720', // max 30MB
        ]);

        $file = $request->file('music');
        $path = null;
        $musicUrl = null;

        if (\App\Services\GoogleDriveService::isConfigured()) {
            $drive = new \App\Services\GoogleDriveService();
            $ext = $file->getClientOriginalExtension() ?: 'mp3';
            $driveResult = $drive->uploadEventFile($event, $file, 'musica_evento_' . $event->id . '_' . time() . '.' . $ext);
            if ($driveResult && !empty($driveResult['direct_url'])) {
                $path = $driveResult['direct_url'];
                $musicUrl = $driveResult['direct_url'];
            }
        }

        if (!$path) {
            $path = $file->store('music', 'public');
            $musicUrl = \Illuminate\Support\Facades\Storage::disk('public')->url($path);
        }

        $event->update(['background_music_path' => $path]);

        return response()->json([
            'message' => 'Música de fondo cargada exitosamente',
            'background_music_path' => $path,
            'background_music_url' => $musicUrl,
            'event' => $event->fresh()
        ]);
    }

    public function saveInvitationStyles(Request $request, $id)
    {
        $event = Event::findOrFail($id);
        $validated = $request->validate([
            'styles' => 'required|array',
        ]);

        $event->update([
            'invitation_styles' => $validated['styles']
        ]);

        return response()->json([
            'message' => 'Estilos de la invitación guardados con éxito',
            'invitation_styles' => $event->invitation_styles,
            'event' => $event->fresh()
        ]);
    }

    public function generateAiStylePalette(Request $request, $id)
    {
        $event = Event::findOrFail($id);
        $gemini = new \App\Services\GoogleGeminiService();
        $vibe = $request->input('vibe');
        $eventType = $event->event_type ?: 'boda';
        $coupleNames = $event->couple_names ?: $event->title;

        $palette = $gemini->generateStylePalette($eventType, $coupleNames, $vibe);
        if (!$palette) {
            return response()->json([
                'message' => 'No se pudo generar la paleta con IA en este momento. Intentá nuevamente.'
            ], 500);
        }

        return response()->json([
            'message' => '¡Paleta generada exitosamente con Gemini!',
            'palette' => $palette
        ]);
    }

    public function generateAiInvitationCopy(Request $request, $id)
    {
        $event = Event::findOrFail($id);
        $gemini = new \App\Services\GoogleGeminiService();
        $tone = $request->input('tone', 'romantic');
        $eventType = $event->event_type ?: 'boda';
        $coupleNames = $event->couple_names ?: $event->title;

        $copy = $gemini->generateInvitationCopy($eventType, $coupleNames, $tone);
        if (!$copy) {
            return response()->json([
                'message' => 'No se pudieron generar los textos con IA en este momento.'
            ], 500);
        }

        return response()->json([
            'message' => '¡Textos generados con éxito!',
            'copy' => $copy
        ]);
    }

    public function removeBackgroundMusic($id)
    {
        $event = Event::findOrFail($id);
        if ($event->background_music_path) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete($event->background_music_path);
            $event->update(['background_music_path' => null]);
        }
        return response()->json([
            'message' => 'Música de fondo eliminada correctamente',
            'event' => $event->fresh()
        ]);
    }

    public function getSongSuggestions($id)
    {
        $event = Event::findOrFail($id);
        $suggestions = $event->guests()
            ->whereNotNull('song_suggestion')
            ->where('song_suggestion', '!=', '')
            ->select('id', 'name', 'phone', 'song_suggestion', 'status', 'updated_at')
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json([
            'total' => $suggestions->count(),
            'suggestions' => $suggestions
        ]);
    }

    public function getDedications($id)
    {
        $event = Event::findOrFail($id);
        $dedications = [];
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('event_dedications')) {
                $dedications = \App\Models\EventDedication::where('event_id', $event->id)
                    ->latest()
                    ->get();
            }
        } catch (\Throwable $e) {
            $dedications = [];
        }

        return response()->json($dedications);
    }

    public function toggleDedicationApproval($id, $dedicationId)
    {
        $dedication = \App\Models\EventDedication::where('event_id', $id)->findOrFail($dedicationId);
        $dedication->update(['is_approved' => !$dedication->is_approved]);

        return response()->json([
            'message' => $dedication->is_approved ? 'Dedicatoria aprobada para proyección' : 'Dedicatoria ocultada de proyección',
            'dedication' => $dedication
        ]);
    }

    public function deleteDedication($id, $dedicationId)
    {
        $dedication = \App\Models\EventDedication::where('event_id', $id)->findOrFail($dedicationId);
        if ($dedication->media_path) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete($dedication->media_path);
        }
        $dedication->delete();

        return response()->json([
            'message' => 'Dedicatoria eliminada'
        ]);
    }

    public function getLiveProjectionFeed($id)
    {
        $event = Event::findOrFail($id);
        $dedications = [];
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('event_dedications')) {
                $dedications = \App\Models\EventDedication::where('event_id', $event->id)
                    ->where('is_approved', true)
                    ->latest()
                    ->take(50)
                    ->get();
            }
        } catch (\Throwable $e) {
            $dedications = [];
        }

        return response()->json([
            'event' => $event,
            'dedications' => $dedications,
            'upload_url' => url("/evento/{$event->id}/dedicatoria"),
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
