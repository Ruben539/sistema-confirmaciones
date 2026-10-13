<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            // Fecha límite fija para confirmar asistencia; si es null se usa rsvp_deadline_days
            $table->date('rsvp_deadline_date')->nullable()->after('rsvp_deadline_days');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn('rsvp_deadline_date');
        });
    }
};
