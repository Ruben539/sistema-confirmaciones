<?php

namespace App\Http\Controllers;

use App\Models\CasitaOption;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Menús y pérdidas habituales que se sugieren en La Casita. Solo administradores. */
class CasitaOptionController extends Controller
{
    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->isAdmin(), 403, 'Solo el administrador puede usar el módulo La Casita.');
    }

    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        return response()->json(
            CasitaOption::when($request->query('type'), fn ($q, $type) => $q->where('type', $type))
                ->orderBy('type')->orderBy('sort_order')->orderBy('name')->get()
        );
    }

    private function validated(Request $request, ?CasitaOption $option = null): array
    {
        $type = $option?->type ?? $request->input('type');

        return $request->validate([
            'type' => [$option ? 'sometimes' : 'required', Rule::in(CasitaOption::TYPES)],
            'name' => ['required', 'string', 'max:255',
                Rule::unique('casita_options', 'name')->where('type', $type)->ignore($option?->id)],
        ], ['name.unique' => 'Ya está en la lista.']);
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin($request);
        $data = $this->validated($request);
        $option = CasitaOption::create(array_merge($data, [
            'name' => trim($data['name']),
            'sort_order' => (int) CasitaOption::where('type', $data['type'])->max('sort_order') + 1,
        ]));

        return response()->json(['message' => 'Agregado a la lista.', 'option' => $option], 201);
    }

    public function update(Request $request, $id)
    {
        $this->authorizeAdmin($request);
        $option = CasitaOption::findOrFail($id);
        $data = $this->validated($request, $option);
        $option->update(['name' => trim($data['name'])]);

        return response()->json(['message' => 'Actualizado.', 'option' => $option]);
    }

    public function destroy(Request $request, $id)
    {
        $this->authorizeAdmin($request);
        CasitaOption::findOrFail($id)->delete();

        return response()->json(['message' => 'Quitado de la lista.']);
    }
}
