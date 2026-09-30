<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            // Nombres de los acompañantes incluidos en la invitación (ej: "Sofía (hija, 4 años)")
            if (!Schema::hasColumn('guests', 'companions')) {
                $table->string('companions')->nullable()->after('children');
            }
        });
    }

    public function down(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            $table->dropColumn(['companions']);
        });
    }
};
