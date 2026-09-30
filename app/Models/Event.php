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
        'spotify_url',
        'gift_settings', // JSON: bank_name, account_holder, cbu, cvu, alias, notes, external_registry_url, custom_gifts
        'dress_code', // e.g. 'formal', 'elegante_sport', 'black_tie', 'casual', 'playa'
        'dress_code_notes',
        'cover_photo_path',
        'welcome_message',
        'background_music_path',
        'google_drive_folder_id',
        'features_enabled', // JSON: { spotify, gifts, music_suggestions, countdown, guest_dedications, dress_code }
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'auto_decline_expired' => 'boolean',
        'max_guests' => 'integer',
        'rsvp_deadline_days' => 'integer',
        'milestones_notified' => 'array',
        'timing' => 'array',
        'venue_layout' => 'array',
        'gift_settings' => 'array',
        'features_enabled' => 'array',
    ];

    protected $appends = ['is_active', 'cover_photo_url', 'background_music_url', 'google_drive_folder_url'];

    public function getGoogleDriveFolderUrlAttribute(): ?string
    {
        if (empty($this->google_drive_folder_id)) {
            return null;
        }
        return "https://drive.google.com/drive/folders/{$this->google_drive_folder_id}";
    }

    public function getCoverPhotoUrlAttribute(): ?string
    {
        if (!$this->cover_photo_path) {
            return null;
        }

        if (str_starts_with($this->cover_photo_path, 'http://') || str_starts_with($this->cover_photo_path, 'https://')) {
            return $this->cover_photo_path;
        }

        return \Illuminate\Support\Facades\Storage::disk('public')->url($this->cover_photo_path);
    }

    public function getBackgroundMusicUrlAttribute(): ?string
    {
        if (!$this->background_music_path) {
            return null;
        }

        if (str_starts_with($this->background_music_path, 'http://') || str_starts_with($this->background_music_path, 'https://')) {
            return $this->background_music_path;
        }

        return \Illuminate\Support\Facades\Storage::disk('public')->url($this->background_music_path);
    }

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

    public function dedications()
    {
        return $this->hasMany(EventDedication::class)->latest();
    }
}

