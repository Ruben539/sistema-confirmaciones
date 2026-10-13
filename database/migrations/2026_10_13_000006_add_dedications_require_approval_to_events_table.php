<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            // Las dedicatorias nuevas quedan pendientes hasta que alguien las apruebe para la pantalla gigante
            $table->boolean('dedications_require_approval')->default(true)->after('features_enabled');
        });

        // Los eventos existentes mantienen la publicación inmediata que tenían
        DB::table('events')->update(['dedications_require_approval' => false]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn('dedications_require_approval');
        });
    }
};
