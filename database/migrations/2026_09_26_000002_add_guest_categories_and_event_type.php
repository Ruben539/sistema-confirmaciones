<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            if (!Schema::hasColumn('guests', 'adults')) {
                $table->integer('adults')->default(1)->after('passes');
                $table->integer('youth')->default(0)->after('adults');
                $table->integer('children')->default(0)->after('youth');
                $table->integer('confirmed_adults')->default(0)->after('confirmed_passes');
                $table->integer('confirmed_youth')->default(0)->after('confirmed_adults');
                $table->integer('confirmed_children')->default(0)->after('confirmed_youth');
            }
        });

        Schema::table('events', function (Blueprint $table) {
            if (!Schema::hasColumn('events', 'event_type')) {
                $table->string('event_type')->default('boda')->after('title');
            }
        });
    }

    public function down(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            $table->dropColumn(['adults', 'youth', 'children', 'confirmed_adults', 'confirmed_youth', 'confirmed_children']);
        });

        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn('event_type');
        });
    }
};
