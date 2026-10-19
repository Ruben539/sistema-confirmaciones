<?php

namespace App\Services;

use Google\Client as GoogleClient;
use Google\Service\Drive as GoogleDrive;
use Google\Service\Drive\DriveFile;
use Google\Service\Drive\Permission;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class GoogleDriveService
{
    protected ?GoogleClient $client = null;
    protected ?GoogleDrive $service = null;

    // Last error from Google (shown by `php artisan drive:test`)
    public ?string $lastError = null;

    public function __construct()
    {
        if ($this->isConfigured()) {
            $this->initClient();
        }
    }

    /**
     * Check if Google Drive credentials and folder ID are configured.
     */
    public static function isConfigured(): bool
    {
        if (!class_exists(\Google\Client::class)) {
            return false;
        }

        $folderId = config('filesystems.disks.google.folderId') ?: env('GOOGLE_DRIVE_FOLDER_ID');
        $clientId = config('filesystems.disks.google.clientId') ?: env('GOOGLE_DRIVE_CLIENT_ID');
        $refreshToken = config('filesystems.disks.google.refreshToken') ?: env('GOOGLE_DRIVE_REFRESH_TOKEN');

        if (!empty($folderId) && !empty($clientId) && !empty($refreshToken)) {
            return true;
        }

        return !empty($folderId) && !empty(self::getCredentials());
    }

    /**
     * Get credentials array from .env variables (Service Account) or physical file.
     *
     * @return array|null
     */
    public static function getCredentials(): ?array
    {
        // 1. One-line JSON in .env (GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON)
        $rawJson = env('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON');
        if (!empty($rawJson)) {
            $decoded = json_decode($rawJson, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        // 2. Base64 encoded JSON in .env
        $base64Json = env('GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64');
        if (!empty($base64Json)) {
            $decoded = json_decode(base64_decode($base64Json), true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        // 3. Individual variables: GOOGLE_DRIVE_CLIENT_EMAIL & GOOGLE_DRIVE_PRIVATE_KEY
        $clientEmail = env('GOOGLE_DRIVE_CLIENT_EMAIL');
        $privateKey = env('GOOGLE_DRIVE_PRIVATE_KEY');
        if (!empty($clientEmail) && !empty($privateKey)) {
            $formattedKey = str_replace('\n', "\n", $privateKey);
            return [
                'type' => 'service_account',
                'client_email' => $clientEmail,
                'client_id' => env('GOOGLE_DRIVE_CLIENT_ID', ''),
                'private_key' => $formattedKey,
            ];
        }

        // 4. Physical file fallback
        $credPath = self::getCredentialsPath();
        if ($credPath && file_exists($credPath)) {
            $decoded = json_decode(@file_get_contents($credPath), true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return null;
    }

    /**
     * Get path to physical credentials JSON if present.
     */
    public static function getCredentialsPath(): ?string
    {
        $customPath = env('GOOGLE_DRIVE_CREDENTIALS_PATH');
        if (!empty($customPath) && file_exists(base_path($customPath))) {
            return base_path($customPath);
        }

        if (file_exists(storage_path('app/google-drive.json'))) {
            return storage_path('app/google-drive.json');
        }

        return null;
    }

    /**
     * Initialize the authenticated Google API Client.
     */
    protected function initClient(): void
    {
        try {
            $this->client = new GoogleClient();

            $clientId = config('filesystems.disks.google.clientId') ?: env('GOOGLE_DRIVE_CLIENT_ID');
            $clientSecret = config('filesystems.disks.google.clientSecret') ?: env('GOOGLE_DRIVE_CLIENT_SECRET');
            $refreshToken = config('filesystems.disks.google.refreshToken') ?: env('GOOGLE_DRIVE_REFRESH_TOKEN');

            if (!empty($clientId) && !empty($refreshToken)) {
                // OAuth 2.0 Client credentials (clientId + clientSecret + refreshToken)
                $this->client->setClientId($clientId);
                $this->client->setClientSecret($clientSecret);

                // Reuse the access token (~1h) instead of asking Google for a new one on every request:
                // video streaming makes many small requests per dedication
                $cachedToken = Cache::get('google_drive_access_token');
                if ($cachedToken) {
                    $this->client->setAccessToken($cachedToken);
                }
                if (!$cachedToken || $this->client->isAccessTokenExpired()) {
                    $token = $this->client->refreshToken($refreshToken);
                    // Google returns the error instead of throwing (e.g. invalid_grant = token expired or revoked)
                    if (!empty($token['error'])) {
                        throw new \RuntimeException('OAuth: ' . $token['error'] . (!empty($token['error_description']) ? ' - ' . $token['error_description'] : ''));
                    }
                    Cache::put('google_drive_access_token', $token, now()->addSeconds(max(60, ((int) ($token['expires_in'] ?? 3600)) - 300)));
                }
                $this->client->addScope([
                    GoogleDrive::DRIVE,
                    GoogleDrive::DRIVE_FILE,
                ]);
            } else {
                // Service Account credentials
                $credentials = self::getCredentials();
                if (!$credentials) {
                    $this->client = null;
                    $this->service = null;
                    return;
                }

                $this->client->setAuthConfig($credentials);
                $this->client->addScope([
                    GoogleDrive::DRIVE,
                    GoogleDrive::DRIVE_FILE,
                ]);
            }

            $this->service = new GoogleDrive($this->client);
        } catch (\Throwable $e) {
            $this->lastError = 'Error initializing Google Drive client: ' . $e->getMessage();
            Log::error($this->lastError);
            $this->client = null;
            $this->service = null;
        }
    }

    /**
     * Search or create a folder in Google Drive.
     *
     * @param string $folderName
     * @param string|null $parentId Parent folder ID. Defaults to root GOOGLE_DRIVE_FOLDER_ID
     * @return string|null Folder ID
     */
    public function getOrCreateFolder(string $folderName, ?string $parentId = null): ?string
    {
        if (!$this->service) {
            $this->initClient();
            if (!$this->service) return null;
        }

        $parentId = $parentId ?: (config('filesystems.disks.google.folderId') ?: env('GOOGLE_DRIVE_FOLDER_ID'));

        try {
            // Check if folder already exists in the parent
            $escapedName = str_replace("'", "\\'", $folderName);
            $query = "mimeType = 'application/vnd.google-apps.folder' and name = '{$escapedName}' and trashed = false";
            if (!empty($parentId)) {
                $query .= " and '{$parentId}' in parents";
            }

            $response = $this->service->files->listFiles([
                'q' => $query,
                'spaces' => 'drive',
                'fields' => 'files(id, name)',
                'pageSize' => 1,
            ]);

            $files = $response->getFiles();
            if (!empty($files) && count($files) > 0) {
                return $files[0]->getId();
            }

            // Create new folder
            $folderMetadata = new DriveFile([
                'name' => $folderName,
                'mimeType' => 'application/vnd.google-apps.folder',
                'parents' => !empty($parentId) ? [$parentId] : [],
            ]);

            $createdFolder = $this->service->files->create($folderMetadata, [
                'fields' => 'id, name',
            ]);

            // The folder stays private: each file gets its own "anyone with the link" permission,
            // so a leaked folder link doesn't expose every photo/video (including rejected ones)
            return $createdFolder->getId();
        } catch (\Throwable $e) {
            Log::error('Google Drive getOrCreateFolder failed: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Get or create a dedicated folder for an event.
     * Caches the folder ID in $event->google_drive_folder_id.
     *
     * @param \App\Models\Event $event
     * @return string|null Folder ID
     */
    public function getOrCreateEventFolder(\App\Models\Event $event): ?string
    {
        if (!$this->service) {
            $this->initClient();
            if (!$this->service) return null;
        }

        // 1. Generate clean folder name using the names of the hosts / couple
        $hosts = trim($event->couple_names ?: ($event->title ?: "Evento #{$event->id}"));
        $safeHosts = preg_replace('/[\/\\\\:*?"<>|]/', '', $hosts);
        $folderName = $safeHosts ?: "Evento #{$event->id}";

        // 2. If already saved on event, verify it exists and is not trashed
        if (!empty($event->google_drive_folder_id)) {
            try {
                $existing = $this->service->files->get($event->google_drive_folder_id, ['fields' => 'id, name, trashed']);
                if ($existing && !$existing->getTrashed()) {
                    // If the hosts name changed, keep Drive folder name in sync
                    if ($existing->getName() !== $folderName) {
                        try {
                            $this->service->files->update($event->google_drive_folder_id, new DriveFile(['name' => $folderName]));
                        } catch (\Throwable $renameErr) {
                            Log::warning('Could not rename Google Drive folder: ' . $renameErr->getMessage());
                        }
                    }
                    return $event->google_drive_folder_id;
                }
            } catch (\Throwable $e) {
                Log::info("Existing folder {$event->google_drive_folder_id} for Event #{$event->id} not found, searching or re-creating.");
            }
        }

        // 3. Search or create folder in root Google Drive directory
        $rootFolderId = config('filesystems.disks.google.folderId') ?: env('GOOGLE_DRIVE_FOLDER_ID');
        $folderId = $this->getOrCreateFolder($folderName, $rootFolderId);

        if ($folderId) {
            $event->update(['google_drive_folder_id' => $folderId]);
        }

        return $folderId;
    }

    /**
     * Upload an uploaded file or file path to Google Drive.
     *
     * @param UploadedFile|string $file
     * @param string|null $customName
     * @param string|null $targetFolderId Optional folder ID. If null, uses root GOOGLE_DRIVE_FOLDER_ID
     * @param bool $public false keeps the file private (e.g. contracts): only the API can read it
     * @return array{file_id: string, direct_url: string, web_view_link: string, name: string}|null
     */
    public function uploadFile($file, ?string $customName = null, ?string $targetFolderId = null, bool $public = true): ?array
    {
        if (!$this->service) {
            $this->initClient();
            if (!$this->service) {
                $this->lastError = $this->lastError ?: 'Google Drive service is not ready.';
                Log::warning('Google Drive service is not ready. Skipping cloud upload.');
                return null;
            }
        }

        try {
            $folderId = $targetFolderId ?: (config('filesystems.disks.google.folderId') ?: env('GOOGLE_DRIVE_FOLDER_ID'));

            if ($file instanceof UploadedFile) {
                $filename = $customName ?: (time() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '', $file->getClientOriginalName()));
                $mimeType = $file->getMimeType();
                $path = $file->getRealPath();
            } else {
                $filename = $customName ?: basename($file);
                $mimeType = mime_content_type($file) ?: 'application/octet-stream';
                $path = $file;
            }

            $fileMetadata = new DriveFile([
                'name' => $filename,
                'parents' => !empty($folderId) ? [$folderId] : [],
            ]);
            $fields = 'id, name, webViewLink, webContentLink';
            $size = filesize($path);
            $chunkSize = 5 * 1024 * 1024;

            if ($size > $chunkSize) {
                // Drive only accepts 'multipart' up to 5 MB: bigger files (videos) go as a resumable upload in chunks
                $this->client->setDefer(true);
                try {
                    $request = $this->service->files->create($fileMetadata, ['fields' => $fields]);
                    $media = new \Google\Http\MediaFileUpload($this->client, $request, $mimeType, null, true, $chunkSize);
                    $media->setFileSize($size);

                    $uploadedFile = false;
                    $handle = fopen($path, 'rb');
                    while (!$uploadedFile && !feof($handle)) {
                        $uploadedFile = $media->nextChunk(fread($handle, $chunkSize));
                    }
                    fclose($handle);
                } finally {
                    $this->client->setDefer(false);
                }

                if (!$uploadedFile) {
                    throw new \RuntimeException('Resumable upload did not complete');
                }
            } else {
                $uploadedFile = $this->service->files->create($fileMetadata, [
                    'data' => file_get_contents($path),
                    'mimeType' => $mimeType,
                    'uploadType' => 'multipart',
                    'fields' => $fields,
                ]);
            }

            $fileId = $uploadedFile->getId();

            // Set public read permission so the file can be viewed publicly by guests
            if ($public) {
                try {
                    $permission = new Permission([
                        'type' => 'anyone',
                        'role' => 'reader',
                    ]);
                    $this->service->permissions->create($fileId, $permission);
                } catch (\Throwable $permError) {
                    Log::warning('Could not set public permission on Google Drive file: ' . $permError->getMessage());
                }
            }

            // Google CDN high performance direct display URL
            $directUrl = "https://lh3.googleusercontent.com/d/{$fileId}";

            return [
                'file_id' => $fileId,
                'direct_url' => $directUrl,
                'web_view_link' => $uploadedFile->getWebViewLink() ?: "https://drive.google.com/file/d/{$fileId}/view",
                'name' => $uploadedFile->getName(),
            ];
        } catch (\Throwable $e) {
            $this->lastError = 'Google Drive upload failed: ' . $e->getMessage();
            Log::error($this->lastError);
            return null;
        }
    }

    /**
     * Upload a file directly into an event's dedicated folder in Google Drive.
     *
     * @param \App\Models\Event $event
     * @param UploadedFile|string $file
     * @param string|null $customName
     * @return array{file_id: string, direct_url: string, web_view_link: string, name: string}|null
     */
    public function uploadEventFile(\App\Models\Event $event, $file, ?string $customName = null): ?array
    {
        $eventFolderId = $this->getOrCreateEventFolder($event);
        return $this->uploadFile($file, $customName, $eventFolderId);
    }

    /**
     * Extracts the Drive file ID from the URLs this service stores
     * (lh3.googleusercontent.com/d/{id}, drive.google.com/file/d/{id}/..., ...?id={id}).
     */
    public static function fileIdFromUrl(?string $url): ?string
    {
        if (empty($url)) {
            return null;
        }
        if (preg_match('~^https://(?:lh3\.googleusercontent\.com/d/|drive\.google\.com/file/d/)([A-Za-z0-9_-]{10,})~', $url, $m)) {
            return $m[1];
        }
        if (preg_match('~^https://(?:drive|docs)\.google\.com/.*[?&]id=([A-Za-z0-9_-]{10,})~', $url, $m)) {
            return $m[1];
        }
        return null;
    }

    /**
     * Streams a Drive file's content, forwarding the browser's Range header so <video>
     * can seek and play while downloading. Returns the upstream PSR-7 response (body not buffered).
     */
    public function streamFile(string $fileId, ?string $range = null): ?\Psr\Http\Message\ResponseInterface
    {
        if (!$this->service) {
            $this->initClient();
            if (!$this->service) {
                return null;
            }
        }

        try {
            $http = $this->client->authorize();
            return $http->request('GET', "https://www.googleapis.com/drive/v3/files/{$fileId}?alt=media", [
                'headers' => $range ? ['Range' => $range] : [],
                'stream' => true,
                'http_errors' => false,
            ]);
        } catch (\Throwable $e) {
            $this->lastError = 'Google Drive stream failed: ' . $e->getMessage();
            Log::error($this->lastError);
            return null;
        }
    }

    /**
     * Starts a resumable upload so the BROWSER sends the file straight to Google Drive
     * (the file never goes through PHP/nginx, so their upload size limits don't apply).
     * $origin must be the web panel's origin: Google then allows the browser's PUT (CORS).
     * Returns the upload session URL, valid for about a week.
     */
    public function createResumableUpload(string $name, string $mimeType, int $size, ?string $folderId, string $origin): ?string
    {
        if (!$this->service) {
            $this->initClient();
            if (!$this->service) {
                return null;
            }
        }

        try {
            $http = $this->client->authorize();
            $response = $http->request('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,mimeType', [
                'headers' => [
                    'Content-Type' => 'application/json; charset=UTF-8',
                    'X-Upload-Content-Type' => $mimeType,
                    'X-Upload-Content-Length' => (string) $size,
                    'Origin' => $origin,
                ],
                'body' => json_encode([
                    'name' => $name,
                    'parents' => $folderId ? [$folderId] : [],
                ]),
                'http_errors' => false,
            ]);

            if ($response->getStatusCode() !== 200 || !$response->hasHeader('Location')) {
                $this->lastError = 'Google Drive rejected the upload session: ' . $response->getStatusCode() . ' ' . $response->getBody();
                Log::error($this->lastError);
                return null;
            }

            return $response->getHeaderLine('Location');
        } catch (\Throwable $e) {
            $this->lastError = 'Google Drive upload session failed: ' . $e->getMessage();
            Log::error($this->lastError);
            return null;
        }
    }

    /**
     * Basic metadata of a Drive file (id, name, size, mimeType, parents), or null if it doesn't exist.
     */
    public function getFileMeta(string $fileId): ?array
    {
        if (!$this->service) {
            $this->initClient();
            if (!$this->service) {
                return null;
            }
        }

        try {
            $file = $this->service->files->get($fileId, ['fields' => 'id, name, size, mimeType, parents, trashed']);
            if ($file->getTrashed()) {
                return null;
            }
            return [
                'id' => $file->getId(),
                'name' => $file->getName(),
                'size' => (int) $file->getSize(),
                'mimeType' => $file->getMimeType(),
                'parents' => $file->getParents() ?? [],
            ];
        } catch (\Throwable $e) {
            $this->lastError = 'Google Drive metadata failed: ' . $e->getMessage();
            return null;
        }
    }

    /**
     * Delete a file from Google Drive by its file ID.
     */
    public function deleteFile(string $fileId): bool
    {
        if (!$this->service) {
            $this->initClient();
            if (!$this->service) return false;
        }

        try {
            $this->service->files->delete($fileId);
            return true;
        } catch (\Throwable $e) {
            Log::error('Google Drive delete failed: ' . $e->getMessage());
            return false;
        }
    }
}
