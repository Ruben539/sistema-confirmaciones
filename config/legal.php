<?php

// Data shown on the public legal pages (/privacidad, /terminos, /eliminar-datos).
// Empty values in the .env fall back to the app name (env() returns "" for "KEY=").
$brand = env('LEGAL_BRAND') ?: env('APP_NAME') ?: 'Confirmaciones';

return [
    // Brand as guests and planners know it
    'brand' => $brand,
    // Person or company responsible for the data (name as in the RUC if there is one)
    'owner' => env('LEGAL_OWNER') ?: $brand,
    'email' => env('LEGAL_EMAIL') ?: null,
    'whatsapp' => env('LEGAL_WHATSAPP') ?: null,
    'country' => env('LEGAL_COUNTRY') ?: 'Paraguay',
    'updated_at' => env('LEGAL_UPDATED_AT') ?: '15/10/2026',
];
