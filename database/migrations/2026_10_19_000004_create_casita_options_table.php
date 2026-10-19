<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Editable suggestion lists of La Casita:
 * - menu:    menus suggested when registering an event
 * - perdida: usual losses suggested in "Pérdidas y bebidas"
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('casita_options', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20)->index();
            $table->string('name');
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['type', 'name']);
        });

        $now = now();
        $defaults = [
            'menu' => ['Buffet de pastas con carne', 'Servicio de Asado', 'Servicio de Asado Premium', 'Hamburguesas Gourmet',
                'Parrillitas Corridas', 'Buffet frío/caliente', 'Finger Food', 'Desmechado', 'Baby Shower', 'A definir'],
            'perdida' => ['Servilletas hilo oscuro', 'Anillos de servilleta', 'Platos orgánicos verde', 'Vasos multiuso', 'Copas', 'Cubiertos', 'Mantel'],
        ];
        foreach ($defaults as $type => $names) {
            foreach ($names as $i => $name) {
                DB::table('casita_options')->insert(['type' => $type, 'name' => $name, 'sort_order' => $i, 'created_at' => $now, 'updated_at' => $now]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('casita_options');
    }
};
