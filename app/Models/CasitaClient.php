<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class CasitaClient extends Model
{
    protected $fillable = ['name', 'normalized_name', 'phone', 'email', 'document', 'notes'];

    public function events()
    {
        return $this->hasMany(CasitaEvent::class, 'client_id')->orderByDesc('event_date');
    }

    public static function cleanName(string $name): string
    {
        return trim(preg_replace('/\s+/u', ' ', $name));
    }

    /** "María  y Juan" → "maria y juan" */
    public static function normalize(string $name): string
    {
        return Str::lower(Str::ascii(self::cleanName($name)));
    }

    /** Client with this name (ignoring accents, case and extra spaces), created if new. */
    public static function resolve(string $name): self
    {
        $clean = self::cleanName($name);

        return self::firstOrCreate(['normalized_name' => self::normalize($clean)], ['name' => $clean]);
    }
}
