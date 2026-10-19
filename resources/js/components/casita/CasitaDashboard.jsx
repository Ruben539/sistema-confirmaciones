import React, { useEffect, useState } from 'react';
import { Home, Plus, RefreshCw, AlertTriangle, CalendarClock, Wallet } from 'lucide-react';
import { apiFetch } from '../../api';
import { gs, fmtDate } from './casitaUtils';
import { PageHeader, Card, Kpi, Empty, BalanceBadge, DateRange, appendRange, btnPrimary, btnGhost } from './CasitaUi';

const CURRENT_YEAR = new Date().getFullYear();

// "₲ 35,3 M" for chart labels
const gsShort = (n) => {
    const v = Number(n) || 0;
    if (v >= 1e9) return `₲ ${(v / 1e9).toLocaleString('es-PY', { maximumFractionDigits: 1 })} MM`;
    if (v >= 1e6) return `₲ ${(v / 1e6).toLocaleString('es-PY', { maximumFractionDigits: 1 })} M`;
    return gs(v);
};
const pct = (now, before) => (before ? ((now - before) / before) * 100 : undefined);

export default function CasitaDashboard({ onOpenEvent, onNewEvent, onGoImport }) {
    const [year, setYear] = useState(CURRENT_YEAR); // '' = todos los años
    const [range, setRange] = useState({ from: '', to: '' }); // a date range replaces the year
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const ranged = Boolean(range.from || range.to);

    const load = async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (ranged) appendRange(params, range);
        else if (year) params.set('year', year);
        const { ok, json } = await apiFetch(`/api/casita/summary?${params}`);
        setLoading(false);
        if (!ok) { setError(json?.errors?.to?.[0] || json?.message || 'No se pudo cargar el resumen.'); return; }
        setError(null);
        // First visit: if the current year has no events yet, show every year
        if (!ranged && year && json.years.length && !json.years.includes(year) && year === CURRENT_YEAR) { setYear(''); return; }
        setData(json);
    };
    useEffect(() => { load(); }, [year, range]);

    const pickYear = (y) => { setRange({ from: '', to: '' }); setYear(y); };
    const pickRange = (r) => { setRange(r); if (r.from || r.to) setYear(''); };

    const t = data?.totals;
    const prev = data?.previous;
    const empty = data && data.years.length === 0 && t.events === 0;
    const prevLabel = ranged ? 'vs año anterior' : year ? `vs ${year - 1}` : null;
    const periodLabel = ranged
        ? `${range.from ? fmtDate(range.from) : 'el inicio'} – ${range.to ? fmtDate(range.to) : 'hoy'}`
        : year || 'todos los años';

    return (
        <div className="space-y-6">
            <PageHeader icon={Home} title="La Casita · Resumen" subtitle="Facturación, cobros y próximos eventos del salón">
                <button onClick={() => load()} className={btnGhost} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</button>
                <button onClick={onNewEvent} className={btnPrimary}><Plus className="w-4 h-4" /> Nuevo registro</button>
            </PageHeader>

            {empty && (
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

            {data && !empty && (<>
                {/* Period: a year, every year, or a date range */}
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {[['', 'Todos los años'], ...data.years.map(y => [y, String(y)])].map(([value, label]) => (
                            <button key={label} onClick={() => pickYear(value)}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${!ranged && year === value ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-rose-300'}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <DateRange value={range} onChange={pickRange} />
                    {error && <div className="text-xs font-bold text-rose-600">{error}</div>}
                </div>

                <Alerts data={data} onOpenEvent={onOpenEvent} />

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                    <Kpi label="Eventos" value={t.events.toLocaleString('es-PY')} delta={prev && pct(t.events, prev.events)} deltaHint={prevLabel} />
                    <Kpi label="Facturado" value={gsShort(t.budget_total)} delta={prev && pct(t.budget_total, prev.budget_total)} deltaHint={prevLabel} />
                    <Kpi label="Cobrado" value={gsShort(t.paid_total)} tone="emerald" hint={t.budget_total ? `${Math.round((t.paid_total / t.budget_total) * 100)}% de lo facturado` : null} />
                    <Kpi label="Saldo pendiente" value={gsShort(t.balance)} tone="amber" />
                    <Kpi label="Promedio por evento" value={gsShort(t.avg_ticket)} delta={prev?.events ? pct(t.avg_ticket, prev.budget_total / prev.events) : undefined} deltaHint={prevLabel} />
                    <Kpi label="Invitados" value={t.guests.toLocaleString('es-PY')} hint={t.events ? `${Math.round(t.guests / t.events)} por evento` : null} />
                </div>

                <Card title={`Facturación por mes · ${periodLabel}`}
                    actions={data.by_month_previous ? <Legend current={ranged ? 'Período' : year} previous={ranged ? 'Un año antes' : year - 1} /> : null}>
                    <MonthChart months={data.by_month} previous={data.by_month_previous} />
                </Card>

                <div className="grid lg:grid-cols-2 gap-6">
                    <Card title="Próximos eventos" actions={<span className="text-[11px] text-zinc-500">{data.upcoming_stats.count} en total · {gsShort(data.upcoming_stats.balance)} por cobrar</span>}>
                        {data.upcoming.length === 0 ? <Empty>No hay eventos próximos.</Empty> : (
                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {data.upcoming.map(ev => (
                                    <EventRow key={ev.id} ev={ev} onOpenEvent={onOpenEvent}
                                        sub={<>
                                            <span className={ev.days_left <= 7 ? 'font-bold text-rose-600' : ''}>{daysLabel(ev.days_left)}</span>
                                            {' · '}{fmtDate(ev.event_date)}
                                            {!ev.guarantee_paid && <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-full">Sin garantía</span>}
                                        </>} />
                                ))}
                            </div>
                        )}
                    </Card>
                    <Card title="Cobros pendientes de eventos realizados" actions={<span className="text-[11px] text-zinc-500">{data.overdue_stats.count} eventos · {gsShort(data.overdue_stats.balance)}</span>}>
                        {data.overdue.length === 0 ? <Empty>Todos los eventos realizados están pagados.</Empty> : (
                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {data.overdue.map(ev => (
                                    <EventRow key={ev.id} ev={ev} onOpenEvent={onOpenEvent} sub={<>{fmtDate(ev.event_date)} · {ev.menu || 'Sin menú'}</>} />
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    <Card title="Menús más vendidos">
                        <Ranking rows={data.menus.map(m => ({ name: m.name, value: m.events, label: `${m.events} ${m.events === 1 ? 'evento' : 'eventos'}`, sub: gsShort(m.total) }))} />
                    </Card>
                    <Card title="Servicios y extras más vendidos">
                        <Ranking rows={data.services.map(s => ({ name: s.name, value: s.total, label: gsShort(s.total), sub: `${s.events} ${s.events === 1 ? 'evento' : 'eventos'}` }))} />
                        <p className="text-[11px] text-zinc-500 mt-3">Sin contar el cubierto por persona ni la garantía.</p>
                    </Card>
                </div>

                <Card title="Por año">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-wider text-zinc-500 text-left">
                                    <th className="py-2">Año</th><th className="py-2 text-right">Eventos</th><th className="py-2 text-right">Facturado</th>
                                    <th className="py-2 text-right">Promedio</th><th className="py-2 text-right">Cobrado</th><th className="py-2 text-right">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {data.by_year.map(y => (
                                    <tr key={y.year} onClick={() => pickYear(y.year)} title={`Ver ${y.year}`}
                                        className={`tabular-nums cursor-pointer hover:bg-rose-50/50 dark:hover:bg-zinc-800/40 ${!ranged && year === y.year ? 'bg-rose-50/60 dark:bg-zinc-800/60' : ''}`}>
                                        <td className="py-2 font-black">{y.year}</td>
                                        <td className="py-2 text-right">{y.events}</td>
                                        <td className="py-2 text-right">{gs(y.budget_total)}</td>
                                        <td className="py-2 text-right text-zinc-500">{gs(y.events ? Math.round(y.budget_total / y.events) : 0)}</td>
                                        <td className="py-2 text-right text-emerald-600">{gs(y.paid_total)}</td>
                                        <td className="py-2 text-right text-amber-600">{gs(y.balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </>)}
        </div>
    );
}

const daysLabel = (d) => (d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `En ${d} días`);

/** Things to act on: guarantees missing for the next 30 days and money owed by past events. */
function Alerts({ data }) {
    const items = [];
    const u = data.upcoming_stats;
    if (u.without_guarantee > 0) {
        items.push({ icon: AlertTriangle, tone: 'amber', text: `${u.without_guarantee} ${u.without_guarantee === 1 ? 'evento' : 'eventos'} de los próximos 30 días sin garantía cobrada.` });
    }
    if (u.next_30_days > 0) {
        items.push({ icon: CalendarClock, tone: 'zinc', text: `${u.next_30_days} ${u.next_30_days === 1 ? 'evento' : 'eventos'} en los próximos 30 días.` });
    }
    if (data.overdue_stats.count > 0) {
        items.push({ icon: Wallet, tone: 'rose', text: `${data.overdue_stats.count} eventos realizados deben ${gs(data.overdue_stats.balance)}.` });
    }
    if (!items.length) return null;

    const tones = {
        amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900',
        rose: 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900',
        zinc: 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800',
    };
    return (
        <div className="grid md:grid-cols-3 gap-3">
            {items.map(({ icon: Icon, tone, text }) => (
                <div key={text} className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-xs font-semibold ${tones[tone]}`}>
                    <Icon className="w-4 h-4 shrink-0 mt-0.5" /> <span>{text}</span>
                </div>
            ))}
        </div>
    );
}

function Legend({ current, previous }) {
    return (
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-rose-500 to-amber-400" /> {current}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-zinc-200 dark:bg-zinc-700" /> {previous}</span>
        </div>
    );
}

/** Bars of revenue per month; the previous year (if any) is drawn as a grey bar behind. */
function MonthChart({ months, previous }) {
    const max = Math.max(1, ...months.map(m => m.budget_total), ...(previous || []).map(m => m.budget_total));
    return (
        <div className="overflow-x-auto">
            <div className="grid gap-1.5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(40px, 1fr))` }}>
                {months.map((m, i) => {
                    const p = previous?.[i];
                    return (
                        <div key={`${m.label}-${i}`} className="flex flex-col items-center gap-1.5"
                            title={`${m.label}: ${m.events} eventos · ${gs(m.budget_total)}${p ? `\nUn año antes: ${p.events} eventos · ${gs(p.budget_total)}` : ''}`}>
                            <div className="text-[10px] font-bold tabular-nums text-zinc-500 h-4">{m.budget_total ? gsShort(m.budget_total).replace('₲ ', '') : ''}</div>
                            <div className="relative w-full h-40 flex items-end justify-center">
                                {p && <div className="absolute bottom-0 w-full rounded-t-lg bg-zinc-200/80 dark:bg-zinc-700/60" style={{ height: `${(p.budget_total / max) * 100}%` }} />}
                                <div className={`relative ${p ? 'w-3/5' : 'w-full'} rounded-t-lg bg-gradient-to-t from-rose-500 to-amber-400`} style={{ height: `${(m.budget_total / max) * 100}%`, minHeight: m.budget_total ? 3 : 0 }} />
                            </div>
                            <div className="text-[10px] font-bold uppercase text-zinc-500 whitespace-nowrap">{m.label}</div>
                            <div className="text-xs font-black tabular-nums">{m.events}</div>
                        </div>
                    );
                })}
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">El número de abajo es la cantidad de eventos del mes.</p>
        </div>
    );
}

function Ranking({ rows }) {
    if (!rows.length) return <Empty>Sin datos.</Empty>;
    const max = Math.max(1, ...rows.map(r => r.value));
    return (
        <ul className="space-y-2.5">
            {rows.map(r => (
                <li key={r.name} className="text-xs">
                    <div className="flex justify-between gap-3">
                        <span className="truncate font-semibold text-zinc-700 dark:text-zinc-300" title={r.name}>{r.name}</span>
                        <span className="shrink-0 tabular-nums"><b>{r.label}</b> <span className="text-zinc-500">· {r.sub}</span></span>
                    </div>
                    <div className="h-1.5 mt-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400" style={{ width: `${(r.value / max) * 100}%` }} />
                    </div>
                </li>
            ))}
        </ul>
    );
}

function EventRow({ ev, sub, onOpenEvent }) {
    return (
        <button onClick={() => onOpenEvent(ev.id)} className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-rose-50/50 dark:hover:bg-zinc-800/40 rounded-xl px-2 transition-colors">
            <div className="min-w-0">
                <div className="text-xs font-black truncate">{ev.client_name}</div>
                <div className="text-[11px] text-zinc-500">{sub}</div>
            </div>
            <div className="text-right shrink-0">
                <div className="text-xs font-black tabular-nums">{gs(ev.balance)}</div>
                <BalanceBadge balance={ev.balance} />
            </div>
        </button>
    );
}
