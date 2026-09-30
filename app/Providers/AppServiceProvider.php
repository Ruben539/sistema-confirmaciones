<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\Filesystem;
use Masbug\Flysystem\GoogleDriveAdapter;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        try {
            if (class_exists(\Google\Client::class) && class_exists(GoogleDriveAdapter::class)) {
                Storage::extend('google', function ($app, $config) {
                    $client = new \Google\Client();
                    $client->setClientId($config['clientId'] ?? env('GOOGLE_DRIVE_CLIENT_ID'));
                    $client->setClientSecret($config['clientSecret'] ?? env('GOOGLE_DRIVE_CLIENT_SECRET'));
                    $client->refreshToken($config['refreshToken'] ?? env('GOOGLE_DRIVE_REFRESH_TOKEN'));
                    $client->addScope([\Google\Service\Drive::DRIVE, \Google\Service\Drive::DRIVE_FILE]);

                    $service = new \Google\Service\Drive($client);
                    $folderId = $config['folderId'] ?? env('GOOGLE_DRIVE_FOLDER_ID', '/');
                    $adapter = new GoogleDriveAdapter($service, $folderId);
                    $driver = new Filesystem($adapter);

                    return new \Illuminate\Filesystem\FilesystemAdapter($driver, $adapter);
                });
            }
        } catch (\Throwable $e) {
            // Safe fallback
        }
    }
}
