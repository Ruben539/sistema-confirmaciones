<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tables', function (Blueprint $table) {
            // Posición en el plano del salón (centro del salón = 0,0). Null = ubicación automática
            if (!Schema::hasColumn('tables', 'pos_x')) {
                $table->float('pos_x')->nullable()->after('notes');
            }
            if (!Schema::hasColumn('tables', 'pos_y')) {
                $table->float('pos_y')->nullable()->after('pos_x');
            }
            // 'round', 'imperial' o 'square'. Null = se deduce del nombre (ej: "Mesa Principal" = imperial)
            if (!Schema::hasColumn('tables', 'shape')) {
                $table->string('shape', 20)->nullable()->after('pos_y');
            }
            // Rotación en grados (0 o 90)
            if (!Schema::hasColumn('tables', 'rotation')) {
                $table->integer('rotation')->default(0)->after('shape');
            }
        });

        Schema::table('events', function (Blueprint $table) {
            // Posición de pista, escenario y entrada: {"dance": {"x":0,"y":-200}, "stage": {...}, "entrance": {...}}
            if (!Schema::hasColumn('events', 'venue_layout')) {
                $table->json('venue_layout')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('tables', function (Blueprint $table) {
            $table->dropColumn(['pos_x', 'pos_y', 'shape', 'rotation']);
        });
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn(['venue_layout']);
        });
    }
};
