<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Event extends Model
{
    use HasFactory;

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
        'plan_type', // 'initial' (100), 'medium' (150), 'premium' (+150)
        'max_guests',
        'payment_status', // 'pending', 'paid'
        'rsvp_deadline_days', // Days before event date (e.g. 7)
        'auto_decline_expired', // Boolean
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'auto_decline_expired' => 'boolean',
        'max_guests' => 'integer',
        'rsvp_deadline_days' => 'integer',
    ];

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

