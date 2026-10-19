<?php

namespace App\Http\Controllers;

use App\Models\CasitaEvent;
use App\Models\Event;
use App\Services\GoogleDriveService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Signed contracts of the events (sistema de confirmaciones = "event", La Casita = "casita").
 * Admin only. The file goes to a private Google Drive folder (or the private local disk when
 * Drive is not configured) and is downloaded through this controller, never by a public link.
 */
class ContractController extends Controller
{
    private const DRIVE_FOLDER = 'Contratos';

    private const MODELS = [
        'event' => Event::class,
        'casita' => CasitaEvent::class,
    ];

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->isAdmin(), 403, 'Solo el administrador puede gestionar los contratos.');
    }

    private function findEvent(string $type, $id): Model
    {
        abort_unless(isset(self::MODELS[$type]), 404);
        return self::MODELS[$type]::findOrFail($id);
    }

    private function response(Model $event, string $message, int $status = 200)
    {
        return response()->json(['message' => $message, 'contract' => $event->fresh()->contractSummary()], $status);
    }

    /**
     * Upcoming events (both modules) still without a signed contract, soonest first.
     * Feeds the panel's counter and list.
     */
    public function pending(Request $request)
    {
        $this->authorizeAdmin($request);

        $items = collect(self::missingContracts())->map(fn (Model $e) => [
            'type' => $e->contractType(),
            'id' => $e->id,
            'label' => $e->contractLabel(),
            'module' => $e instanceof CasitaEvent ? 'La Casita' : 'Confirmaciones',
            'event_date' => $e->event_date ? Carbon::parse($e->event_date)->format('Y-m-d') : null,
            'days_left' => $e->event_date ? (int) Carbon::today()->diffInDays(Carbon::parse($e->event_date)->startOfDay(), false) : null,
            'planner_name' => $e->planner?->name,
            'contract' => $e->contractSummary(),
        ])->values();

        return response()->json(['count' => $items->count(), 'items' => $items]);
    }

    /** Events of both modules without a signed contract, soonest first (undated last). */
    public static function missingContracts(): array
    {
        $events = Event::contractMissing()->with('planner:id,name')->get();
        $casita = CasitaEvent::contractMissing()->with('planner:id,name')->get();

        return $events->concat($casita)
            ->sortBy(fn ($e) => $e->event_date ? Carbon::parse($e->event_date)->format('Y-m-d') : '9999-12-31')
            ->values()
            ->all();
    }

    /** Change the status by hand: sent to the client, not required, back to pending, or signed on paper. */
    public function update(Request $request, string $type, $id)
    {
        $this->authorizeAdmin($request);
        $event = $this->findEvent($type, $id);

        $data = $request->validate([
            'status' => ['required', Rule::in(array_keys(Event::CONTRACT_STATUSES))],
        ]);

        $event->forceFill([
            'contract_status' => $data['status'],
            'contract_signed_at' => $data['status'] === 'signed' ? ($event->contract_signed_at ?? now()) : null,
        ])->save();

        return $this->response($event, 'Contrato: ' . Event::CONTRACT_STATUSES[$data['status']] . '.');
    }

    /** Upload the signed contract (PDF or photo). Marks it as signed and replaces any previous file. */
    public function upload(Request $request, string $type, $id)
    {
        $this->authorizeAdmin($request);
        $event = $this->findEvent($type, $id);

        $request->validate([
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,webp|max:20480',
        ], [
            'file.mimes' => 'El contrato tiene que ser un PDF o una foto (JPG, PNG).',
            'file.max' => 'El archivo no puede pasar de 20 MB.',
        ]);

        $file = $request->file('file');
        $ext = strtolower($file->getClientOriginalExtension() ?: 'pdf');
        $name = 'Contrato ' . Str::limit(preg_replace('/[^\pL\pN ._-]/u', '', $event->contractLabel()), 80, '')
            . ($event->event_date ? ' ' . Carbon::parse($event->event_date)->format('Y-m-d') : '')
            . ' (' . $type . '-' . $event->id . ').' . $ext;

        $fileId = null;
        $path = null;
        if (GoogleDriveService::isConfigured()) {
            $drive = new GoogleDriveService();
            $folderId = $drive->getOrCreateFolder(self::DRIVE_FOLDER);
            $result = $folderId ? $drive->uploadFile($file, $name, $folderId, false) : null;
            $fileId = $result['file_id'] ?? null;
        }
        if (!$fileId) {
            $path = $file->storeAs('contracts', Str::uuid() . '.' . $ext, 'local');
        }
        if (!$fileId && !$path) {
            return response()->json(['message' => 'No se pudo guardar el contrato. Probá de nuevo.'], 500);
        }

        $this->deleteStoredFile($event);
        $event->forceFill([
            'contract_file_id' => $fileId,
            'contract_file_path' => $path,
            'contract_file_name' => $name,
            'contract_status' => 'signed',
            'contract_signed_at' => now(),
        ])->save();

        return $this->response($event, 'Contrato firmado guardado.', 201);
    }

    /** Show the contract in the browser (admin only). */
    public function download(Request $request, string $type, $id)
    {
        $this->authorizeAdmin($request);
        $event = $this->findEvent($type, $id);
        abort_unless($event->hasContractFile(), 404, 'Este evento no tiene un contrato subido.');

        $name = $event->contract_file_name ?: 'Contrato.pdf';
        $mime = match (strtolower(pathinfo($name, PATHINFO_EXTENSION))) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            default => 'application/pdf',
        };
        $headers = [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="' . str_replace('"', '', Str::ascii($name)) . '"',
            'Cache-Control' => 'private, no-store',
        ];

        if ($event->contract_file_path) {
            abort_unless(Storage::disk('local')->exists($event->contract_file_path), 404, 'El archivo del contrato ya no está disponible.');
            return response(Storage::disk('local')->get($event->contract_file_path), 200, $headers);
        }

        $upstream = (new GoogleDriveService())->streamFile($event->contract_file_id);
        abort_if(!$upstream || $upstream->getStatusCode() >= 400, 502, 'No se pudo obtener el contrato desde Google Drive.');

        return response((string) $upstream->getBody(), 200, $headers);
    }

    /** Remove the uploaded file; the contract goes back to "pending" so the reminders start again. */
    public function destroyFile(Request $request, string $type, $id)
    {
        $this->authorizeAdmin($request);
        $event = $this->findEvent($type, $id);

        $this->deleteStoredFile($event);
        $event->forceFill([
            'contract_file_id' => null,
            'contract_file_path' => null,
            'contract_file_name' => null,
            'contract_status' => 'pending',
            'contract_signed_at' => null,
        ])->save();

        return $this->response($event, 'Contrato eliminado. El evento vuelve a figurar sin contrato.');
    }

    private function deleteStoredFile(Model $event): void
    {
        if ($event->contract_file_path) {
            Storage::disk('local')->delete($event->contract_file_path);
        }
        if ($event->contract_file_id) {
            (new GoogleDriveService())->deleteFile($event->contract_file_id);
        }
    }
}
