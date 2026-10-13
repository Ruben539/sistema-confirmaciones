<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The APK is uploaded by the browser straight to Google Drive (not stored on the server).
     */
    public function up(): void
    {
        Schema::table('app_releases', function (Blueprint $table) {
            $table->string('drive_file_id', 100)->nullable()->after('notes');
            $table->string('file_path')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('app_releases', function (Blueprint $table) {
            $table->dropColumn('drive_file_id');
        });
    }
};
