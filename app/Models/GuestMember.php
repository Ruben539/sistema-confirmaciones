<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A named companion of an invitation (see the guest_members migration).
 */
class GuestMember extends Model
{
    public const CATEGORIES = ['adult', 'youth', 'child'];

    protected $fillable = ['guest_id', 'event_id', 'name', 'category', 'table_number', 'attended_at', 'position'];

    protected $casts = [
        'attended_at' => 'datetime',
    ];

    public function guest()
    {
        return $this->belongsTo(Guest::class);
    }

    /**
     * Names written in one cell ("Ana, Carlos y Sofía (hija, 4 años)") as separate people. Commas inside
     * parentheses don't split, and the age in parentheses gives the category (up to 12 child, 13-17 youth).
     */
    public static function parseNames(?string $text): array
    {
        $text = trim((string) $text);
        if ($text === '') {
            return [];
        }

        $parts = [];
        $current = '';
        $depth = 0;
        $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
        for ($i = 0; $i < count($chars); $i++) {
            $ch = $chars[$i];
            if ($ch === '(') $depth++;
            if ($ch === ')') $depth = max(0, $depth - 1);
            if ($depth === 0 && in_array($ch, [',', ';', "\n", '/', '+'], true)) {
                $parts[] = $current;
                $current = '';
                continue;
            }
            $current .= $ch;
        }
        $parts[] = $current;

        // "Ana y Carlos": " y " / " e " also separate names (outside parentheses)
        $people = [];
        foreach ($parts as $part) {
            foreach (preg_split('/\s+(?:y|e)\s+(?![^()]*\))/iu', $part) as $piece) {
                $name = trim($piece, " \t.-");
                if ($name !== '') {
                    $people[] = ['name' => mb_substr($name, 0, 120), 'category' => self::categoryFromText($name)];
                }
            }
        }

        return $people;
    }

    private static function categoryFromText(string $name): string
    {
        if (preg_match('/(\d{1,2})\s*(a[nñ]os|años|meses)/iu', $name, $m)) {
            if (str_starts_with(mb_strtolower($m[2]), 'mes')) {
                return 'child';
            }
            $age = (int) $m[1];
            return $age <= 12 ? 'child' : ($age <= 17 ? 'youth' : 'adult');
        }
        if (preg_match('/\b(beb[eé]|ni[nñ]o|ni[nñ]a|hij[oa] menor)\b/iu', $name)) {
            return 'child';
        }
        return 'adult';
    }
}
