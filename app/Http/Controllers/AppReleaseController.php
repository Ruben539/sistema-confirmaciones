<?php

namespace App\Http\Controllers;

use App\Models\AppRelease;
use App\Services\GoogleDriveService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

/**
 * "Aplicación": the admin uploads the Android app (APK); planners and hostesses download it.
 *
 * Upload: the browser sends the APK straight to Google Drive through a resumable upload session
 * this controller creates, so the file never goes through PHP/nginx (no upload size limits) and
 * nothing is stored on the server. The Drive folder is private: downloads are streamed by the API
 * to logged-in users only. A version newer than the one the user downloaded / dismissed shows a
 * notice in the web panel.
 */
class AppReleaseController extends Controller
{
    private const DRIVE_FOLDER = 'Wedding Check - App';
    private const APK_MIME = 'application/vnd.android.package-archive';
    private const MAX_SIZE = 500 * 1024 * 1024;

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

    private function requireAdmin(): void
    {
        abort_unless(Auth::user()->isAdmin(), 403, 'Solo el administrador puede gestionar las versiones de la app.');
    }

    private function appFolderId(GoogleDriveService $drive): ?string
    {
        return $drive->getOrCreateFolder(self::DRIVE_FOLDER);
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

    /**
     * Step 1 (admin): returns a Google Drive upload URL; the browser PUTs the APK there directly.
     */
    public function uploadSession(Request $request)
    {
        $this->requireAdmin();

        $validated = $request->validate([
            'file_name' => ['required', 'string', 'max:200', 'regex:/\.apk$/i'],
            'file_size' => 'required|integer|min:1|max:' . self::MAX_SIZE,
        ], [
            'file_name.regex' => 'El archivo tiene que ser un .apk de Android.',
            'file_size.max' => 'El APK no puede superar los 500 MB.',
        ]);

        if (!GoogleDriveService::isConfigured()) {
            return response()->json(['message' => 'Google Drive no está configurado en el servidor (php artisan drive:test).'], 503);
        }

        $drive = new GoogleDriveService();
        $folderId = $this->appFolderId($drive);
        // Google only lets the browser upload from the origin given when the session is created
        $origin = $request->header('Origin') ?: rtrim(config('app.url'), '/');
        $name = 'WeddingCheck-' . now()->format('Ymd-His') . '.apk';

        $uploadUrl = $folderId
            ? $drive->createResumableUpload($name, self::APK_MIME, (int) $validated['file_size'], $folderId, $origin)
            : null;

        if (!$uploadUrl) {
            return response()->json(['message' => 'No se pudo iniciar la subida a Google Drive. ' . ($drive->lastError ?? '')], 502);
        }

        return response()->json(['upload_url' => $uploadUrl]);
    }

    /**
     * Step 2 (admin): once the browser finished uploading, register the version.
     * The file is checked in Drive: our app folder, .apk name and a real APK (ZIP "PK" signature).
     */
    public function store(Request $request)
    {
        $this->requireAdmin();

        $validated = $request->validate([
            'drive_file_id' => 'required|string|max:100',
            'version' => 'required|string|max:30',
            'notes' => 'nullable|string|max:2000',
        ]);

        $drive = new GoogleDriveService();
        $meta = $drive->getFileMeta($validated['drive_file_id']);
        $folderId = $this->appFolderId($drive);

        if (!$meta || !$folderId || !in_array($folderId, $meta['parents'], true)) {
            return response()->json(['message' => 'No se encontró el archivo subido en la carpeta de la app en Google Drive.'], 422);
        }

        $signature = '';
        $head = $drive->streamFile($meta['id'], 'bytes=0-1');
        if ($head && $head->getStatusCode() < 400) {
            $signature = $head->getBody()->read(2);
        }
        if (!preg_match('/\.apk$/i', $meta['name']) || $meta['size'] <= 0 || $signature !== 'PK') {
            $drive->deleteFile($meta['id']);
            return response()->json(['message' => 'El archivo no es un APK válido de Android.'], 422);
        }

        $release = AppRelease::create([
            'version' => $validated['version'],
            'notes' => $validated['notes'] ?? null,
            'drive_file_id' => $meta['id'],
            'original_name' => $meta['name'],
            'file_size' => $meta['size'],
            'uploaded_by' => Auth::id(),
        ]);

        return response()->json([
            'message' => "Versión {$release->version} publicada. Las planners y anfitrionas verán el aviso de actualización.",
            'release' => $this->present($release->load('uploader:id,name')),
        ], 201);
    }

    public function download(Request $request, $id)
    {
        $release = AppRelease::findOrFail($id);
        $fileName = 'WeddingCheck-' . preg_replace('/[^\w.-]/', '_', $release->version) . '.apk';

        // Downloading the current version (or a newer one) clears the update notice
        $user = Auth::user();
        if ((int) $user->seen_app_release_id < $release->id) {
            $user->forceFill(['seen_app_release_id' => $release->id])->save();
        }

        // Releases uploaded before the Drive storage (kept on the server)
        if (!$release->drive_file_id) {
            abort_unless($release->file_path && Storage::disk('local')->exists($release->file_path), 404, 'El archivo de esta versión ya no está disponible.');
            $release->increment('downloads');
            return Storage::disk('local')->download($release->file_path, $fileName, ['Content-Type' => self::APK_MIME]);
        }

        $upstream = (new GoogleDriveService())->streamFile($release->drive_file_id, $request->header('Range'));
        abort_if(!$upstream || $upstream->getStatusCode() >= 400, 502, 'No se pudo obtener el APK desde Google Drive.');

        // Count once per download, not per resumed chunk
        if (!$request->header('Range') || str_starts_with($request->header('Range'), 'bytes=0-')) {
            $release->increment('downloads');
        }

        $headers = [
            'Content-Type' => self::APK_MIME,
            'Content-Disposition' => 'attachment; filename="' . $fileName . '"',
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'private, no-store',
        ];
        foreach (['Content-Length', 'Content-Range'] as $header) {
            if ($upstream->hasHeader($header)) {
                $headers[$header] = $upstream->getHeaderLine($header);
            }
        }

        $body = $upstream->getBody();
        return response()->stream(function () use ($body) {
            @set_time_limit(0); // large file on a slow phone connection
            while (!$body->eof()) {
                echo $body->read(512 * 1024);
                flush();
            }
        }, $upstream->getStatusCode(), $headers);
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
        $this->requireAdmin();

        $release = AppRelease::findOrFail($id);
        if ($release->drive_file_id) {
            (new GoogleDriveService())->deleteFile($release->drive_file_id);
        } elseif ($release->file_path) {
            Storage::disk('local')->delete($release->file_path);
        }
        $release->delete();

        return response()->json(['message' => "Versión {$release->version} eliminada."]);
    }
}
