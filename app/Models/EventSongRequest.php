<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EventSongRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_id',
        'guest_id',
        'requester_name',
        'song_title',
        'artist',
        'spotify_id',
        'spotify_uri',
        'image_url',
        'external_url',
        'note',
        'is_played',
    ];

    protected $casts = [
        'is_played' => 'boolean',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function guest()
    {
        return $this->belongsTo(Guest::class);
    }
}
