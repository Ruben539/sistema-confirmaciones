<?php

namespace App\Jobs;

use App\Models\Guest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SendWhatsAppMessageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 30;

    protected $guestId;
    protected $messageMode;

    public function __construct($guestId, $messageMode = 'invitation')
    {
        $this->guestId = $guestId;
        $this->messageMode = $messageMode;
    }

    public function handle(): void
    {
        $guest = Guest::with('event')->find($this->guestId);

        if (!$guest) {
            Log::warning("WhatsApp Job: Guest ID {$this->guestId} not found.");
            return;
        }

        $event = $guest->event;

        if ($event && !$event->isActive()) {
            Log::info("WhatsApp Job: Event ID {$event->id} is inactive, disabled, or past date. Skipping guest {$guest->name}.");
            return;
        }

        // Apply Spintax Anti-Spam Greeting Variations
        $greetings = [
            "¡Hola {nombre}! 👋",
            "¡Buenas {nombre}! 👋",
            "¡Hola {nombre}, qué tal! 👋",
            "¡Hola {nombre}! Espero que estés muy bien 👋",
        ];
        $selectedGreeting = $greetings[array_rand($greetings)];

        if ($this->messageMode === 'reminder') {
            $rawTemplate = "{$selectedGreeting} ⏰ Recordatorio: Te recordamos que la fecha límite para confirmar tu asistencia al evento de {pareja} vence pronto.\n📍 Lugar: {lugar}\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir";
        } else {
            $rawTemplate = $event->message_template ?? "{$selectedGreeting} Te invitamos al evento de {pareja} ✨\n📍 Lugar: {lugar}\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir";
            if (!str_contains($rawTemplate, '{nombre}')) {
                $rawTemplate = "{$selectedGreeting}\n" . $rawTemplate;
            }
        }

        $message = str_replace(
            ['{nombre}', '{pareja}', '{lugar}'],
            [$guest->name, $event->couple_names ?? $event->title, $event->location ?? 'Por confirmar'],
            $rawTemplate
        );

        $cleanPhone = preg_replace('/[^\d]/', '', $guest->phone);
        $botUrl = env('WHATSAPP_BOT_URL', 'http://127.0.0.1:3001/lead');

        try {
            $response = Http::timeout(10)->post($botUrl, [
                'phone' => $cleanPhone,
                'message' => $message,
                'session_id' => $event->user_id ? "planner_{$event->user_id}" : "default"
            ]);

            if ($response->successful()) {
                $guest->update([
                    'whatsapp_status' => 'sent',
                    'last_sent_at' => now(),
                ]);
                Log::info("WhatsApp Job: Sent successfully to {$guest->name} ({$cleanPhone})");
            } else {
                Log::warning("WhatsApp Job: Failed response for {$guest->name}: " . $response->body());
            }
        } catch (\Exception $e) {
            Log::error("WhatsApp Job Exception for {$guest->name}: " . $e->getMessage());
            throw $e;
        }

        // Random Anti-Spam Delay (8 to 14 seconds) to protect account velocity
        $sleepSecs = rand(8, 14);
        sleep($sleepSecs);
    }
}
