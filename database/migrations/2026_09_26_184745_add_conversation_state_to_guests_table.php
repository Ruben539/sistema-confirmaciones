<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            if (!Schema::hasColumn('guests', 'conversation_state')) {
                $table->string('conversation_state')->nullable()->default('awaiting_attendance')->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            if (Schema::hasColumn('guests', 'conversation_state')) {
                $table->dropColumn('conversation_state');
            }
        });
    }
};
