<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class GoogleGeminiService
{
    protected ?string $apiKey;
    protected array $fallbackModels = [
        'gemini-3.5-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash-lite',
        'gemini-3-flash-preview',
        'gemini-flash-latest',
    ];

    public function __construct()
    {
        $this->apiKey = config('services.gemini.api_key') ?: env('GEMINI_API_KEY');
    }

    /**
     * Check if Gemini API key is configured.
     */
    public static function isConfigured(): bool
    {
        return !empty(config('services.gemini.api_key') ?: env('GEMINI_API_KEY'));
    }

    /**
     * Generate raw text content with Gemini API, with automatic fallback across models.
     */
    public function generateContent(string $prompt, ?string $systemInstruction = null): ?string
    {
        if (!$this->apiKey) {
            Log::warning('Gemini API key is not configured.');
            return null;
        }

        foreach ($this->fallbackModels as $model) {
            $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . $this->apiKey;

            $payload = [
                'contents' => [
                    [
                        'parts' => [
                            ['text' => $prompt]
                        ]
                    ]
                ],
                'generationConfig' => [
                    'temperature' => 0.7,
                    'maxOutputTokens' => 1024,
                ]
            ];

            if ($systemInstruction) {
                $payload['systemInstruction'] = [
                    'parts' => [
                        ['text' => $systemInstruction]
                    ]
                ];
            }

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_TIMEOUT, 25);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

            if ($httpCode === 200 && !empty($response)) {
                $data = json_decode($response, true);
                $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
                if (!empty($text)) {
                    return trim($text);
                }
            } else {
                Log::warning("Gemini model {$model} returned HTTP {$httpCode}: " . substr((string)$response, 0, 200));
            }
        }

        return null;
    }

    /**
     * Generate a personalized color palette & style configuration for an event.
     */
    public function generateStylePalette(string $eventType, string $coupleNames, ?string $preferredVibe = null): ?array
    {
        $vibeContext = $preferredVibe ? " con vibra o preferencia: {$preferredVibe}" : "";
        $prompt = <<<EOT
Eres un diseñador de invitaciones digitales de alta gama.
Crea una paleta de colores y configuración visual armoniosa para un evento tipo: "{$eventType}", organizado por: "{$coupleNames}"{$vibeContext}.

Responde ÚNICAMENTE con un objeto JSON válido (sin markdown ```json ni explicaciones adicionales) con esta estructura:
{
  "name": "Nombre descriptivo y elegante del estilo (ej: Champán & Terciopelo)",
  "mode": "dark",
  "primary_color": "#D97706",
  "secondary_color": "#F59E0B",
  "font_family": "serif",
  "background_type": "gradient",
  "background_value": "linear-gradient(145deg, #18181b 0%, #09090b 100%)",
  "card_style": "glass",
  "envelope_color": "#831843",
  "envelope_seal_color": "#D97706",
  "explanation": "Frase de 1 línea explicando por qué esta combinación realza la elegancia del evento."
}

Valores permitidos:
- mode: "dark" o "light"
- font_family: "serif" o "sans" o "script"
- background_type: "gradient" o "solid"
- card_style: "glass" o "solid"
- Colores en formato hexadecimal (#RRGGBB).
EOT;

        $rawJson = $this->generateContent($prompt, 'Responde estrictamente con JSON puro, sin formato markdown.');
        if (!$rawJson) return null;

        $cleaned = trim($rawJson);
        $cleaned = preg_replace('/^```(?:json)?\s*/i', '', $cleaned);
        $cleaned = preg_replace('/\s*```$/i', '', $cleaned);

        if (preg_match('/\{[\s\S]*\}/', $cleaned, $matches)) {
            $decoded = json_decode($matches[0], true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        $decoded = json_decode($cleaned, true);
        return is_array($decoded) ? $decoded : null;
    }

    /**
     * Generate invitation welcome copy, quote, and dress code notes.
     */
    public function generateInvitationCopy(string $eventType, string $coupleNames, string $tone = 'romantic'): ?array
    {
        $prompt = <<<EOT
Eres un redactor profesional de invitaciones de eventos y bodas de lujo.
Redacta textos emotivos para el evento de: "{$coupleNames}" (tipo de evento: {$eventType}), con tono: {$tone}.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "welcome_message": "Texto emotivo de bienvenida de 2 o 3 párrafos cortos para la tarjeta inicial de la invitación web.",
  "dress_code_notes": "Consejo de etiqueta cálido y elegante para orientar a los invitados sobre su vestimenta (ej: colores reservados, calzado cómodo si hay césped, etc.).",
  "quote": "Una frase inspiradora corta o cita poética sobre el amor, la celebración o la compañía."
}
EOT;

        $rawJson = $this->generateContent($prompt, 'Responde estrictamente con JSON puro, sin markdown.');
        if (!$rawJson) return null;

        $cleaned = trim($rawJson);
        $cleaned = preg_replace('/^```(?:json)?\s*/i', '', $cleaned);
        $cleaned = preg_replace('/\s*```$/i', '', $cleaned);

        if (preg_match('/\{[\s\S]*\}/', $cleaned, $matches)) {
            $decoded = json_decode($matches[0], true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        $decoded = json_decode($cleaned, true);
        return is_array($decoded) ? $decoded : null;
    }

    /**
     * Suggest a warm dedication message for a guest to send in their RSVP.
     */
    public function suggestDedication(string $guestName, string $coupleNames, string $eventType = 'boda', string $tone = 'cariñoso'): ?string
    {
        $prompt = <<<EOT
Escribe una felicitación y dedicatoria breve (máximo 2 a 3 oraciones), emotiva, cálida y natural de parte de "{$guestName}" para "{$coupleNames}" por su {$eventType}.
Tono: {$tone}.
No incluyas saludos genéricos como "Hola", ve directo a un mensaje conmovedor que exprese cariño sincero y buenos deseos.
EOT;

        return $this->generateContent($prompt);
    }
}
