<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Two WhatsApp numbers at once: the Baileys bot and the official Cloud API.
 * - events.whatsapp_channel: auto (bot up to a safe daily quota, then official) | baileys | cloud
 * - guests.whatsapp_channel: the number each guest talks to, so everything else goes through the same one
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->string('whatsapp_channel', 10)->default('auto');
        });
        Schema::table('guests', function (Blueprint $table) {
            $table->string('whatsapp_channel', 10)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn('whatsapp_channel');
        });
        Schema::table('guests', function (Blueprint $table) {
            $table->dropColumn('whatsapp_channel');
        });
    }
};
