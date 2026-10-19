<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('event_trivia_responses')) {
            Schema::create('event_trivia_responses', function (Blueprint $table) {
                $table->id();
                $table->foreignId('event_id')->constrained()->cascadeOnDelete();
                $table->foreignId('guest_id')->nullable()->constrained()->nullOnDelete();
                $table->string('participant_name', 120);
                $table->integer('score')->default(0);
                $table->integer('total_questions')->default(0);
                $table->integer('time_taken_seconds')->nullable();
                $table->json('answers')->nullable();
                $table->timestamps();

                $table->index(['event_id', 'score']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('event_trivia_responses');
    }
};
