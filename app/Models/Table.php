<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Table extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_id',
        'name',
        'capacity',
        'notes',
        'pos_x',
        'pos_y',
        'shape',
        'rotation',
    ];

    protected $casts = [
        'pos_x' => 'float',
        'pos_y' => 'float',
        'rotation' => 'integer',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function guests()
    {
        return $this->hasMany(Guest::class, 'table_number', 'name')
            ->where('event_id', $this->event_id);
    }

    /**
     * Single naming rule for tables and guests' table_number:
     * "1", "01", "mesa 1", "MESA  1" => "Mesa 1". Other names are kept as typed (trimmed, single spaces).
     */
    public static function normalizeName(?string $name): ?string
    {
        $name = preg_replace('/\s+/u', ' ', trim((string) $name));
        if ($name === '') {
            return null;
        }
        if (preg_match('/^(?:mesa\s*)?0*(\d+)$/iu', $name, $m)) {
            return 'Mesa ' . ((int) $m[1]);
        }
        return $name;
    }

    /**
     * Case-insensitive comparison key for a table name.
     */
    public static function nameKey(?string $name): ?string
    {
        $normalized = self::normalizeName($name);
        return $normalized === null ? null : mb_strtolower($normalized);
    }

    public static function findByName($eventId, ?string $name): ?self
    {
        $key = self::nameKey($name);
        if ($key === null) {
            return null;
        }
        // Compared in PHP: SQL LOWER() doesn't handle accents (Ñ, É) on every database
        return self::where('event_id', $eventId)->get()->first(fn($t) => self::nameKey($t->name) === $key);
    }

    /**
     * Returns the table with that name, creating it if needed. Second value: whether it was created.
     */
    public static function ensureExists($eventId, ?string $name, int $minCapacity = 10): array
    {
        $normalized = self::normalizeName($name);
        if ($normalized === null) {
            return [null, false];
        }
        $table = self::findByName($eventId, $normalized);
        if ($table) {
            return [$table, false];
        }
        return [self::create([
            'event_id' => $eventId,
            'name' => $normalized,
            'capacity' => max(10, $minCapacity),
        ]), true];
    }
}
