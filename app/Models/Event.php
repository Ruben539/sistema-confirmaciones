<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Event extends Model
{
    use HasFactory;

    /**
     * Guest capacity per plan. 'custom' has no fixed cap: max_guests is set by hand.
     */
    public const PLANS = [
        // digital_invitation: el plan incluye la Invitación Digital. Hoy ninguno la incluye: siempre se
        // solicita y el admin la habilita por evento (digital_invitation_addon)
        'initial' => ['label' => 'Plan Inicial', 'max_guests' => 100, 'digital_invitation' => false],
        'medium' => ['label' => 'Plan Medio', 'max_guests' => 150, 'digital_invitation' => false],
        'pro' => ['label' => 'Plan Pro', 'max_guests' => 180, 'digital_invitation' => false],
        'premium' => ['label' => 'Plan Premium', 'max_guests' => 300, 'digital_invitation' => false],
        'custom' => ['label' => 'Personalizado', 'max_guests' => null, 'digital_invitation' => false],
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

    public static function planIncludesDigitalInvitation(?string $plan): bool
    {
        return (bool) (self::PLANS[$plan ?? 'initial']['digital_invitation'] ?? false);
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
        'digital_invitation_addon', // Boolean: Invitación Digital contratada como adicional
        'rsvp_deadline_days', // Days before event date (e.g. 7)
        'rsvp_deadline_date', // Fixed RSVP deadline date; overrides rsvp_deadline_days when set
        'reminder_interval_days', // null = single reminder the day before the deadline, 0 = none, N = every N days
        'reminder_max_count', // Max reminders per guest when reminder_interval_days > 0
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
        'dedications_require_approval', // Boolean: new dedications wait for approval before reaching the big screen
        'invitation_styles', // JSON: { preset, mode, primary_color, secondary_color, font_family, background_type, background_value, ... }
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'dedications_require_approval' => 'boolean',
        'digital_invitation_addon' => 'boolean',
        'auto_decline_expired' => 'boolean',
        'max_guests' => 'integer',
        'rsvp_deadline_days' => 'integer',
        'rsvp_deadline_date' => 'date:Y-m-d',
        'reminder_interval_days' => 'integer',
        'reminder_max_count' => 'integer',
        'milestones_notified' => 'array',
        'timing' => 'array',
        'venue_layout' => 'array',
        'gift_settings' => 'array',
        'features_enabled' => 'array',
        'invitation_styles' => 'array',
    ];

    protected $appends = ['is_active', 'has_digital_invitation', 'rsvp_deadline_effective', 'cover_photo_url', 'background_music_url', 'google_drive_folder_url'];

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

        if (str_starts_with($this->background_music_path, '/')) {
            return url($this->background_music_path);
        }

        return \Illuminate\Support\Facades\Storage::disk('public')->url($this->background_music_path);
    }

    /**
     * Fin del plazo para confirmar asistencia: la fecha fija si se configuró,
     * si no la fecha del evento menos rsvp_deadline_days. Null si no hay fechas.
     */
    public function rsvpDeadline(): ?\Carbon\Carbon
    {
        if ($this->rsvp_deadline_date) {
            return \Carbon\Carbon::parse($this->rsvp_deadline_date)->endOfDay();
        }

        if ($this->event_date) {
            return \Carbon\Carbon::parse($this->event_date)->subDays($this->rsvp_deadline_days ?? 7)->endOfDay();
        }

        return null;
    }

    protected static function booted()
    {
        static::creating(function ($event) {
            if (empty($event->public_code)) {
                $event->public_code = Str::random(12);
            }
        });
    }

    public static function findByPublicCodeOrFail(string $code): self
    {
        return self::where('public_code', $code)->firstOrFail();
    }

    /**
     * Datos del evento que pueden ver los invitados en las páginas públicas (sin login).
     * Nunca incluye datos internos: plan, pago, planner, plantilla de mensajes, ids, etc.
     */
    public function toPublicArray(): array
    {
        return $this->only([
            'public_code', 'title', 'couple_names', 'event_type', 'event_date', 'location',
            'cover_photo_url', 'background_music_url', 'spotify_url', 'gift_settings',
            'dress_code', 'dress_code_notes', 'welcome_message', 'features_enabled', 'invitation_styles',
        ]);
    }

    // Fields that only exist for the Digital Invitation module
    public const DIGITAL_INVITATION_FIELDS = [
        'spotify_url', 'background_music_path', 'gift_settings', 'dress_code', 'dress_code_notes',
        'welcome_message', 'features_enabled', 'invitation_styles', 'dedications_require_approval',
    ];

    public function hasDigitalInvitation(): bool
    {
        return (bool) $this->digital_invitation_addon || self::planIncludesDigitalInvitation($this->plan_type);
    }

    // Effective RSVP deadline (aaaa-mm-dd) for clients: fixed date or event date minus the configured days
    public function getRsvpDeadlineEffectiveAttribute(): ?string
    {
        return $this->rsvpDeadline()?->toDateString();
    }

    public function getHasDigitalInvitationAttribute(): bool
    {
        return $this->hasDigitalInvitation();
    }

    public function ensureDigitalInvitation(): void
    {
        // The admin always has the full suite (e.g. to prepare the invitation before the client pays
        // for it); planners and guests only get it once the add-on is enabled for the event
        if (auth()->user()?->isAdmin()) {
            return;
        }

        abort_unless(
            $this->hasDigitalInvitation(),
            403,
            'La Invitación Digital no está habilitada para este evento. Podés solicitarla desde la sección Invitación Digital.'
        );
    }

    /**
     * Quita (sin guardar) los datos de la Invitación Digital para mostrar al invitado
     * solo la página básica de confirmación.
     */
    public function withoutDigitalInvitation(): self
    {
        foreach (self::DIGITAL_INVITATION_FIELDS as $field) {
            $this->setAttribute($field, null);
        }
        $this->setAttribute('features_enabled', [
            'spotify' => false,
            'gifts' => false,
            'music_suggestions' => false,
            'countdown' => false,
            'guest_dedications' => false,
            'dress_code' => false,
            'background_music' => false,
        ]);
        return $this;
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

    // Hostesses (anfitrionas) assigned to work this event
    public function hostesses()
    {
        return $this->belongsToMany(User::class, 'event_hostess', 'event_id', 'user_id')->withTimestamps();
    }

    public function planRequests()
    {
        return $this->hasMany(PlanRequest::class);
    }

    public function pendingPlanRequest()
    {
        return $this->hasOne(PlanRequest::class)
            ->where('status', 'pending')
            ->where('type', PlanRequest::TYPE_PLAN)
            ->latestOfMany();
    }

    public function dedications()
    {
        return $this->hasMany(EventDedication::class)->latest();
    }
}

