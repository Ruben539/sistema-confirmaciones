<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Las rutas de la API del sistema están en routes/web.php (prefijo /api), con sesión para el panel
// y token Sanctum para la app. No duplicar acá rutas sin protección.
Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
