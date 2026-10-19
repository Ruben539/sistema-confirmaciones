<?php

namespace App\Models;

use App\Models\Concerns\HasContract;
use Illuminate\Database\Eloquent\Model;

/**
 * Un evento en La Casita con su presupuesto (hojas Registro y Auxiliar del Excel).
 * Totales:
 *   presupuesto = suma de las líneas
 *   abonado     = pagos (garantía, seña, pagos) − devoluciones
 *   saldo       = presupuesto − abonado
 */
class CasitaEvent extends Model
{
    use HasContract;

    protected $fillable = ['client_id', 'client_name', 'event_date', 'schedule', 'venue', 'menu', 'notes', 'planner_id', 'created_by'];

    protected $casts = [
        'event_date' => 'date:Y-m-d',
    ];

    public function items()
    {
        return $this->hasMany(CasitaEventItem::class)->orderBy('sort_order')->orderBy('id');
    }

    public function payments()
    {
        return $this->hasMany(CasitaPayment::class)->orderBy('paid_on')->orderBy('id');
    }

    public function losses()
    {
        return $this->hasMany(CasitaLoss::class)->orderBy('sort_order')->orderBy('id');
    }

    public function client()
    {
        return $this->belongsTo(CasitaClient::class, 'client_id');
    }

    public function contractType(): string
    {
        return 'casita';
    }

    public function contractLabel(): string
    {
        return $this->client_name ?: "Evento #{$this->id}";
    }

    /** Wedding planner who organizes the event (optional) */
    public function planner()
    {
        return $this->belongsTo(User::class, 'planner_id');
    }

    /** Adds budget_total, paid_total and balance to a query (no N+1 on lists). */
    public function scopeWithTotals($query)
    {
        return $query
            ->withSum('items as budget_total', 'total')
            ->withSum(['payments as paid_in' => fn ($q) => $q->where('kind', '!=', 'devolucion')], 'amount')
            ->withSum(['payments as refunded' => fn ($q) => $q->where('kind', 'devolucion')], 'amount')
            ->withSum(['payments as guarantee_paid' => fn ($q) => $q->where('kind', 'garantia')], 'amount');
    }

    /** Totals for a model loaded with scopeWithTotals() or with its relations. */
    public function totals(): array
    {
        // withSum() leaves null when there are no rows; only fall back to the relations when not preloaded
        $preloaded = array_key_exists('budget_total', $this->attributes);
        $budget = (int) ($preloaded ? $this->budget_total : $this->items->sum('total'));
        $paidIn = (int) ($preloaded ? $this->paid_in : $this->payments->where('kind', '!=', 'devolucion')->sum('amount'));
        $refunded = (int) ($preloaded ? $this->refunded : $this->payments->where('kind', 'devolucion')->sum('amount'));
        $paid = $paidIn - $refunded;

        return [
            'budget_total' => $budget,
            'paid_total' => $paid,
            'refunded_total' => $refunded,
            'balance' => $budget - $paid,
        ];
    }

    /**
     * Garantía usada en la liquidación de pérdidas: lo cobrado como garantía;
     * si no se registró el pago, la línea "Garantía" del presupuesto.
     */
    public function guaranteeAmount(): int
    {
        $paid = (int) $this->payments->where('kind', 'garantia')->sum('amount');
        if ($paid > 0) return $paid;

        return (int) $this->items->filter(fn ($i) => preg_match('/garant/iu', $i->description))->sum('total');
    }

    /** Liquidación post-evento (hoja Perdidas). Positivo = el cliente debe; negativo = se le devuelve. */
    public function settlement(): array
    {
        $losses = (int) $this->losses->where('section', 'perdida')->sum('total');
        $added = (int) $this->losses->where('section', 'agregado')->sum('total');
        $leftover = (int) $this->losses->where('section', 'sobrante')->sum('total');
        $guarantee = $this->guaranteeAmount();

        return [
            'losses_total' => $losses,
            'added_total' => $added,
            'charges_total' => $losses + $added,
            'leftover_total' => $leftover,
            'guarantee' => $guarantee,
            'credits_total' => $leftover + $guarantee,
            'result' => ($losses + $added) - ($leftover + $guarantee),
        ];
    }
}
