import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save, Printer, Receipt, Trash2, Plus, X, Wallet, PackageX, Pencil, Check } from 'lucide-react';
import { apiFetch } from '../../api';
import DateInput from '../DateInput';
import ConfirmModal from '../ConfirmModal';
import { gs, fmtDate, todayIso, KIND_LABELS, printBudget, catalogKey, applyLineChange } from './casitaUtils';
import { Card, Field, Kpi, Empty, BalanceBadge, MoneyInput, CatalogInput, CatalogItemModal, inputCls, btnPrimary, btnGhost, btnDanger } from './CasitaUi';

const EMPTY = { client_name: '', event_date: '', schedule: '', venue: 'La Casita', menu: '', notes: 'No incluye IVA', planner_id: null };

// Lines a new budget usually starts with (from the old Excel)
const DEFAULT_LINES = ['Garantia', 'Apa', 'Incluye un metre', 'Mozo Adicional', 'Paquete por persona'];

let lineKey = 0;
const newLine = (description = '', unit_price = 0, quantity = 1) => ({ _key: ++lineKey, description, unit_price, quantity });

export default function CasitaEventEditor({ eventId, showToast, onBack, onSaved, onGoLosses }) {
    const isNew = eventId === 'new';
    const [form, setForm] = useState(EMPTY);
    const [lines, setLines] = useState([]);
    const [saved, setSaved] = useState(null); // last version from the server (totals, payments)
    const [catalog, setCatalog] = useState([]);
    const [clientNames, setClientNames] = useState([]);
    const [planners, setPlanners] = useState([]);
    const [menus, setMenus] = useState([]);
    const [itemModal, setItemModal] = useState(null); // { item } to edit, or { initialName, lineKey } to add
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        apiFetch('/api/casita/catalog').then(({ ok, json }) => ok && setCatalog(json.filter(i => i.is_active)));
        // Typing an existing client's name attaches the event to that client
        apiFetch('/api/casita/clients').then(({ ok, json }) => ok && setClientNames(json.map(c => c.name)));
        apiFetch('/api/planners').then(({ ok, json }) => ok && Array.isArray(json) && setPlanners(json));
        apiFetch('/api/casita/options?type=menu').then(({ ok, json }) => ok && setMenus(json.map(o => o.name)));
    }, []);

    // A price-list item was edited or added from the budget dropdown
    const onCatalogSaved = (item, previous) => {
        setCatalog(list => (previous ? list.map(c => (c.id === item.id ? item : c)) : [...list, item]).filter(c => c.is_active !== false));
        if (previous) {
            // Lines of that item: new name; new price only where they still had the old list price
            const oldKey = catalogKey(previous.name);
            setLines(ls => ls.map(l => (catalogKey(l.description) !== oldKey ? l : {
                ...l, description: item.name, priceFor: catalogKey(item.name),
                unit_price: Number(l.unit_price) === previous.price ? item.price : l.unit_price,
            })));
        } else if (itemModal?.lineKey) {
            setLines(ls => ls.map(l => (l._key === itemModal.lineKey ? { ...l, description: item.name, unit_price: item.price, priceFor: catalogKey(item.name) } : l)));
        }
        setDirty(true);
        setItemModal(null);
    };

    const applyServer = (ev) => {
        setSaved(ev);
        setForm({
            client_name: ev.client_name || '', event_date: ev.event_date || '', schedule: ev.schedule || '',
            venue: ev.venue || 'La Casita', menu: ev.menu || '', notes: ev.notes || '', planner_id: ev.planner_id,
        });
        setLines(ev.items.map(i => newLine(i.description, i.unit_price, i.quantity)));
        setDirty(false);
    };

    useEffect(() => {
        if (isNew) {
            setForm(EMPTY);
            setSaved(null);
            setLines([]);
            return;
        }
        setLoading(true);
        apiFetch(`/api/casita/events/${eventId}`).then(({ ok, json }) => {
            if (ok) applyServer(json);
            else setError('No se pudo cargar el evento.');
            setLoading(false);
        });
    }, [eventId]);

    // Fill the default lines with catalog prices once the catalog arrives (new budgets only)
    useEffect(() => {
        if (isNew && lines.length === 0 && catalog.length) {
            setLines(DEFAULT_LINES.map(name => {
                const item = catalog.find(c => catalogKey(c.name) === catalogKey(name));
                return newLine(item?.name || name, item?.price || 0, 1);
            }));
        }
    }, [isNew, catalog]);

    const priceByKey = useMemo(() => new Map(catalog.map(c => [catalogKey(c.name), c.price])), [catalog]);

    const setField = (key, value) => { setForm(f => ({ ...f, [key]: value })); setDirty(true); };

    const updateLine = (key, patch) => {
        setLines(ls => ls.map(l => (l._key === key ? applyLineChange(l, patch, priceByKey) : l)));
        setDirty(true);
    };

    const removeLine = (key) => { setLines(ls => ls.filter(l => l._key !== key)); setDirty(true); };
    const addLine = () => { setLines(ls => [...ls, newLine()]); setDirty(true); };

    const budget = lines.reduce((s, l) => s + (Number(l.unit_price) || 0) * (Number(l.quantity) || 0), 0);
    const paid = saved?.paid_total || 0;

    const save = async () => {
        setError(null);
        if (!form.client_name.trim()) { setError('Escribí el nombre del cliente.'); return; }
        const items = lines.filter(l => l.description.trim()).map(l => ({
            description: l.description.trim(), unit_price: Number(l.unit_price) || 0, quantity: Number(l.quantity) || 0,
        }));
        setSaving(true);
        const payload = { ...form, event_date: form.event_date || null, planner_id: form.planner_id || null, items };
        const { ok, json } = await apiFetch(isNew ? '/api/casita/events' : `/api/casita/events/${eventId}`, {
            method: isNew ? 'POST' : 'PUT', body: JSON.stringify(payload),
        });
        setSaving(false);
        if (!ok) { setError(json?.message || 'No se pudo guardar.'); return; }
        showToast(json.message);
        applyServer(json.event);
        if (isNew) onSaved(json.event.id);
    };

    const remove = async () => {
        const { ok, json } = await apiFetch(`/api/casita/events/${eventId}`, { method: 'DELETE' });
        setConfirmDelete(false);
        if (ok) { showToast(json.message); onBack(); }
    };

    const printDoc = (withPayments) => {
        if (dirty) { setError('Guardá los cambios antes de imprimir.'); return; }
        printBudget(saved, { withPayments });
    };

    if (loading) return <Empty>Cargando evento…</Empty>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className={btnGhost} title="Volver al registro"><ArrowLeft className="w-4 h-4" /></button>
                    <div>
                        <h2 className="text-xl font-black tracking-tight">{isNew ? 'Nuevo registro' : form.client_name || 'Evento'}</h2>
                        <p className="text-xs text-zinc-500">{isNew ? 'Datos del evento y presupuesto' : `${fmtDate(form.event_date)} · ${form.venue}`}</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {!isNew && <button onClick={() => printDoc(false)} className={btnGhost}><Printer className="w-4 h-4" /> Presupuesto</button>}
                    {!isNew && <button onClick={() => printDoc(true)} className={btnGhost}><Receipt className="w-4 h-4" /> Recibo</button>}
                    {!isNew && <button onClick={() => onGoLosses(Number(eventId))} className={btnGhost}><PackageX className="w-4 h-4" /> Pérdidas</button>}
                </div>
            </div>

            {error && <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold">{error}</div>}

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <Kpi label="Total de presupuesto" value={gs(budget)} />
                <Kpi label="Total abonado" value={gs(paid)} tone="emerald" />
                <Kpi label="Saldo pendiente" value={gs(budget - paid)} tone="amber" hint={dirty ? 'Sin guardar' : undefined} />
            </div>

            <Card title="Datos del evento">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Cliente" className="md:col-span-2">
                        <input value={form.client_name} onChange={e => setField('client_name', e.target.value)} list="casita-clients" className={inputCls} placeholder="Ej: María y Michael (o elegí un cliente existente)" />
                        <datalist id="casita-clients">{clientNames.map(n => <option key={n} value={n} />)}</datalist>
                    </Field>
                    <Field label="Fecha del evento">
                        <DateInput value={form.event_date} onChange={v => setField('event_date', v)} className={inputCls} />
                    </Field>
                    <Field label="Horario">
                        <input value={form.schedule} onChange={e => setField('schedule', e.target.value)} className={inputCls} placeholder="21:00hs hasta las 03:00hs" />
                    </Field>
                    <Field label="Lugar">
                        <input value={form.venue} onChange={e => setField('venue', e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Menú">
                        <input value={form.menu} onChange={e => setField('menu', e.target.value)} list="casita-menus" className={inputCls} />
                        <datalist id="casita-menus">{menus.map(m => <option key={m} value={m} />)}</datalist>
                    </Field>
                    <Field label="Wedding planner (opcional)">
                        <select value={form.planner_id || ''} onChange={e => setField('planner_id', e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                            <option value="">Sin wedding planner</option>
                            {planners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </Field>
                    <Field label="Observaciones" className="md:col-span-2">
                        <input value={form.notes} onChange={e => setField('notes', e.target.value)} className={inputCls} />
                    </Field>
                </div>
            </Card>

            <Card title="Presupuesto" actions={<button onClick={addLine} className={btnGhost}><Plus className="w-4 h-4" /> Agregar línea</button>}>
                {lines.length === 0 ? <Empty>Agregá las líneas del presupuesto.</Empty> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[640px]">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-wider text-zinc-500 text-left">
                                    <th className="pb-2 pr-2">Detalle</th><th className="pb-2 pr-2 w-36 text-right">Precio</th>
                                    <th className="pb-2 pr-2 w-24 text-right">Cantidad</th><th className="pb-2 pr-2 w-36 text-right">Total</th><th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map(l => (
                                    <tr key={l._key}>
                                        <td className="py-1 pr-2"><CatalogInput
                                                value={l.description}
                                                onChange={v => updateLine(l._key, { description: v })}
                                                items={catalog}
                                                placeholder="Buscar en la lista de precios…"
                                                onEdit={item => setItemModal({ item })}
                                                onCreate={name => setItemModal({ initialName: name, lineKey: l._key })}
                                            /></td>
                                        <td className="py-1 pr-2"><MoneyInput value={l.unit_price} onChange={v => updateLine(l._key, { unit_price: v })} /></td>
                                        <td className="py-1 pr-2"><MoneyInput value={l.quantity} onChange={v => updateLine(l._key, { quantity: v })} /></td>
                                        <td className="py-1 pr-2 text-right font-black tabular-nums">{gs((Number(l.unit_price) || 0) * (Number(l.quantity) || 0))}</td>
                                        <td className="py-1"><button onClick={() => removeLine(l._key)} className="p-2 rounded-lg text-zinc-400 hover:text-rose-600" title="Quitar línea"><X className="w-4 h-4" /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr><td colSpan={3} className="pt-3 text-right text-[11px] font-bold uppercase text-zinc-500">Total de presupuesto</td><td className="pt-3 pr-2 text-right text-sm font-black tabular-nums">{gs(budget)}</td><td /></tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </Card>

            {/* Save right after the budget, where the editing ends */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                {error && <span className="text-xs font-bold text-rose-600">{error}</span>}
                {dirty && !error && <span className="text-xs text-amber-600 font-bold">Hay cambios sin guardar</span>}
                <button onClick={save} disabled={saving} className={`${btnPrimary} px-6 py-3`}>
                    <Save className="w-4 h-4" /> {saving ? 'Guardando…' : dirty || isNew ? 'Guardar' : 'Guardado'}
                </button>
            </div>

            {isNew ? (
                <p className="text-xs text-zinc-500">Guardá el registro para poder cargar pagos y garantías.</p>
            ) : (
                <PaymentsCard event={saved} showToast={showToast} onChanged={ev => { setSaved(ev); }} />
            )}

            {!isNew && (
                <div className="flex justify-end">
                    <button onClick={() => setConfirmDelete(true)} className={btnDanger}><Trash2 className="w-4 h-4" /> Eliminar evento</button>
                </div>
            )}

            {itemModal && (
                <CatalogItemModal
                    item={itemModal.item}
                    initialName={itemModal.initialName}
                    showToast={showToast}
                    onClose={() => setItemModal(null)}
                    onSaved={onCatalogSaved}
                />
            )}

            <ConfirmModal
                isOpen={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={remove}
                title="Eliminar evento"
                message={`Se borra "${form.client_name}" con su presupuesto, pagos y pérdidas. No se puede deshacer.`}
                confirmText="Sí, eliminar"
            />
        </div>
    );
}

/** Payment history of one event (hojas Pagos y Garantía) */
export function PaymentsCard({ event, showToast, onChanged }) {
    const [draft, setDraft] = useState({ paid_on: todayIso(), kind: 'pago', amount: '', note: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const add = async () => {
        setError(null);
        if (!draft.amount) { setError('Escribí el monto.'); return; }
        setSaving(true);
        const { ok, json } = await apiFetch(`/api/casita/events/${event.id}/payments`, { method: 'POST', body: JSON.stringify(draft) });
        setSaving(false);
        if (!ok) { setError(json?.message || 'No se pudo registrar el pago.'); return; }
        showToast(json.message);
        onChanged(json.event);
        setDraft(d => ({ ...d, amount: '', note: '' }));
    };

    const remove = async (paymentId) => {
        const { ok, json } = await apiFetch(`/api/casita/payments/${paymentId}`, { method: 'DELETE' });
        if (ok) { showToast(json.message); onChanged(json.event); }
    };

    // Correct a registered payment (date, reason, amount, detail)
    const [editing, setEditing] = useState(null);
    const saveEdit = async () => {
        setError(null);
        if (!editing.amount) { setError('Escribí el monto.'); return; }
        const { id, paid_on, kind, amount, note } = editing;
        const { ok, json } = await apiFetch(`/api/casita/payments/${id}`, { method: 'PUT', body: JSON.stringify({ paid_on, kind, amount, note }) });
        if (!ok) { setError(json?.message || 'No se pudo guardar el pago.'); return; }
        showToast(json.message);
        onChanged(json.event);
        setEditing(null);
    };

    return (
        <Card title="Pagos y garantía" actions={<div className="flex items-center gap-2 text-xs"><span className="text-zinc-500">Saldo</span><b className="tabular-nums">{gs(event.balance)}</b><BalanceBadge balance={event.balance} /></div>}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end mb-4">
                <Field label="Fecha"><DateInput value={draft.paid_on} onChange={v => setDraft(d => ({ ...d, paid_on: v }))} className={inputCls} /></Field>
                <Field label="Motivo">
                    <select value={draft.kind} onChange={e => setDraft(d => ({ ...d, kind: e.target.value }))} className={inputCls}>
                        {Object.entries(KIND_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                </Field>
                <Field label="Monto"><MoneyInput value={draft.amount} onChange={v => setDraft(d => ({ ...d, amount: v }))} /></Field>
                <Field label="Detalle"><input value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} className={inputCls} placeholder="Transferencia, efectivo…" /></Field>
                <button onClick={add} disabled={saving} className={btnPrimary}><Wallet className="w-4 h-4" /> Registrar</button>
            </div>
            {error && <div className="mb-3 text-xs font-bold text-rose-600">{error}</div>}

            {(event.payments || []).length === 0 ? <Empty>Todavía no hay pagos.</Empty> : (
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-zinc-500 text-left">
                            <th className="pb-2">Fecha</th><th className="pb-2">Motivo</th><th className="pb-2">Detalle</th><th className="pb-2 text-right">Monto</th><th className="w-16" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {event.payments.map(p => editing?.id === p.id ? (
                            <tr key={p.id} className="bg-rose-50/40 dark:bg-zinc-800/40">
                                <td className="py-1.5 pr-2 w-36"><DateInput value={editing.paid_on} onChange={v => setEditing(e => ({ ...e, paid_on: v }))} className={inputCls} /></td>
                                <td className="py-1.5 pr-2 w-32">
                                    <select value={editing.kind} onChange={e => setEditing(x => ({ ...x, kind: e.target.value }))} className={inputCls}>
                                        {Object.entries(KIND_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                                    </select>
                                </td>
                                <td className="py-1.5 pr-2"><input value={editing.note || ''} onChange={e => setEditing(x => ({ ...x, note: e.target.value }))} className={inputCls} /></td>
                                <td className="py-1.5 pr-2 w-36"><MoneyInput value={editing.amount} onChange={v => setEditing(x => ({ ...x, amount: v }))} /></td>
                                <td className="py-1.5 text-right whitespace-nowrap">
                                    <button onClick={saveEdit} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40" title="Guardar"><Check className="w-4 h-4" /></button>
                                    <button onClick={() => { setEditing(null); setError(null); }} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700" title="Cancelar"><X className="w-4 h-4" /></button>
                                </td>
                            </tr>
                        ) : (
                            <tr key={p.id} className="tabular-nums">
                                <td className="py-2">{fmtDate(p.paid_on)}</td>
                                <td className="py-2 font-bold">{KIND_LABELS[p.kind] || p.kind}</td>
                                <td className="py-2 text-zinc-500">{p.note || '—'}</td>
                                <td className={`py-2 text-right font-black ${p.kind === 'devolucion' ? 'text-rose-600' : 'text-emerald-600'}`}>{p.kind === 'devolucion' ? '− ' : ''}{gs(p.amount)}</td>
                                <td className="py-2 text-right whitespace-nowrap">
                                    <button onClick={() => setEditing({ ...p })} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-white" title="Editar pago"><Pencil className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => remove(p.id)} className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600" title="Eliminar pago"><Trash2 className="w-3.5 h-3.5" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr><td colSpan={3} className="pt-3 text-right text-[11px] font-bold uppercase text-zinc-500">Total abonado</td><td className="pt-3 text-right font-black tabular-nums">{gs(event.paid_total)}</td><td /></tr>
                    </tfoot>
                </table>
            )}
        </Card>
    );
}
