import React, { useEffect, useState } from 'react';
import { Home, Plus, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../api';
import { gs, fmtDate } from './casitaUtils';
import { PageHeader, Card, Kpi, Empty, BalanceBadge, btnPrimary, btnGhost } from './CasitaUi';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function CasitaDashboard({ onOpenEvent, onNewEvent, onGoImport }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        const { ok, json } = await apiFetch('/api/casita/summary');
        if (ok) setData(json);
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const t = data?.totals;

    return (
        <div className="space-y-6">
            <PageHeader icon={Home} title="La Casita · Resumen" subtitle="Facturación, cobros y próximos eventos del salón">
                <button onClick={load} className={btnGhost} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</button>
                <button onClick={onNewEvent} className={btnPrimary}><Plus className="w-4 h-4" /> Nuevo registro</button>
            </PageHeader>

            {data && t.events === 0 && (
                <Card>
                    <div className="text-center py-6 space-y-3">
                        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Todavía no hay eventos registrados.</p>
                        <p className="text-xs text-zinc-500">Podés cargar el historial desde la planilla de Excel o registrar un evento nuevo.</p>
                        <div className="flex justify-center gap-2">
                            <button onClick={onGoImport} className={btnGhost}>Importar Excel</button>
                            <button onClick={onNewEvent} className={btnPrimary}>Nuevo registro</button>
                        </div>
                    </div>
                </Card>
            )}

            {t && t.events > 0 && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Kpi label="Eventos registrados" value={t.events.toLocaleString('es-PY')} hint={`${t.upcoming_count} por realizarse`} />
                        <Kpi label="Total presupuestado" value={gs(t.budget_total)} />
                        <Kpi label="Total cobrado" value={gs(t.paid_total)} tone="emerald" />
                        <Kpi label="Saldo pendiente" value={gs(t.balance)} tone="amber" hint={`${gs(t.upcoming_balance)} de eventos próximos`} />
                    </div>

                    <div className="grid lg:grid-cols-2 gap-6">
                        <Card title="Próximos eventos">
                            {data.upcoming.length === 0 ? <Empty>No hay eventos próximos.</Empty> : (
                                <EventTable events={data.upcoming} onOpenEvent={onOpenEvent} />
                            )}
                        </Card>
                        <Card title="Eventos realizados con saldo pendiente">
                            {data.overdue.length === 0 ? <Empty>Todos los eventos realizados están pagados.</Empty> : (
                                <EventTable events={data.overdue} onOpenEvent={onOpenEvent} />
                            )}
                        </Card>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-6">
                        <Card title="Por año" className="lg:col-span-2">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-[10px] uppercase tracking-wider text-zinc-500 text-left">
                                            <th className="py-2">Año</th><th className="py-2 text-right">Eventos</th><th className="py-2 text-right">Presupuestado</th>
                                            <th className="py-2 text-right">Cobrado</th><th className="py-2 text-right">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {data.by_year.map(y => (
                                            <tr key={y.year} className="tabular-nums">
                                                <td className="py-2 font-black">{y.year}</td>
                                                <td className="py-2 text-right">{y.events}</td>
                                                <td className="py-2 text-right">{gs(y.budget_total)}</td>
                                                <td className="py-2 text-right text-emerald-600">{gs(y.paid_total)}</td>
                                                <td className="py-2 text-right text-amber-600">{gs(y.balance)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                        <Card title="Menús más vendidos">
                            <ul className="space-y-2 text-xs">
                                {data.menus.map(m => (
                                    <li key={m.name} className="flex justify-between gap-2">
                                        <span className="truncate text-zinc-700 dark:text-zinc-300">{m.name}</span>
                                        <span className="font-black tabular-nums">{m.events}</span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    </div>

                    <Card title="Eventos por mes (todos los años)">
                        <div className="grid grid-cols-6 md:grid-cols-12 gap-2 text-center">
                            {data.by_month.map((n, i) => (
                                <div key={MONTHS[i]} className="rounded-2xl bg-rose-50/60 dark:bg-zinc-800/60 py-3">
                                    <div className="text-[10px] font-bold uppercase text-zinc-500">{MONTHS[i]}</div>
                                    <div className="text-base font-black tabular-nums">{n}</div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
}

function EventTable({ events, onOpenEvent }) {
    return (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {events.map(ev => (
                <button key={ev.id} onClick={() => onOpenEvent(ev.id)} className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-rose-50/50 dark:hover:bg-zinc-800/40 rounded-xl px-2 transition-colors">
                    <div className="min-w-0">
                        <div className="text-xs font-black truncate">{ev.client_name}</div>
                        <div className="text-[11px] text-zinc-500">{fmtDate(ev.event_date)} · {ev.menu || 'Sin menú'}</div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="text-xs font-black tabular-nums">{gs(ev.balance)}</div>
                        <BalanceBadge balance={ev.balance} />
                    </div>
                </button>
            ))}
        </div>
    );
}
