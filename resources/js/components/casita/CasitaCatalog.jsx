import React, { useEffect, useMemo, useState } from 'react';
import { Tags, Plus, Search, Trash2, Check, Pencil, X } from 'lucide-react';
import { apiFetch } from '../../api';
import { gs, CATALOG_CATEGORIES } from './casitaUtils';
import { PageHeader, Card, Empty, MoneyInput, inputCls, btnPrimary, btnGhost } from './CasitaUi';

/** Hoja "bdLista": precios que se usan al armar presupuestos. Los cambios no tocan presupuestos ya guardados. */
export default function CasitaCatalog({ showToast }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [draft, setDraft] = useState({ name: '', price: '', category: 'otro' });
    const [edits, setEdits] = useState({}); // id → { price, name }

    const load = async () => {
        const { ok, json } = await apiFetch('/api/casita/catalog');
        if (ok) setItems(json);
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const grouped = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = q ? items.filter(i => i.name.toLowerCase().includes(q)) : items;
        return Object.keys(CATALOG_CATEGORIES).map(cat => [cat, list.filter(i => (i.category || 'otro') === cat)]).filter(([, rows]) => rows.length);
    }, [items, search]);

    const add = async () => {
        if (!draft.name.trim()) return;
        const { ok, json } = await apiFetch('/api/casita/catalog', { method: 'POST', body: JSON.stringify({ ...draft, price: Number(draft.price) || 0 }) });
        if (ok) { showToast(json.message); setDraft({ name: '', price: '', category: draft.category }); load(); }
        else showToast(json?.message || 'No se pudo agregar.');
    };

    const saveItem = async (item, patch) => {
        const { ok, json } = await apiFetch(`/api/casita/catalog/${item.id}`, { method: 'PUT', body: JSON.stringify({ ...item, ...patch }) });
        if (ok) {
            showToast(json.message);
            setItems(list => list.map(i => (i.id === item.id ? json.item : i)));
            setEdits(e => { const { [item.id]: _, ...rest } = e; return rest; });
        } else showToast(json?.message || 'No se pudo guardar.');
    };

    const remove = async (item) => {
        const { ok, json } = await apiFetch(`/api/casita/catalog/${item.id}`, { method: 'DELETE' });
        if (ok) { showToast(json.message); setItems(list => list.filter(i => i.id !== item.id)); }
    };

    return (
        <div className="space-y-6">
            <PageHeader icon={Tags} title="Lista de precios" subtitle="Precios que se proponen al armar un presupuesto. Cambiarlos no modifica presupuestos ya guardados." />

            <Card title="Agregar ítem">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Detalle" className={`${inputCls} md:col-span-2`} />
                    <MoneyInput value={draft.price} onChange={v => setDraft(d => ({ ...d, price: v }))} placeholder="Precio" />
                    <div className="flex gap-2">
                        <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} className={inputCls}>
                            {Object.entries(CATALOG_CATEGORIES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                        </select>
                        <button onClick={add} className={btnPrimary}><Plus className="w-4 h-4" /></button>
                    </div>
                </div>
            </Card>

            <div className="relative max-w-sm">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…" className={`${inputCls} pl-9`} />
            </div>

            {loading ? <Empty>Cargando…</Empty> : grouped.length === 0 ? <Empty>Sin ítems.</Empty> : (
                <div className="grid lg:grid-cols-2 gap-6">
                    {grouped.map(([cat, rows]) => (
                        <Card key={cat} title={CATALOG_CATEGORIES[cat]}>
                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {rows.map(item => {
                                    const edit = edits[item.id];
                                    return (
                                        <div key={item.id} className={`py-2 space-y-1.5 ${item.is_active ? '' : 'opacity-50'}`}>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    value={edit?.name ?? item.name}
                                                    onChange={e => setEdits(x => ({ ...x, [item.id]: { ...x[item.id], name: e.target.value } }))}
                                                    className={`${inputCls} flex-1 min-w-0`}
                                                />
                                                <div className="w-32 shrink-0">
                                                    <MoneyInput
                                                        value={edit?.price ?? item.price}
                                                        onChange={v => setEdits(x => ({ ...x, [item.id]: { ...x[item.id], price: v } }))}
                                                    />
                                                </div>
                                                {edit && (
                                                    <button onClick={() => saveItem(item, { name: edit.name ?? item.name, price: Number(edit.price ?? item.price) || 0 })} className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40" title="Guardar"><Check className="w-4 h-4" /></button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px]">
                                                <span className="text-zinc-500">Grupo</span>
                                                {/* Changing the group saves right away and moves the item to that card */}
                                                <select value={item.category || 'otro'} onChange={e => saveItem(item, { category: e.target.value })} className="text-[11px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 outline-none">
                                                    {Object.entries(CATALOG_CATEGORIES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                                                </select>
                                                <button onClick={() => saveItem(item, { is_active: !item.is_active })} className="font-bold px-2 py-1 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" title={item.is_active ? 'Ocultar en presupuestos' : 'Volver a mostrar'}>
                                                    {item.is_active ? 'Activo' : 'Oculto'}
                                                </button>
                                                <button onClick={() => remove(item)} className="ml-auto p-1.5 rounded-lg text-zinc-400 hover:text-rose-600" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="text-[11px] text-zinc-500 mt-2">{rows.length} ítems · desde {gs(Math.min(...rows.map(r => r.price)))}</div>
                        </Card>
                    ))}
                </div>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
                <OptionsEditor type="menu" title="Menús" hint="Se sugieren en el campo Menú al registrar un evento." showToast={showToast} />
                <OptionsEditor type="perdida" title="Pérdidas habituales" hint="Se sugieren en Pérdidas y bebidas (sin precio fijo)." showToast={showToast} />
            </div>
        </div>
    );
}

/** Editable list of suggestions (menus or usual losses). */
function OptionsEditor({ type, title, hint, showToast }) {
    const [options, setOptions] = useState([]);
    const [draft, setDraft] = useState('');
    const [editing, setEditing] = useState(null); // { id, name }

    const load = async () => {
        const { ok, json } = await apiFetch(`/api/casita/options?type=${type}`);
        if (ok) setOptions(json);
    };
    useEffect(() => { load(); }, [type]);

    const add = async () => {
        if (!draft.trim()) return;
        const { ok, json } = await apiFetch('/api/casita/options', { method: 'POST', body: JSON.stringify({ type, name: draft }) });
        showToast(ok ? json.message : (json?.errors?.name?.[0] || json?.message || 'No se pudo agregar.'));
        if (ok) { setDraft(''); load(); }
    };

    const save = async () => {
        const { ok, json } = await apiFetch(`/api/casita/options/${editing.id}`, { method: 'PUT', body: JSON.stringify({ name: editing.name }) });
        showToast(ok ? json.message : (json?.errors?.name?.[0] || json?.message || 'No se pudo guardar.'));
        if (ok) { setEditing(null); load(); }
    };

    const remove = async (id) => {
        const { ok, json } = await apiFetch(`/api/casita/options/${id}`, { method: 'DELETE' });
        if (ok) { showToast(json.message); load(); }
    };

    return (
        <Card title={title}>
            <p className="text-[11px] text-zinc-500 mb-3">{hint}</p>
            <div className="flex gap-2 mb-3">
                <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Agregar…" className={inputCls} />
                <button onClick={add} className={btnGhost}><Plus className="w-4 h-4" /></button>
            </div>
            {options.length === 0 ? <Empty>Sin elementos.</Empty> : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {options.map(o => (
                        <li key={o.id} className="flex items-center gap-2 py-1.5 text-xs">
                            {editing?.id === o.id ? (<>
                                <input autoFocus value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(null); }} className={inputCls} />
                                <button onClick={save} className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40" title="Guardar"><Check className="w-4 h-4" /></button>
                                <button onClick={() => setEditing(null)} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700" title="Cancelar"><X className="w-4 h-4" /></button>
                            </>) : (<>
                                <span className="flex-1 font-semibold">{o.name}</span>
                                <button onClick={() => setEditing({ id: o.id, name: o.name })} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => remove(o.id)} className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600" title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>)}
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
