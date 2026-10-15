<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\Guest;
use App\Models\GuestMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * "Mensajes": every WhatsApp conversation goes through the event's single number (the bot), so the
 * planner reads and answers her guests from the panel, per event. The admin can delete messages to
 * keep the database small (the movements history is a separate table and is not affected).
 */
class ConversationController extends Controller
{
    private function authorizeEvent(Event $event): void
    {
        abort_unless(Auth::user()?->canAccessEvent($event), 403, 'Acceso denegado: no tenés permisos sobre este evento.');
    }

    private function requireAdmin(): void
    {
        abort_unless(Auth::user()?->isAdmin(), 403, 'Solo el administrador puede eliminar mensajes.');
    }

    /**
     * Conversations of one event, newest first, with the last message and what needs attention.
     */
    public function index($eventId)
    {
        $event = Event::findOrFail($eventId);
        $this->authorizeEvent($event);

        $guests = Guest::where('event_id', $event->id)
            ->whereNotNull('last_message_at')
            ->orderByDesc('needs_reply')
            ->orderByDesc('last_message_at')
            ->get(['id', 'name', 'phone', 'status', 'table_number', 'last_message_at', 'unread_messages', 'needs_reply', 'whatsapp_channel']);

        // Last message of each conversation in one query
        $lastIds = GuestMessage::whereIn('guest_id', $guests->pluck('id'))
            ->select(DB::raw('MAX(id) as id'))
            ->groupBy('guest_id')
            ->pluck('id');
        $lastMessages = GuestMessage::whereIn('id', $lastIds)->get()->keyBy('guest_id');

        return response()->json([
            'conversations' => $guests->map(fn ($g) => [
                'guest_id' => $g->id,
                'name' => $g->name,
                'phone' => $g->phone,
                'status' => $g->status,
                'table_number' => $g->table_number,
                'last_message_at' => $g->last_message_at,
                'unread' => $g->unread_messages,
                'needs_reply' => $g->needs_reply,
                'channel' => $g->whatsapp_channel,
                'last_message' => optional($lastMessages->get($g->id), fn ($m) => [
                    'author' => $m->author,
                    'body' => mb_substr($m->body, 0, 140),
                ]),
            ])->values(),
            'totals' => [
                'unread' => (int) $guests->sum('unread_messages'),
                'needs_reply' => $guests->where('needs_reply', true)->count(),
                'messages' => GuestMessage::where('event_id', $event->id)->count(),
            ],
        ]);
    }

    /**
     * Full conversation of a guest (latest 300 messages). Opening it marks it as read.
     */
    public function show($guestId)
    {
        $guest = Guest::with('event')->findOrFail($guestId);
        $this->authorizeEvent($guest->event);

        $messages = GuestMessage::with('user:id,name')
            ->where('guest_id', $guest->id)
            ->orderByDesc('id')
            ->limit(300)
            ->get()
            ->reverse()
            ->values();

        if ($guest->unread_messages > 0) {
            $guest->update(['unread_messages' => 0]);
        }

        return response()->json([
            'guest' => $guest->only(['id', 'name', 'phone', 'status', 'table_number', 'needs_reply', 'notes', 'whatsapp_channel']),
            'messages' => $messages,
        ]);
    }

    /**
     * The planner answers from the panel: the message goes out from the event's WhatsApp number.
     */
    public function reply(Request $request, $guestId)
    {
        $guest = Guest::with('event')->findOrFail($guestId);
        $this->authorizeEvent($guest->event);

        $validated = $request->validate(['message' => 'required|string|max:2000']);
        $phone = preg_replace('/[^\d]/', '', (string) $guest->phone);
        if (!$phone) {
            return response()->json(['message' => 'Este invitado no tiene un teléfono registrado.'], 422);
        }

        // Official API: more than 24 h after the guest's last message it goes as the approved "notice" template
        $result = \App\Services\WhatsAppGateway::sendText($phone, $validated['message'], null, [
            'channel' => \App\Services\WhatsAppGateway::channelFor($guest),
            'name' => trim(explode(' ', trim($guest->name))[0]),
            'timeout' => 30,
        ]);
        if (!$result['ok']) {
            return response()->json([
                'message' => !empty($result['retry'])
                    ? 'No se pudo contactar al WhatsApp del sistema. Intentá de nuevo en unos minutos.'
                    : 'El WhatsApp del sistema no pudo enviar el mensaje' . (!empty($result['error']) ? ' (' . $result['error'] . ')' : '') . '.',
            ], 502);
        }

        $message = GuestMessage::create([
            'event_id' => $guest->event_id,
            'guest_id' => $guest->id,
            'direction' => 'out',
            'author' => 'planner',
            'user_id' => Auth::id(),
            'body' => $validated['message'],
        ]);
        $guest->update(['needs_reply' => false, 'unread_messages' => 0, 'last_message_at' => now()]);

        return response()->json([
            'message' => 'Mensaje enviado.',
            'sent' => $message->load('user:id,name'),
        ], 201);
    }

    // "Listo": the conversation no longer needs a person
    public function resolve($guestId)
    {
        $guest = Guest::with('event')->findOrFail($guestId);
        $this->authorizeEvent($guest->event);
        $guest->update(['needs_reply' => false, 'unread_messages' => 0]);

        return response()->json(['message' => 'Conversación marcada como resuelta.']);
    }

    // ───────── Admin: storage cleanup ─────────

    public function destroyConversation($guestId)
    {
        $this->requireAdmin();
        $guest = Guest::findOrFail($guestId);

        $deleted = GuestMessage::where('guest_id', $guest->id)->delete();
        $guest->update(['last_message_at' => null, 'unread_messages' => 0, 'needs_reply' => false]);

        return response()->json(['message' => "Se eliminaron {$deleted} mensajes de {$guest->name}.", 'deleted' => $deleted]);
    }

    public function destroyEventMessages($eventId)
    {
        $this->requireAdmin();
        $event = Event::findOrFail($eventId);

        $deleted = GuestMessage::where('event_id', $event->id)->delete();
        Guest::where('event_id', $event->id)->update(['last_message_at' => null, 'unread_messages' => 0, 'needs_reply' => false]);

        return response()->json(['message' => "Se eliminaron {$deleted} mensajes del evento.", 'deleted' => $deleted]);
    }

    /**
     * Storage used by messages, overall and per event (for the cleanup panel).
     */
    public function stats(Request $request)
    {
        $this->requireAdmin();
        $days = max(1, (int) $request->query('older_than_days', 90));
        $sizeExpr = DB::getDriverName() === 'pgsql' ? 'COALESCE(SUM(OCTET_LENGTH(body)), 0)' : 'COALESCE(SUM(LENGTH(body)), 0)';

        $byEvent = GuestMessage::select('event_id', DB::raw('COUNT(*) as messages'), DB::raw("{$sizeExpr} as bytes"), DB::raw('MAX(created_at) as last_at'))
            ->groupBy('event_id')
            ->orderByDesc('messages')
            ->get();
        $events = Event::whereIn('id', $byEvent->pluck('event_id'))->get(['id', 'title', 'couple_names', 'event_date'])->keyBy('id');

        return response()->json([
            'total_messages' => (int) $byEvent->sum('messages'),
            'total_bytes' => (int) $byEvent->sum('bytes'),
            'older_than_days' => $days,
            'older_count' => GuestMessage::where('created_at', '<', now()->subDays($days))->count(),
            'events' => $byEvent->map(fn ($row) => [
                'event_id' => $row->event_id,
                'title' => optional($events->get($row->event_id), fn ($e) => $e->couple_names ?: $e->title) ?? "Evento #{$row->event_id}",
                'event_date' => optional($events->get($row->event_id))->event_date,
                'messages' => (int) $row->messages,
                'bytes' => (int) $row->bytes,
                'last_at' => $row->last_at,
            ])->values(),
        ]);
    }

    // Deletes every message older than N days (all events)
    public function purge(Request $request)
    {
        $this->requireAdmin();
        $validated = $request->validate(['older_than_days' => 'required|integer|min:1|max:3650']);

        $deleted = GuestMessage::where('created_at', '<', now()->subDays($validated['older_than_days']))->delete();

        // Guests left without messages leave the inbox
        Guest::whereNotNull('last_message_at')
            ->whereDoesntHave('messages')
            ->update(['last_message_at' => null, 'unread_messages' => 0, 'needs_reply' => false]);

        return response()->json(['message' => "Se eliminaron {$deleted} mensajes con más de {$validated['older_than_days']} días.", 'deleted' => $deleted]);
    }
}
