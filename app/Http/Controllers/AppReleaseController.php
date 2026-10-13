<?php

namespace App\Http\Controllers;

use App\Models\AppRelease;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

/**
 * "Aplicación": the admin uploads the Android app (APK); planners and hostesses download it.
 * A newer version than the one the user downloaded / dismissed shows a notice in the web panel.
 */
class AppReleaseController extends Controller
{
    private const DISK = 'local'; // storage/app/private: not reachable by URL, only through download()

    private function present(AppRelease $release): array
    {
        return [
            'id' => $release->id,
            'version' => $release->version,
            'notes' => $release->notes,
            'original_name' => $release->original_name,
            'file_size' => $release->file_size,
            'downloads' => $release->downloads,
            'created_at' => $release->created_at,
            'uploaded_by' => $release->uploader?->name,
            'download_url' => "/api/app-releases/{$release->id}/download",
        ];
    }

    public function index()
    {
        $user = Auth::user();
        $releases = AppRelease::with('uploader:id,name')->orderByDesc('id')->get();
        $latest = $releases->first();

        return response()->json([
            'latest' => $latest ? $this->present($latest) : null,
            // Admin sees the full history; the rest only need the current version
            'releases' => $user->isAdmin() ? $releases->map(fn ($r) => $this->present($r))->values() : [],
            'has_update' => $latest && !$user->isAdmin() && (int) $user->seen_app_release_id < $latest->id,
        ]);
    }

    public function store(Request $request)
    {
        abort_unless(Auth::user()->isAdmin(), 403, 'Solo el administrador puede subir versiones de la app.');

        $validated = $request->validate([
            'apk' => 'required|file|max:204800', // 200 MB
            'version' => 'required|string|max:30',
            'notes' => 'nullable|string|max:2000',
        ]);

        $file = $request->file('apk');
        // An APK is a ZIP: check the extension and the "PK" signature, not just the browser's mime type
        $handle = fopen($file->getRealPath(), 'rb');
        $signature = fread($handle, 2);
        fclose($handle);
        if (strtolower($file->getClientOriginalExtension()) !== 'apk' || $signature !== 'PK') {
            return response()->json(['message' => 'El archivo no es un APK válido de Android.'], 422);
        }

        $path = $file->storeAs('app-releases', 'wedding-check-' . preg_replace('/[^\w.-]/', '_', $validated['version']) . '-' . time() . '.apk', self::DISK);

        $release = AppRelease::create([
            'version' => $validated['version'],
            'notes' => $validated['notes'] ?? null,
            'file_path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'uploaded_by' => Auth::id(),
        ]);

        return response()->json([
            'message' => "Versión {$release->version} publicada. Las planners y anfitrionas verán el aviso de actualización.",
            'release' => $this->present($release->load('uploader:id,name')),
        ], 201);
    }

    public function download($id)
    {
        $release = AppRelease::findOrFail($id);
        abort_unless(Storage::disk(self::DISK)->exists($release->file_path), 404, 'El archivo de esta versión ya no está disponible.');

        $release->increment('downloads');

        // Downloading the current version (or a newer one) clears the update notice
        $user = Auth::user();
        if ((int) $user->seen_app_release_id < $release->id) {
            $user->forceFill(['seen_app_release_id' => $release->id])->save();
        }

        $name = 'WeddingCheck-' . preg_replace('/[^\w.-]/', '_', $release->version) . '.apk';

        return Storage::disk(self::DISK)->download($release->file_path, $name, [
            'Content-Type' => 'application/vnd.android.package-archive',
        ]);
    }

    // "Cerrar" on the notice: don't show it again for the current version
    public function markSeen()
    {
        $latest = AppRelease::current();
        $user = Auth::user();
        if ($latest && (int) $user->seen_app_release_id < $latest->id) {
            $user->forceFill(['seen_app_release_id' => $latest->id])->save();
        }

        return response()->json(['has_update' => false]);
    }

    public function destroy($id)
    {
        abort_unless(Auth::user()->isAdmin(), 403, 'Solo el administrador puede borrar versiones de la app.');

        $release = AppRelease::findOrFail($id);
        Storage::disk(self::DISK)->delete($release->file_path);
        $release->delete();

        return response()->json(['message' => "Versión {$release->version} eliminada."]);
    }
}
