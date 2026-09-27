<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            if (!Schema::hasColumn('guests', 'attended_at')) {
                $table->timestamp('attended_at')->nullable()->after('status');
            }
        });

        // Actualizar la restricción check de PostgreSQL para permitir el estado 'attended'
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_status_check;");
            DB::statement("ALTER TABLE guests ADD CONSTRAINT guests_status_check CHECK (status::text = ANY (ARRAY['pending'::text, 'confirmed'::text, 'declined'::text, 'attended'::text]));");
        }
    }

    public function down(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            $table->dropColumn(['attended_at']);
        });
    }
};
