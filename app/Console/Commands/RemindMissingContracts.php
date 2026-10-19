<?php

namespace App\Console\Commands;

use App\Http\Controllers\ContractController;
use App\Models\CasitaEvent;
use App\Models\User;
use App\Services\EventMilestoneService;
use App\Services\WhatsAppGateway;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Reminds the admins by WhatsApp about upcoming events (confirmaciones and La Casita) that still
 * have no signed contract. One message per admin listing the events that are due:
 *  - the first reminder the day after the event was created,
 *  - then every REPEAT_DAYS days, or every day once the event is URGENT_DAYS days away or less.
 * It stops once the contract is uploaded or marked as signed / not required.
 */
class RemindMissingContracts extends Command
{
    protected $signature = 'contracts:remind {--dry-run : Show the message without sending it}';
    protected $description = 'Avisa por WhatsApp a los administradores de los eventos que todavía no tienen el contrato firmado.';

    private const GRACE_DAYS = 1;
    private const REPEAT_DAYS = 3;
    private const URGENT_DAYS = 30;
    private const MAX_LINES = 20;

    public function handle(): int
    {
        $today = Carbon::today();
        $due = collect(ContractController::missingContracts())->filter(fn ($e) => $this->isDue($e, $today))->values();

        if ($due->isEmpty()) {
            $this->info('No hay contratos pendientes para recordar hoy.');
            return self::SUCCESS;
        }

        $message = $this->buildMessage($due, $today);

        if ($this->option('dry-run')) {
            $this->line($message);
            return self::SUCCESS;
        }

        $admins = User::where('role', 'admin')->where('is_active', true)->whereNotNull('phone')->where('phone', '!=', '')->get();
        if ($admins->isEmpty()) {
            $this->warn('Ningún administrador activo tiene teléfono cargado: no se envió el recordatorio.');
            Log::warning('contracts:remind: no admin with a phone number');
            return self::SUCCESS;
        }

        $sent = 0;
        foreach ($admins as $admin) {
            $phone = EventMilestoneService::formatPhone($admin->phone);
            $result = WhatsAppGateway::sendText($phone, "Hola {$admin->name} 👋\n\n" . $message, null, ['name' => $admin->name, 'timeout' => 15]);
            if ($result['ok'] ?? false) {
                $sent++;
            } else {
                $this->warn("No se pudo enviar a {$admin->name}: " . ($result['error'] ?? 'error desconocido'));
                Log::warning("contracts:remind: send to admin #{$admin->id} failed: " . ($result['error'] ?? 'unknown'));
            }
        }

        // Only count it as reminded when someone got the message, so a failed day is retried tomorrow
        if ($sent > 0) {
            foreach ($due as $event) {
                $event->forceFill([
                    'contract_reminder_sent_at' => now(),
                    'contract_reminder_count' => (int) $event->contract_reminder_count + 1,
                ])->saveQuietly();
            }
        }

        $this->info("Recordatorio de {$due->count()} contratos enviado a {$sent} de {$admins->count()} administradores.");
        return self::SUCCESS;
    }

    private function isDue($event, Carbon $today): bool
    {
        if ($event->created_at && $event->created_at->copy()->startOfDay()->addDays(self::GRACE_DAYS)->greaterThan($today)) {
            return false;
        }
        if (!$event->contract_reminder_sent_at) {
            return true;
        }

        $daysLeft = $this->daysLeft($event, $today);
        $every = $daysLeft !== null && $daysLeft <= self::URGENT_DAYS ? 1 : self::REPEAT_DAYS;

        return $event->contract_reminder_sent_at->copy()->startOfDay()->addDays($every)->lessThanOrEqualTo($today);
    }

    private function daysLeft($event, Carbon $today): ?int
    {
        return $event->event_date ? (int) $today->diffInDays(Carbon::parse($event->event_date)->startOfDay(), false) : null;
    }

    private function buildMessage($events, Carbon $today): string
    {
        $count = $events->count();
        $lines = $events->take(self::MAX_LINES)->map(function ($event) use ($today) {
            $module = $event instanceof CasitaEvent ? 'La Casita' : 'Confirmaciones';
            $daysLeft = $this->daysLeft($event, $today);
            $when = match (true) {
                $daysLeft === null => 'sin fecha',
                $daysLeft === 0 => '*es hoy*',
                $daysLeft === 1 => '*mañana*',
                default => Carbon::parse($event->event_date)->format('d/m/Y') . " (faltan {$daysLeft} días)",
            };
            $icon = $daysLeft !== null && $daysLeft <= 7 ? '🔴' : ($event->contract_status === 'sent' ? '🟡' : '⚪');
            $status = $event->contract_status === 'sent' ? ' — enviado, falta la firma' : '';

            return "{$icon} *{$event->contractLabel()}* · {$module} · {$when}{$status}";
        });

        $text = "📝 *Contratos pendientes de firma*\n\n"
            . ($count === 1 ? "Este evento todavía no tiene el contrato firmado:" : "Estos {$count} eventos todavía no tienen el contrato firmado:")
            . "\n\n" . $lines->implode("\n");

        if ($count > self::MAX_LINES) {
            $text .= "\n…y " . ($count - self::MAX_LINES) . ' más.';
        }

        return $text . "\n\nCuando lo tengas, subilo en el panel (Eventos o La Casita → el evento → Contrato) y dejo de avisarte.";
    }
}
