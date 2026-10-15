<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Named companions of an invitation ("Rubén + Ana, Carlos..."): each one can have its own table and is
 * checked in on its own. The invitation (guests) is still what the WhatsApp bot and the QR work with.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('guest_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('guest_id')->constrained('guests')->cascadeOnDelete();
            $table->unsignedBigInteger('event_id')->index();
            $table->string('name', 120);
            $table->string('category', 10)->default('adult'); // adult | youth | child
            // null = sits with the person who holds the invitation
            $table->string('table_number', 100)->nullable();
            $table->timestamp('attended_at')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::table('guests', function (Blueprint $table) {
            // When the person holding the invitation went in (groups can come in parts)
            $table->timestamp('holder_attended_at')->nullable()->after('attended_people');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guest_members');
        Schema::table('guests', function (Blueprint $table) {
            $table->dropColumn('holder_attended_at');
        });
    }
};
