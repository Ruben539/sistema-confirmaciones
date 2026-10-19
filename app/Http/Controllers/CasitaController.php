<?php

namespace App\Http\Controllers;

use App\Models\CasitaClient;
use App\Models\CasitaEvent;
use App\Models\CasitaLoss;
use App\Models\CasitaPayment;
use App\Services\CasitaImporter;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Módulo "La Casita" (reemplaza la planilla Excel de registros de eventos).
 * Solo administradores: es la administración del salón, no de los planners.
 */
class CasitaController extends Controller
{
    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->isAdmin(), 403, 'Solo el administrador puede usar el módulo La Casita.');
    }

    private function present(CasitaEvent $event): array
    {
        return array_merge($event->only(['id', 'client_id', 'client_name', 'schedule', 'venue', 'menu', 'notes', 'event_id']), [
            'event_date' => $event->event_date?->format('Y-m-d'),
            'items_count' => $event->items_count ?? null,
        ], $event->totals());
    }

    private function presentFull(CasitaEvent $event): array
    {
        $event->loadMissing(['items', 'payments', 'losses']);

        return array_merge($this->present($event), [
            'items' => $event->items,
            'payments' => $event->payments,
            'losses' => $event->losses,
            'settlement' => $event->settlement(),
        ]);
    }

    // ───────────── Resumen ─────────────

    public function summary(Request $request)
    {
        $this->authorizeAdmin($request);

        $events = CasitaEvent::withTotals()->orderBy('event_date')->get();
        $today = Carbon::today();

        $byYear = [];
        $byMonth = array_fill(1, 12, 0);
        $menus = [];
        foreach ($events as $ev) {
            $t = $ev->totals();
            $year = $ev->event_date?->year ?? 'Sin fecha';
            $byYear[$year] ??= ['year' => $year, 'events' => 0, 'budget_total' => 0, 'paid_total' => 0, 'balance' => 0];
            $byYear[$year]['events']++;
            $byYear[$year]['budget_total'] += $t['budget_total'];
            $byYear[$year]['paid_total'] += $t['paid_total'];
            $byYear[$year]['balance'] += $t['balance'];
            if ($ev->event_date) $byMonth[$ev->event_date->month]++;
            $menu = trim((string) $ev->menu) ?: 'Sin menú';
            $menus[$menu] = ($menus[$menu] ?? 0) + 1;
        }
        arsort($menus);

        $upcoming = $events->filter(fn ($e) => $e->event_date && $e->event_date->gte($today))
            ->take(12)->map(fn ($e) => $this->present($e))->values();

        // Events that already happened and still owe money
        $overdue = $events->filter(fn ($e) => $e->event_date && $e->event_date->lt($today) && $e->totals()['balance'] > 0)
            ->sortByDesc('event_date')->take(20)->map(fn ($e) => $this->present($e))->values();

        $all = $events->map(fn ($e) => $e->totals());

        return response()->json([
            'totals' => [
                'events' => $events->count(),
                'budget_total' => $all->sum('budget_total'),
                'paid_total' => $all->sum('paid_total'),
                'balance' => $all->sum('balance'),
                'upcoming_count' => $events->filter(fn ($e) => $e->event_date && $e->event_date->gte($today))->count(),
                'upcoming_balance' => $events->filter(fn ($e) => $e->event_date && $e->event_date->gte($today))->sum(fn ($e) => $e->totals()['balance']),
            ],
            'by_year' => array_values(collect($byYear)->sortKeys()->all()),
            'by_month' => array_values($byMonth),
            'menus' => collect($menus)->take(8)->map(fn ($count, $name) => ['name' => $name, 'events' => $count])->values(),
            'upcoming' => $upcoming,
            'overdue' => $overdue,
        ]);
    }

    // ───────────── Eventos (Registro + Presupuesto) ─────────────

    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        $query = CasitaEvent::withTotals()->withCount('items');

        if ($search = trim((string) $request->query('search'))) {
            $like = '%' . mb_strtolower($search) . '%';
            $query->where(fn ($q) => $q->whereRaw('LOWER(client_name) LIKE ?', [$like])->orWhereRaw('LOWER(menu) LIKE ?', [$like]));
        }
        if ($year = $request->query('year')) {
            $query->whereYear('event_date', (int) $year);
        }
        $when = $request->query('when');
        if ($when === 'upcoming') $query->whereDate('event_date', '>=', Carbon::today());
        if ($when === 'past') $query->whereDate('event_date', '<', Carbon::today());

        $sort = $request->query('sort', 'date_desc');
        $query->orderBy('event_date', $sort === 'date_asc' ? 'asc' : 'desc')->orderBy('id', 'desc');

        $events = $query->get()->map(fn ($e) => $this->present($e));

        if ($request->query('status') === 'pending') $events = $events->filter(fn ($e) => $e['balance'] > 0)->values();
        if ($request->query('status') === 'paid') $events = $events->filter(fn ($e) => $e['balance'] <= 0)->values();

        $years = CasitaEvent::whereNotNull('event_date')->pluck('event_date')
            ->map(fn ($d) => $d->year)->unique()->sortDesc()->values();

        return response()->json(['events' => $events, 'years' => $years]);
    }

    public function show(Request $request, $id)
    {
        $this->authorizeAdmin($request);

        return response()->json($this->presentFull(CasitaEvent::findOrFail($id)));
    }

    private function validateEvent(Request $request): array
    {
        return $request->validate([
            'client_name' => 'required|string|max:255',
            'event_date' => 'nullable|date',
            'schedule' => 'nullable|string|max:255',
            'venue' => 'nullable|string|max:255',
            'menu' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:5000',
            'event_id' => 'nullable|integer|exists:events,id',
            'items' => 'array|max:300',
            'items.*.description' => 'required|string|max:255',
            'items.*.unit_price' => 'required|integer|min:0',
            'items.*.quantity' => 'required|integer|min:0',
            'items.*.note' => 'nullable|string|max:255',
        ]);
    }

    private function syncItems(CasitaEvent $event, array $items): void
    {
        $event->items()->delete();
        foreach (array_values($items) as $i => $item) {
            $event->items()->create([
                'description' => trim($item['description']),
                'unit_price' => (int) $item['unit_price'],
                'quantity' => (int) $item['quantity'],
                'note' => $item['note'] ?? null,
                'sort_order' => $i,
            ]);
        }
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin($request);
        $data = $this->validateEvent($request);

        $event = DB::transaction(function () use ($data, $request) {
            $client = CasitaClient::resolve($data['client_name']);
            $event = CasitaEvent::create(array_merge(
                collect($data)->except('items')->all(),
                ['client_id' => $client->id, 'client_name' => $client->name, 'venue' => $data['venue'] ?? 'La Casita', 'created_by' => $request->user()->id]
            ));
            $this->syncItems($event, $data['items'] ?? []);
            return $event;
        });

        return response()->json(['message' => 'Evento registrado.', 'event' => $this->presentFull($event->fresh())], 201);
    }

    public function update(Request $request, $id)
    {
        $this->authorizeAdmin($request);
        $event = CasitaEvent::findOrFail($id);
        $data = $this->validateEvent($request);

        DB::transaction(function () use ($event, $data) {
            // Renaming the client in the event moves it to the client with that name (created if new)
            $client = CasitaClient::resolve($data['client_name']);
            $event->update(array_merge(collect($data)->except('items')->all(), [
                'client_id' => $client->id, 'client_name' => $client->name, 'venue' => $data['venue'] ?? 'La Casita',
            ]));
            if (array_key_exists('items', $data)) $this->syncItems($event, $data['items']);
        });

        return response()->json(['message' => 'Evento actualizado.', 'event' => $this->presentFull($event->fresh())]);
    }

    public function destroy(Request $request, $id)
    {
        $this->authorizeAdmin($request);
        CasitaEvent::findOrFail($id)->delete();

        return response()->json(['message' => 'Evento eliminado.']);
    }

    // ───────────── Pagos y garantías ─────────────

    public function payments(Request $request)
    {
        $this->authorizeAdmin($request);

        $query = CasitaPayment::with('casitaEvent:id,client_name,event_date')->orderByDesc('paid_on')->orderByDesc('id');
        if ($kind = $request->query('kind')) {
            $query->whereIn('kind', explode(',', $kind));
        }
        if ($year = $request->query('year')) {
            $query->whereYear('paid_on', (int) $year);
        }

        return response()->json($query->limit(2000)->get());
    }

    private function validatePayment(Request $request): array
    {
        return $request->validate([
            'paid_on' => 'required|date',
            'kind' => ['required', Rule::in(CasitaPayment::KINDS)],
            'amount' => 'required|integer|min:1',
            'note' => 'nullable|string|max:255',
        ]);
    }

    public function storePayment(Request $request, $id)
    {
        $this->authorizeAdmin($request);
        $event = CasitaEvent::findOrFail($id);
        $event->payments()->create($this->validatePayment($request));

        return response()->json(['message' => 'Pago registrado.', 'event' => $this->presentFull($event->fresh())], 201);
    }

    public function updatePayment(Request $request, $paymentId)
    {
        $this->authorizeAdmin($request);
        $payment = CasitaPayment::findOrFail($paymentId);
        $payment->update($this->validatePayment($request));

        return response()->json(['message' => 'Pago actualizado.', 'event' => $this->presentFull($payment->casitaEvent->fresh())]);
    }

    public function destroyPayment(Request $request, $paymentId)
    {
        $this->authorizeAdmin($request);
        $payment = CasitaPayment::findOrFail($paymentId);
        $event = $payment->casitaEvent;
        $payment->delete();

        return response()->json(['message' => 'Pago eliminado.', 'event' => $this->presentFull($event->fresh())]);
    }

    // ───────────── Pérdidas y bebidas (liquidación post-evento) ─────────────

    public function saveLosses(Request $request, $id)
    {
        $this->authorizeAdmin($request);
        $event = CasitaEvent::findOrFail($id);

        $data = $request->validate([
            'lines' => 'present|array|max:200',
            'lines.*.section' => ['required', Rule::in(CasitaLoss::SECTIONS)],
            'lines.*.description' => 'required|string|max:255',
            'lines.*.quantity' => 'required|integer|min:0',
            'lines.*.unit_price' => 'required|integer|min:0',
        ]);

        DB::transaction(function () use ($event, $data) {
            $event->losses()->delete();
            foreach (array_values($data['lines']) as $i => $line) {
                $event->losses()->create(array_merge($line, ['sort_order' => $i]));
            }
        });

        return response()->json(['message' => 'Liquidación guardada.', 'event' => $this->presentFull($event->fresh())]);
    }

    // ───────────── Importar la hoja "Registro" del Excel ─────────────

    /** Filas ya leídas en el navegador. La lógica está en CasitaImporter (la usa también `php artisan casita:import`). */
    public function import(Request $request, CasitaImporter $importer)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'rows' => 'required|array|max:20000',
            'rows.*.date' => 'nullable|date_format:Y-m-d',
            'rows.*.client' => 'required|string|max:255',
            'rows.*.venue' => 'nullable|string|max:255',
            'rows.*.menu' => 'nullable|string|max:255',
            'rows.*.detail' => 'required|string|max:255',
            'rows.*.price' => 'required|integer|min:0',
            'rows.*.quantity' => 'required|integer|min:0',
            'rows.*.note' => 'nullable|string|max:255',
            'settle_past' => 'boolean',
        ]);

        return response()->json($importer->import($data['rows'], (bool) ($data['settle_past'] ?? false), $request->user()->id));
    }
}
