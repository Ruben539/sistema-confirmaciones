<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Event;
use App\Models\Guest;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Admin User
        $admin = User::firstOrCreate(
            ['email' => 'admin@wedding.com'],
            [
                'name' => 'Administrador General',
                'username' => 'admin',
                'password' => Hash::make('password123'),
                'role' => 'admin',
            ]
        );

        // 2. Wedding Planner User
        $planner = User::firstOrCreate(
            ['email' => 'planner@wedding.com'],
            [
                'name' => 'Sofía (Wedding Planner)',
                'username' => 'planner',
                'password' => Hash::make('password123'),
                'role' => 'planner',
            ]
        );

        // 3. Event 1 (Assigned to planner)
        $event1 = Event::firstOrCreate(
            ['title' => 'Boda de Valentina & Santiago'],
            [
                'user_id' => $planner->id,
                'couple_names' => 'Valentina & Santiago',
                'event_date' => now()->addMonths(2)->format('Y-m-d'),
                'location' => 'Hacienda San José, Salón Principal',
                'message_template' => "¡Hola {nombre}! Te invitamos a la boda de {pareja} 💍\n📍 Lugar: {lugar}\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir",
                'status' => 'active'
            ]
        );

        // 4. Event 2 (Assigned to planner)
        $event2 = Event::firstOrCreate(
            ['title' => 'Boda de Camila & Mateo'],
            [
                'user_id' => $planner->id,
                'couple_names' => 'Camila & Mateo',
                'event_date' => now()->addMonths(4)->format('Y-m-d'),
                'location' => 'Estancia Los Olivos',
                'message_template' => "¡Hola {nombre}! Te invitamos a la boda de {pareja} 💍\n📍 Lugar: {lugar}\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir",
                'status' => 'active'
            ]
        );

        // Sample Guests for Event 1
        if (Guest::where('event_id', $event1->id)->count() === 0) {
            Guest::create([
                'event_id' => $event1->id,
                'name' => 'María García',
                'phone' => '+5491123456789',
                'passes' => 2,
                'confirmed_passes' => 2,
                'table_number' => 'Mesa 1',
                'status' => 'confirmed',
                'whatsapp_status' => 'sent',
                'dietary_restrictions' => 'Vegetariana',
                'notes' => 'Familia de la novia',
                'token' => Str::random(32),
            ]);

            Guest::create([
                'event_id' => $event1->id,
                'name' => 'Carlos Rodríguez',
                'phone' => '+5491198765432',
                'passes' => 1,
                'confirmed_passes' => 0,
                'table_number' => 'Mesa 5',
                'status' => 'pending',
                'whatsapp_status' => 'not_sent',
                'notes' => 'Amigo de Santiago',
                'token' => Str::random(32),
            ]);

            Guest::create([
                'event_id' => $event1->id,
                'name' => 'Ana & Luis Martínez',
                'phone' => '+5491155554444',
                'passes' => 4,
                'confirmed_passes' => 0,
                'table_number' => 'Mesa Principal',
                'status' => 'declined',
                'whatsapp_status' => 'sent',
                'notes' => 'Viaje programado',
                'token' => Str::random(32),
            ]);
        }
    }
}
