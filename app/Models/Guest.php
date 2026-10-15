<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Guest extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_id',
        'name',
        'phone',
        'whatsapp_lid',
        'passes',
        'confirmed_passes',
        'adults',
        'youth',
        'children',
        'companions',
        'confirmed_adults',
        'confirmed_youth',
        'confirmed_children',
        'table_number',
        'status',
        'conversation_state',
        'dietary_restrictions',
        'notes',
        'whatsapp_status',
        'last_sent_at',
        'reminder_sent_at',
        'reminder_count',
        'last_message_at',
        'unread_messages',
        'needs_reply',
        'attended_at',
        'attended_people',
        'holder_attended_at',
        'token',
        'song_suggestion',
    ];

    protected $casts = [
        'attended_at' => 'datetime',
        'last_sent_at' => 'datetime',
        'reminder_sent_at' => 'datetime',
        'last_message_at' => 'datetime',
        'holder_attended_at' => 'datetime',
        'needs_reply' => 'boolean',
    ];

    protected static function booted()
    {
        static::creating(function ($guest) {
            if (empty($guest->token)) {
                $guest->token = Str::random(32);
            }
            if ($guest->adults === null) $guest->adults = 1;
            if ($guest->youth === null) $guest->youth = 0;
            if ($guest->children === null) $guest->children = 0;
            $guest->passes = max(1, (int)$guest->adults + (int)$guest->youth + (int)$guest->children);
        });

        static::updating(function ($guest) {
            if ($guest->isDirty(['adults', 'youth', 'children'])) {
                $guest->passes = max(1, (int)$guest->adults + (int)$guest->youth + (int)$guest->children);
            }
            if ($guest->isDirty(['confirmed_adults', 'confirmed_youth', 'confirmed_children'])) {
                $guest->confirmed_passes = (int)$guest->confirmed_adults + (int)$guest->confirmed_youth + (int)$guest->confirmed_children;
            }
            // Check-in by hand (or an old app) lets the whole group in; leaving "attended" resets the count
            if ($guest->isDirty('status')) {
                if ($guest->status === 'attended' && (int) $guest->attended_people === 0) {
                    $guest->attended_people = $guest->groupSize();
                    $guest->holder_attended_at = $guest->holder_attended_at ?? now();
                } elseif ($guest->status !== 'attended') {
                    $guest->attended_people = 0;
                    $guest->holder_attended_at = null;
                }
            }
        });

        // Movement history (see GuestActivity): recorded wherever the change comes from
        static::created(function ($guest) {
            GuestActivity::record($guest, 'created', 'Invitado agregado a la lista');
        });

        static::updated(function ($guest) {
            if ($guest->wasChanged('status')) {
                $from = $guest->getOriginal('status');
                $to = $guest->status;
                $via = GuestActivity::context('via');
                if ($to === 'attended') {
                    $people = $guest->groupSize() > 1 ? " · {$guest->attended_people} de {$guest->groupSize()} personas" : '';
                    GuestActivity::record($guest, 'checked_in', ($via === 'scan' ? 'Ingresó (QR escaneado)' : 'Ingresó (marcado a mano)') . $people, ['from' => $from]);
                } elseif ($from === 'attended') {
                    GuestActivity::record($guest, 'check_in_undone', 'Se deshizo el ingreso', ['to' => $to]);
                } elseif ($to === 'confirmed') {
                    GuestActivity::record($guest, 'confirmed', 'Confirmó asistencia (' . $guest->confirmed_passes . ' personas)', ['from' => $from]);
                } elseif ($to === 'declined') {
                    GuestActivity::record($guest, 'declined', $via === 'deadline' ? 'Cancelado automáticamente: venció el plazo para confirmar' : 'No asistirá', ['from' => $from]);
                } elseif ($to === 'pending') {
                    GuestActivity::record($guest, 'reset_pending', 'Volvió a pendiente', ['from' => $from]);
                }
            }

            // Whole group in at once (by hand or an app without the group question): every named companion too;
            // undoing the check-in clears them
            if ($guest->wasChanged('status')) {
                if ($guest->status === 'attended' && (int) $guest->attended_people >= max($guest->groupSize(), (int) $guest->passes)) {
                    $guest->members()->whereNull('attended_at')->update(['attended_at' => now()]);
                } elseif ($guest->getOriginal('status') === 'attended') {
                    $guest->members()->whereNotNull('attended_at')->update(['attended_at' => null]);
                }
            }

            // The rest of a group arriving later with the same QR
            if (!$guest->wasChanged('status') && $guest->status === 'attended' && $guest->wasChanged('attended_people')) {
                $more = (int) $guest->attended_people - (int) $guest->getOriginal('attended_people');
                if ($more > 0) {
                    GuestActivity::record($guest, 'checked_in', "Ingresaron {$more} más ({$guest->attended_people} de {$guest->groupSize()} personas)");
                }
            }

            if ($guest->wasChanged('table_number')) {
                $from = $guest->getOriginal('table_number') ?: 'sin mesa';
                $to = $guest->table_number ?: 'sin mesa';
                GuestActivity::record($guest, 'table_changed', "Mesa: {$from} → {$to}");
            }

            if ($guest->wasChanged('whatsapp_status') && $guest->whatsapp_status === 'sent') {
                GuestActivity::record($guest, 'invitation_sent', 'Invitación enviada por WhatsApp');
            }

            if ($guest->wasChanged('reminder_count') && $guest->reminder_count > (int) $guest->getOriginal('reminder_count')) {
                GuestActivity::record($guest, 'reminder_sent', "Recordatorio enviado por WhatsApp (#{$guest->reminder_count})");
            }
        });
    }

    // People of the invitation: the confirmed amount once they answered, otherwise the invited amount
    public function groupSize(): int
    {
        return max(1, ((int) $this->confirmed_passes > 0) ? (int) $this->confirmed_passes : (int) $this->passes);
    }

    // Named companions (each with its own table / check-in). Not "companions": that is the free-text column
    public function members()
    {
        return $this->hasMany(GuestMember::class)->orderBy('position')->orderBy('id');
    }

    // WhatsApp conversation (see ConversationController)
    public function messages()
    {
        return $this->hasMany(GuestMessage::class);
    }

    public function activities()
    {
        return $this->hasMany(GuestActivity::class);
    }

    public function event()
    {
        return $this->belongsTo(Event::class);
    }
}
