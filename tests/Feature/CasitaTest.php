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

    public function test_summary(): void
    {
        $admin = $this->admin();
        $this->createEvent($admin);
        $summary = $this->getJson('/api/casita/summary')->assertOk()->json();
        $this->assertSame(1, $summary['totals']['events']);
        $this->assertSame(2026, $summary['by_year'][0]['year']);
    }
}
