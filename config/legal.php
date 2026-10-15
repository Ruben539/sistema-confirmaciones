<?php

// Data shown on the public legal pages (/privacidad, /terminos, /eliminar-datos)
return [
    // Brand as guests and planners know it
    'brand' => env('LEGAL_BRAND', env('APP_NAME', 'Confirmaciones')),
    // Person or company responsible for the data (name as in the RUC if there is one)
    'owner' => env('LEGAL_OWNER', env('LEGAL_BRAND', env('APP_NAME', 'Confirmaciones'))),
    'email' => env('LEGAL_EMAIL'),
    'whatsapp' => env('LEGAL_WHATSAPP'),
    'country' => env('LEGAL_COUNTRY', 'Paraguay'),
    'updated_at' => env('LEGAL_UPDATED_AT', '15/10/2026'),
];
