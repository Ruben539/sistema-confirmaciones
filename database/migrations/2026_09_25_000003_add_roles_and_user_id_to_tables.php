<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'role')) {
                $table->enum('role', ['admin', 'planner'])->default('planner')->after('email');
            }
        });

        Schema::table('events', function (Blueprint $table) {
            if (!Schema::hasColumn('events', 'user_id')) {
                $table->foreignId('user_id')->nullable()->after('id')->constrained('users')->onDelete('cascade');
            }
            if (!Schema::hasColumn('events', 'status')) {
                $table->enum('status', ['active', 'completed', 'archived'])->default('active')->after('message_template');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });

        Schema::table('events', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn(['user_id', 'status']);
        });
    }
};
