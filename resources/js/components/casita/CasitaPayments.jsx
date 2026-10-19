import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, ShieldCheck, Search } from 'lucide-react';
import { apiFetch } from '../../api';
import { gs, fmtDate, KIND_LABELS } from './casitaUtils';
import { PageHeader, Card, Kpi, Empty, Field, DateRange, appendRange, inputCls } from './CasitaUi';
import { PaymentsCard } from './CasitaEventEditor';
import CasitaEventPicker from './CasitaEventPicker';

/**
 * mode="payments"   → hoja Pagos: registrar pagos de un evento + historial de todos los cobros.
 * mode="guarantees" → hoja Garantía: garantía y seña cobradas por evento, y devoluciones.
 */
export default function CasitaPayments({ mode = 'payments', showToast, onOpenEvent }) {
    const isGuarantees = mode === 'guarantees';
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [kind, setKind] = useState('');
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [selected, setSelected] = useState(null);
    const [range, setRange] = useState({ from: '', to: '' });

    const load = async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (isGuarantees) params.set('kind', 'garantia,sena,devolucion');
        else if (kind) params.set('kind', kind);
        appendRange(params, range);
        const { ok, json } = await apiFetch(`/api/casita/payments?${params}`);
        if (ok) setPayments(json);
        setLoading(false);
    };
    useEffect(() => { load(); }, [kind, mode, range]);

    useEffect(() => {
        if (!selectedId) { setSelected(null); return; }
        apiFetch(`/api/casita/events/${selectedId}`).then(({ ok, json }) => ok && setSelected(json));
    }, [selectedId]);

    // A row of the history loads that event above, where its payments can be corrected
    const selectEvent = (id) => { setSelectedId(id); window.scrollTo({ top: 0, behavior: 'smooth' }); };

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? payments.filter(p => (p.casita_event?.client_name || '').toLowerCase().includes(q)) : payments;
    }, [payments, search]);

    const byKind = visible.reduce((acc, p) => ({ ...acc, [p.kind]: (acc[p.kind] || 0) + p.amount }), {});

    // Guarantees grouped per event, like the Garantía sheet (Fecha, Cliente, Garantía, Seña, Total)
    const perEvent = useMemo(() => {
        if (!isGuarantees) return [];
        const map = new Map();
        visible.forEach(p => {
            const id = p.casita_event_id;
            const row = map.get(id) || { id, event: p.casita_event, garantia: 0, sena: 0, devolucion: 0, last: p.paid_on };
            row[p.kind] += p.amount;
            if (p.paid_on > row.last) row.last = p.paid_on;
            map.set(id, row);
        });
        return [...map.values()].sort((a, b) => (b.event?.event_date || '').localeCompare(a.event?.event_date || ''));
    }, [visible, isGuarantees]);

    return (
        <div className="space-y-6">
            <PageHeader
                icon={isGuarantees ? ShieldCheck : Wallet}
                title={isGuarantees ? 'Garantías' : 'Pagos'}
                subtitle={isGuarantees ? 'Garantía y seña cobradas por evento, y lo devuelto' : 'Registrá cobros y consultá el historial de pagos'}
            />

            <Card title={isGuarantees ? 'Registrar garantía o devolución' : 'Registrar un pago'}>
                <Field label="Evento" className="max-w-xl">
                    <CasitaEventPicker value={selectedId} onChange={setSelectedId} />
                </Field>
            </Card>

            {selected && (
                <div className="flex items-center justify-between gap-3 -mb-3">
                    <div className="text-xs text-zinc-500"><b className="text-zinc-900 dark:text-white">{selected.client_name}</b> · {fmtDate(selected.event_date)}</div>
                    <button onClick={() => onOpenEvent(selected.id)} className="text-xs font-bold text-rose-600 hover:underline">Abrir ficha del evento →</button>
                </div>
            )}
            {selected && (
                <PaymentsCard event={selected} showToast={showToast} onChanged={ev => { setSelected(ev); load(); }} />
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {isGuarantees ? (<>
                    <Kpi label="Garantías cobradas" value={gs(byKind.garantia)} tone="emerald" />
                    <Kpi label="Señas cobradas" value={gs(byKind.sena)} tone="emerald" />
                    <Kpi label="Devuelto" value={gs(byKind.devolucion)} tone="rose" />
                    <Kpi label="Eventos" value={perEvent.length} />
                </>) : (<>
                    <Kpi label="Cobrado (pagos)" value={gs(byKind.pago)} tone="emerald" />
                    <Kpi label="Garantías y señas" value={gs((byKind.garantia || 0) + (byKind.sena || 0))} tone="emerald" />
                    <Kpi label="Devoluciones" value={gs(byKind.devolucion)} tone="rose" />
                    <Kpi label="Movimientos" value={visible.length} />
                </>)}
            </div>

            <Card title="Historial">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente…" className={`${inputCls} pl-9`} />
                    </div>
                    {!isGuarantees && (
                        <select value={kind} onChange={e => setKind(e.target.value)} className={inputCls}>
                            <option value="">Todos los motivos</option>
                            {Object.entries(KIND_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                        </select>
                    )}
                </div>
                <div className="mb-4">
                    <DateRange value={range} onChange={setRange} />
                    {(range.from || range.to) && <p className="text-[11px] text-zinc-500 mt-1.5">Se filtra por la fecha del pago. Los totales de arriba son de este período.</p>}
                </div>

                {loading ? <Empty>Cargando…</Empty> : visible.length === 0 ? <Empty>No hay movimientos.</Empty> : isGuarantees ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-wider text-zinc-500 text-left">
                                    <th className="pb-2">Evento</th><th className="pb-2">Cliente</th><th className="pb-2 text-right">Garantía</th>
                                    <th className="pb-2 text-right">Seña</th><th className="pb-2 text-right">Total</th><th className="pb-2 text-right">Devuelto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {perEvent.map(r => (
                                    <tr key={r.id} onClick={() => selectEvent(r.id)} title="Ver y editar sus pagos" className="cursor-pointer hover:bg-rose-50/50 dark:hover:bg-zinc-800/40 tabular-nums">
                                        <td className="py-2">{fmtDate(r.event?.event_date)}</td>
                                        <td className="py-2 font-black">{r.event?.client_name}</td>
                                        <td className="py-2 text-right">{gs(r.garantia)}</td>
                                        <td className="py-2 text-right">{gs(r.sena)}</td>
                                        <td className="py-2 text-right font-black">{gs(r.garantia + r.sena)}</td>
                                        <td className="py-2 text-right text-rose-600">{r.devolucion ? gs(r.devolucion) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-wider text-zinc-500 text-left">
                                    <th className="pb-2">Fecha</th><th className="pb-2">Cliente</th><th className="pb-2">Motivo</th><th className="pb-2">Detalle</th><th className="pb-2 text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {visible.map(p => (
                                    <tr key={p.id} onClick={() => selectEvent(p.casita_event_id)} title="Ver y editar los pagos de este evento" className="cursor-pointer hover:bg-rose-50/50 dark:hover:bg-zinc-800/40 tabular-nums">
                                        <td className="py-2">{fmtDate(p.paid_on)}</td>
                                        <td className="py-2 font-black">{p.casita_event?.client_name}</td>
                                        <td className="py-2">{KIND_LABELS[p.kind] || p.kind}</td>
                                        <td className="py-2 text-zinc-500">{p.note || '—'}</td>
                                        <td className={`py-2 text-right font-black ${p.kind === 'devolucion' ? 'text-rose-600' : 'text-emerald-600'}`}>{p.kind === 'devolucion' ? '− ' : ''}{gs(p.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
