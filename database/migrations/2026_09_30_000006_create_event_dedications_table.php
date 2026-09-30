<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('event_dedications')) {
            Schema::create('event_dedications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('event_id')->constrained('events')->onDelete('cascade');
                $table->foreignId('guest_id')->nullable()->constrained('guests')->onDelete('set null');
                $table->string('author_name', 150);
                $table->string('type', 20)->default('text'); // 'text', 'photo', 'video'
                $table->string('media_path', 500)->nullable();
                $table->text('message')->nullable();
                $table->boolean('is_approved')->default(true);
                $table->timestamps();

                $table->index(['event_id', 'is_approved']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('event_dedications');
    }
};
