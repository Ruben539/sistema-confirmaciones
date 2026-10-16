<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Shared invitation: a couple / family with several WhatsApp numbers is ONE invitation. Messages go once, to
 * the main phone; any of the other numbers (comma separated digits) is recognized as the same invitation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            $table->string('alt_phones', 255)->nullable()->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            $table->dropColumn('alt_phones');
        });
    }
};
