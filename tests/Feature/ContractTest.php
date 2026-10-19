<?php

namespace Tests\Feature;

use App\Models\CasitaEvent;
use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ContractTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Http::preventStrayRequests(); // never reach the real bot or Drive
        config(['whatsapp.driver' => 'baileys', 'whatsapp.automation' => true]);
        Carbon::setTestNow('2026-10-19 09:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function admin(array $attrs = []): User
    {
        return User::factory()->create(array_merge(['role' => 'admin', 'phone' => '0981123456', 'is_active' => true], $attrs));
    }

    private function event(array $attrs = []): Event
    {
        $event = Event::create(array_merge(['title' => 'Boda', 'couple_names' => 'Sofía & Mateo', 'event_date' => '2026-12-12'], $attrs));
        $event->forceFill(['created_at' => now()->subDays(2)])->saveQuietly();
        return $event->fresh();
    }

    private function casita(array $attrs = []): CasitaEvent
    {
        $event = CasitaEvent::create(array_merge(['client_name' => 'María y Michael', 'event_date' => '2026-11-07'], $attrs));
        $event->forceFill(['created_at' => now()->subDays(2)])->saveQuietly();
        return $event->fresh();
    }

    public function test_new_events_start_without_contract_and_are_listed_as_pending(): void
    {
        $admin = $this->admin();
        $this->event();
        $this->casita();
        $this->event(['couple_names' => 'Ya pasó', 'event_date' => '2026-01-01']);

        $res = $this->actingAs($admin)->getJson('/api/contracts/pending')->assertOk();

        $this->assertSame(2, $res->json('count'));
        // Soonest first: La Casita (7/11) before the wedding (12/12)
        $this->assertSame(['casita', 'event'], array_column($res->json('items'), 'type'));
        $this->assertSame(19, $res->json('items.0.days_left'));
    }

    public function test_only_admin_can_manage_contracts(): void
    {
        $planner = User::factory()->create(['role' => 'planner']);
        $event = $this->event();

        $this->actingAs($planner)->getJson('/api/contracts/pending')->assertForbidden();
        $this->actingAs($planner)->putJson("/api/contracts/event/{$event->id}", ['status' => 'signed'])->assertForbidden();
        $this->actingAs($planner)->postJson("/api/contracts/event/{$event->id}/file", ['file' => UploadedFile::fake()->create('c.pdf', 10, 'application/pdf')])->assertForbidden();
    }

    public function test_uploading_the_signed_contract_closes_it_and_it_can_be_downloaded(): void
    {
        $admin = $this->admin();
        $event = $this->casita();

        $res = $this->actingAs($admin)->postJson("/api/contracts/casita/{$event->id}/file", [
            'file' => UploadedFile::fake()->create('contrato.pdf', 50, 'application/pdf'),
        ])->assertCreated();

        $this->assertSame('signed', $res->json('contract.status'));
        $this->assertSame("/api/contracts/casita/{$event->id}/file", $res->json('contract.download_url'));
        $this->assertSame(0, $this->getJson('/api/contracts/pending')->json('count'));

        $this->get("/api/contracts/casita/{$event->id}/file")->assertOk()->assertHeader('Content-Type', 'application/pdf');

        // Removing it puts the event back in the pending list
        $this->deleteJson("/api/contracts/casita/{$event->id}/file")->assertOk();
        $this->assertSame('pending', $event->fresh()->contract_status);
        $this->assertSame(1, $this->getJson('/api/contracts/pending')->json('count'));
        $this->assertSame([], Storage::disk('local')->allFiles('contracts'));
    }

    public function test_rejects_files_that_are_not_pdf_or_images(): void
    {
        $event = $this->event();
        $this->actingAs($this->admin())->postJson("/api/contracts/event/{$event->id}/file", [
            'file' => UploadedFile::fake()->create('contrato.exe', 10),
        ])->assertUnprocessable();
    }

    public function test_status_can_be_changed_by_hand(): void
    {
        $admin = $this->admin();
        $event = $this->event();

        $this->actingAs($admin)->putJson("/api/contracts/event/{$event->id}", ['status' => 'sent'])->assertOk()->assertJsonPath('contract.status', 'sent');
        $this->assertSame(1, $this->getJson('/api/contracts/pending')->json('count')); // sent still needs the signature

        $this->putJson("/api/contracts/event/{$event->id}", ['status' => 'not_required'])->assertOk();
        $this->assertSame(0, $this->getJson('/api/contracts/pending')->json('count'));

        $this->putJson("/api/contracts/event/{$event->id}", ['status' => 'whatever'])->assertUnprocessable();
    }

    public function test_events_list_and_casita_list_include_the_contract(): void
    {
        $admin = $this->admin();
        $this->event();
        $this->casita();

        $this->actingAs($admin)->getJson('/api/event')->assertOk()->assertJsonPath('events.0.contract.status', 'pending');
        $this->getJson('/api/casita/events')->assertOk()->assertJsonPath('events.0.contract.status', 'pending');

        $this->casita(['client_name' => 'Con contrato'])->forceFill(['contract_status' => 'signed'])->saveQuietly();
        $missing = $this->getJson('/api/casita/events?contract=missing')->json('events');
        $this->assertSame(['María y Michael'], array_column($missing, 'client_name'));
        $this->assertSame(['Con contrato'], array_column($this->getJson('/api/casita/events?contract=signed')->json('events'), 'client_name'));
    }

    public function test_reminder_goes_to_admins_by_whatsapp_once_per_period(): void
    {
        Http::fake(['*' => Http::response(['status' => 'success'], 200)]);
        $this->admin();
        $this->event();                                   // 54 days away: every 3 days
        $casita = $this->casita();                        // 19 days away: every day
        $this->event(['couple_names' => 'Recién creado'])->forceFill(['created_at' => now()])->saveQuietly(); // not yet
        $this->casita(['client_name' => 'Firmado'])->forceFill(['contract_status' => 'signed'])->saveQuietly();

        $this->artisan('contracts:remind')->assertSuccessful();

        Http::assertSentCount(1);
        Http::assertSent(function ($request) {
            $text = $request['message'] ?? '';
            return $request['phone'] === '595981123456'
                && str_contains($text, 'Sofía & Mateo')
                && str_contains($text, 'María y Michael')
                && !str_contains($text, 'Recién creado')
                && !str_contains($text, 'Firmado');
        });
        $this->assertNotNull($casita->fresh()->contract_reminder_sent_at);

        // Same day: nothing new
        $this->artisan('contracts:remind')->assertSuccessful();
        Http::assertSentCount(1);

        // Next day: only the urgent one (La Casita, < 30 days)
        Carbon::setTestNow('2026-10-20 09:00:00');
        $this->artisan('contracts:remind')->assertSuccessful();
        Http::assertSentCount(2);
        Http::assertSent(fn ($request) => str_contains($request['message'] ?? '', 'María y Michael') && !str_contains($request['message'] ?? '', 'Sofía'));
    }

    public function test_failed_send_is_retried_next_run(): void
    {
        Http::fake(['*' => Http::response(['error' => 'down'], 500)]);
        $this->admin();
        $event = $this->event();

        $this->artisan('contracts:remind')->assertSuccessful();

        $this->assertNull($event->fresh()->contract_reminder_sent_at);
    }
}
