<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Signed contract of each event (sistema de confirmaciones and La Casita).
 * contract_status: pending (not sent yet), sent (waiting for the client's signature), signed, not_required.
 * While it is pending or sent, the admin gets a WhatsApp reminder (contracts:remind).
 */
return new class extends Migration
{
    private const TABLES = ['events', 'casita_events'];

    public function up(): void
    {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->string('contract_status', 20)->default('pending')->index();
                $table->string('contract_file_id')->nullable();   // Google Drive file id (private folder)
                $table->string('contract_file_path')->nullable(); // local private disk, when Drive is not configured
                $table->string('contract_file_name')->nullable();
                $table->timestamp('contract_signed_at')->nullable();
                $table->timestamp('contract_reminder_sent_at')->nullable();
                $table->unsignedInteger('contract_reminder_count')->default(0);
            });

            // Events already held don't need a contract reminder
            DB::table($tableName)
                ->whereNotNull('event_date')
                ->whereDate('event_date', '<', now()->toDateString())
                ->update(['contract_status' => 'not_required']);
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropIndex(['contract_status']);
                $table->dropColumn([
                    'contract_status', 'contract_file_id', 'contract_file_path', 'contract_file_name',
                    'contract_signed_at', 'contract_reminder_sent_at', 'contract_reminder_count',
                ]);
            });
        }
    }
};
