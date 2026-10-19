<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Editable suggestion of La Casita: a menu ('menu') or a usual loss ('perdida'). */
class CasitaOption extends Model
{
    public const TYPES = ['menu', 'perdida'];

    protected $fillable = ['type', 'name', 'sort_order'];

    protected $casts = ['sort_order' => 'integer'];
}
