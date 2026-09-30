<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Event extends Model
{
    use HasFactory;

    /**
     * Guest capacity per plan. 'custom' has no fixed cap: max_guests is set by hand.
     */
    public const PLANS = [
        'initial' => ['label' => 'Plan Inicial', 'max_guests' => 100],
        'medium' => ['label' => 'Plan Medio', 'max_guests' => 150],
        'pro' => ['label' => 'Plan Pro', 'max_guests' => 180],
        'premium' => ['label' => 'Plan Premium', 'max_guests' => 300],
        'custom' => ['label' => 'Personalizado', 'max_guests' => null],
    ];

    public static function planKeys(): string
    {
        return implode(',', array_keys(self::PLANS));
    }

    public static function planMaxGuests(?string $plan): ?int
    {
        $plan = array_key_exists($plan ?? '', self::PLANS) ? $plan : 'initial';
        return self::PLANS[$plan]['max_guests'];
    }

    public static function planLabel(?string $plan, ?int $maxGuests = null): string
    {
        $label = self::PLANS[$plan ?? 'initial']['label'] ?? ($plan ?? 'Plan Inicial');
        $max = $maxGuests ?? self::planMaxGuests($plan);
        return $max ? "{$label} ({$max} invitados)" : $label;
    }

    public const EVENT_TYPES = [
        'boda' => '💍 Boda / Casamiento',
        'xv_anos' => '👑 15 Años / Fiesta de XV',
        'cumpleanos' => '🎂 Cumpleaños',
        'aniversario' => '❤️ Aniversario',
        'corporativo' => '🏢 Evento Corporativo',
        'graduacion' => '🎓 Graduación / Colación',
        'baby_shower' => '🎈 Baby Shower / Fiesta',
        'otro' => '🎉 Otro Evento Especial',
    ];

    protected $fillable = [
        'user_id',
        'title',
        'event_type',
        'couple_names',
        'event_date',
        'location',
        'message_template',
        'status',
        'is_enabled',
        'plan_type', // see Event::PLANS
        'max_guests',
        'payment_status', // 'pending', 'paid'
        'rsvp_deadline_days', // Days before event date (e.g. 7)
        'auto_decline_expired', // Boolean
        'milestones_notified', // JSON Array: [25, 50, 75, 90, 100]
        'timing', // JSON Array of timeline items [{time, title, description, completed}]
        'venue_layout', // JSON list of venue elements on the seating plan (stage, dance floor, bar, buffet...)
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'auto_decline_expired' => 'boolean',
        'max_guests' => 'integer',
        'rsvp_deadline_days' => 'integer',
        'milestones_notified' => 'array',
        'timing' => 'array',
        'venue_layout' => 'array',
    ];

    protected $appends = ['is_active'];

    public function getIsActiveAttribute(): bool
    {
        return $this->isActive();
    }

    public function isActive(): bool
    {
        if (!$this->is_enabled) {
            return false;
        }

        if ($this->status && $this->status !== 'active') {
            return false;
        }

        if ($this->event_date && \Carbon\Carbon::parse($this->event_date)->endOfDay()->isPast()) {
            return false;
        }

        return true;
    }

    public function planner()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function guests()
    {
        return $this->hasMany(Guest::class);
    }

    public function planRequests()
    {
        return $this->hasMany(PlanRequest::class);
    }

    public function pendingPlanRequest()
    {
        return $this->hasOne(PlanRequest::class)->where('status', 'pending')->latestOfMany();
    }
}

