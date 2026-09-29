<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Usuario Administrador General
        User::updateOrCreate(
            ['email' => 'admin@gmail.com'],
            [
                'name' => 'Administrador General',
                'username' => 'admin',
                'phone' => env('ADMIN_WHATSAPP_PHONE', '595972495723'),
                'password' => Hash::make('password123'),
                'role' => 'admin',
            ]
        );
    }
}

