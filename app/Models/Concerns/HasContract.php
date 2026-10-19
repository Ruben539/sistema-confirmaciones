<?php

namespace App\Models\Concerns;

use Illuminate\Support\Carbon;

/**
 * Signed contract of an event (Event and CasitaEvent share the same columns, see the
 * add_contract_fields_to_events migration). The file is never public: it is downloaded
 * through ContractController by an admin.
 */
trait HasContract
{
    public const CONTRACT_STATUSES = [
        'pending' => 'Pendiente',
        'sent' => 'Enviado, falta la firma',
        'signed' => 'Firmado',
        'not_required' => 'No requiere',
    ];

    // Statuses that still need the admin's attention (and get WhatsApp reminders)
    public const CONTRACT_OPEN = ['pending', 'sent'];

    // Deleting the event also deletes its contract file
    public static function bootHasContract(): void
    {
        static::deleted(function ($event) {
            if ($event->contract_file_path) {
                \Illuminate\Support\Facades\Storage::disk('local')->delete($event->contract_file_path);
            }
            if ($event->contract_file_id) {
                (new \App\Services\GoogleDriveService())->deleteFile($event->contract_file_id);
            }
        });
    }

    public function initializeHasContract(): void
    {
        $this->mergeCasts([
            'contract_signed_at' => 'datetime',
            'contract_reminder_sent_at' => 'datetime',
            'contract_reminder_count' => 'integer',
        ]);
        // File location is internal: the panel uses the download URL
        $this->makeHidden(['contract_file_id', 'contract_file_path', 'contract_reminder_count']);
    }

    /** Events still without a signed contract that haven't happened yet (undated ones too). */
    public function scopeContractMissing($query)
    {
        return $query
            ->whereIn('contract_status', self::CONTRACT_OPEN)
            ->where(fn ($q) => $q->whereNull('event_date')->orWhereDate('event_date', '>=', Carbon::today()));
    }

    public function contractIsOpen(): bool
    {
        return in_array($this->contract_status ?? 'pending', self::CONTRACT_OPEN, true);
    }

    public function hasContractFile(): bool
    {
        return !empty($this->contract_file_id) || !empty($this->contract_file_path);
    }

    /** "event" or "casita": the {type} of the contract routes. */
    abstract public function contractType(): string;

    /** Name shown in reminders and lists. */
    abstract public function contractLabel(): string;

    public function contractSummary(): array
    {
        return [
            'status' => $this->contract_status ?? 'pending',
            'status_label' => self::CONTRACT_STATUSES[$this->contract_status ?? 'pending'] ?? $this->contract_status,
            'file_name' => $this->contract_file_name,
            'download_url' => $this->hasContractFile() ? "/api/contracts/{$this->contractType()}/{$this->id}/file" : null,
            'signed_at' => $this->contract_signed_at?->toIso8601String(),
            'reminder_sent_at' => $this->contract_reminder_sent_at?->toIso8601String(),
        ];
    }
}
