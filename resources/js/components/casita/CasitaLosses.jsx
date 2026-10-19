import React, { useEffect, useState } from 'react';
import { PackageX, Plus, X, Save, Printer } from 'lucide-react';
import { apiFetch } from '../../api';
import { gs, SECTION_LABELS, printSettlement, catalogKey, applyLineChange } from './casitaUtils';
import { PageHeader, Card, Field, Kpi, Empty, MoneyInput, CatalogInput, inputCls, btnPrimary, btnGhost } from './CasitaUi';
import { LogosButton } from './CasitaLogos';
import CasitaEventPicker from './CasitaEventPicker';

const SECTIONS = ['perdida', 'agregado', 'sobrante'];


let key = 0;
const line = (section, description = '', quantity = 1, unit_price = 0) => ({ _key: ++key, section, description, quantity, unit_price });

/** Hoja "Pérdidas": lo que se rompió o se agregó durante el evento, lo que sobró, y el saldo contra la garantía. */
export default function CasitaLosses({ eventId, onChangeEvent, showToast }) {
    const [event, setEvent] = useState(null);
    const [lines, setLines] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [usualLosses, setUsualLosses] = useState([]); // editable in Lista de precios
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        apiFetch('/api/casita/catalog').then(({ ok, json }) => ok && setCatalog(json.filter(i => i.is_active)));
        apiFetch('/api/casita/options?type=perdida').then(({ ok, json }) => ok && setUsualLosses(json.map(o => o.name)));
    }, []);

    const apply = (ev) => {
        setEvent(ev);
        setLines(ev.losses.map(l => line(l.section, l.description, l.quantity, l.unit_price)));
        setDirty(false);
    };

    useEffect(() => {
        if (!eventId) { setEvent(null); setLines([]); return; }
        apiFetch(`/api/casita/events/${eventId}`).then(({ ok, json }) => ok && apply(json));
    }, [eventId]);

    const priceByKey = new Map(catalog.map(c => [catalogKey(c.name), c.price]));
    // Suggestions: usual losses (no list price) plus drinks and glassware from the price list
    const lossItems = [
        ...usualLosses.map(name => ({ name, price: null })),
        ...catalog.filter(c => c.category === 'bebida' || c.category === 'vajilla').map(c => ({ name: c.name, price: c.price })),
    ];

    const update = (k, patch) => {
        setLines(ls => ls.map(l => (l._key === k ? applyLineChange(l, patch, priceByKey) : l)));
        setDirty(true);
    };

    const sum = (section) => lines.filter(l => l.section === section).reduce((s, l) => s + (Number(l.unit_price) || 0) * (Number(l.quantity) || 0), 0);
    const guarantee = event?.settlement?.guarantee || 0;
    const charges = sum('perdida') + sum('agregado');
    const credits = sum('sobrante') + guarantee;
    const result = charges - credits;

    const save = async () => {
        setSaving(true);
        const payload = { lines: lines.filter(l => l.description.trim()).map(({ section, description, quantity, unit_price }) => ({
            section, description: description.trim(), quantity: Number(quantity) || 0, unit_price: Number(unit_price) || 0,
        })) };
        const { ok, json } = await apiFetch(`/api/casita/events/${eventId}/losses`, { method: 'PUT', body: JSON.stringify(payload) });
        setSaving(false);
        if (ok) { showToast(json.message); apply(json.event); }
        else showToast(json?.message || 'No se pudo guardar.');
    };

    return (
        <div className="space-y-6">
            <PageHeader icon={PackageX} title="Pérdidas y bebidas" subtitle="Liquidación después del evento: pérdidas, bebidas agregadas y sobrantes contra la garantía">
                <LogosButton showToast={showToast} focus="real" />
                {event && <button onClick={() => (dirty ? showToast('Guardá los cambios antes de imprimir.') : printSettlement(event))} className={btnGhost}><Printer className="w-4 h-4" /> Imprimir</button>}
                {event && <button onClick={save} disabled={saving || !dirty} className={btnPrimary}><Save className="w-4 h-4" /> {saving ? 'Guardando…' : dirty ? 'Guardar' : 'Guardado'}</button>}
            </PageHeader>

            <Card>
                <Field label="Evento" className="max-w-xl">
                    <CasitaEventPicker value={eventId} onChange={onChangeEvent} />
                </Field>
            </Card>

            {!event ? <Empty>Elegí un evento para cargar su liquidación.</Empty> : (<>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Kpi label="Pérdidas + agregados" value={gs(charges)} tone="rose" />
                    <Kpi label="Bebidas sobrantes" value={gs(sum('sobrante'))} />
                    <Kpi label="Garantía" value={gs(guarantee)} hint={guarantee ? undefined : 'Sin garantía cobrada'} />
                    <Kpi label={result >= 0 ? 'El cliente debe' : 'A devolver al cliente'} value={gs(Math.abs(result))} tone={result >= 0 ? 'amber' : 'emerald'} />
                </div>


                {SECTIONS.map(section => {
                    const rows = lines.filter(l => l.section === section);
                    return (
                        <Card key={section} title={SECTION_LABELS[section]}
                            actions={<button onClick={() => { setLines(ls => [...ls, line(section)]); setDirty(true); }} className={btnGhost}><Plus className="w-4 h-4" /> Agregar</button>}>
                            {rows.length === 0 ? <Empty>Sin líneas.</Empty> : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs min-w-[600px]">
                                        <thead>
                                            <tr className="text-[10px] uppercase tracking-wider text-zinc-500 text-left">
                                                <th className="pb-2 pr-2">Detalle</th><th className="pb-2 pr-2 w-24 text-right">Cantidad</th>
                                                <th className="pb-2 pr-2 w-36 text-right">Precio unitario</th><th className="pb-2 pr-2 w-36 text-right">Total</th><th className="w-8" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map(l => (
                                                <tr key={l._key}>
                                                    <td className="py-1 pr-2"><CatalogInput value={l.description} onChange={v => update(l._key, { description: v })} items={lossItems} /></td>
                                                    <td className="py-1 pr-2"><MoneyInput value={l.quantity} onChange={v => update(l._key, { quantity: v })} /></td>
                                                    <td className="py-1 pr-2"><MoneyInput value={l.unit_price} onChange={v => update(l._key, { unit_price: v })} /></td>
                                                    <td className="py-1 pr-2 text-right font-black tabular-nums">{gs((Number(l.unit_price) || 0) * (Number(l.quantity) || 0))}</td>
                                                    <td className="py-1"><button onClick={() => { setLines(ls => ls.filter(x => x._key !== l._key)); setDirty(true); }} className="p-2 rounded-lg text-zinc-400 hover:text-rose-600"><X className="w-4 h-4" /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr><td colSpan={3} className="pt-3 text-right text-[11px] font-bold uppercase text-zinc-500">Subtotal</td><td className="pt-3 pr-2 text-right font-black tabular-nums">{gs(sum(section))}</td><td /></tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </Card>
                    );
                })}
            </>)}
        </div>
    );
}
