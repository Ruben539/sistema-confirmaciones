import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { apiFetch } from '../../api';
import { gs, fmtDate, isPast } from './casitaUtils';
import { PageHeader, Card, Empty, BalanceBadge, btnPrimary, inputCls } from './CasitaUi';

export default function CasitaEvents({ onOpenEvent, onNewEvent }) {
    const [events, setEvents] = useState([]);
    const [years, setYears] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState('');
    const [when, setWhen] = useState('');
    const [status, setStatus] = useState('');
    const [planner, setPlanner] = useState('');
    const [planners, setPlanners] = useState([]);

    useEffect(() => {
        const params = new URLSearchParams();
        if (year) params.set('year', year);
        if (when) params.set('when', when);
        if (status) params.set('status', status);
        if (planner) params.set('planner', planner);
        if (when === 'upcoming') params.set('sort', 'date_asc');
        setLoading(true);
        apiFetch(`/api/casita/events?${params}`).then(({ ok, json }) => {
            if (ok) { setEvents(json.events); setYears(json.years); }
            setLoading(false);
        });
    }, [year, when, status, planner]);

    useEffect(() => {
        apiFetch('/api/planners').then(({ ok, json }) => ok && Array.isArray(json) && setPlanners(json));
    }, []);

    // Search runs locally so typing is instant
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return events;
        return events.filter(e => `${e.client_name} ${e.menu || ''}`.toLowerCase().includes(q));
    }, [events, search]);

    const totals = visible.reduce((acc, e) => ({
        budget: acc.budget + e.budget_total, paid: acc.paid + e.paid_total, balance: acc.balance + e.balance,
    }), { budget: 0, paid: 0, balance: 0 });

    return (
        <div className="space-y-6">
            <PageHeader icon={ClipboardList} title="Registro de eventos" subtitle="Cada evento con su presupuesto, pagos y saldo">
                <button onClick={onNewEvent} className={btnPrimary}><Plus className="w-4 h-4" /> Nuevo registro</button>
            </PageHeader>

            <Card>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                    <div className="relative md:col-span-1">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente o menú…" className={`${inputCls} pl-9`} />
                    </div>
                    <select value={year} onChange={e => setYear(e.target.value)} className={inputCls}>
                        <option value="">Todos los años</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={when} onChange={e => setWhen(e.target.value)} className={inputCls}>
                        <option value="">Realizados y próximos</option>
                        <option value="upcoming">Próximos</option>
                        <option value="past">Realizados</option>
                    </select>
                    <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                        <option value="">Cualquier estado de pago</option>
                        <option value="pending">Con saldo pendiente</option>
                        <option value="paid">Pagados</option>
                    </select>
                    <select value={planner} onChange={e => setPlanner(e.target.value)} className={inputCls}>
                        <option value="">Con o sin wedding planner</option>
                        <option value="none">Sin wedding planner</option>
                        {planners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500 mb-3">
                    <span><b className="text-zinc-900 dark:text-white">{visible.length}</b> eventos</span>
                    <span>Presupuestado <b className="text-zinc-900 dark:text-white tabular-nums">{gs(totals.budget)}</b></span>
                    <span>Cobrado <b className="text-emerald-600 tabular-nums">{gs(totals.paid)}</b></span>
                    <span>Saldo <b className="text-amber-600 tabular-nums">{gs(totals.balance)}</b></span>
                </div>

                {loading ? <Empty>Cargando…</Empty> : visible.length === 0 ? <Empty>No hay eventos con esos filtros.</Empty> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-wider text-zinc-500 text-left border-b border-zinc-100 dark:border-zinc-800">
                                    <th className="py-2 pr-3">Fecha</th><th className="py-2 pr-3">Cliente</th><th className="py-2 pr-3">Menú</th><th className="py-2 pr-3">Wedding planner</th>
                                    <th className="py-2 pr-3 text-right">Presupuesto</th><th className="py-2 pr-3 text-right">Cobrado</th>
                                    <th className="py-2 pr-3 text-right">Saldo</th><th className="py-2">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {visible.map(ev => (
                                    <tr key={ev.id} onClick={() => onOpenEvent(ev.id)} className="cursor-pointer hover:bg-rose-50/50 dark:hover:bg-zinc-800/40 tabular-nums">
                                        <td className={`py-2.5 pr-3 whitespace-nowrap ${isPast(ev.event_date) ? 'text-zinc-400' : 'font-bold'}`}>{fmtDate(ev.event_date)}</td>
                                        <td className="py-2.5 pr-3 font-black">{ev.client_name}</td>
                                        <td className="py-2.5 pr-3 text-zinc-500">{ev.menu || '—'}</td>
                                        <td className="py-2.5 pr-3 text-zinc-500">{ev.planner_name || '—'}</td>
                                        <td className="py-2.5 pr-3 text-right">{gs(ev.budget_total)}</td>
                                        <td className="py-2.5 pr-3 text-right text-emerald-600">{gs(ev.paid_total)}</td>
                                        <td className="py-2.5 pr-3 text-right font-black">{gs(ev.balance)}</td>
                                        <td className="py-2.5"><BalanceBadge balance={ev.balance} /></td>
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
