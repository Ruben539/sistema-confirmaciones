import React, { useEffect, useMemo, useState } from 'react';
import { Contact, Search, Save, GitMerge, AlertTriangle, Plus } from 'lucide-react';
import { apiFetch } from '../../api';
import { gs, fmtDate } from './casitaUtils';
import { PageHeader, Card, Kpi, Empty, Field, BalanceBadge, inputCls, btnPrimary, btnGhost } from './CasitaUi';

/** Clientes de La Casita: datos de contacto, historial de eventos y unión de clientes duplicados. */
export default function CasitaClients({ showToast, onOpenEvent, onNewEvent }) {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('recent');
    const [selectedId, setSelectedId] = useState(null);
    const [duplicates, setDuplicates] = useState([]);
    const [showDuplicates, setShowDuplicates] = useState(false);

    const load = async () => {
        const [list, dups] = await Promise.all([apiFetch('/api/casita/clients'), apiFetch('/api/casita/clients/duplicates')]);
        if (list.ok) setClients(list.json);
        if (dups.ok) setDuplicates(dups.json);
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = q ? clients.filter(c => `${c.name} ${c.phone || ''} ${c.email || ''} ${c.document || ''}`.toLowerCase().includes(q)) : [...clients];
        const sorters = {
            recent: (a, b) => (b.last_event || '').localeCompare(a.last_event || ''),
            name: (a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
            events: (a, b) => b.events_count - a.events_count || b.budget_total - a.budget_total,
            amount: (a, b) => b.budget_total - a.budget_total,
            balance: (a, b) => b.balance - a.balance,
        };
        return list.sort(sorters[sort]);
    }, [clients, search, sort]);

    const merge = async (sourceId, intoId) => {
        const { ok, json } = await apiFetch(`/api/casita/clients/${sourceId}/merge`, { method: 'POST', body: JSON.stringify({ into_id: intoId }) });
        showToast(ok ? json.message : (json?.message || 'No se pudo unir.'));
        if (ok) { setSelectedId(json.client_id); load(); }
    };

    const repeat = clients.filter(c => c.events_count > 1).length;

    return (
        <div className="space-y-6">
            <PageHeader icon={Contact} title="Clientes" subtitle="Cada cliente con sus datos de contacto y todos sus eventos">
                <button onClick={onNewEvent} className={btnPrimary}><Plus className="w-4 h-4" /> Nuevo registro</button>
            </PageHeader>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Kpi label="Clientes" value={clients.length.toLocaleString('es-PY')} />
                <Kpi label="Con más de un evento" value={repeat} />
                <Kpi label="Con saldo pendiente" value={clients.filter(c => c.balance > 0).length} tone="amber" />
                <Kpi label="Posibles duplicados" value={duplicates.length} tone={duplicates.length ? 'amber' : 'zinc'} />
            </div>

            {duplicates.length > 0 && (
                <Card
                    title={<span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Nombres parecidos: ¿son el mismo cliente?</span>}
                    actions={<button onClick={() => setShowDuplicates(s => !s)} className={btnGhost}>{showDuplicates ? 'Ocultar' : `Revisar ${duplicates.length}`}</button>}
                >
                    {showDuplicates ? (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {duplicates.map(p => (
                                <div key={`${p.a.id}-${p.b.id}`} className="flex flex-col md:flex-row md:items-center justify-between gap-2 py-2.5 text-xs">
                                    <div>
                                        <b>{p.a.name}</b> <span className="text-zinc-400">({p.a.events_count})</span>
                                        <span className="text-zinc-400 mx-2">↔</span>
                                        <b>{p.b.name}</b> <span className="text-zinc-400">({p.b.events_count})</span>
                                        <span className="ml-2 text-[10px] text-zinc-400">{p.similarity}% parecido</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => merge(p.b.id, p.a.id)} className={btnGhost}><GitMerge className="w-3.5 h-3.5" /> Unir en «{p.a.name}»</button>
                                        <button onClick={() => merge(p.a.id, p.b.id)} className={btnGhost}><GitMerge className="w-3.5 h-3.5" /> Unir en «{p.b.name}»</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-zinc-500">Solo se unen automáticamente los nombres iguales (sin importar acentos ni mayúsculas). Los parecidos los decidís vos: "Ana y Esteban" y "Diana y Esteban" pueden ser clientes distintos.</p>
                    )}
                </Card>
            )}

            <div className="grid lg:grid-cols-5 gap-6">
                <Card className="lg:col-span-2">
                    <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre, teléfono, CI/RUC…" className={`${inputCls} pl-9`} />
                        </div>
                        <select value={sort} onChange={e => setSort(e.target.value)} className={`${inputCls} w-40`}>
                            <option value="recent">Evento más reciente</option>
                            <option value="name">Nombre A-Z</option>
                            <option value="events">Más eventos</option>
                            <option value="amount">Mayor facturación</option>
                            <option value="balance">Mayor saldo</option>
                        </select>
                    </div>
                    <div className="text-[11px] text-zinc-500 mb-2">{visible.length} clientes</div>
                    {loading ? <Empty>Cargando…</Empty> : visible.length === 0 ? <Empty>Sin clientes. Importá el Excel o registrá un evento.</Empty> : (
                        <div className="max-h-[640px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 -mx-2">
                            {visible.map(c => (
                                <button key={c.id} onClick={() => setSelectedId(c.id)}
                                    className={`w-full flex items-center justify-between gap-3 px-2 py-2.5 text-left rounded-xl transition-colors ${selectedId === c.id ? 'bg-rose-50 dark:bg-rose-950/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'}`}>
                                    <div className="min-w-0">
                                        <div className="text-xs font-black truncate">{c.name}</div>
                                        <div className="text-[11px] text-zinc-500 truncate">
                                            {c.events_count} {c.events_count === 1 ? 'evento' : 'eventos'} · último {fmtDate(c.last_event)}{c.phone ? ` · ${c.phone}` : ''}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 tabular-nums">
                                        <div className="text-xs font-bold">{gs(c.budget_total)}</div>
                                        {c.balance > 0 && <div className="text-[10px] font-bold text-amber-600">debe {gs(c.balance)}</div>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </Card>

                <div className="lg:col-span-3">
                    {selectedId ? (
                        <ClientDetail key={selectedId} id={selectedId} clients={clients} showToast={showToast} onOpenEvent={onOpenEvent} onMerge={merge} onSaved={load} />
                    ) : (
                        <Card><Empty>Elegí un cliente para ver sus datos y sus eventos.</Empty></Card>
                    )}
                </div>
            </div>
        </div>
    );
}

function ClientDetail({ id, clients, showToast, onOpenEvent, onMerge, onSaved }) {
    const [client, setClient] = useState(null);
    const [form, setForm] = useState({ name: '', phone: '', email: '', document: '', notes: '' });
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(null);
    const [mergeInto, setMergeInto] = useState('');

    const load = async () => {
        const { ok, json } = await apiFetch(`/api/casita/clients/${id}`);
        if (!ok) return;
        setClient(json);
        setForm({ name: json.name || '', phone: json.phone || '', email: json.email || '', document: json.document || '', notes: json.notes || '' });
        setDirty(false);
    };
    useEffect(() => { load(); }, [id]);

    const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };

    const save = async () => {
        setError(null);
        const { ok, json } = await apiFetch(`/api/casita/clients/${id}`, { method: 'PUT', body: JSON.stringify(form) });
        if (!ok) { setError(json?.message || 'No se pudo guardar.'); return; }
        showToast(json.message);
        load();
        onSaved();
    };

    if (!client) return <Card><Empty>Cargando…</Empty></Card>;

    const others = clients.filter(c => c.id !== client.id);

    return (
        <div className="space-y-6">
            <Card title={client.name} actions={<button onClick={save} disabled={!dirty} className={btnPrimary}><Save className="w-4 h-4" /> {dirty ? 'Guardar' : 'Guardado'}</button>}>
                {error && <div className="mb-3 text-xs font-bold text-rose-600">{error}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Nombre" className="md:col-span-2"><input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} /></Field>
                    <Field label="Teléfono / WhatsApp"><input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder="0981 123456" /></Field>
                    <Field label="Correo"><input value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} /></Field>
                    <Field label="CI / RUC"><input value={form.document} onChange={e => set('document', e.target.value)} className={inputCls} /></Field>
                    <Field label="Notas"><input value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} /></Field>
                </div>
            </Card>

            <div className="grid grid-cols-3 gap-4">
                <Kpi label="Facturado" value={gs(client.budget_total)} />
                <Kpi label="Cobrado" value={gs(client.paid_total)} tone="emerald" />
                <Kpi label="Saldo" value={gs(client.balance)} tone="amber" />
            </div>

            <Card title={`Eventos (${client.events_count})`}>
                {client.events.length === 0 ? <Empty>Sin eventos.</Empty> : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {client.events.map(ev => (
                            <button key={ev.id} onClick={() => onOpenEvent(ev.id)} className="w-full flex items-center justify-between gap-3 py-2.5 px-2 text-left rounded-xl hover:bg-rose-50/50 dark:hover:bg-zinc-800/40">
                                <div className="min-w-0">
                                    <div className="text-xs font-black">{fmtDate(ev.event_date)}</div>
                                    <div className="text-[11px] text-zinc-500 truncate">{ev.menu || 'Sin menú'} · {ev.venue}</div>
                                </div>
                                <div className="text-right shrink-0 tabular-nums">
                                    <div className="text-xs font-bold">{gs(ev.budget_total)}</div>
                                    <BalanceBadge balance={ev.balance} />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </Card>

            <Card title="Unir con otro cliente">
                <p className="text-[11px] text-zinc-500 mb-3">Si es la misma persona cargada con otro nombre, sus eventos pasan a «{client.name}» y el otro cliente se borra.</p>
                <div className="flex gap-2">
                    <select value={mergeInto} onChange={e => setMergeInto(e.target.value)} className={inputCls}>
                        <option value="">Elegí el cliente duplicado…</option>
                        {others.map(c => <option key={c.id} value={c.id}>{c.name} ({c.events_count})</option>)}
                    </select>
                    <button disabled={!mergeInto} onClick={() => { onMerge(Number(mergeInto), client.id); setMergeInto(''); }} className={btnGhost}><GitMerge className="w-4 h-4" /> Unir</button>
                </div>
            </Card>
        </div>
    );
}
