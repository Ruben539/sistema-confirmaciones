<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EventController;
use App\Http\Controllers\GuestController;
use App\Http\Controllers\HostessController;
use App\Http\Controllers\RsvpController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\AppReleaseController;
use App\Http\Controllers\PlannerController;
use App\Http\Controllers\TableController;
use App\Http\Controllers\PlanRequestController;
use App\Http\Controllers\TimingController;
use App\Http\Controllers\EventTypeController;
use App\Http\Controllers\SpotifyController;
use App\Http\Controllers\WhatsAppCloudWebhookController;
use App\Http\Controllers\AiListController;
use App\Http\Controllers\LiveStreamController;
use App\Http\Controllers\CasitaController;
use App\Http\Controllers\CasitaCatalogController;

// Rutas de API para el sistema de confirmaciones
Route::prefix('api')->group(function () {
    // ───────────── Rutas públicas (sin login) ─────────────

    // Auth
    Route::get('/auth/user', [AuthController::class, 'user']);
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Webhook del bot de WhatsApp (protegido con WHATSAPP_WEBHOOK_SECRET dentro del controlador)
    Route::post('/rsvp/incoming-whatsapp', [RsvpController::class, 'handleIncomingWhatsApp']);

    // Webhook de la API oficial de WhatsApp (Meta): verificación (GET) y mensajes firmados (POST)
    Route::get('/whatsapp/webhook', [WhatsAppCloudWebhookController::class, 'verify']);
    Route::post('/whatsapp/webhook', [WhatsAppCloudWebhookController::class, 'receive']);

    // Páginas del invitado: el token / public_code del link es la llave.
    // Límites por IP generosos: en el salón muchos invitados comparten el mismo WiFi (misma IP pública).
    Route::get('/rsvp/{token}', [RsvpController::class, 'show'])->middleware('throttle:60,1');
    Route::post('/rsvp/{token}', [RsvpController::class, 'submit'])->middleware('throttle:20,1');
    Route::post('/rsvp/{token}/dedication', [RsvpController::class, 'uploadDedication'])->middleware('throttle:20,1');
    Route::post('/rsvp/{token}/song-request', [RsvpController::class, 'storeSongRequest'])->middleware('throttle:30,1');
    Route::get('/events/{code}/public-invitation', [RsvpController::class, 'publicInvitation'])->middleware('throttle:60,1');
    Route::post('/events/{code}/public-dedication', [RsvpController::class, 'uploadPublicDedication'])->middleware('throttle:20,1');
    Route::post('/events/{code}/public-song-request', [RsvpController::class, 'storePublicSongRequest'])->middleware('throttle:30,1');
    Route::post('/rsvp/suggest-dedication', [RsvpController::class, 'suggestDedication'])->middleware('throttle:15,1'); // IA (Gemini): tiene costo

    // Videos de dedicatorias en Google Drive (solo con link firmado)
    Route::get('/dedications/{dedication}/media', [EventController::class, 'streamDedicationMedia'])
        ->name('dedications.media')
        ->middleware(['signed:relative', 'throttle:600,1']);

    // Pantalla gigante de proyección (consulta cada 10s)
    Route::get('/events/{code}/live-feed', [EventController::class, 'getLiveProjectionFeed'])->middleware('throttle:60,1');

    // Transmisión de Cámara en Vivo (WebRTC)
    Route::get('/events/{code}/live-stream/status', [LiveStreamController::class, 'status'])->middleware('throttle:120,1');
    Route::post('/events/{code}/live-stream/start', [LiveStreamController::class, 'start'])->middleware('throttle:30,1');
    Route::post('/events/{code}/live-stream/answer', [LiveStreamController::class, 'answer'])->middleware('throttle:60,1');
    Route::post('/events/{code}/live-stream/candidate', [LiveStreamController::class, 'addCandidate'])->middleware('throttle:300,1');
    Route::get('/events/{code}/live-stream/candidates', [LiveStreamController::class, 'getCandidates'])->middleware('throttle:300,1');
    Route::post('/events/{code}/live-stream/heartbeat', [LiveStreamController::class, 'heartbeat'])->middleware('throttle:120,1');
    Route::post('/events/{code}/live-stream/stop', [LiveStreamController::class, 'stop'])->middleware('throttle:30,1');

    // Spotify: lo usan la invitación pública y el panel
    Route::get('/spotify/resolve', [SpotifyController::class, 'resolve'])->middleware('throttle:120,1');
    Route::get('/spotify/search', [SpotifyController::class, 'search'])->middleware('throttle:120,1');

    // ───────────── Panel y app móvil (login obligatorio) ─────────────
    // auth:sanctum acepta la sesión del panel web y el token Bearer de la app.
    // role.access: usuarios desactivados y límites de la anfitriona (ver EnforceRoleAccess)
    Route::middleware(['auth:sanctum', 'role.access'])->group(function () {
        // Event & Planner Management
        Route::get('/event', [EventController::class, 'index']);
        Route::post('/events', [EventController::class, 'store']);
        Route::put('/event/{id}', [EventController::class, 'update']);
        Route::delete('/event/{id}', [EventController::class, 'destroy']);
        Route::get('/planners', [EventController::class, 'planners']);

        // Event Types Management
        Route::get('/event-types', [EventTypeController::class, 'index']);
        Route::post('/event-types', [EventTypeController::class, 'store']);
        Route::put('/event-types/{id}', [EventTypeController::class, 'update']);
        Route::delete('/event-types/{id}', [EventTypeController::class, 'destroy']);

        // Planners / User Administration
        Route::get('/planners/full', [PlannerController::class, 'index']);
        Route::post('/planners', [PlannerController::class, 'store']);
        Route::put('/planners/{id}', [PlannerController::class, 'update']);
        Route::delete('/planners/{id}', [PlannerController::class, 'destroy']);

        // Mensajes: conversaciones de WhatsApp por evento (planner y admin); limpieza solo admin
        Route::get('/events/{eventId}/conversations', [ConversationController::class, 'index']);
        Route::delete('/events/{eventId}/messages', [ConversationController::class, 'destroyEventMessages']);
        Route::get('/guests/{guestId}/conversation', [ConversationController::class, 'show']);
        Route::post('/guests/{guestId}/conversation', [ConversationController::class, 'reply']);
        Route::post('/guests/{guestId}/conversation/resolve', [ConversationController::class, 'resolve']);
        Route::put('/guest-messages/{messageId}', [ConversationController::class, 'editMessage']);
        Route::delete('/guests/{guestId}/conversation', [ConversationController::class, 'destroyConversation']);
        Route::get('/messages/stats', [ConversationController::class, 'stats']);
        Route::post('/messages/purge', [ConversationController::class, 'purge']);

        // Aplicación móvil: el admin sube el APK, planners y anfitrionas lo descargan
        Route::get('/app-releases', [AppReleaseController::class, 'index']);
        Route::post('/app-releases/upload-session', [AppReleaseController::class, 'uploadSession']);
        Route::post('/app-releases', [AppReleaseController::class, 'store']);
        Route::post('/app-releases/seen', [AppReleaseController::class, 'markSeen']);
        Route::get('/app-releases/{id}/download', [AppReleaseController::class, 'download']);
        Route::delete('/app-releases/{id}', [AppReleaseController::class, 'destroy']);

        // Anfitrionas (las crea la planner y las asigna a sus eventos)
        Route::get('/hostesses', [HostessController::class, 'index']);
        Route::post('/hostesses', [HostessController::class, 'store']);
        Route::put('/hostesses/{id}', [HostessController::class, 'update']);
        Route::put('/hostesses/{id}/events', [HostessController::class, 'syncEvents']);
        Route::delete('/hostesses/{id}', [HostessController::class, 'destroy']);

        // Guests Routes
        Route::get('/events/{eventId}/guests', [GuestController::class, 'index']);
        Route::post('/events/{eventId}/guests', [GuestController::class, 'store']);
        Route::post('/events/{eventId}/guests/import', [GuestController::class, 'importBatch']);
        // Asistente de listas (IA): Claude propone las invitaciones de un Excel (tiene costo por uso)
        Route::post('/events/{eventId}/ai-list/analyze', [AiListController::class, 'analyze'])->middleware('throttle:20,1');
        Route::post('/events/{eventId}/send-bulk-queue', [GuestController::class, 'sendBulkQueue']);
        Route::post('/events/{eventId}/cancel-bulk-queue', [GuestController::class, 'cancelBulkQueue']);
        Route::get('/events/{eventId}/bulk-status', [GuestController::class, 'bulkStatus']);
        Route::post('/events/{eventId}/send-corrections', [GuestController::class, 'sendCorrections']);
        Route::post('/events/{eventId}/send-count-correction', [GuestController::class, 'sendCountCorrection']);
        Route::post('/events/{eventId}/guests/merge', [GuestController::class, 'mergeGuests']);
        Route::delete('/events/{eventId}/guests/clear', [GuestController::class, 'destroyAll']);

        Route::put('/guests/{id}', [GuestController::class, 'update']);
        Route::post('/guests/{id}/sent', [GuestController::class, 'markSent']);
        Route::post('/guests/{id}/send-auto', [GuestController::class, 'sendWhatsAppApi']);
        Route::post('/guests/{id}/reminder', [GuestController::class, 'sendReminder']);
        Route::post('/guests/{id}/resend-qr', [GuestController::class, 'resendQrPass']);
        Route::get('/guests/{id}/activity', [GuestController::class, 'activity']);
        Route::put('/guests/{id}/members', [GuestController::class, 'updateMembers']);
        Route::delete('/guests/{id}', [GuestController::class, 'destroy']);

        // Seating Tables Routes
        Route::get('/events/{eventId}/tables', [TableController::class, 'index']);
        Route::post('/events/{eventId}/tables', [TableController::class, 'store']);
        Route::post('/events/{eventId}/tables/auto-create', [TableController::class, 'autoCreateFromGuests']);
        Route::put('/tables/{id}', [TableController::class, 'update']);
        Route::delete('/tables/{id}', [TableController::class, 'destroy']);
        Route::post('/tables/assign', [TableController::class, 'assignGuest']);
        Route::post('/tables/assign-member', [TableController::class, 'assignMember']);
        Route::post('/events/{eventId}/tables/import', [TableController::class, 'importAssignments']);
        Route::put('/events/{eventId}/tables/layout', [TableController::class, 'saveLayout']);

        // Invitación Digital: configuración, dedicatorias y canciones
        Route::post('/events/{id}/cover-photo', [EventController::class, 'uploadCoverPhoto']);
        Route::delete('/events/{id}/cover-photo', [EventController::class, 'removeCoverPhoto']);
        Route::post('/events/{id}/background-music', [EventController::class, 'uploadBackgroundMusic']);
        Route::delete('/events/{id}/background-music', [EventController::class, 'removeBackgroundMusic']);
        Route::post('/events/{id}/styles', [EventController::class, 'saveInvitationStyles']);
        Route::post('/events/{id}/invitation-background', [EventController::class, 'uploadInvitationBackground']);
        Route::match(['get', 'post'], '/events/{id}/ai-style-palette', [EventController::class, 'generateAiStylePalette'])->middleware('throttle:20,1');
        Route::match(['get', 'post'], '/events/{id}/ai-invitation-copy', [EventController::class, 'generateAiInvitationCopy'])->middleware('throttle:20,1');
        Route::get('/events/{id}/song-suggestions', [EventController::class, 'getSongSuggestions']);
        Route::post('/events/{id}/song-requests', [EventController::class, 'createSongRequest']);
        Route::post('/events/{id}/song-requests/{requestId}/toggle-played', [EventController::class, 'toggleSongRequestPlayed']);
        Route::delete('/events/{id}/song-requests/{requestId}', [EventController::class, 'deleteSongRequest']);
        Route::get('/events/{id}/dedications', [EventController::class, 'getDedications']);
        Route::post('/events/{id}/dedications/{dedicationId}/toggle', [EventController::class, 'toggleDedicationApproval']);
        Route::delete('/events/{id}/dedications/{dedicationId}', [EventController::class, 'deleteDedication']);

        // Acreditación en puerta (escaneo de QR)
        Route::post('/check-in/scan', [GuestController::class, 'scanQrCheckIn']);
        Route::post('/check-in/{token}', [GuestController::class, 'scanQrCheckIn']);

        // Plan Upgrade Requests & Admin Approval Routes
        Route::get('/plan-requests', [PlanRequestController::class, 'index']);
        Route::post('/events/{eventId}/plan-request', [PlanRequestController::class, 'store']);
        Route::post('/events/{eventId}/digital-invitation-request', [PlanRequestController::class, 'storeDigitalInvitation']);
        Route::post('/plan-requests/{id}/approve', [PlanRequestController::class, 'approve']);
        Route::post('/plan-requests/{id}/reject', [PlanRequestController::class, 'reject']);

        // Event Timing / Cronograma Routes
        Route::get('/events/{eventId}/timing', [TimingController::class, 'show']);
        Route::post('/events/{eventId}/timing', [TimingController::class, 'save']);
        Route::post('/events/{eventId}/timing/upload', [TimingController::class, 'upload']);
        Route::post('/events/{eventId}/timing/items/{itemId}/toggle', [TimingController::class, 'toggleItem']);

        // La Casita: registro de eventos, presupuestos, pagos, garantías y pérdidas (solo admin)
        Route::prefix('casita')->group(function () {
            Route::get('/summary', [CasitaController::class, 'summary']);
            Route::get('/events', [CasitaController::class, 'index']);
            Route::post('/events', [CasitaController::class, 'store']);
            Route::post('/events/import', [CasitaController::class, 'import']);
            Route::get('/events/{id}', [CasitaController::class, 'show']);
            Route::put('/events/{id}', [CasitaController::class, 'update']);
            Route::delete('/events/{id}', [CasitaController::class, 'destroy']);
            Route::post('/events/{id}/payments', [CasitaController::class, 'storePayment']);
            Route::put('/events/{id}/losses', [CasitaController::class, 'saveLosses']);
            Route::get('/payments', [CasitaController::class, 'payments']);
            Route::put('/payments/{paymentId}', [CasitaController::class, 'updatePayment']);
            Route::delete('/payments/{paymentId}', [CasitaController::class, 'destroyPayment']);
            Route::get('/catalog', [CasitaCatalogController::class, 'index']);
            Route::post('/catalog', [CasitaCatalogController::class, 'store']);
            Route::put('/catalog/{id}', [CasitaCatalogController::class, 'update']);
            Route::delete('/catalog/{id}', [CasitaCatalogController::class, 'destroy']);
        });
    });
});

// Páginas legales (las pide Meta para publicar la app de WhatsApp)
Route::view('/privacidad', 'legal.privacy');
Route::view('/terminos', 'legal.terms');
Route::view('/eliminar-datos', 'legal.data-deletion');

// Fallback SPA renderiza la plantilla de React
Route::get('/{any?}', function () {
    return view('welcome');
})->where('any', '.*');
