<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use App\Services\GoogleDriveService;

class EventDedication extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_id',
        'guest_id',
        'author_name',
        'type', // 'photo', 'video', 'text'
        'media_path',
        'message',
        'is_approved',
    ];

    protected $casts = [
        'is_approved' => 'boolean',
    ];

    protected $appends = ['media_url'];

    public function getMediaUrlAttribute(): ?string
    {
        if (!$this->media_path) {
            return null;
        }

        // Videos in Drive are streamed through our server (the lh3 link only serves images).
        // Signed URL: dedication ids are sequential, so the link can't be guessed for other dedications.
        if ($this->type === 'video' && GoogleDriveService::fileIdFromUrl($this->media_path)) {
            return URL::signedRoute('dedications.media', ['dedication' => $this->id], null, false);
        }

        // If it is already a full URL
        if (str_starts_with($this->media_path, 'http://') || str_starts_with($this->media_path, 'https://')) {
            return $this->media_path;
        }

        return Storage::disk('public')->url($this->media_path);
    }

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function guest()
    {
        return $this->belongsTo(Guest::class);
    }
}
