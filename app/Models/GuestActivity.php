<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

/**
 * One entry of a guest's history (who did what, from where). Most entries are written automatically
 * by Guest::booted() when status / table / sending fields change; the rest via GuestActivity::record().
 */
class GuestActivity extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'guest_id', 'event_id', 'user_id', 'action', 'description', 'source', 'device', 'meta',
    ];

    protected $casts = [
        'meta' => 'array',
        'created_at' => 'datetime',
    ];

    // Channel of the current request when it can't be inferred (e.g. 'whatsapp' for the bot webhook)
    protected static ?string $source = null;

    // Extra detail for the next automatic entries of this request (e.g. ['via' => 'scan'])
    protected static array $context = [];

    public static function setSource(?string $source): void
    {
        static::$source = $source;
    }

    public static function withContext(array $context, callable $callback)
    {
        $previous = static::$context;
        static::$context = array_merge($previous, $context);
        try {
            return $callback();
        } finally {
            static::$context = $previous;
        }
    }

    public static function context(string $key, $default = null)
    {
        return static::$context[$key] ?? $default;
    }

    public static function record(Guest $guest, string $action, ?string $description = null, array $meta = []): void
    {
        try {
            $request = app()->runningInConsole() ? null : request();
            $device = $request?->header('X-Device-Name');

            static::create([
                'guest_id' => $guest->id,
                'event_id' => $guest->event_id,
                'user_id' => auth()->id(),
                'action' => $action,
                'description' => $description ? mb_substr($description, 0, 500) : null,
                'source' => static::resolveSource($device),
                'device' => $device ? mb_substr($device, 0, 120) : null,
                'meta' => $meta ?: null,
            ]);
        } catch (\Throwable $e) {
            // History must never break the action itself
            Log::warning('No se pudo registrar el movimiento del invitado: ' . $e->getMessage());
        }
    }

    protected static function resolveSource(?string $device): string
    {
        if (static::$source) return static::$source;
        if (app()->runningInConsole()) return 'sistema';
        if (auth()->check()) return $device ? 'app' : 'panel';
        return 'invitado';
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function guest()
    {
        return $this->belongsTo(Guest::class);
    }
}
