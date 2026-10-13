<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AppRelease extends Model
{
    protected $fillable = [
        'version', 'notes', 'file_path', 'original_name', 'file_size', 'uploaded_by', 'downloads',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'downloads' => 'integer',
    ];

    // file_path is internal (private disk): never sent to the browser
    protected $hidden = ['file_path'];

    // Newest uploaded version (the one planners and hostesses should install)
    public static function current(): ?self
    {
        return static::orderByDesc('id')->first();
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
