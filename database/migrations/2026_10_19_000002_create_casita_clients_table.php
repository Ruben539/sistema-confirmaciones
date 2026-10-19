<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Clientes de La Casita. Un cliente puede tener varios eventos (ej. Karina Aguilera 2025 y 2026).
 * normalized_name = nombre sin acentos, en minúsculas y sin espacios repetidos: "María y Juan" y
 * "Maria y  juan" son el mismo cliente.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('casita_clients', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('normalized_name')->unique();
            $table->string('phone', 50)->nullable();
            $table->string('email')->nullable();
            $table->string('document', 50)->nullable(); // CI o RUC
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::table('casita_events', function (Blueprint $table) {
            $table->foreignId('client_id')->nullable()->after('id')->constrained('casita_clients')->nullOnDelete();
        });

        // Link events created before this migration
        $events = DB::table('casita_events')->orderBy('event_date')->get(['id', 'client_name']);
        foreach ($events as $event) {
            $name = trim(preg_replace('/\s+/u', ' ', $event->client_name));
            $normalized = Str::lower(Str::ascii($name));
            $clientId = DB::table('casita_clients')->where('normalized_name', $normalized)->value('id')
                ?? DB::table('casita_clients')->insertGetId([
                    'name' => $name, 'normalized_name' => $normalized, 'created_at' => now(), 'updated_at' => now(),
                ]);
            DB::table('casita_events')->where('id', $event->id)->update(['client_id' => $clientId]);
        }
    }

    public function down(): void
    {
        Schema::table('casita_events', function (Blueprint $table) {
            $table->dropConstrainedForeignId('client_id');
        });
        Schema::dropIfExists('casita_clients');
    }
};
