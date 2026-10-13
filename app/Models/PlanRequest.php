<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlanRequest extends Model
{
    use HasFactory;

    public const TYPE_PLAN = 'plan';
    public const TYPE_DIGITAL_INVITATION = 'digital_invitation';

    protected $fillable = [
        'event_id',
        'type',
        'user_id',
        'current_plan',
        'requested_plan',
        'requested_guests',
        'notes',
        'status',
        'admin_notes',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'requested_guests' => 'integer',
        'reviewed_at' => 'datetime',
    ];

    public function isDigitalInvitation(): bool
    {
        return $this->type === self::TYPE_DIGITAL_INVITATION;
    }

    // Short description for WhatsApp messages and the admin panel
    public function summary(): string
    {
        if ($this->isDigitalInvitation()) {
            return 'Invitación Digital';
        }
        $label = Event::PLANS[$this->requested_plan]['label'] ?? $this->requested_plan;
        return "{$label} ({$this->requested_guests} invitados)";
    }

    /**
     * Applies an approved request to its event: enables the Digital Invitation add-on,
     * or changes the plan and its guest capacity.
     */
    public function applyToEvent(): void
    {
        if ($this->isDigitalInvitation()) {
            $this->event->update(['digital_invitation_addon' => true]);
            return;
        }

        $this->event->update([
            'plan_type' => $this->requested_plan,
            'max_guests' => $this->requested_guests,
        ]);
    }

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function planner()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
