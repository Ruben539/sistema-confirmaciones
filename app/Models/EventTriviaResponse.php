<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EventTriviaResponse extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_id',
        'guest_id',
        'participant_name',
        'score',
        'total_questions',
        'time_taken_seconds',
        'answers',
    ];

    protected $casts = [
        'answers' => 'array',
        'score' => 'integer',
        'total_questions' => 'integer',
        'time_taken_seconds' => 'integer',
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
