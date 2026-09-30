<?php

return [

    /*
    |--------------------------------------------------------------------------
    | WhatsApp Bot (Baileys)
    |--------------------------------------------------------------------------
    */

    'bot_url' => env('WHATSAPP_BOT_URL', 'http://127.0.0.1:3001/lead'),

    /*
    |--------------------------------------------------------------------------
    | Anti-block throttling (per WhatsApp session / phone number)
    |--------------------------------------------------------------------------
    |
    | Baileys is not an official API: WhatsApp can ban numbers that send too
    | much too fast. These limits apply to every automated message sent from
    | the same session, no matter which screen or command triggered it.
    |
    */

    // Random pause between two messages, in seconds
    'min_delay' => (int) env('WHATSAPP_MIN_DELAY', 20),
    'max_delay' => (int) env('WHATSAPP_MAX_DELAY', 45),

    // After this many messages in a row, take a longer break (seconds)
    'burst_size' => (int) env('WHATSAPP_BURST_SIZE', 30),
    'burst_pause' => (int) env('WHATSAPP_BURST_PAUSE', 300),

    // Max automated messages per number per day. Keep it low for new numbers
    // and raise it gradually as the number builds history.
    'daily_limit' => (int) env('WHATSAPP_DAILY_LIMIT', 150),

    // Only send between these hours (app timezone). Messages outside the
    // window wait for the next opening.
    'window_start' => (int) env('WHATSAPP_WINDOW_START', 9),
    'window_end' => (int) env('WHATSAPP_WINDOW_END', 21),

];
