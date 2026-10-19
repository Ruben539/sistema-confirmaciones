<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Línea de la liquidación post-evento: pérdida, bebida agregada o bebida sobrante. */
class CasitaLoss extends Model
{
    public const SECTIONS = ['perdida', 'agregado', 'sobrante'];

    protected $fillable = ['casita_event_id', 'section', 'description', 'quantity', 'unit_price', 'total', 'sort_order'];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'integer',
        'total' => 'integer',
    ];

    protected static function booted(): void
    {
        static::saving(fn ($line) => $line->total = (int) $line->unit_price * (int) $line->quantity);
    }
}
