<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Recordatorio 1 día antes de la fecha límite de confirmación y auto-cancelación de pendientes al vencer.
// Requiere el cron del servidor: * * * * * cd /var/www/sistema-confirmaciones && php artisan schedule:run
Schedule::command('rsvp:process-deadlines')->hourly()->withoutOverlapping();
