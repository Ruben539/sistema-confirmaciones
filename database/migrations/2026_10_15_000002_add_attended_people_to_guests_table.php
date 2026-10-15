<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Group invitations can arrive in parts ("entraron 3 de 5"): how many people of the invitation already went in.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            $table->unsignedSmallInteger('attended_people')->default(0)->after('attended_at');
        });

        // Guests already checked in came in complete
        DB::table('guests')
            ->where('status', 'attended')
            ->update(['attended_people' => DB::raw('CASE WHEN confirmed_passes > 0 THEN confirmed_passes ELSE passes END')]);
    }

    public function down(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            $table->dropColumn('attended_people');
        });
    }
};
