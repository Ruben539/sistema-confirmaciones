<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EventController;
use App\Http\Controllers\GuestController;
use App\Http\Controllers\RsvpController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PlannerController;
use App\Http\Controllers\TableController;

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
    
    // Planners Administration
    Route::get('/planners/full', [PlannerController::class, 'index']);
    Route::post('/planners', [PlannerController::class, 'store']);
    Route::delete('/planners/{id}', [PlannerController::class, 'destroy']);

    // Guests Routes
    Route::get('/events/{eventId}/guests', [GuestController::class, 'index']);
    Route::post('/events/{eventId}/guests', [GuestController::class, 'store']);
    Route::post('/events/{eventId}/guests/import', [GuestController::class, 'importBatch']);
    Route::post('/events/{eventId}/send-bulk-queue', [GuestController::class, 'sendBulkQueue']);
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

    // Public Guest RSVP Routes
    Route::post('/rsvp/incoming-whatsapp', [RsvpController::class, 'handleIncomingWhatsApp']);
    Route::get('/rsvp/{token}', [RsvpController::class, 'show']);
    Route::post('/rsvp/{token}', [RsvpController::class, 'submit']);

    // Door Accreditation / Check-In QR Scan Route
    Route::post('/check-in/scan', [GuestController::class, 'scanQrCheckIn']);
    Route::post('/check-in/{token}', [GuestController::class, 'scanQrCheckIn']);
});

// Fallback SPA renderiza la plantilla de React
Route::get('/{any?}', function () {
    return view('welcome');
})->where('any', '.*');
