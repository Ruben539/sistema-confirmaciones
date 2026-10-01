<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EventController;
use App\Http\Controllers\SpotifyController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// AI Style Palette & Invitation Copy Generator
Route::match(['get', 'post'], '/events/{id}/ai-style-palette', [EventController::class, 'generateAiStylePalette']);
Route::match(['get', 'post'], '/events/{id}/ai-invitation-copy', [EventController::class, 'generateAiInvitationCopy']);

// Spotify API routes
Route::get('/spotify/resolve', [SpotifyController::class, 'resolve']);
Route::get('/spotify/search', [SpotifyController::class, 'search']);
