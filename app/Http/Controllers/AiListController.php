<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Services\AiGuestListService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * "Asistente de listas (IA)": the planner uploads any guest-list Excel, Claude proposes the invitations and
 * the planner corrects them by writing ("Nicole va con Oso"). Importing goes through the usual guest import.
 */
class AiListController extends Controller
{
    public function analyze(Request $request, $eventId, AiGuestListService $assistant)
    {
        $event = Event::findOrFail($eventId);
        abort_unless(Auth::user()?->canAccessEvent($event), 403, 'Acceso denegado: no tenés permisos sobre este evento.');

        $validated = $request->validate([
            'headers' => 'required|array|max:60',
            'rows' => 'required|array|min:1|max:600',
            'rows.*.row' => 'required|integer',
            'rows.*.cells' => 'required|array|max:60',
            'instruction' => 'nullable|string|max:1000',
            'proposal' => 'nullable|array',
        ]);

        // A long list can take a minute or more to analyze
        @set_time_limit(180);

        try {
            $result = $assistant->analyze(
                $validated['headers'],
                $validated['rows'],
                $validated['instruction'] ?? null,
                $validated['proposal'] ?? null,
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($result);
    }
}
