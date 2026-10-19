<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Lista de precios de La Casita (hoja bdLista del Excel). */
class CasitaCatalogItem extends Model
{
    protected $fillable = ['name', 'price', 'category', 'is_active', 'sort_order'];

    protected $casts = [
        'price' => 'integer',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];
}
