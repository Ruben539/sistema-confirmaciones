<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            if (!Schema::hasColumn('guests', 'table_number')) {
                $table->string('table_number')->nullable()->after('confirmed_passes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('guests', function (Blueprint $table) {
            if (Schema::hasColumn('guests', 'table_number')) {
                $table->dropColumn('table_number');
            }
        });
    }
};
