<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Actualizar el check constraint en PostgreSQL para incluir 'attended'
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_status_check;");
            DB::statement("ALTER TABLE guests ADD CONSTRAINT guests_status_check CHECK (status::text = ANY (ARRAY['pending'::text, 'confirmed'::text, 'declined'::text, 'attended'::text]));");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_status_check;");
            DB::statement("ALTER TABLE guests ADD CONSTRAINT guests_status_check CHECK (status::text = ANY (ARRAY['pending'::text, 'confirmed'::text, 'declined'::text]));");
        }
    }
};
