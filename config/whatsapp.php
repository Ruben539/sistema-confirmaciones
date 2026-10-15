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
    | Sending channel: "baileys" (our Node bot) or "cloud" (official WhatsApp Cloud API by Meta)
    |--------------------------------------------------------------------------
    */

    'driver' => env('WHATSAPP_DRIVER', 'baileys'),

    'cloud' => [
        // false = everything goes through the Baileys bot, even with the Cloud credentials loaded
        'enabled' => (bool) env('WHATSAPP_CLOUD_ENABLED', true),
        'graph_version' => env('WHATSAPP_CLOUD_GRAPH_VERSION', 'v26.0'),
        'phone_number_id' => env('WHATSAPP_CLOUD_PHONE_NUMBER_ID'),
        'business_account_id' => env('WHATSAPP_CLOUD_BUSINESS_ACCOUNT_ID'),
        'token' => env('WHATSAPP_CLOUD_TOKEN'),
        // Signs every webhook call from Meta (X-Hub-Signature-256)
        'app_secret' => env('WHATSAPP_CLOUD_APP_SECRET'),
        // Word we choose; Meta sends it back once when the webhook is configured
        'verify_token' => env('WHATSAPP_CLOUD_VERIFY_TOKEN'),
        'language' => env('WHATSAPP_CLOUD_TEMPLATE_LANGUAGE', 'es'),

        // Message templates approved by Meta (needed to write first / after 24 h without the guest writing)
        'templates' => [
            // Greeting + "Ver invitación" button; the event's own message is sent when the guest taps it
            'invitation' => env('WHATSAPP_TPL_INVITATION', 'saludo_invitacion'),
            'reminder' => env('WHATSAPP_TPL_REMINDER', 'recordatorio_evento'),
            'pass' => env('WHATSAPP_TPL_PASS', 'pase_ingreso'),
            'notice' => env('WHATSAPP_TPL_NOTICE', 'aviso_mensaje'),
        ],
    ],

    // Shared secret the bot sends in X-Webhook-Secret when forwarding incoming messages.
    // Without it anyone could post fake guest replies (or "APROBAR n") to the webhook.
    'webhook_secret' => env('WHATSAPP_WEBHOOK_SECRET'),

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

    // Random pause between two messages of the Baileys bot, in seconds
    'min_delay' => (int) env('WHATSAPP_MIN_DELAY', 20),
    'max_delay' => (int) env('WHATSAPP_MAX_DELAY', 45),

    // After this many messages in a row, take a longer break (seconds)
    'burst_size' => (int) env('WHATSAPP_BURST_SIZE', 30),
    'burst_pause' => (int) env('WHATSAPP_BURST_PAUSE', 300),

    // Max automated messages per bot session per day
    'daily_limit' => (int) env('WHATSAPP_DAILY_LIMIT', 150),

    // Invitations / reminders (writing first, the riskiest for an unofficial number) the bot sends per day
    // in total. In "auto" events the rest go through the official API.
    'baileys_daily_limit' => (int) env('WHATSAPP_BAILEYS_DAILY_LIMIT', 30),

    // Official Cloud API: not banned for pacing, short gaps; Meta's daily limit of new contacts
    // (250 for a business not verified yet)
    'cloud_min_delay' => (int) env('WHATSAPP_CLOUD_MIN_DELAY', 1),
    'cloud_max_delay' => (int) env('WHATSAPP_CLOUD_MAX_DELAY', 3),
    'cloud_daily_limit' => (int) env('WHATSAPP_CLOUD_DAILY_LIMIT', 250),

    // Only send between these hours (app timezone). Messages outside the
    // window wait for the next opening.
    'window_start' => (int) env('WHATSAPP_WINDOW_START', 9),
    'window_end' => (int) env('WHATSAPP_WINDOW_END', 21),

];
