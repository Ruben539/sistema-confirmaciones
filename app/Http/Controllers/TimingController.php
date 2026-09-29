<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Services\TimingParserService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TimingController extends Controller
{
    protected TimingParserService $parser;

    public function __construct(TimingParserService $parser)
    {
        $this->parser = $parser;
    }

    private function authorizeEvent(Event $event)
    {
        $user = Auth::user();
        if ($user && $user->role === 'planner' && $event->user_id !== $user->id) {
            abort(403, 'Acceso denegado: No tenés permisos sobre este evento.');
        }
    }

    /**
     * Obtener el timing guardado de un evento.
     */
    public function show($eventId)
    {
        $event = Event::with('planner')->findOrFail($eventId);
        $this->authorizeEvent($event);

        return response()->json([
            'timing' => $event->timing ?? [],
            'event' => [
                'id' => $event->id,
                'title' => $event->title,
                'couple_names' => $event->couple_names,
                'event_date' => $event->event_date,
                'location' => $event->location,
                'planner' => $event->planner,
            ]
        ]);
    }

    /**
     * Guardar o actualizar la lista de hitos del Timing.
     */
    public function save(Request $request, $eventId)
    {
        $event = Event::findOrFail($eventId);
        $this->authorizeEvent($event);

        $validated = $request->validate([
            'timing' => 'nullable|array',
            'timing.*.id' => 'nullable|string',
            'timing.*.time' => 'required|string|max:50',
            'timing.*.title' => 'required|string|max:255',
            'timing.*.description' => 'nullable|string',
            'timing.*.completed' => 'nullable|boolean',
        ]);

        $event->timing = $validated['timing'] ?? [];
        $event->save();

        return response()->json([
            'message' => '¡Timing del evento guardado con éxito!',
            'timing' => $event->timing,
        ]);
    }

    /**
     * Subir archivo (PDF, Word .docx, o .txt) o enviar texto pegado
     * para extraer y estructurar automáticamente el Timing.
     */
    public function upload(Request $request, $eventId)
    {
        $event = Event::findOrFail($eventId);
        $this->authorizeEvent($event);

        if ($request->hasFile('file')) {
            $request->validate([
                'file' => 'required|file|mimes:pdf,docx,doc,txt|max:12288', // Max 12MB
            ]);

            $file = $request->file('file');
            $ext = $file->getClientOriginalExtension();
            $path = $file->getRealPath();

            $result = $this->parser->parseFile($path, $ext);
        } elseif ($request->filled('text')) {
            $result = $this->parser->parseText($request->input('text'));
        } else {
            return response()->json([
                'message' => 'Por favor subí un archivo PDF o Word (.docx) o pegá el texto del cronograma.'
            ], 422);
        }

        if (empty($result['items'])) {
            return response()->json([
                'message' => 'No pudimos detectar horarios en el archivo. Verificá que tenga horas en formato "07:00", "16:30", etc.',
                'items' => [],
                'metadata' => $result['metadata'] ?? [],
            ], 422);
        }

        return response()->json([
            'message' => "Se detectaron {$result['count']} momentos en el cronograma con éxito.",
            'items' => $result['items'],
            'metadata' => $result['metadata'],
            'count' => $result['count'],
        ]);
    }

    /**
     * Marcar un hito como completado/pendiente en tiempo real durante el evento.
     */
    public function toggleItem(Request $request, $eventId, $itemId)
    {
        $event = Event::findOrFail($eventId);
        $this->authorizeEvent($event);

        $timing = $event->timing ?? [];
        $updated = false;

        foreach ($timing as &$item) {
            if (($item['id'] ?? '') === $itemId) {
                $item['completed'] = !($item['completed'] ?? false);
                $updated = true;
                break;
            }
        }
        unset($item);

        if ($updated) {
            $event->timing = $timing;
            $event->save();
        }

        return response()->json([
            'message' => 'Estado actualizado',
            'timing' => $event->timing,
        ]);
    }
}
