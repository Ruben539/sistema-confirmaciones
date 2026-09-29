<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('icon', 50)->nullable()->default('🎉');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // Seed default initial event types
        $defaults = [
            ['name' => 'Boda / Casamiento', 'slug' => 'boda', 'icon' => '💍', 'description' => 'Celebración nupcial y casamientos', 'sort_order' => 1],
            ['name' => '15 Años / Fiesta de XV', 'slug' => 'xv_anos', 'icon' => '👑', 'description' => 'Fiestas de quinceañeras y debutantes', 'sort_order' => 2],
            ['name' => 'Cumpleaños', 'slug' => 'cumpleanos', 'icon' => '🎂', 'description' => 'Cumpleaños infantiles, adultos o temáticos', 'sort_order' => 3],
            ['name' => 'Aniversario', 'slug' => 'aniversario', 'icon' => '❤️', 'description' => 'Bodas de plata, oro o aniversarios de pareja', 'sort_order' => 4],
            ['name' => 'Evento Corporativo', 'slug' => 'corporativo', 'icon' => '🏢', 'description' => 'Cenas de fin de año, conferencias y lanzamientos', 'sort_order' => 5],
            ['name' => 'Graduación / Colación', 'slug' => 'graduacion', 'icon' => '🎓', 'description' => 'Fiestas de egresados, colaciones y graduaciones', 'sort_order' => 6],
            ['name' => 'Baby Shower / Fiesta', 'slug' => 'baby_shower', 'icon' => '🎈', 'description' => 'Baby showers, revelación de género y bautismos', 'sort_order' => 7],
            ['name' => 'Otro Evento Especial', 'slug' => 'otro', 'icon' => '🎉', 'description' => 'Celebraciones generales y reuniones privadas', 'sort_order' => 8],
        ];

        foreach ($defaults as $item) {
            DB::table('event_types')->insert(array_merge($item, [
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('event_types');
    }
};
