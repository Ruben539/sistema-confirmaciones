<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AppRelease extends Model
{
    protected $fillable = [
        'version', 'notes', 'drive_file_id', 'file_path', 'original_name', 'file_size', 'uploaded_by', 'downloads',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'downloads' => 'integer',
    ];

    // Internal storage references: never sent to the browser (downloads go through the API)
    protected $hidden = ['file_path', 'drive_file_id'];

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
