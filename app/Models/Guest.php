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
        'passes',
        'confirmed_passes',
        'adults',
        'youth',
        'children',
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
        'attended_at',
        'token',
    ];

    protected $casts = [
        'attended_at' => 'datetime',
        'last_sent_at' => 'datetime',
        'reminder_sent_at' => 'datetime',
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
        });
    }

    public function event()
    {
        return $this->belongsTo(Event::class);
    }
}
