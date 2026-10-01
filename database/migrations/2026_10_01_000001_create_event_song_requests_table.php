<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('event_song_requests')) {
            Schema::create('event_song_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('event_id')->constrained('events')->onDelete('cascade');
                $table->foreignId('guest_id')->nullable()->constrained('guests')->onDelete('set null');
                $table->string('requester_name', 150);
                $table->string('song_title', 255);
                $table->string('artist', 255)->nullable();
                $table->string('spotify_id', 100)->nullable();
                $table->string('spotify_uri', 150)->nullable();
                $table->string('image_url', 500)->nullable();
                $table->string('external_url', 500)->nullable();
                $table->text('note')->nullable();
                $table->boolean('is_played')->default(false);
                $table->timestamps();

                $table->index(['event_id', 'is_played']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('event_song_requests');
    }
};
