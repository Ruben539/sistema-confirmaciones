<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            // Código aleatorio para los links públicos (/evento/{code}/...): no se puede adivinar como el id
            $table->string('public_code', 16)->nullable()->unique()->after('id');
        });

        DB::table('events')->whereNull('public_code')->orderBy('id')->each(function ($event) {
            DB::table('events')->where('id', $event->id)->update(['public_code' => Str::random(12)]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropUnique(['public_code']);
            $table->dropColumn('public_code');
        });
    }
};
