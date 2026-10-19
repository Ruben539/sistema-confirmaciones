<?php

namespace App\Http\Controllers;

use App\Models\CasitaCatalogItem;
use Illuminate\Http\Request;

/** Lista de precios de La Casita (hoja bdLista). Solo administradores. */
class CasitaCatalogController extends Controller
{
    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->isAdmin(), 403, 'Solo el administrador puede usar el módulo La Casita.');
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => 'required|string|max:255',
            'price' => 'required|integer|min:0',
            'category' => 'nullable|string|max:50',
            'is_active' => 'nullable|boolean',
        ]);
    }

    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        return response()->json(CasitaCatalogItem::orderBy('category')->orderBy('sort_order')->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin($request);
        $item = CasitaCatalogItem::create(array_merge(
            ['is_active' => true, 'sort_order' => (int) CasitaCatalogItem::max('sort_order') + 1],
            $this->validated($request)
        ));

        return response()->json(['message' => 'Ítem agregado a la lista de precios.', 'item' => $item], 201);
    }

    public function update(Request $request, $id)
    {
        $this->authorizeAdmin($request);
        $item = CasitaCatalogItem::findOrFail($id);
        $item->update($this->validated($request));

        return response()->json(['message' => 'Precio actualizado.', 'item' => $item]);
    }

    public function destroy(Request $request, $id)
    {
        $this->authorizeAdmin($request);
        CasitaCatalogItem::findOrFail($id)->delete();

        return response()->json(['message' => 'Ítem eliminado.']);
    }
}
