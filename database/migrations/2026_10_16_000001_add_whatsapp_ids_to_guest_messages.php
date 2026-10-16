<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * WhatsApp's own id of each message we send (and the chat it went to), so a message written from the panel
 * can be edited like in WhatsApp (during the 15 minutes after sending).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('guest_messages', function (Blueprint $table) {
            $table->string('wa_id', 120)->nullable();
            $table->string('wa_jid', 120)->nullable();
            $table->string('channel', 10)->nullable();
            $table->timestamp('edited_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('guest_messages', function (Blueprint $table) {
            $table->dropColumn(['wa_id', 'wa_jid', 'channel', 'edited_at']);
        });
    }
};
