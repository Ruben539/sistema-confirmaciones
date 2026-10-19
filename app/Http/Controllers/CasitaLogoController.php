<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Logos printed on La Casita documents, stored in storage/app/public/images:
 *  casita → presupuestos, recibos y el borrador en PDF
 *  real   → liquidación de pérdidas y bebidas
 */
class CasitaLogoController extends Controller
{
    public const SLOTS = ['casita', 'real'];
    private const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->isAdmin(), 403, 'Solo el administrador puede usar el módulo La Casita.');
    }

    private function checkSlot(string $slot): void
    {
        abort_unless(in_array($slot, self::SLOTS, true), 404);
    }

    /** Current file of a slot (images/casita.png, images/real.jpg, …) or null. */
    private function pathFor(string $slot): ?string
    {
        $disk = Storage::disk('public');
        foreach (self::EXTENSIONS as $ext) {
            if ($disk->exists("images/{$slot}.{$ext}")) {
                return "images/{$slot}.{$ext}";
            }
        }
        return null;
    }

    private function describe(string $slot): array
    {
        $path = $this->pathFor($slot);
        $version = $path ? Storage::disk('public')->lastModified($path) : null;

        return [
            'slot' => $slot,
            'exists' => (bool) $path,
            'url' => $path ? "/api/casita/logos/{$slot}?v={$version}" : null,
        ];
    }

    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        return response()->json(array_map(fn ($slot) => $this->describe($slot), self::SLOTS));
    }

    /** Public (no login) so printed pages and the PDF can load it like any image. */
    public function show(string $slot)
    {
        $this->checkSlot($slot);
        $path = $this->pathFor($slot);
        abort_unless($path, 404);

        return response()->file(Storage::disk('public')->path($path), [
            'Cache-Control' => 'no-cache',
        ]);
    }

    public function store(Request $request, string $slot)
    {
        $this->authorizeAdmin($request);
        $this->checkSlot($slot);
        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg,webp|max:15360',
        ]);

        $file = $request->file('image');
        $ext = strtolower($file->extension() ?: $file->getClientOriginalExtension() ?: 'png');
        $ext = in_array($ext, self::EXTENSIONS, true) ? $ext : 'png';

        $this->deleteFiles($slot);
        $file->storeAs('images', "{$slot}.{$ext}", 'public');

        return response()->json(['message' => 'Logo actualizado.', 'logo' => $this->describe($slot)]);
    }

    public function destroy(Request $request, string $slot)
    {
        $this->authorizeAdmin($request);
        $this->checkSlot($slot);
        $this->deleteFiles($slot);

        return response()->json(['message' => 'Logo quitado.', 'logo' => $this->describe($slot)]);
    }

    private function deleteFiles(string $slot): void
    {
        $disk = Storage::disk('public');
        foreach (self::EXTENSIONS as $ext) {
            $disk->delete("images/{$slot}.{$ext}");
        }
    }
}
