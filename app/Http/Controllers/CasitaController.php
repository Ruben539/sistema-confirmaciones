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
        return array_merge($event->only(['id', 'client_id', 'client_name', 'schedule', 'venue', 'menu', 'notes', 'planner_id']), [
            'planner_name' => $event->planner?->name,
            'event_date' => $event->event_date?->format('Y-m-d'),
            'items_count' => $event->items_count ?? null,
        ], $event->totals());
    }

    /** Optional ?from=Y-m-d&to=Y-m-d filter (both ends included). */
    private function dateRange(Request $request): array
    {
        $data = $request->validate([
            'from' => 'nullable|date_format:Y-m-d',
            'to' => 'nullable|date_format:Y-m-d' . ($request->filled('from') ? '|after_or_equal:from' : ''),
        ], ['to.after_or_equal' => 'La fecha "hasta" no puede ser anterior a "desde".']);

        return [
            !empty($data['from']) ? Carbon::parse($data['from'])->startOfDay() : null,
            !empty($data['to']) ? Carbon::parse($data['to'])->startOfDay() : null,
        ];
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

    /**
     * Resumen. ?year=2025 or ?from=&to= limit KPIs, months, menus and services to that period (and compare
     * with the year before); upcoming events and pending collections always cover every year.
     */
    public function summary(Request $request)
    {
        $this->authorizeAdmin($request);

        $events = CasitaEvent::withTotals()->orderBy('event_date')->get();
        $today = Carbon::today();
        $years = $events->pluck('event_date')->filter()->map->year->unique()->sortDesc()->values();
        $year = $request->integer('year') ?: null;

        [$from, $to] = $this->dateRange($request);
        $ranged = $from || $to;
        if ($ranged) $year = null; // a date range wins over the year

        $inYear = fn ($y) => $events->filter(fn ($e) => $y === null || $e->event_date?->year === $y);
        $inRange = fn ($f, $t) => $events->filter(fn ($e) => $e->event_date
            && (!$f || $e->event_date->gte($f)) && (!$t || $e->event_date->lte($t)));
        $scope = $ranged ? $inRange($from, $to) : $inYear($year);

        // Lines per event, to count guests and rank services
        $items = DB::table('casita_event_items')->whereIn('casita_event_id', $scope->pluck('id'))
            ->get(['casita_event_id', 'description', 'quantity', 'total']);
        $norm = fn ($s) => trim(preg_replace('/\s+/', ' ', \Illuminate\Support\Str::lower(\Illuminate\Support\Str::ascii((string) $s))));
        // Guest lines of the sheet: Personas, Adultos, Jóvenes, Menores, Niños, Paquete por persona
        $isGuest = fn ($d) => (bool) preg_match('/^(personas?|adultos?|jovenes|menores|ninos|paquete por persona)\b/', $d);
        $isGuarantee = fn ($d) => str_starts_with($d, 'garant');

        $guests = 0;
        $services = [];
        foreach ($items as $item) {
            $d = $norm($item->description);
            if ($d === '') continue;
            if ($isGuest($d)) { $guests += (int) $item->quantity; continue; }
            if ($isGuarantee($d) || (int) $item->total <= 0) continue;
            $services[$d] ??= ['name' => trim($item->description), 'events' => [], 'quantity' => 0, 'total' => 0];
            $services[$d]['events'][$item->casita_event_id] = true;
            $services[$d]['quantity'] += (int) $item->quantity;
            $services[$d]['total'] += (int) $item->total;
        }
        $topServices = collect($services)
            ->map(fn ($s) => ['name' => $s['name'], 'events' => count($s['events']), 'quantity' => $s['quantity'], 'total' => $s['total']])
            ->sortByDesc('total')->take(8)->values();

        $sumTotals = function ($list) {
            $t = $list->map(fn ($e) => $e->totals());
            return [
                'events' => $list->count(),
                'budget_total' => $t->sum('budget_total'),
                'paid_total' => $t->sum('paid_total'),
                'balance' => $t->sum('balance'),
            ];
        };
        $totals = $sumTotals($scope);
        $totals['avg_ticket'] = $totals['events'] ? intdiv($totals['budget_total'], $totals['events']) : 0;
        $totals['guests'] = $guests;

        // Chart buckets: the 12 calendar months, or each month of the range (up to 24)
        $monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        $buckets = [];
        $keyOf = fn ($date) => $date->month;
        $prevKeyOf = $keyOf;
        if ($ranged) {
            $start = ($from ?? $scope->min('event_date') ?? $today)->copy()->startOfMonth();
            $end = ($to ?? $scope->max('event_date') ?? $today)->copy()->startOfMonth();
            if ($start->diffInMonths($end) < 24) {
                for ($m = $start->copy(); $m->lte($end); $m->addMonth()) {
                    $buckets[$m->format('Y-m')] = $monthNames[$m->month - 1] . ' ' . $m->format('y');
                }
                $keyOf = fn ($date) => $date->format('Y-m');
                $prevKeyOf = fn ($date) => $date->copy()->addYear()->format('Y-m');
            }
        }
        if (!$buckets) {
            foreach ($monthNames as $i => $name) $buckets[$i + 1] = $name;
        }
        $monthly = function ($list, $keyFn) use ($buckets) {
            $out = array_map(fn ($label) => ['label' => $label, 'events' => 0, 'budget_total' => 0], $buckets);
            foreach ($list as $e) {
                if (!$e->event_date || !isset($out[$k = $keyFn($e->event_date)])) continue;
                $out[$k]['events']++;
                $out[$k]['budget_total'] += $e->totals()['budget_total'];
            }
            return array_values($out);
        };

        // Compare with the previous year, or with the same dates one year earlier
        $compare = $ranged || $year;
        $previous = $ranged
            ? $inRange($from?->copy()->subYear(), $to?->copy()->subYear())
            : ($year ? $inYear($year - 1) : collect());

        // "Servicio de Asado" and "Servicio de asado" are the same menu: group ignoring case/accents,
        // and show the most used spelling
        $menus = $scope->groupBy(fn ($e) => $norm($e->menu) ?: '-')
            ->map(fn ($list, $key) => [
                'name' => $key === '-' ? 'Sin menú' : $list->countBy(fn ($e) => trim($e->menu))->sortDesc()->keys()->first(),
                'events' => $list->count(),
                'total' => $list->sum(fn ($e) => $e->totals()['budget_total']),
            ])
            ->sortByDesc('events')->take(8)->values();

        $byYear = $events->filter(fn ($e) => $e->event_date)->groupBy(fn ($e) => $e->event_date->year)
            ->map(fn ($list, $y) => ['year' => (int) $y] + $sumTotals($list))
            ->sortKeys()->values();

        // Upcoming events (all years): days left and whether the guarantee was collected
        $upcomingAll = $events->filter(fn ($e) => $e->event_date && $e->event_date->gte($today));
        $upcoming = $upcomingAll->take(10)->map(fn ($e) => $this->present($e) + [
            'days_left' => (int) $today->diffInDays($e->event_date),
            'guarantee_paid' => (int) $e->guarantee_paid,
        ])->values();
        $soon = $upcomingAll->filter(fn ($e) => $e->event_date->lte($today->copy()->addDays(30)));

        // Past events that still owe money (all years)
        $overdueAll = $events->filter(fn ($e) => $e->event_date && $e->event_date->lt($today) && $e->totals()['balance'] > 0);

        return response()->json([
            'year' => $year,
            'from' => $from?->toDateString(),
            'to' => $to?->toDateString(),
            'years' => $years,
            'totals' => $totals,
            'previous' => $compare ? $sumTotals($previous) : null,
            'by_month' => $monthly($scope, $keyOf),
            'by_month_previous' => $compare ? $monthly($previous, $prevKeyOf) : null,
            'by_year' => $byYear,
            'menus' => $menus,
            'services' => $topServices,
            'upcoming' => $upcoming,
            'upcoming_stats' => [
                'count' => $upcomingAll->count(),
                'balance' => $upcomingAll->sum(fn ($e) => $e->totals()['balance']),
                'next_30_days' => $soon->count(),
                'without_guarantee' => $soon->filter(fn ($e) => !(int) $e->guarantee_paid)->count(),
            ],
            'overdue' => $overdueAll->sortByDesc('event_date')->take(10)->map(fn ($e) => $this->present($e))->values(),
            'overdue_stats' => [
                'count' => $overdueAll->count(),
                'balance' => $overdueAll->sum(fn ($e) => $e->totals()['balance']),
            ],
        ]);
    }

    // ───────────── Eventos (Registro + Presupuesto) ─────────────

    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        $query = CasitaEvent::withTotals()->withCount('items')->with('planner:id,name');

        if ($search = trim((string) $request->query('search'))) {
            $like = '%' . mb_strtolower($search) . '%';
            $query->where(fn ($q) => $q->whereRaw('LOWER(client_name) LIKE ?', [$like])->orWhereRaw('LOWER(menu) LIKE ?', [$like]));
        }
        if ($year = $request->query('year')) {
            $query->whereYear('event_date', (int) $year);
        }
        [$from, $to] = $this->dateRange($request);
        if ($from) $query->whereDate('event_date', '>=', $from);
        if ($to) $query->whereDate('event_date', '<=', $to);
        $planner = $request->query('planner');
        if ($planner === 'none') $query->whereNull('planner_id');
        elseif ($planner) $query->where('planner_id', (int) $planner);
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
            'planner_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('role', 'planner')],
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
        [$from, $to] = $this->dateRange($request);
        if ($from) $query->whereDate('paid_on', '>=', $from);
        if ($to) $query->whereDate('paid_on', '<=', $to);

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
