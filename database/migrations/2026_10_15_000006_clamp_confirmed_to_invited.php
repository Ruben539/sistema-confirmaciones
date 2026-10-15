<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Guests who confirmed more people than their (corrected) invitation, e.g. confirmed 3 on an invitation that
 * was inflated by a wrongly read Excel and later re-imported as 2: the confirmation can't exceed the
 * invitation. They are marked as "falta avisar" so the panel offers sending them the right amount.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('guests')
            ->whereColumn('confirmed_passes', '>', 'passes')
            ->whereIn('status', ['confirmed', 'attended'])
            ->whereNull('pending_correction_from')
            ->update(['pending_correction_from' => DB::raw('confirmed_passes')]);

        DB::table('guests')
            ->whereColumn('confirmed_passes', '>', 'passes')
            ->update([
                'confirmed_adults' => DB::raw('adults'),
                'confirmed_youth' => DB::raw('youth'),
                'confirmed_children' => DB::raw('children'),
                'confirmed_passes' => DB::raw('passes'),
            ]);
    }

    public function down(): void
    {
        // Data fix: nothing to undo
    }
};
