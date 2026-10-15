<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One WhatsApp message of a guest's conversation with the event's number:
 * in = written by the guest; out = automatic answer (bot) or written by the planner from the panel.
 */
class GuestMessage extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['event_id', 'guest_id', 'direction', 'author', 'user_id', 'body'];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    // Outgoing message sent by the system (invitation, reminder, QR pass) or by the planner from the panel
    public static function logOutgoing(Guest $guest, string $text, string $author = 'bot', ?int $userId = null): void
    {
        try {
            static::create([
                'event_id' => $guest->event_id,
                'guest_id' => $guest->id,
                'direction' => 'out',
                'author' => $author,
                'user_id' => $userId,
                'body' => mb_substr($text, 0, 4000),
            ]);
        } catch (\Throwable $e) {
            // The conversation log must never break a send
        }
    }

    public function guest()
    {
        return $this->belongsTo(Guest::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
