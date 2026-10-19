<?php

namespace App\Services;

use App\Models\CasitaClient;
use App\Models\CasitaEvent;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Imports the "Registro" sheet of the old La Casita Excel.
 * Used by the "Importar Excel" screen (rows already read in the browser) and by
 * `php artisan casita:import` (reads the exported CSV here with parseCsv()).
 *
 * Row shape: date (Y-m-d|null), client, venue, menu, detail, price, quantity, note.
 */
class CasitaImporter
{
    private const COLUMNS = [
        'date' => ['fecha'], 'venue' => ['lugar'], 'client' => ['cliente'], 'menu' => ['menu'], 'detail' => ['detalle'],
        'price' => ['precio'], 'quantity' => ['cantidad'], 'total' => ['total'], 'note' => ['observacion', 'observaciones'],
    ];

    /** @return array{rows: array, warnings: string[]} */
    public function parseCsv(string $path): array
    {
        $content = file_get_contents($path);
        if ($content === false) throw new \RuntimeException("No se pudo leer {$path}");
        if (str_starts_with($content, "\xEF\xBB\xBF")) $content = substr($content, 3);
        // The Excel export is Windows-1252 (Latin-1); convert unless it is already UTF-8
        if (!mb_check_encoding($content, 'UTF-8')) $content = mb_convert_encoding($content, 'UTF-8', 'Windows-1252');

        $lines = preg_split('/\r\n|\n|\r/', $content);
        $sample = implode("\n", array_slice($lines, 0, 20));
        $sep = substr_count($sample, ';') >= substr_count($sample, ',') ? ';' : ',';
        $matrix = array_map(fn ($l) => str_getcsv($l, $sep, '"', ''), $lines);

        $norm = fn ($s) => Str::lower(Str::ascii(trim((string) $s)));
        $headerIndex = null;
        foreach ($matrix as $i => $r) {
            $cells = array_map($norm, $r);
            if (in_array('fecha', $cells, true) && in_array('cliente', $cells, true)) { $headerIndex = $i; break; }
        }
        if ($headerIndex === null) throw new \RuntimeException('No encontré la fila de títulos (Fecha, Lugar, Cliente, Menú, Detalle, Precio, Cantidad, Total).');

        $header = array_map($norm, $matrix[$headerIndex]);
        $col = [];
        foreach (self::COLUMNS as $key => $names) {
            $found = array_values(array_filter(array_keys($header), fn ($k) => in_array($header[$k], $names, true)));
            $col[$key] = $found[0] ?? null;
        }

        $rows = [];
        $warnings = [];
        foreach (array_slice($matrix, $headerIndex + 1, null, true) as $i => $r) {
            $get = fn ($key) => $col[$key] !== null ? trim((string) ($r[$col[$key]] ?? '')) : '';
            $client = $get('client');
            $detail = $get('detail');
            if ($client === '' || $detail === '') continue;

            $line = $i + 1;
            [$date, $warning] = $this->parseDate($get('date'));
            if ($warning) $warnings[] = "Fila {$line} ({$client}): {$warning}";

            $quantity = $this->toInt($get('quantity'));
            $price = $this->toInt($get('price'));
            $total = $this->toInt($get('total'));
            if (!$price && $total && $quantity) $price = (int) round($total / $quantity);
            if ($price > 0 && $price < 1000) $warnings[] = "Fila {$line} ({$client}): precio sospechoso {$price} en \"{$detail}\"";

            $note = $get('note');
            $rows[] = [
                'date' => $date, 'client' => $client, 'venue' => $get('venue') ?: null, 'menu' => $get('menu') ?: null,
                'detail' => $detail, 'price' => max(0, $price), 'quantity' => max(0, $quantity),
                'note' => ($note === '' || str_starts_with($note, '#')) ? null : $note,
            ];
        }

        return ['rows' => $rows, 'warnings' => $warnings];
    }

    private function toInt(string $value): int
    {
        $digits = preg_replace('/[^\d]/', '', $value);
        return $digits === '' ? 0 : (int) $digits;
    }

    /** dd/mm/yyyy → Y-m-d; fixes typos like 21/11/225 and two-digit years. */
    private function parseDate(string $value): array
    {
        if ($value === '') return [null, null];
        if (!preg_match('#^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$#', $value, $m)) return [null, "fecha no reconocida \"{$value}\""];
        $year = $m[3];
        $warning = null;
        if (strlen($year) === 2) $year = "20{$year}";
        if (strlen($year) === 3) {
            $fixed = '2' . str_pad(substr($year, 1), 3, '0', STR_PAD_LEFT);
            $warning = "año \"{$year}\" corregido a \"{$fixed}\"";
            $year = $fixed;
        }
        if (!checkdate((int) $m[2], (int) $m[1], (int) $year)) return [null, "fecha inválida \"{$value}\""];

        return [sprintf('%04d-%02d-%02d', $year, $m[2], $m[1]), $warning];
    }

    /**
     * Groups rows by date + client, merges repeated blocks (the sheet has events copied 2-3 times),
     * skips events already loaded and links every event to its client.
     */
    public function import(array $rows, bool $settlePast = false, ?int $userId = null): array
    {
        // Consecutive rows of the same date + client form a block
        $blocks = [];
        foreach ($rows as $row) {
            $key = ($row['date'] ?? '') . '|' . CasitaClient::normalize($row['client']);
            $last = array_key_last($blocks);
            if ($last !== null && $blocks[$last]['key'] === $key) $blocks[$last]['rows'][] = $row;
            else $blocks[] = ['key' => $key, 'rows' => [$row]];
        }

        // Same event in several blocks: keep each distinct line as many times as its largest block has it
        $events = [];
        $duplicateBlocks = 0;
        foreach ($blocks as $block) {
            $counts = [];
            foreach ($block['rows'] as $row) {
                $sig = mb_strtolower(trim($row['detail'])) . '|' . $row['price'] . '|' . $row['quantity'];
                $counts[$sig] ??= ['row' => $row, 'n' => 0];
                $counts[$sig]['n']++;
            }
            if (isset($events[$block['key']])) {
                $duplicateBlocks++;
                foreach ($counts as $sig => $c) {
                    $prev = $events[$block['key']]['lines'][$sig]['n'] ?? 0;
                    $events[$block['key']]['lines'][$sig] = ['row' => $c['row'], 'n' => max($prev, $c['n'])];
                }
            } else {
                $events[$block['key']] = ['first' => $block['rows'][0], 'lines' => $counts];
            }
        }

        $today = Carbon::today()->toDateString();
        $stats = ['created_events' => 0, 'created_items' => 0, 'skipped_existing' => 0, 'settled_past' => 0];
        $clientsBefore = CasitaClient::count();

        DB::transaction(function () use ($events, $settlePast, $userId, $today, &$stats) {
            foreach ($events as $ev) {
                $first = $ev['first'];
                $client = CasitaClient::resolve($first['client']);
                $date = $first['date'] ?: null;

                $exists = CasitaEvent::where('client_id', $client->id)
                    ->when($date, fn ($q) => $q->whereDate('event_date', $date), fn ($q) => $q->whereNull('event_date'))
                    ->exists();
                if ($exists) { $stats['skipped_existing']++; continue; }

                $menu = collect($ev['lines'])->pluck('row.menu')->filter()->first();
                $notes = collect($ev['lines'])->pluck('row.note')->filter()->unique()->implode(' · ');

                $event = CasitaEvent::create([
                    'client_id' => $client->id,
                    'client_name' => $client->name,
                    'event_date' => $date,
                    'venue' => trim($first['venue'] ?? '') ?: 'La Casita',
                    'menu' => $menu ? trim($menu) : null,
                    'notes' => $notes ?: null,
                    'created_by' => $userId,
                ]);

                $i = 0;
                $budget = 0;
                foreach ($ev['lines'] as $line) {
                    for ($k = 0; $k < $line['n']; $k++) {
                        $item = $event->items()->create([
                            'description' => trim($line['row']['detail']),
                            'unit_price' => (int) $line['row']['price'],
                            'quantity' => (int) $line['row']['quantity'],
                            'sort_order' => $i++,
                        ]);
                        $budget += $item->total;
                        $stats['created_items']++;
                    }
                }

                // The Excel has no payment history: optionally mark events that already happened as paid
                if ($settlePast && $date && $date < $today && $budget > 0) {
                    $event->payments()->create([
                        'paid_on' => $date, 'kind' => 'pago', 'amount' => $budget,
                        'note' => 'Saldado al importar (historial del Excel)',
                    ]);
                    $stats['settled_past']++;
                }
                $stats['created_events']++;
            }
        });

        $warnings = [];
        if ($duplicateBlocks) $warnings[] = "Se juntaron {$duplicateBlocks} bloques repetidos (el mismo evento copiado más de una vez).";

        return array_merge($stats, [
            'message' => "Importación lista: {$stats['created_events']} eventos nuevos.",
            'created_clients' => CasitaClient::count() - $clientsBefore,
            'duplicate_blocks' => $duplicateBlocks,
            'warnings' => $warnings,
        ]);
    }
}
