<?php

use App\Models\Table;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Applies the single table-naming rule (Table::normalizeName) to existing data:
 * - "1", "01", "mesa 1" become "Mesa 1" on tables and guests
 * - duplicate tables of the same event (same name ignoring case) are merged into the oldest one
 * - guests pointing to a table that doesn't exist get that table created
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            $tables = DB::table('tables')->orderBy('id')->get()->groupBy('event_id');

            foreach ($tables as $eventId => $eventTables) {
                $keep = []; // nameKey => kept table row

                foreach ($eventTables as $t) {
                    $name = Table::normalizeName($t->name) ?? "Mesa {$t->id}";
                    $key = mb_strtolower($name);

                    if (isset($keep[$key])) {
                        // Duplicate: keep the oldest, with the larger capacity and any saved position
                        $kept = $keep[$key];
                        DB::table('tables')->where('id', $kept->id)->update([
                            'capacity' => max($kept->capacity, $t->capacity),
                            'notes' => $kept->notes ?? $t->notes,
                            'pos_x' => $kept->pos_x ?? $t->pos_x,
                            'pos_y' => $kept->pos_y ?? $t->pos_y,
                        ]);
                        DB::table('tables')->where('id', $t->id)->delete();
                        continue;
                    }

                    if ($name !== $t->name) {
                        DB::table('tables')->where('id', $t->id)->update(['name' => $name]);
                    }
                    $t->name = $name;
                    $keep[$key] = $t;
                }
            }

            $guests = DB::table('guests')->whereNotNull('table_number')->get(['id', 'event_id', 'table_number', 'passes']);
            $missing = []; // "eventId|key" => [eventId, name, seats]

            foreach ($guests as $g) {
                $name = Table::normalizeName($g->table_number);
                if ($name !== $g->table_number) {
                    DB::table('guests')->where('id', $g->id)->update(['table_number' => $name]);
                }
                if ($name === null) {
                    continue;
                }

                // Guests use the exact name (casing) of their table
                $table = DB::table('tables')->where('event_id', $g->event_id)->get()
                    ->first(fn($t) => mb_strtolower($t->name) === mb_strtolower($name));

                if ($table) {
                    if ($table->name !== $name) {
                        DB::table('guests')->where('id', $g->id)->update(['table_number' => $table->name]);
                    }
                } else {
                    $k = $g->event_id . '|' . mb_strtolower($name);
                    $missing[$k] ??= [$g->event_id, $name, 0];
                    $missing[$k][2] += (int) $g->passes;
                }
            }

            foreach ($missing as [$eventId, $name, $seats]) {
                DB::table('tables')->insert([
                    'event_id' => $eventId,
                    'name' => $name,
                    'capacity' => max(10, $seats),
                    'rotation' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });
    }

    public function down(): void
    {
        // Data normalization can't be undone
    }
};
