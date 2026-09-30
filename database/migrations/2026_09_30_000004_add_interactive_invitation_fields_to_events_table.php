<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            if (!Schema::hasColumn('events', 'spotify_url')) {
                $table->string('spotify_url', 500)->nullable();
            }
            if (!Schema::hasColumn('events', 'gift_settings')) {
                $table->json('gift_settings')->nullable();
            }
            if (!Schema::hasColumn('events', 'dress_code')) {
                $table->string('dress_code', 100)->nullable();
            }
            if (!Schema::hasColumn('events', 'dress_code_notes')) {
                $table->text('dress_code_notes')->nullable();
            }
            if (!Schema::hasColumn('events', 'cover_photo_path')) {
                $table->string('cover_photo_path', 500)->nullable();
            }
            if (!Schema::hasColumn('events', 'welcome_message')) {
                $table->text('welcome_message')->nullable();
            }
            if (!Schema::hasColumn('events', 'background_music_path')) {
                $table->string('background_music_path', 500)->nullable();
            }
            if (!Schema::hasColumn('events', 'features_enabled')) {
                $table->json('features_enabled')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn([
                'spotify_url',
                'gift_settings',
                'dress_code',
                'dress_code_notes',
                'cover_photo_path',
                'welcome_message',
                'background_music_path',
                'features_enabled',
            ]);
        });
    }
};
