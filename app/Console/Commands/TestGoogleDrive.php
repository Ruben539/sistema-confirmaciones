<?php

namespace App\Console\Commands;

use App\Services\GoogleDriveService;
use Illuminate\Console\Command;

class TestGoogleDrive extends Command
{
    protected $signature = 'drive:test';
    protected $description = 'Verifica la conexión y configuración con Google Drive';

    public function handle(): int
    {
        $this->info('🔍 Verificando configuración de Google Drive...');

        $folderId = config('filesystems.disks.google.folderId') ?: env('GOOGLE_DRIVE_FOLDER_ID');
        $clientId = config('filesystems.disks.google.clientId') ?: env('GOOGLE_DRIVE_CLIENT_ID');
        $refreshToken = config('filesystems.disks.google.refreshToken') ?: env('GOOGLE_DRIVE_REFRESH_TOKEN');
        $credentials = GoogleDriveService::getCredentials();

        if (!empty($clientId) && !empty($refreshToken)) {
            $this->info('  ✅ Credenciales OAuth 2.0 cargadas desde .env:');
            $this->line("     • Client ID: {$clientId}");
            $this->line("     • Refresh Token: " . substr($refreshToken, 0, 15) . "...");
        } elseif ($credentials) {
            $this->info('  ✅ Credenciales cargadas con éxito.');
            if (isset($credentials['client_email'])) {
                $this->info("  📋 Cuenta de Servicio: {$credentials['client_email']}");
            }
        } else {
            $this->error('  ❌ No se encontraron credenciales en .env ni en archivo.');
            $this->line('     Configurá GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET y GOOGLE_DRIVE_REFRESH_TOKEN en tu .env');
        }

        $this->line("• Folder ID configurado: " . ($folderId ?: '(no configurado en .env)'));
        if (!$folderId) {
            $this->warn('  ⚠️ Agregá GOOGLE_DRIVE_FOLDER_ID=tu_id en tu archivo .env');
        }

        if (!GoogleDriveService::isConfigured()) {
            $this->error('❌ Google Drive no está completamente configurado aún.');
            return 1;
        }

        $this->info('🚀 Probando subida de archivo de prueba...');
        $drive = new GoogleDriveService();

        $tmpFile = tempnam(sys_get_temp_dir(), 'drive_test_') . '.txt';
        file_put_contents($tmpFile, 'Test de conexión con Google Drive - Sistema de Confirmaciones ' . date('Y-m-d H:i:s'));

        $res = $drive->uploadFile($tmpFile, 'test_conexion_' . time() . '.txt');
        @unlink($tmpFile);

        if ($res && !empty($res['file_id'])) {
            $this->info('🎉 ¡Conexión con Google Drive exitosa!');
            $this->line("• ID del archivo: {$res['file_id']}");
            $this->line("• Link público: {$res['direct_url']}");
            $this->line("• Link de Google Drive: {$res['web_view_link']}");

            // Test event folder creation
            $firstEvent = \App\Models\Event::first();
            if ($firstEvent) {
                $this->line('');
                $this->info("📁 Probando creación/obtención de carpeta exclusiva para el Evento #{$firstEvent->id} ('{$firstEvent->title}')...");
                $eventFolderId = $drive->getOrCreateEventFolder($firstEvent);
                if ($eventFolderId) {
                    $this->info("  ✅ Carpeta del evento lista: ID {$eventFolderId}");
                    $this->line("  🔗 URL en Drive: https://drive.google.com/drive/folders/{$eventFolderId}");

                    $testEventFile = tempnam(sys_get_temp_dir(), 'event_test_') . '.txt';
                    file_put_contents($testEventFile, "Archivo de prueba para Evento #{$firstEvent->id}");
                    $eventUploadRes = $drive->uploadEventFile($firstEvent, $testEventFile, 'test_carpeta_evento_' . $firstEvent->id . '.txt');
                    @unlink($testEventFile);

                    if ($eventUploadRes && !empty($eventUploadRes['file_id'])) {
                        $this->info("  ✅ Archivo subido exitosamente dentro de la carpeta exclusiva del evento!");
                        $this->line("     • File ID: {$eventUploadRes['file_id']}");
                        $this->line("     • View URL: {$eventUploadRes['web_view_link']}");
                    }
                } else {
                    $this->warn('  ⚠️ No se pudo crear la carpeta del evento.');
                }
            }

            return 0;
        }

        $this->error('❌ No se pudo subir el archivo de prueba a Google Drive.');
        $this->line('Revisá los permisos y credenciales de Google Drive en el archivo .env.');
        return 1;
    }
}
