<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CasitaEventItem extends Model
{
    protected $fillable = ['casita_event_id', 'description', 'unit_price', 'quantity', 'total', 'note', 'sort_order'];

    protected $casts = [
        'unit_price' => 'integer',
        'quantity' => 'integer',
        'total' => 'integer',
    ];

    protected static function booted(): void
    {
        // Total is always price × quantity (the Excel had no calculation errors; keep it that way)
        static::saving(fn ($item) => $item->total = (int) $item->unit_price * (int) $item->quantity);
    }
}
