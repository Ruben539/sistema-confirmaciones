<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            if (!Schema::hasColumn('events', 'is_enabled')) {
                $table->boolean('is_enabled')->default(false)->after('status');
            }
            if (!Schema::hasColumn('events', 'plan_type')) {
                $table->string('plan_type')->default('initial')->after('is_enabled'); // 'initial' (100), 'medium' (150), 'premium' (+150)
            }
            if (!Schema::hasColumn('events', 'max_guests')) {
                $table->integer('max_guests')->default(100)->after('plan_type');
            }
            if (!Schema::hasColumn('events', 'payment_status')) {
                $table->string('payment_status')->default('pending')->after('max_guests'); // 'pending', 'paid'
            }
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn(['is_enabled', 'plan_type', 'max_guests', 'payment_status']);
        });
    }
};
