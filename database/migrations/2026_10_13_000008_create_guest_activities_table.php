<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Historial de movimientos por invitado: invitación, recordatorios, respuesta, QR, ingreso, mesa...
        Schema::create('guest_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('guest_id')->constrained('guests')->cascadeOnDelete();
            $table->unsignedBigInteger('event_id')->index();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('action', 40);
            $table->string('description', 500)->nullable();
            $table->string('source', 20); // app, panel, whatsapp, invitado, sistema
            $table->string('device', 120)->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['guest_id', 'id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('guest_activities');
    }
};
