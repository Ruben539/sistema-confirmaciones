<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\PlanRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PlanRequestController extends Controller
{
    private function formatParaguayPhone($phone)
    {
        $digits = preg_replace('/[^\d]/', '', $phone);
        if (empty($digits)) return '';

        if (str_starts_with($digits, '09') && strlen($digits) === 10) {
            return '595' . substr($digits, 1);
        }
        if (str_starts_with($digits, '9') && strlen($digits) === 9) {
            return '595' . $digits;
        }
        if (str_starts_with($digits, '595')) {
            return $digits;
        }
        if (strlen($digits) >= 9) {
            $last9 = substr($digits, -9);
            if (str_starts_with($last9, '9')) {
                return '595' . $last9;
            }
        }
        return $digits;
    }

    public function index()
    {
        $user = Auth::user();

        if ($user && $user->role === 'admin') {
            $requests = PlanRequest::with(['event', 'planner', 'reviewer'])
                ->orderBy('created_at', 'desc')
                ->get();
        } else if ($user) {
            $requests = PlanRequest::with(['event', 'reviewer'])
                ->where('user_id', $user->id)
                ->orderBy('created_at', 'desc')
                ->get();
        } else {
            $requests = [];
        }

        return response()->json([
            'requests' => $requests,
            'pending_count' => collect($requests)->where('status', 'pending')->count(),
        ]);
    }

    public function store(Request $request, $eventId)
    {
        $user = Auth::user();
        $event = Event::with('planner')->findOrFail($eventId);

        if ($user && $user->role === 'planner' && $event->user_id !== $user->id) {
            return response()->json([
                'message' => 'No tenés permisos para solicitar cambios de plan en este evento.'
            ], 403);
        }

        $validated = $request->validate([
            'requested_plan' => 'required|string|in:initial,medium,premium,custom',
            'requested_guests' => 'nullable|integer|min:1',
            'notes' => 'nullable|string|max:1000',
        ]);

        $reqGuests = $validated['requested_guests'] ?? match ($validated['requested_plan']) {
            'medium' => 150,
            'premium' => 300,
            default => 100,
        };

        $planRequest = PlanRequest::create([
            'event_id' => $event->id,
            'user_id' => $user ? $user->id : ($event->user_id ?? 1),
            'current_plan' => $event->plan_type ?? 'initial',
            'requested_plan' => $validated['requested_plan'],
            'requested_guests' => $reqGuests,
            'notes' => $validated['notes'] ?? null,
            'status' => 'pending',
        ]);

        $plannerName = $user ? $user->name : ($event->planner->name ?? 'Wedding Planner');
        $plannerPhone = $user ? ($user->phone ?? 'Sin teléfono') : '';
        $eventTitle = $event->couple_names ?? $event->title;

        $planLabels = [
            'initial' => 'Plan Inicial (100 invitados)',
            'medium' => 'Plan Medio (150 invitados)',
            'premium' => 'Plan Premium (+150 invitados)',
            'custom' => 'Personalizado',
        ];

        $currentPlanLabel = $planLabels[$event->plan_type ?? 'initial'] ?? $event->plan_type;
        $reqPlanLabel = $planLabels[$validated['requested_plan']] ?? $validated['requested_plan'];
        $notesText = !empty($validated['notes']) ? "\n💬 *Mensaje de la Planner:* \"{$validated['notes']}\"" : "";

        $whatsappMessage = "🚨 *SOLICITUD DE CAMBIO DE PLAN* 💍\n\n"
            . "👤 *Wedding Planner:* {$plannerName}\n"
            . "📱 *Teléfono:* {$plannerPhone}\n"
            . "🎪 *Evento:* {$eventTitle}\n"
            . "📦 *Plan Actual:* {$currentPlanLabel} ({$event->max_guests} máx)\n"
            . "🚀 *Plan Solicitado:* {$reqPlanLabel} ({$reqGuests} invitados){$notesText}\n\n"
            . "👉 Para autorizar directamente, respondé a este mensaje:\n"
            . "*APROBAR {$planRequest->id}*";

        // Find Administrator(s) phone numbers
        $adminPhones = User::where('role', 'admin')
            ->whereNotNull('phone')
            ->pluck('phone')
            ->map(fn($p) => $this->formatParaguayPhone($p))
            ->filter()
            ->unique()
            ->toArray();

        // Also check .env fallback
        $envAdminPhone = env('ADMIN_WHATSAPP_PHONE');
        if (!empty($envAdminPhone)) {
            $adminPhones[] = $this->formatParaguayPhone($envAdminPhone);
        }
        $adminPhones = array_unique(array_filter($adminPhones));

        $botUrl = env('WHATSAPP_BOT_URL', 'http://127.0.0.1:3001/lead');
        $sentCount = 0;

        foreach ($adminPhones as $adminPhone) {
            try {
                $res = Http::timeout(8)->post($botUrl, [
                    'phone' => preg_replace('/[^\d]/', '', $adminPhone),
                    'message' => $whatsappMessage
                ]);
                if ($res->successful()) {
                    $sentCount++;
                }
            } catch (\Exception $e) {
                Log::warning("Error enviando WhatsApp de solicitud de plan a admin {$adminPhone}: " . $e->getMessage());
            }
        }

        // Generate direct WhatsApp link as fallback for the Planner
        $primaryAdminPhone = !empty($adminPhones) ? $adminPhones[0] : preg_replace('/[^\d]/', '', env('ADMIN_WHATSAPP_PHONE', '595981000000'));
        $encodedText = urlencode("¡Hola! Soy {$plannerName}. Envié una solicitud de ampliación de plan para '{$eventTitle}'. Solicitamos pasar a {$reqPlanLabel} ({$reqGuests} invitados). ¡Muchas gracias!");
        $directWhatsAppUrl = "https://api.whatsapp.com/send?phone={$primaryAdminPhone}&text={$encodedText}";

        return response()->json([
            'message' => '¡Solicitud enviada con éxito! Se notificó a la administración.',
            'request' => $planRequest->load(['event', 'planner']),
            'whatsapp_notified' => $sentCount > 0,
            'direct_whatsapp_url' => $directWhatsAppUrl,
        ], 201);
    }

    public function approve(Request $request, $id)
    {
        $user = Auth::user();

        if (!$user || $user->role !== 'admin') {
            return response()->json([
                'message' => 'Acceso denegado. Solo administradores pueden aprobar solicitudes de plan.'
            ], 403);
        }

        $planRequest = PlanRequest::with(['event', 'planner'])->findOrFail($id);
        $event = $planRequest->event;

        $event->update([
            'plan_type' => $planRequest->requested_plan,
            'max_guests' => $planRequest->requested_guests,
        ]);

        $planRequest->update([
            'status' => 'approved',
            'admin_notes' => $request->input('admin_notes', 'Aprobado desde el panel de administración'),
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
        ]);

        // Optional: Notify the Wedding Planner by WhatsApp
        $planner = $planRequest->planner;
        if ($planner && !empty($planner->phone)) {
            $cleanPlannerPhone = $this->formatParaguayPhone($planner->phone);
            $eventTitle = $event->couple_names ?? $event->title;
            $botUrl = env('WHATSAPP_BOT_URL', 'http://127.0.0.1:3001/lead');
            try {
                Http::timeout(8)->post($botUrl, [
                    'phone' => preg_replace('/[^\d]/', '', $cleanPlannerPhone),
                    'message' => "🎉 ¡Hola {$planner->name}! Tu solicitud de ampliación de plan para el evento '{$eventTitle}' fue *APROBADA*.\n\nNuevo plan: *{$planRequest->requested_plan}* con un cupo máximo de *{$planRequest->requested_guests} invitados*. Ya podés continuar cargando invitados."
                ]);
            } catch (\Exception $e) {
                Log::warning("Error notificando aprobación a planner: " . $e->getMessage());
            }
        }

        return response()->json([
            'message' => "Solicitud aprobada con éxito. El evento '{$event->title}' ahora cuenta con capacidad para {$planRequest->requested_guests} invitados.",
            'request' => $planRequest->fresh(['event', 'planner', 'reviewer']),
            'event' => $event->fresh()
        ]);
    }

    public function reject(Request $request, $id)
    {
        $user = Auth::user();

        if (!$user || $user->role !== 'admin') {
            return response()->json([
                'message' => 'Acceso denegado.'
            ], 403);
        }

        $planRequest = PlanRequest::with(['event', 'planner'])->findOrFail($id);
        $adminNotes = $request->input('admin_notes', 'Rechazado por el administrador');

        $planRequest->update([
            'status' => 'rejected',
            'admin_notes' => $adminNotes,
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
        ]);

        // Optional: Notify the Wedding Planner by WhatsApp
        $planner = $planRequest->planner;
        if ($planner && !empty($planner->phone)) {
            $cleanPlannerPhone = $this->formatParaguayPhone($planner->phone);
            $eventTitle = $planRequest->event ? ($planRequest->event->couple_names ?? $planRequest->event->title) : 'tu evento';
            $botUrl = env('WHATSAPP_BOT_URL', 'http://127.0.0.1:3001/lead');
            try {
                Http::timeout(8)->post($botUrl, [
                    'phone' => preg_replace('/[^\d]/', '', $cleanPlannerPhone),
                    'message' => "ℹ️ Hola {$planner->name}. Tu solicitud de ampliación de plan para el evento '{$eventTitle}' no fue autorizada en esta ocasión.\n\nMotivo: \"{$adminNotes}\"\n\nPodés comunicarte con la administración ante cualquier duda."
                ]);
            } catch (\Exception $e) {
                Log::warning("Error notificando rechazo a planner: " . $e->getMessage());
            }
        }

        return response()->json([
            'message' => 'Solicitud rechazada.',
            'request' => $planRequest->fresh(['event', 'planner', 'reviewer'])
        ]);
    }
}
