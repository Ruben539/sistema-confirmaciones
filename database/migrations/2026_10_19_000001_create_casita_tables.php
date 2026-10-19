<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo "La Casita": reemplaza la planilla "recibo nuevo 2026.xlsm".
 * - casita_catalog_items  = hoja bdLista (lista de precios)
 * - casita_events + items = hojas Registro y Auxiliar (presupuesto / recibo por cliente)
 * - casita_payments       = hojas Pagos y Garantia
 * - casita_losses         = hoja Perdidas (pérdidas, bebidas agregadas y sobrantes)
 * Los montos son guaraníes enteros.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('casita_catalog_items', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->bigInteger('price')->default(0);
            $table->string('category', 50)->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('casita_events', function (Blueprint $table) {
            $table->id();
            $table->string('client_name');
            $table->date('event_date')->nullable()->index();
            $table->string('schedule')->nullable(); // "21:00hs hasta las 03:00hs"
            $table->string('venue')->default('La Casita');
            $table->string('menu')->nullable();
            $table->text('notes')->nullable();
            // Optional link to the guest-confirmation event of the same party
            $table->foreignId('event_id')->nullable()->constrained('events')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('casita_event_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('casita_event_id')->constrained('casita_events')->cascadeOnDelete();
            $table->string('description');
            $table->bigInteger('unit_price')->default(0);
            $table->integer('quantity')->default(1);
            $table->bigInteger('total')->default(0);
            $table->string('note')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('casita_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('casita_event_id')->constrained('casita_events')->cascadeOnDelete();
            $table->date('paid_on');
            $table->string('kind', 20)->default('pago'); // garantia | sena | pago | devolucion
            $table->bigInteger('amount');
            $table->string('note')->nullable();
            $table->timestamps();
        });

        Schema::create('casita_losses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('casita_event_id')->constrained('casita_events')->cascadeOnDelete();
            $table->string('section', 20); // perdida | agregado | sobrante
            $table->string('description');
            $table->integer('quantity')->default(1);
            $table->bigInteger('unit_price')->default(0);
            $table->bigInteger('total')->default(0);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // Price list as it was in the bdLista sheet
        $catalog = [
            ['Paquete por persona', 200000, 'paquete'], ['Paquete jóvenes', 155000, 'paquete'], ['Menores', 100000, 'paquete'],
            ['Menores exonerados', 0, 'paquete'], ['Antipasto (por persona)', 60000, 'paquete'],
            ['Garantia', 700000, 'garantia'], ['Apa', 850000, 'servicio'],
            ['Apa Infantil hasta 50 personas', 200000, 'servicio'], ['Apa Infantil hasta 80 personas', 250000, 'servicio'],
            ['Apa Infantil hasta 100 personas', 300000, 'servicio'],
            ['Incluye un metre', 0, 'personal'], ['Mozo Adicional', 220000, 'personal'], ['Cantinero', 250000, 'personal'],
            ['Anfitriona', 400000, 'personal'], ['Buffethier', 200000, 'personal'],
            ['Hamburguesas adicionales', 30000, 'comida'], ['comida para proveedores', 40000, 'comida'],
            ['Bolsa de Hielo 25KG', 35000, 'bebida'], ['Conservadora', 60000, 'bebida'],
            ['Caja Corona x12 710ml', 185000, 'bebida'], ['Caja Miller X15 650ml', 185000, 'bebida'],
            ['Caja Hieneken X12 650ml', 185000, 'bebida'], ['Caja de Pilsen X12 710ml', 115000, 'bebida'],
            ['Caja de Coca Cola 1litro (12 unidades)', 85000, 'bebida'], ['Pack de agua sin gas', 30000, 'bebida'],
            ['Pack de agua con gas', 30000, 'bebida'], ['Pack de agua tónica', 30000, 'bebida'], ['Pack de soda', 30000, 'bebida'],
            ['Servicio de Chopp Munich 50Lt.', 620000, 'bebida'], ['Servicio de Chopp Munich 30Lt.', 420000, 'bebida'],
            ['Jugos naturales', 650000, 'bebida'], ['Plancha de Smirnoff', 180000, 'bebida'], ['Vino Malbec por Unidad', 60000, 'bebida'],
            ['chandon delice y extra luce x unidad', 80000, 'bebida'], ['chandon delice y extra luce x caja (6ud)', 468000, 'bebida'],
            ['pines de luz por mesa', 25000, 'mobiliario'], ['Sillas para el civil', 15000, 'mobiliario'],
            ['mesita para el civil', 150000, 'mobiliario'], ['mesa 1.20x 2.70', 220000, 'mobiliario'],
            ['Isla para 10 personas', 150000, 'mobiliario'], ['Caminero', 300000, 'mobiliario'], ['Pasarela', 350000, 'mobiliario'],
            ['Toldo 10x15', 3000000, 'estructura'], ['Tarima 3x4', 540000, 'estructura'], ['Tarima 4.40 x 3.20', 550000, 'estructura'],
            ['Tarima 6x4', 1080000, 'estructura'], ['Pista 4x4', 400000, 'estructura'], ['Pista 6x8', 1000000, 'estructura'],
            ['Piso 5x5', 625000, 'estructura'], ['piso 6x6', 900000, 'estructura'], ['piso 8x6', 1200000, 'estructura'],
            ['Piso 8x8', 1600000, 'estructura'],
            ['vasos de wisky', 2000, 'vajilla'], ['vasos normales', 1500, 'vajilla'], ['copas multiuso', 1500, 'vajilla'],
        ];
        $now = now();
        foreach ($catalog as $i => [$name, $price, $category]) {
            DB::table('casita_catalog_items')->insert([
                'name' => $name, 'price' => $price, 'category' => $category,
                'is_active' => true, 'sort_order' => $i, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('casita_losses');
        Schema::dropIfExists('casita_payments');
        Schema::dropIfExists('casita_event_items');
        Schema::dropIfExists('casita_events');
        Schema::dropIfExists('casita_catalog_items');
    }
};
