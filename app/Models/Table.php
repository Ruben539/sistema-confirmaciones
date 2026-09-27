<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Table extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_id',
        'name',
        'capacity',
        'notes',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function guests()
    {
        return $this->hasMany(Guest::class, 'table_number', 'name')
            ->where('event_id', $this->event_id);
    }
}
