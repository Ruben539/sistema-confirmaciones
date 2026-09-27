<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('guests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('phone');
            $table->integer('passes')->default(1);
            $table->integer('confirmed_passes')->default(0);
            $table->enum('status', ['pending', 'confirmed', 'declined', 'attended'])->default('pending');
            $table->text('dietary_restrictions')->nullable();
            $table->text('notes')->nullable();
            $table->enum('whatsapp_status', ['not_sent', 'sent', 'delivered'])->default('not_sent');
            $table->timestamp('last_sent_at')->nullable();
            $table->string('token', 64)->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guests');
    }
};
