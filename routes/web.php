<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EventController;
use App\Http\Controllers\GuestController;
use App\Http\Controllers\RsvpController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PlannerController;
use App\Http\Controllers\TableController;
use App\Http\Controllers\PlanRequestController;
use App\Http\Controllers\TimingController;
use App\Http\Controllers\EventTypeController;
use App\Http\Controllers\SpotifyController;

// Rutas de API para el sistema de confirmaciones
Route::prefix('api')->group(function () {
    // Auth Routes
    Route::get('/auth/user', [AuthController::class, 'user']);
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

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

    // Guests Routes
    Route::get('/events/{eventId}/guests', [GuestController::class, 'index']);
    Route::post('/events/{eventId}/guests', [GuestController::class, 'store']);
    Route::post('/events/{eventId}/guests/import', [GuestController::class, 'importBatch']);
    Route::post('/events/{eventId}/send-bulk-queue', [GuestController::class, 'sendBulkQueue']);
    Route::post('/events/{eventId}/cancel-bulk-queue', [GuestController::class, 'cancelBulkQueue']);
    Route::delete('/events/{eventId}/guests/clear', [GuestController::class, 'destroyAll']);
    
    Route::put('/guests/{id}', [GuestController::class, 'update']);
    Route::post('/guests/{id}/sent', [GuestController::class, 'markSent']);
    Route::post('/guests/{id}/send-auto', [GuestController::class, 'sendWhatsAppApi']);
    Route::delete('/guests/{id}', [GuestController::class, 'destroy']);

    // Seating Tables Routes
    Route::get('/events/{eventId}/tables', [TableController::class, 'index']);
    Route::post('/events/{eventId}/tables', [TableController::class, 'store']);
    Route::post('/events/{eventId}/tables/auto-create', [TableController::class, 'autoCreateFromGuests']);
    Route::put('/tables/{id}', [TableController::class, 'update']);
    Route::delete('/tables/{id}', [TableController::class, 'destroy']);
    Route::post('/tables/assign', [TableController::class, 'assignGuest']);
    Route::put('/events/{eventId}/tables/layout', [TableController::class, 'saveLayout']);

    // Public Guest Interactive Invitation & RSVP Routes
    Route::post('/rsvp/incoming-whatsapp', [RsvpController::class, 'handleIncomingWhatsApp']);
    Route::get('/rsvp/{token}', [RsvpController::class, 'show']);
    Route::post('/rsvp/{token}', [RsvpController::class, 'submit']);
    Route::post('/rsvp/{token}/dedication', [RsvpController::class, 'uploadDedication']);
    Route::post('/rsvp/{token}/song-request', [RsvpController::class, 'storeSongRequest']);
    Route::get('/events/{eventId}/public-invitation', [RsvpController::class, 'publicInvitation']);
    Route::post('/events/{eventId}/public-dedication', [RsvpController::class, 'uploadPublicDedication']);
    Route::post('/events/{eventId}/public-song-request', [RsvpController::class, 'storePublicSongRequest']);

    // Live Projection Screen Route (for Projector / DJ / Big Screen)
    Route::get('/events/{eventId}/live-feed', [EventController::class, 'getLiveProjectionFeed']);

    // Admin: Interactive Invitation, Dedications & Spotify / Song Suggestions
    Route::post('/events/{id}/cover-photo', [EventController::class, 'uploadCoverPhoto']);
    Route::post('/events/{id}/background-music', [EventController::class, 'uploadBackgroundMusic']);
    Route::delete('/events/{id}/background-music', [EventController::class, 'removeBackgroundMusic']);
    Route::post('/events/{id}/styles', [EventController::class, 'saveInvitationStyles']);
    Route::match(['get', 'post'], '/events/{id}/ai-style-palette', [EventController::class, 'generateAiStylePalette']);
    Route::match(['get', 'post'], '/events/{id}/ai-invitation-copy', [EventController::class, 'generateAiInvitationCopy']);
    Route::post('/rsvp/suggest-dedication', [RsvpController::class, 'suggestDedication']);
    Route::get('/events/{id}/song-suggestions', [EventController::class, 'getSongSuggestions']);
    Route::post('/events/{id}/song-requests/{requestId}/toggle-played', [EventController::class, 'toggleSongRequestPlayed']);
    Route::delete('/events/{id}/song-requests/{requestId}', [EventController::class, 'deleteSongRequest']);
    Route::get('/events/{id}/dedications', [EventController::class, 'getDedications']);
    Route::post('/events/{id}/dedications/{dedicationId}/toggle', [EventController::class, 'toggleDedicationApproval']);
    Route::delete('/events/{id}/dedications/{dedicationId}', [EventController::class, 'deleteDedication']);

    // Spotify Integration & Real-Time DJ Music Search Routes
    Route::get('/spotify/resolve', [SpotifyController::class, 'resolve']);
    Route::get('/spotify/search', [SpotifyController::class, 'search']);

    // Door Accreditation / Check-In QR Scan Route
    Route::post('/check-in/scan', [GuestController::class, 'scanQrCheckIn']);
    Route::post('/check-in/{token}', [GuestController::class, 'scanQrCheckIn']);

    // Plan Upgrade Requests & Admin Approval Routes
    Route::get('/plan-requests', [PlanRequestController::class, 'index']);
    Route::post('/events/{eventId}/plan-request', [PlanRequestController::class, 'store']);
    Route::post('/plan-requests/{id}/approve', [PlanRequestController::class, 'approve']);
    Route::post('/plan-requests/{id}/reject', [PlanRequestController::class, 'reject']);

    // Event Timing / Cronograma Routes
    Route::get('/events/{eventId}/timing', [TimingController::class, 'show']);
    Route::post('/events/{eventId}/timing', [TimingController::class, 'save']);
    Route::post('/events/{eventId}/timing/upload', [TimingController::class, 'upload']);
    Route::post('/events/{eventId}/timing/items/{itemId}/toggle', [TimingController::class, 'toggleItem']);
});

// Fallback SPA renderiza la plantilla de React
Route::get('/{any?}', function () {
    return view('welcome');
})->where('any', '.*');
