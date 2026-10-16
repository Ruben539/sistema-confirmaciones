<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class EventController extends Controller
{
    // Only staff of the event (admin, its planner, its hostesses) can touch it
    private function authorizeEvent(Event $event): void
    {
        abort_unless(Auth::user()?->canAccessEvent($event), 403, 'Acceso denegado: no tenés permisos sobre este evento.');
    }

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
        } else if ($user && $user->isHostess()) {
            // Hostess (anfitriona): only the events her planner assigned to her
            $events = $user->hostessEvents()
                ->orderBy('event_date', 'desc')
                ->get()
                ->each(fn ($event) => $event->makeHidden(['pivot']));
        } else {
            $events = collect();
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
            'message_template_single' => 'nullable|string',
            'is_enabled' => 'nullable|boolean',
            'plan_type' => 'nullable|string|in:' . Event::planKeys(),
            'max_guests' => 'nullable|integer|min:1|required_if:plan_type,custom',
            'payment_status' => 'nullable|string|in:pending,paid',
            'digital_invitation_addon' => 'nullable|boolean',
            'rsvp_deadline_days' => 'nullable|integer|min:0|max:180',
            'rsvp_deadline_date' => 'nullable|date',
            'reminder_interval_days' => 'nullable|integer|min:0|max:30',
            'reminder_max_count' => 'nullable|integer|min:1|max:10',
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
            'message_template_single' => $validated['message_template_single'] ?? null,
            'status' => 'active',
            'is_enabled' => $validated['is_enabled'] ?? true,
            'plan_type' => $planType,
            'max_guests' => $maxGuests,
            'payment_status' => $validated['payment_status'] ?? 'paid',
            'digital_invitation_addon' => $validated['digital_invitation_addon'] ?? false,
            'rsvp_deadline_days' => $validated['rsvp_deadline_days'] ?? 7,
            'rsvp_deadline_date' => $validated['rsvp_deadline_date'] ?? null,
            'reminder_interval_days' => $validated['reminder_interval_days'] ?? null,
            'reminder_max_count' => $validated['reminder_max_count'] ?? 3,
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
            'message_template_single' => 'nullable|string',
            'whatsapp_channel' => 'nullable|in:auto,baileys,cloud',
            'status' => 'nullable|in:active,completed,archived',
            'is_enabled' => 'nullable|boolean',
            'plan_type' => 'nullable|string|in:' . Event::planKeys(),
            'max_guests' => 'nullable|integer|min:1',
            'payment_status' => 'nullable|string|in:pending,paid',
            'digital_invitation_addon' => 'nullable|boolean',
            'rsvp_deadline_days' => 'nullable|integer|min:0|max:180',
            'rsvp_deadline_date' => 'nullable|date',
            'reminder_interval_days' => 'nullable|integer|min:0|max:30',
            'reminder_max_count' => 'nullable|integer|min:1|max:10',
            'auto_decline_expired' => 'nullable|boolean',
            'spotify_url' => 'nullable|string|max:500',
            'background_music_path' => 'nullable|string|max:500',
            'gift_settings' => 'nullable',
            'dress_code' => 'nullable|string|max:100',
            'dress_code_notes' => 'nullable|string',
            'welcome_message' => 'nullable|string',
            'features_enabled' => 'nullable',
            'dedications_require_approval' => 'nullable|boolean',
            'invitation_styles' => 'nullable',
        ]);

        // Only admin can reassign event ownership, change plan capacity, or toggle enablement/payment
        if ($user && $user->role !== 'admin') {
            unset($validated['user_id']);
            unset($validated['plan_type']);
            unset($validated['max_guests']);
            unset($validated['payment_status']);
            unset($validated['is_enabled']);
            unset($validated['digital_invitation_addon']);

            // "Configurar Evento" (datos, plazo de confirmación y recordatorios) es exclusivo del admin;
            // la planner solo edita la invitación digital (música, vestimenta, regalos, estilos)
            foreach ([
                'title', 'event_type', 'couple_names', 'event_date', 'location', 'message_template', 'message_template_single', 'whatsapp_channel', 'status',
                'rsvp_deadline_days', 'rsvp_deadline_date', 'auto_decline_expired',
                'reminder_interval_days', 'reminder_max_count',
            ] as $adminOnlyField) {
                unset($validated[$adminOnlyField]);
            }
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

        // Invitación Digital: solo si el plan la incluye o se contrató como adicional (evaluado con los valores nuevos)
        $sendsInvitationFields = array_intersect(array_keys($validated), Event::DIGITAL_INVITATION_FIELDS);
        if ($sendsInvitationFields) {
            $event->fill(array_intersect_key($validated, array_flip(['plan_type', 'digital_invitation_addon'])));
            $event->ensureDigitalInvitation();
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
        $this->authorizeEvent($event);
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

    /**
     * Background image of the digital invitation ("Diseño avanzado"). Returns its URL; the editor
     * keeps it in invitation_styles.background_image_url and saves it with the rest of the design.
     */
    public function uploadInvitationBackground(Request $request, $id)
    {
        $event = Event::findOrFail($id);
        $this->authorizeEvent($event);
        $event->ensureDigitalInvitation();

        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg,webp|max:15360',
        ]);

        $file = $request->file('image');
        $url = null;

        if (\App\Services\GoogleDriveService::isConfigured()) {
            $drive = new \App\Services\GoogleDriveService();
            $ext = $file->getClientOriginalExtension() ?: 'jpg';
            $result = $drive->uploadEventFile($event, $file, 'fondo_invitacion_' . $event->id . '_' . time() . '.' . $ext);
            $url = $result['direct_url'] ?? null;
        }

        if (!$url) {
            $url = \Illuminate\Support\Facades\Storage::disk('public')->url($file->store('invitation-backgrounds', 'public'));
        }

        return response()->json([
            'message' => 'Imagen de fondo subida.',
            'url' => $url,
        ]);
    }

    public function removeCoverPhoto($id)
    {
        $event = Event::findOrFail($id);
        $this->authorizeEvent($event);

        if ($event->cover_photo_path) {
            $disk = \Illuminate\Support\Facades\Storage::disk('public');
            if ($disk->exists($event->cover_photo_path)) {
                $disk->delete($event->cover_photo_path);
            }
            $event->update(['cover_photo_path' => null]);
        }

        return response()->json([
            'message' => 'Foto eliminada con éxito',
            'cover_photo_path' => null,
            'cover_photo_url' => null,
            'event' => $event->fresh()
        ]);
    }

    public function uploadBackgroundMusic(Request $request, $id)
    {
        $event = Event::findOrFail($id);
        $this->authorizeEvent($event);
        $event->ensureDigitalInvitation();
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
        $this->authorizeEvent($event);
        $event->ensureDigitalInvitation();
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
        $this->authorizeEvent($event);
        $event->ensureDigitalInvitation();
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
        $this->authorizeEvent($event);
        $event->ensureDigitalInvitation();
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
        $this->authorizeEvent($event);
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
        $this->authorizeEvent($event);
        $richRequests = collect();

        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('event_song_requests')) {
                $richRequests = \App\Models\EventSongRequest::where('event_id', $event->id)
                    ->orderBy('created_at', 'desc')
                    ->get()
                    ->map(function ($item) {
                        return [
                            'id' => $item->id,
                            'is_rich' => true,
                            'song_title' => $item->song_title,
                            'artist' => $item->artist,
                            'song_suggestion' => $item->artist ? "{$item->song_title} - {$item->artist}" : $item->song_title,
                            'name' => $item->requester_name,
                            'image_url' => $item->image_url,
                            'spotify_id' => $item->spotify_id,
                            'spotify_uri' => $item->spotify_uri,
                            'external_url' => $item->external_url,
                            'note' => $item->note,
                            'is_played' => (bool) $item->is_played,
                            'created_at' => $item->created_at?->diffForHumans() ?? 'Reciente',
                        ];
                    });
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Error loading rich song requests: ' . $e->getMessage());
        }

        // Also get legacy guests song suggestions
        $legacy = $event->guests()
            ->whereNotNull('song_suggestion')
            ->where('song_suggestion', '!=', '')
            ->select('id', 'name', 'phone', 'song_suggestion', 'status', 'updated_at')
            ->orderBy('updated_at', 'desc')
            ->get()
            ->map(function ($g) {
                return [
                    'id' => 'legacy_' . $g->id,
                    'is_rich' => false,
                    'song_title' => $g->song_suggestion,
                    'artist' => null,
                    'song_suggestion' => $g->song_suggestion,
                    'name' => $g->name,
                    'image_url' => null,
                    'spotify_id' => null,
                    'spotify_uri' => null,
                    'external_url' => null,
                    'note' => null,
                    'is_played' => false,
                    'created_at' => $g->updated_at?->diffForHumans() ?? 'Reciente',
                ];
            });

        $richNames = $richRequests->pluck('name')->toArray();
        $filteredLegacy = $legacy->reject(fn($l) => in_array($l['name'], $richNames));
        $allSuggestions = $richRequests->concat($filteredLegacy)->values();

        return response()->json([
            'total' => $allSuggestions->count(),
            'suggestions' => $allSuggestions
        ]);
    }

    public function toggleSongRequestPlayed($id, $requestId)
    {
        $event = Event::findOrFail($id);
        $this->authorizeEvent($event);
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('event_song_requests')) {
                $songReq = \App\Models\EventSongRequest::where('event_id', $event->id)->find($requestId);
                if ($songReq) {
                    $songReq->update(['is_played' => !$songReq->is_played]);
                    return response()->json([
                        'success' => true,
                        'is_played' => $songReq->is_played,
                    ]);
                }
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Error toggling song request: ' . $e->getMessage());
        }

        return response()->json(['success' => false, 'message' => 'No encontrado'], 404);
    }

    public function deleteSongRequest($id, $requestId)
    {
        $event = Event::findOrFail($id);
        $this->authorizeEvent($event);
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('event_song_requests')) {
                $songReq = \App\Models\EventSongRequest::where('event_id', $event->id)->find($requestId);
                if ($songReq) {
                    $songReq->delete();
                    return response()->json(['success' => true]);
                }
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Error deleting song request: ' . $e->getMessage());
        }

        return response()->json(['success' => false, 'message' => 'No encontrado'], 404);
    }

    public function createSongRequest(\Illuminate\Http\Request $request, $id)
    {
        $event = Event::findOrFail($id);
        $this->authorizeEvent($event);
        $event->ensureDigitalInvitation();
        $validated = $request->validate([
            'song_title' => 'required|string|max:255',
            'artist' => 'nullable|string|max:255',
            'requester_name' => 'nullable|string|max:255',
            'spotify_id' => 'nullable|string|max:255',
            'spotify_uri' => 'nullable|string|max:255',
            'image_url' => 'nullable|string|max:500',
            'external_url' => 'nullable|string|max:500',
            'note' => 'nullable|string|max:500',
        ]);

        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('event_song_requests')) {
                $item = \App\Models\EventSongRequest::create([
                    'event_id' => $event->id,
                    'requester_name' => $validated['requester_name'] ?? 'DJ / Anfitrión',
                    'song_title' => $validated['song_title'],
                    'artist' => $validated['artist'] ?? null,
                    'spotify_id' => $validated['spotify_id'] ?? null,
                    'spotify_uri' => $validated['spotify_uri'] ?? null,
                    'image_url' => $validated['image_url'] ?? null,
                    'external_url' => $validated['external_url'] ?? null,
                    'note' => $validated['note'] ?? null,
                    'is_played' => false,
                ]);

                return response()->json([
                    'success' => true,
                    'suggestion' => [
                        'id' => $item->id,
                        'is_rich' => true,
                        'song_title' => $item->song_title,
                        'artist' => $item->artist,
                        'song_suggestion' => $item->artist ? "{$item->song_title} - {$item->artist}" : $item->song_title,
                        'name' => $item->requester_name,
                        'image_url' => $item->image_url,
                        'spotify_id' => $item->spotify_id,
                        'spotify_uri' => $item->spotify_uri,
                        'external_url' => $item->external_url,
                        'note' => $item->note,
                        'is_played' => false,
                        'created_at' => 'Recién',
                    ]
                ]);
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Error creating song request: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }

        return response()->json(['success' => false, 'message' => 'Tabla no disponible'], 400);
    }

    public function getDedications($id)
    {
        $event = Event::findOrFail($id);
        $this->authorizeEvent($event);
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
        $this->authorizeEvent(Event::findOrFail($id));
        $dedication = \App\Models\EventDedication::where('event_id', $id)->findOrFail($dedicationId);
        $dedication->update(['is_approved' => !$dedication->is_approved]);

        return response()->json([
            'message' => $dedication->is_approved ? 'Dedicatoria aprobada para proyección' : 'Dedicatoria ocultada de proyección',
            'dedication' => $dedication
        ]);
    }

    public function deleteDedication($id, $dedicationId)
    {
        $this->authorizeEvent(Event::findOrFail($id));
        $dedication = \App\Models\EventDedication::where('event_id', $id)->findOrFail($dedicationId);
        $driveFileId = \App\Services\GoogleDriveService::fileIdFromUrl($dedication->media_path);
        if ($driveFileId) {
            // Remove it from Drive too: otherwise the file stays reachable by its public link
            (new \App\Services\GoogleDriveService())->deleteFile($driveFileId);
        } elseif ($dedication->media_path) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete($dedication->media_path);
        }
        $dedication->delete();

        return response()->json([
            'message' => 'Dedicatoria eliminada'
        ]);
    }

    /**
     * Streams a dedication video stored in Google Drive (supports Range for <video> seeking/looping).
     * Reached only through the signed URL in EventDedication::media_url.
     */
    public function streamDedicationMedia(Request $request, $dedication)
    {
        $dedication = \App\Models\EventDedication::findOrFail($dedication);
        $fileId = \App\Services\GoogleDriveService::fileIdFromUrl($dedication->media_path);
        abort_unless($fileId, 404);

        $upstream = (new \App\Services\GoogleDriveService())->streamFile($fileId, $request->header('Range'));
        abort_if(!$upstream, 502, 'No se pudo obtener el archivo de Google Drive.');
        abort_if($upstream->getStatusCode() >= 400, $upstream->getStatusCode() === 404 ? 404 : 502);

        $headers = [
            'Content-Type' => $upstream->getHeaderLine('Content-Type') ?: 'video/mp4',
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'private, max-age=3600',
        ];
        foreach (['Content-Length', 'Content-Range'] as $header) {
            if ($upstream->hasHeader($header)) {
                $headers[$header] = $upstream->getHeaderLine($header);
            }
        }

        $body = $upstream->getBody();
        return response()->stream(function () use ($body) {
            while (!$body->eof()) {
                echo $body->read(256 * 1024);
                flush();
            }
        }, $upstream->getStatusCode(), $headers);
    }

    public function getLiveProjectionFeed($code)
    {
        $event = Event::findByPublicCodeOrFail($code);
        $event->ensureDigitalInvitation();
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
            'event' => $event->toPublicArray(),
            'dedications' => $dedications,
            'upload_url' => url("/evento/{$event->public_code}/dedicatoria"),
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
