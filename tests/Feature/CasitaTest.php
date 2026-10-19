<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CasitaTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    private function createEvent(User $admin): array
    {
        return $this->actingAs($admin)->postJson('/api/casita/events', [
            'client_name' => 'María y Michael',
            'event_date' => '2026-11-07',
            'schedule' => '21:00hs hasta las 03:00hs',
            'menu' => 'Buffet de pastas con carne',
            'items' => [
                ['description' => 'Garantia', 'unit_price' => 1000000, 'quantity' => 1],
                ['description' => 'Mozo Adicional', 'unit_price' => 220000, 'quantity' => 14],
                ['description' => 'Paquete por persona', 'unit_price' => 200000, 'quantity' => 280],
            ],
        ])->assertCreated()->json('event');
    }

    public function test_only_admin_can_use_the_module(): void
    {
        $planner = User::factory()->create(['role' => 'planner']);
        $this->actingAs($planner)->getJson('/api/casita/events')->assertForbidden();
        $this->actingAs($planner)->getJson('/api/casita/catalog')->assertForbidden();
    }

    public function test_price_list_is_seeded_from_the_excel(): void
    {
        $items = $this->actingAs($this->admin())->getJson('/api/casita/catalog')->assertOk()->json();
        $this->assertNotEmpty($items);
        $this->assertContains('Mozo Adicional', array_column($items, 'name'));
    }

    public function test_budget_payments_and_balance(): void
    {
        $admin = $this->admin();
        $event = $this->createEvent($admin);

        // 1.000.000 + 3.080.000 + 56.000.000
        $this->assertSame(60080000, $event['budget_total']);
        $this->assertSame(60080000, $event['balance']);

        $this->postJson("/api/casita/events/{$event['id']}/payments", ['paid_on' => '2026-05-01', 'kind' => 'garantia', 'amount' => 1000000])->assertCreated();
        $after = $this->postJson("/api/casita/events/{$event['id']}/payments", ['paid_on' => '2026-06-01', 'kind' => 'pago', 'amount' => 49000000])->json('event');
        $this->assertSame(50000000, $after['paid_total']);
        $this->assertSame(10080000, $after['balance']);

        $refund = $this->postJson("/api/casita/events/{$event['id']}/payments", ['paid_on' => '2026-11-10', 'kind' => 'devolucion', 'amount' => 500000])->json('event');
        $this->assertSame(49500000, $refund['paid_total']);

        $list = $this->getJson('/api/casita/events?status=pending')->json('events');
        $this->assertCount(1, $list);
        $this->assertSame(10580000, $list[0]['balance']);
    }

    public function test_losses_settlement_uses_guarantee(): void
    {
        $admin = $this->admin();
        $event = $this->createEvent($admin);
        $this->postJson("/api/casita/events/{$event['id']}/payments", ['paid_on' => '2026-05-01', 'kind' => 'garantia', 'amount' => 700000]);

        $result = $this->putJson("/api/casita/events/{$event['id']}/losses", ['lines' => [
            ['section' => 'perdida', 'description' => 'Servilletas hilo oscuro', 'quantity' => 35, 'unit_price' => 15000],
            ['section' => 'agregado', 'description' => 'Caja Miller x15', 'quantity' => 4, 'unit_price' => 185000],
            ['section' => 'sobrante', 'description' => 'Pack de agua sin gas', 'quantity' => 2, 'unit_price' => 30000],
        ]])->assertOk()->json('event.settlement');

        // (525.000 + 740.000) − (60.000 + 700.000)
        $this->assertSame(1265000, $result['charges_total']);
        $this->assertSame(760000, $result['credits_total']);
        $this->assertSame(505000, $result['result']);
    }

    public function test_import_merges_repeated_blocks_and_skips_existing(): void
    {
        $admin = $this->admin();
        $row = fn ($detail, $price, $qty, $client = 'Luciana Ortega') => [
            'date' => '2023-01-13', 'client' => $client, 'venue' => 'La Casita', 'menu' => 'Servicio de asado',
            'detail' => $detail, 'price' => $price, 'quantity' => $qty,
        ];
        $block = [$row('Garantia', 700000, 1), $row('Personas', 180000, 55)];
        $rows = array_merge($block, [$row('Garantia', 1, 1, 'Otro cliente')], $block);

        $res = $this->actingAs($admin)->postJson('/api/casita/events/import', ['rows' => $rows])->assertOk()->json();
        $this->assertSame(2, $res['created_events']);
        $this->assertSame(1, $res['duplicate_blocks']);

        $luciana = collect($this->getJson('/api/casita/events?search=luciana')->json('events'))->first();
        $this->assertSame(700000 + 180000 * 55, $luciana['budget_total']);

        $again = $this->postJson('/api/casita/events/import', ['rows' => $rows])->json();
        $this->assertSame(0, $again['created_events']);
        $this->assertSame(2, $again['skipped_existing']);
    }

    public function test_import_can_mark_past_events_as_paid(): void
    {
        $admin = $this->admin();
        $rows = [
            ['date' => '2023-01-13', 'client' => 'Pasado', 'detail' => 'Personas', 'price' => 180000, 'quantity' => 10],
            ['date' => '2099-01-01', 'client' => 'Futuro', 'detail' => 'Personas', 'price' => 200000, 'quantity' => 10],
        ];
        $res = $this->actingAs($admin)->postJson('/api/casita/events/import', ['rows' => $rows, 'settle_past' => true])->json();
        $this->assertSame(1, $res['settled_past']);

        $events = collect($this->getJson('/api/casita/events')->json('events'))->keyBy('client_name');
        $this->assertSame(0, $events['Pasado']['balance']);
        $this->assertSame(2000000, $events['Futuro']['balance']);
    }

    public function test_events_are_grouped_by_client_ignoring_accents(): void
    {
        $admin = $this->admin();
        $rows = [
            ['date' => '2025-12-27', 'client' => 'María y Juan', 'detail' => 'Personas', 'price' => 190000, 'quantity' => 105],
            ['date' => '2026-07-25', 'client' => 'Maria  y juan', 'detail' => 'Personas', 'price' => 200000, 'quantity' => 120],
            ['date' => '2026-08-07', 'client' => 'Aracely y Josias', 'detail' => 'Personas', 'price' => 220000, 'quantity' => 150],
            ['date' => '2026-08-08', 'client' => 'Araceli y Josias', 'detail' => 'Personas', 'price' => 200000, 'quantity' => 120],
        ];
        $res = $this->actingAs($admin)->postJson('/api/casita/events/import', ['rows' => $rows])->json();
        $this->assertSame(3, $res['created_clients']);

        $clients = collect($this->getJson('/api/casita/clients')->json())->keyBy('name');
        $this->assertSame(2, $clients['María y Juan']['events_count']);
        $this->assertSame(190000 * 105 + 200000 * 120, $clients['María y Juan']['budget_total']);

        // Similar names are only suggested, never merged automatically
        $pairs = $this->getJson('/api/casita/clients/duplicates')->json();
        $this->assertCount(1, $pairs);

        $merge = $this->postJson("/api/casita/clients/{$clients['Araceli y Josias']['id']}/merge", ['into_id' => $clients['Aracely y Josias']['id']])->assertOk();
        $client = $this->getJson("/api/casita/clients/{$clients['Aracely y Josias']['id']}")->json();
        $this->assertSame(2, $client['events_count']);
        $this->assertSame('Aracely y Josias', $client['events'][0]['client_name']);
        $this->assertCount(2, $this->getJson('/api/casita/clients')->json());
    }

    public function test_new_event_is_linked_to_existing_client_and_contact_can_be_edited(): void
    {
        $admin = $this->admin();
        $first = $this->createEvent($admin);
        $second = $this->postJson('/api/casita/events', ['client_name' => 'maria y michael', 'items' => []])->json('event');
        $this->assertSame($first['client_id'], $second['client_id']);

        $this->putJson("/api/casita/clients/{$first['client_id']}", ['name' => 'María y Michael', 'phone' => '0981 123456'])->assertOk();
        $this->assertSame('0981 123456', $this->getJson("/api/casita/clients/{$first['client_id']}")->json('phone'));
    }

    public function test_command_imports_the_csv(): void
    {
        $csv = tempnam(sys_get_temp_dir(), 'casita') . '.csv';
        // Same layout and encoding as the Excel export
        file_put_contents($csv, mb_convert_encoding(implode("\r\n", [
            ';;;;;;;;;;',
            ';Fecha;Lugar;Cliente;Menu;Detalle;Precio;Cantidad;Total;Observación;',
            ';07/11/2026;La Casita;María y Michael;Buffet de pastas con carne;Garantia; ₲ 1.000.000 ;1; ₲ 1.000.000 ;;',
            ';07/11/2026;La Casita;María y Michael;Buffet de pastas con carne;Incluye un metre; ₲ -   ;1; ₲ -   ;;',
            ';21/11/225;La Casita;Tais y Marcos;Servicio de asado;Garantia; ₲ 700.000 ;1; ₲ 700.000 ;;',
            ';;;;;;;;;;',
        ]), 'Windows-1252', 'UTF-8'));

        $this->artisan('casita:import', ['path' => $csv, '--dry-run' => true])->assertSuccessful();
        $this->assertSame(0, \App\Models\CasitaEvent::count());

        $this->artisan('casita:import', ['path' => $csv, '--settle-past' => true])->assertSuccessful();
        $this->assertSame(2, \App\Models\CasitaEvent::count());
        $this->assertSame(2, \App\Models\CasitaClient::count());
        $this->assertSame('María y Michael', \App\Models\CasitaClient::orderBy('id')->first()->name);
        $this->assertSame('2025-11-21', \App\Models\CasitaEvent::where('client_name', 'Tais y Marcos')->first()->event_date->format('Y-m-d'));

        $this->artisan('casita:import', ['path' => $csv])->assertSuccessful();
        $this->assertSame(2, \App\Models\CasitaEvent::count());
        unlink($csv);
    }

    public function test_summary(): void
    {
        $admin = $this->admin();
        $this->createEvent($admin);
        $summary = $this->getJson('/api/casita/summary')->assertOk()->json();
        $this->assertSame(1, $summary['totals']['events']);
        $this->assertSame(2026, $summary['by_year'][0]['year']);
    }
}
