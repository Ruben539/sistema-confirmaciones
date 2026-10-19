<?php

namespace App\Console\Commands;

use App\Models\CasitaClient;
use App\Models\CasitaEvent;
use App\Services\CasitaImporter;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Loads the CSV exported from the "Registro" sheet of the La Casita Excel into the database:
 * clients, events and their budget lines. Safe to run more than once (existing events are skipped).
 *
 *   php artisan casita:import "/Users/macuser/Downloads/recibo nuevo 2026(Registro).csv" --settle-past
 *   php artisan casita:import archivo.csv --dry-run     (shows what would be loaded, writes nothing)
 */
class CasitaImport extends Command
{
    protected $signature = 'casita:import
        {path : CSV exportado de la hoja Registro}
        {--settle-past : Marcar como pagados los eventos que ya se realizaron (la planilla no tiene historial de pagos)}
        {--dry-run : Mostrar el resultado sin guardar nada}';

    protected $description = 'Importa a La Casita los clientes y eventos del CSV de la planilla de registros';

    public function handle(CasitaImporter $importer): int
    {
        $path = $this->argument('path');
        if (!is_file($path)) {
            $this->error("No existe el archivo: {$path}");
            return self::FAILURE;
        }

        try {
            ['rows' => $rows, 'warnings' => $warnings] = $importer->parseCsv($path);
        } catch (\RuntimeException $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        }
        $this->info(count($rows) . ' filas leídas.');

        $dryRun = (bool) $this->option('dry-run');
        if ($dryRun) DB::beginTransaction();

        $result = $importer->import($rows, (bool) $this->option('settle-past'));

        $this->table(['', 'Cantidad'], [
            ['Clientes nuevos', $result['created_clients']],
            ['Eventos nuevos', $result['created_events']],
            ['Líneas de presupuesto', $result['created_items']],
            ['Eventos que ya existían (saltados)', $result['skipped_existing']],
            ['Bloques repetidos unidos', $result['duplicate_blocks']],
            ['Eventos pasados marcados como pagados', $result['settled_past']],
            ['Total presupuestado en la base', '₲ ' . number_format(
                (int) DB::table('casita_event_items')->sum('total'), 0, ',', '.'
            )],
            ['Clientes en la base', CasitaClient::count()],
            ['Eventos en la base', CasitaEvent::count()],
        ]);

        foreach (array_merge($result['warnings'], $warnings) as $w) $this->warn($w);

        if ($dryRun) {
            DB::rollBack();
            $this->comment('Prueba sin guardar (--dry-run): no se cargó nada.');
        }

        return self::SUCCESS;
    }
}
