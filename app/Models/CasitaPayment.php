<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CasitaPayment extends Model
{
    public const KINDS = ['garantia', 'sena', 'pago', 'devolucion'];

    protected $fillable = ['casita_event_id', 'paid_on', 'kind', 'amount', 'note'];

    protected $casts = [
        'paid_on' => 'date:Y-m-d',
        'amount' => 'integer',
    ];

    public function casitaEvent()
    {
        return $this->belongsTo(CasitaEvent::class);
    }
}
