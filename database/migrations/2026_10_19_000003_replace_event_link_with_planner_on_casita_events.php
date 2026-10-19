<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A La Casita event is linked to the wedding planner who organizes it (optional),
 * not to an event of the confirmations system.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('casita_events', function (Blueprint $table) {
            $table->foreignId('planner_id')->nullable()->after('menu')->constrained('users')->nullOnDelete();
        });

        Schema::table('casita_events', function (Blueprint $table) {
            $table->dropConstrainedForeignId('event_id');
        });
    }

    public function down(): void
    {
        Schema::table('casita_events', function (Blueprint $table) {
            $table->foreignId('event_id')->nullable()->constrained('events')->nullOnDelete();
        });

        Schema::table('casita_events', function (Blueprint $table) {
            $table->dropConstrainedForeignId('planner_id');
        });
    }
};
