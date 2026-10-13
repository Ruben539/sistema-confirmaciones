<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'username',
        'email',
        'phone',
        'password',
        'role', // 'admin', 'planner', 'hostess'
        'planner_id', // hostess only: planner who created her
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function events()
    {
        return $this->hasMany(Event::class);
    }

    public function planRequests()
    {
        return $this->hasMany(PlanRequest::class);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isPlanner(): bool
    {
        return $this->role === 'planner';
    }

    public function isHostess(): bool
    {
        return $this->role === 'hostess';
    }

    // Hostess: the planner she works for
    public function planner()
    {
        return $this->belongsTo(User::class, 'planner_id');
    }

    // Planner: the hostesses she created
    public function hostesses()
    {
        return $this->hasMany(User::class, 'planner_id')->where('role', 'hostess');
    }

    // Hostess: events she was assigned to
    public function hostessEvents()
    {
        return $this->belongsToMany(Event::class, 'event_hostess', 'user_id', 'event_id')->withTimestamps();
    }

    /**
     * Single rule for "can this user work on this event": admin all, planner her own events,
     * hostess only the events assigned to her. Unknown roles get nothing.
     */
    public function canAccessEvent(Event $event): bool
    {
        if ($this->is_active === false) return false;
        if ($this->isAdmin()) return true;
        if ($this->isPlanner()) return (int) $event->user_id === (int) $this->id;
        if ($this->isHostess()) return $this->hostessEvents()->whereKey($event->id)->exists();
        return false;
    }
}

