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
            // null = un solo recordatorio el día antes del límite; 0 = sin recordatorios; N = cada N días
            $table->unsignedSmallInteger('reminder_interval_days')->nullable()->after('rsvp_deadline_date');
            $table->unsignedTinyInteger('reminder_max_count')->default(3)->after('reminder_interval_days');
        });

        Schema::table('guests', function (Blueprint $table) {
            $table->unsignedSmallInteger('reminder_count')->default(0)->after('reminder_sent_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn(['reminder_interval_days', 'reminder_max_count']);
        });

        Schema::table('guests', function (Blueprint $table) {
            $table->dropColumn('reminder_count');
        });
    }
};
