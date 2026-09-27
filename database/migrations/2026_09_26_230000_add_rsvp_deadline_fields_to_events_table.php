<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            if (!Schema::hasColumn('events', 'rsvp_deadline_days')) {
                $table->integer('rsvp_deadline_days')->default(7)->after('event_date');
            }
            if (!Schema::hasColumn('events', 'auto_decline_expired')) {
                $table->boolean('auto_decline_expired')->default(true)->after('rsvp_deadline_days');
            }
        });

        Schema::table('guests', function (Blueprint $table) {
            if (!Schema::hasColumn('guests', 'reminder_sent_at')) {
                $table->timestamp('reminder_sent_at')->nullable()->after('last_sent_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn(['rsvp_deadline_days', 'auto_decline_expired']);
        });

        Schema::table('guests', function (Blueprint $table) {
            $table->dropColumn(['reminder_sent_at']);
        });
    }
};
