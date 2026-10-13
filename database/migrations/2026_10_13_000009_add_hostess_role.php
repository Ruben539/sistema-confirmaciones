<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Rol "anfitriona" (hostess): usuario creado por una planner, asignado a uno o varios de sus eventos,
     * con acceso limitado a la lista de invitados y la acreditación.
     */
    public function up(): void
    {
        // Allow the new role value (Laravel's enum is a CHECK constraint on PostgreSQL)
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'planner', 'hostess'))");
        } else {
            Schema::table('users', function (Blueprint $table) {
                $table->enum('role', ['admin', 'planner', 'hostess'])->default('planner')->change();
            });
        }

        Schema::table('users', function (Blueprint $table) {
            // Planner who owns this hostess (null for admins / planners)
            $table->foreignId('planner_id')->nullable()->after('role')->constrained('users')->nullOnDelete();
            // Deactivated users can't log in and their open sessions / tokens stop working
            $table->boolean('is_active')->default(true)->after('planner_id');
        });

        Schema::create('event_hostess', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained('events')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['event_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_hostess');

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['planner_id']);
            $table->dropColumn(['planner_id', 'is_active']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'planner'))");
        }
    }
};
