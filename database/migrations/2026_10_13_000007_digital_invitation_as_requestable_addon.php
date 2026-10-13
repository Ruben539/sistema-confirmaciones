<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('plan_requests', function (Blueprint $table) {
            // 'plan' = cambio de plan / cupo; 'digital_invitation' = solicitud de la Invitación Digital
            $table->string('type', 30)->default('plan')->after('event_id');
        });

        // La Invitación Digital deja de venir incluida en los planes: solo la tienen los eventos habilitados
        // como adicional. Los eventos que ya la tenían configurada la conservan para no cortarla de golpe.
        DB::table('events')
            ->where('digital_invitation_addon', false)
            ->where(function ($q) {
                $q->whereNotNull('features_enabled')
                  ->orWhereNotNull('invitation_styles')
                  ->orWhereNotNull('spotify_url')
                  ->orWhereNotNull('gift_settings')
                  ->orWhereNotNull('welcome_message');
            })
            ->update(['digital_invitation_addon' => true]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('plan_requests', function (Blueprint $table) {
            $table->dropColumn('type');
        });
    }
};
