<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The number of people of an invitation changed (e.g. a corrected list was re-imported) after the guest
 * already got the invitation or confirmed: they have to be told (reminder or new QR). Holds the previous
 * amount; null once the correction was sent.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            $table->unsignedSmallInteger('pending_correction_from')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            $table->dropColumn('pending_correction_from');
        });
    }
};
