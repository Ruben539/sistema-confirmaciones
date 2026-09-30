<?php

namespace App\Services;

use Google\Client as GoogleClient;
use Google\Service\Drive as GoogleDrive;
use Google\Service\Drive\DriveFile;
use Google\Service\Drive\Permission;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

class GoogleDriveService
{
    protected ?GoogleClient $client = null;
    protected ?GoogleDrive $service = null;

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
                $this->client->refreshToken($refreshToken);
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
            Log::error('Error initializing Google Drive client: ' . $e->getMessage());
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

            $folderId = $createdFolder->getId();

            // Set reader permission so items inside are accessible
            try {
                $permission = new Permission([
                    'type' => 'anyone',
                    'role' => 'reader',
                ]);
                $this->service->permissions->create($folderId, $permission);
            } catch (\Throwable $permError) {
                Log::warning('Could not set public permission on Google Drive folder: ' . $permError->getMessage());
            }

            return $folderId;
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

        // 1. If already saved on event, verify it exists and is not trashed
        if (!empty($event->google_drive_folder_id)) {
            try {
                $existing = $this->service->files->get($event->google_drive_folder_id, ['fields' => 'id, trashed']);
                if ($existing && !$existing->getTrashed()) {
                    return $event->google_drive_folder_id;
                }
            } catch (\Throwable $e) {
                Log::info("Existing folder {$event->google_drive_folder_id} for Event #{$event->id} not found, searching or re-creating.");
            }
        }

        // 2. Generate a clean folder name for the event
        $eventName = trim($event->title ?: ($event->couple_names ?: 'Evento'));
        $safeName = preg_replace('/[\/\\\\:*?"<>|]/', '', $eventName);
        $folderName = "Evento #{$event->id} - {$safeName}";

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
     * @return array{file_id: string, direct_url: string, web_view_link: string, name: string}|null
     */
    public function uploadFile($file, ?string $customName = null, ?string $targetFolderId = null): ?array
    {
        if (!$this->service) {
            $this->initClient();
            if (!$this->service) {
                Log::warning('Google Drive service is not ready. Skipping cloud upload.');
                return null;
            }
        }

        try {
            $folderId = $targetFolderId ?: (config('filesystems.disks.google.folderId') ?: env('GOOGLE_DRIVE_FOLDER_ID'));

            if ($file instanceof UploadedFile) {
                $filename = $customName ?: (time() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '', $file->getClientOriginalName()));
                $mimeType = $file->getMimeType();
                $content = file_get_contents($file->getRealPath());
            } else {
                $filename = $customName ?: basename($file);
                $mimeType = mime_content_type($file) ?: 'application/octet-stream';
                $content = file_get_contents($file);
            }

            $fileMetadata = new DriveFile([
                'name' => $filename,
                'parents' => !empty($folderId) ? [$folderId] : [],
            ]);

            $uploadedFile = $this->service->files->create($fileMetadata, [
                'data' => $content,
                'mimeType' => $mimeType,
                'uploadType' => 'multipart',
                'fields' => 'id, name, webViewLink, webContentLink',
            ]);

            $fileId = $uploadedFile->getId();

            // Set public read permission so the file can be viewed publicly by guests
            try {
                $permission = new Permission([
                    'type' => 'anyone',
                    'role' => 'reader',
                ]);
                $this->service->permissions->create($fileId, $permission);
            } catch (\Throwable $permError) {
                Log::warning('Could not set public permission on Google Drive file: ' . $permError->getMessage());
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
            Log::error('Google Drive upload failed: ' . $e->getMessage());
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
