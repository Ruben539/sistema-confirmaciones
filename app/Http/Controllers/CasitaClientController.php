<?php

namespace App\Http\Controllers;

use App\Models\CasitaClient;
use App\Models\CasitaEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Clientes de La Casita con sus eventos. Solo administradores. */
class CasitaClientController extends Controller
{
    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->isAdmin(), 403, 'Solo el administrador puede usar el módulo La Casita.');
    }

    /** Events of each client with totals, grouped by client_id (one query). */
    private function eventsByClient(?array $clientIds = null)
    {
        return CasitaEvent::withTotals()
            ->when($clientIds !== null, fn ($q) => $q->whereIn('client_id', $clientIds))
            ->orderByDesc('event_date')
            ->get()
            ->groupBy('client_id');
    }

    private function present(CasitaClient $client, $events): array
    {
        $totals = collect($events)->map(fn ($e) => $e->totals());
        $dates = collect($events)->pluck('event_date')->filter();

        return array_merge($client->only(['id', 'name', 'phone', 'email', 'document', 'notes']), [
            'events_count' => count($events),
            'first_event' => $dates->min()?->format('Y-m-d'),
            'last_event' => $dates->max()?->format('Y-m-d'),
            'budget_total' => $totals->sum('budget_total'),
            'paid_total' => $totals->sum('paid_total'),
            'balance' => $totals->sum('balance'),
        ]);
    }

    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        $byClient = $this->eventsByClient();
        $clients = CasitaClient::orderBy('name')->get()
            ->map(fn ($c) => $this->present($c, $byClient->get($c->id, [])));

        return response()->json($clients);
    }

    public function show(Request $request, $id)
    {
        $this->authorizeAdmin($request);
        $client = CasitaClient::findOrFail($id);
        $events = $this->eventsByClient([$client->id])->get($client->id, collect());

        return response()->json(array_merge($this->present($client, $events), [
            'events' => $events->map(fn ($e) => array_merge(
                $e->only(['id', 'client_name', 'menu', 'venue', 'schedule']),
                ['event_date' => $e->event_date?->format('Y-m-d')],
                $e->totals()
            ))->values(),
        ]));
    }

    public function update(Request $request, $id)
    {
        $this->authorizeAdmin($request);
        $client = CasitaClient::findOrFail($id);

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'document' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:5000',
        ]);

        $name = CasitaClient::cleanName($data['name']);
        $normalized = CasitaClient::normalize($name);
        if (CasitaClient::where('normalized_name', $normalized)->where('id', '!=', $client->id)->exists()) {
            return response()->json(['message' => 'Ya existe otro cliente con ese nombre. Usá "Unir clientes" si son la misma persona.'], 422);
        }

        DB::transaction(function () use ($client, $data, $name, $normalized) {
            $client->update(array_merge($data, ['name' => $name, 'normalized_name' => $normalized]));
            $client->events()->update(['client_name' => $name]);
        });

        return response()->json(['message' => 'Cliente actualizado.', 'client' => $client->fresh()]);
    }

    /** Moves every event of {id} to {into_id}, keeps contact data the target is missing, and deletes {id}. */
    public function merge(Request $request, $id)
    {
        $this->authorizeAdmin($request);
        $data = $request->validate(['into_id' => 'required|integer|exists:casita_clients,id']);
        $source = CasitaClient::findOrFail($id);
        $target = CasitaClient::findOrFail($data['into_id']);
        abort_if($source->id === $target->id, 422, 'Elegí otro cliente.');

        DB::transaction(function () use ($source, $target) {
            CasitaEvent::where('client_id', $source->id)->update(['client_id' => $target->id, 'client_name' => $target->name]);
            foreach (['phone', 'email', 'document'] as $field) {
                if (!$target->$field && $source->$field) $target->$field = $source->$field;
            }
            if ($source->notes) $target->notes = trim(($target->notes ? $target->notes . "\n" : '') . $source->notes);
            $target->save();
            $source->delete();
        });

        return response()->json(['message' => "Clientes unidos en \"{$target->name}\".", 'client_id' => $target->id]);
    }

    /** Pairs of clients with very similar names (e.g. "Araceli y Josias" / "Aracely y Josias"). */
    public function duplicates(Request $request)
    {
        $this->authorizeAdmin($request);

        $clients = CasitaClient::withCount('events')->get(['id', 'name', 'normalized_name']);
        $pairs = [];
        $list = $clients->values();
        for ($i = 0; $i < $list->count(); $i++) {
            for ($j = $i + 1; $j < $list->count(); $j++) {
                $a = $list[$i]; $b = $list[$j];
                if (abs(strlen($a->normalized_name) - strlen($b->normalized_name)) > 4) continue;
                similar_text($a->normalized_name, $b->normalized_name, $percent);
                if ($percent >= 85) {
                    $pairs[] = [
                        'similarity' => round($percent),
                        'a' => $a->only(['id', 'name', 'events_count']),
                        'b' => $b->only(['id', 'name', 'events_count']),
                    ];
                }
            }
        }
        usort($pairs, fn ($x, $y) => $y['similarity'] <=> $x['similarity']);

        return response()->json($pairs);
    }
}
