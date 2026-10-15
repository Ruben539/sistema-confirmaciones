<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Bandeja de "Mensajes" del panel: todo pasa por un solo número de WhatsApp (el del bot), así que la
     * planner lee y responde las conversaciones de sus invitados desde la web.
     */
    public function up(): void
    {
        // WhatsApp conversation of each guest (in its own table so the admin can delete old messages
        // without touching the movements history)
        Schema::create('guest_messages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('event_id')->index();
            $table->foreignId('guest_id')->constrained('guests')->cascadeOnDelete();
            $table->string('direction', 3);   // in (guest) / out (bot or planner)
            $table->string('author', 10);     // guest, bot, planner
            $table->unsignedBigInteger('user_id')->nullable(); // planner / admin who answered
            $table->text('body');
            $table->timestamp('created_at')->useCurrent()->index();

            $table->index(['guest_id', 'id']);
        });

        Schema::table('guests', function (Blueprint $table) {
            $table->timestamp('last_message_at')->nullable()->index();
            $table->unsignedInteger('unread_messages')->default(0);
            // The last message needs a person (comment, question, not understood by the bot)
            $table->boolean('needs_reply')->default(false);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guest_messages');

        Schema::table('guests', function (Blueprint $table) {
            $table->dropIndex(['last_message_at']);
            $table->dropColumn(['last_message_at', 'unread_messages', 'needs_reply']);
        });
    }
};
