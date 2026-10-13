<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Versiones de la app móvil (APK) que sube el admin para que planners y anfitrionas la descarguen.
     */
    public function up(): void
    {
        Schema::create('app_releases', function (Blueprint $table) {
            $table->id();
            $table->string('version', 30);
            $table->text('notes')->nullable();
            $table->string('file_path');
            $table->string('original_name');
            $table->unsignedBigInteger('file_size');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('downloads')->default(0);
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            // Last app release the user downloaded or dismissed: newer ones show the "new version" notice
            $table->unsignedBigInteger('seen_app_release_id')->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('seen_app_release_id');
        });
        Schema::dropIfExists('app_releases');
    }
};
