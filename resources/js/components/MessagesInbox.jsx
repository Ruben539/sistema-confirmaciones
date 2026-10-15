import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Trash2, CheckCircle2, Bot, User, Search, ArrowLeft, Database, X, AlertCircle } from 'lucide-react';
import { apiFetch } from '../api';

const REFRESH_MS = 20000;

const STATUS = {
    confirmed: { label: 'Confirmado', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
    attended: { label: 'Ingresó', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
    declined: { label: 'No asiste', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' },
    pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
};

const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    return d.toDateString() === today.toDateString()
        ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const formatBytes = (b) => (b > 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * "Mensajes": WhatsApp conversations of the selected event. Everything goes through the event's single
 * number, so the planner reads and answers here. The admin can delete messages to save space.
 */
export default function MessagesInbox({ event, user, showToast, onUnreadChange }) {
    const isAdmin = user?.role === 'admin';
    const [conversations, setConversations] = useState([]);
    const [totals, setTotals] = useState({ unread: 0, needs_reply: 0, messages: 0 });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all | attention | unread
    const [search, setSearch] = useState('');
    const [openGuestId, setOpenGuestId] = useState(null);
    const [thread, setThread] = useState(null);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [showCleanup, setShowCleanup] = useState(false);
    const bottomRef = useRef(null);

    const toast = (m) => showToast && showToast(m);

    const loadList = async () => {
        if (!event?.id) return;
        const { ok, json } = await apiFetch(`/api/events/${event.id}/conversations`);
        if (ok && json) {
            setConversations(json.conversations || []);
            setTotals(json.totals || {});
            onUnreadChange && onUnreadChange(json.totals?.unread || 0);
        }
        setLoading(false);
    };

    const loadThread = async (guestId, { scroll = true } = {}) => {
        const { ok, json } = await apiFetch(`/api/guests/${guestId}/conversation`);
        if (ok && json) {
            setThread(json);
            if (scroll) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
    };

    useEffect(() => {
        setLoading(true);
        setOpenGuestId(null);
        setThread(null);
        loadList();
        const timer = setInterval(loadList, REFRESH_MS);
        return () => clearInterval(timer);
    }, [event?.id]);

    // Keep the open conversation fresh too
    useEffect(() => {
        if (!openGuestId) return;
        loadThread(openGuestId);
        const timer = setInterval(() => loadThread(openGuestId, { scroll: false }), REFRESH_MS);
        return () => clearInterval(timer);
    }, [openGuestId]);

    const openConversation = (guestId) => {
        setOpenGuestId(guestId);
        setDraft('');
        // Opening marks it as read on the server; reflect it right away
        setConversations((prev) => prev.map((c) => (c.guest_id === guestId ? { ...c, unread: 0 } : c)));
        setTimeout(loadList, 800);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!draft.trim() || !openGuestId) return;
        setSending(true);
        const { ok, json } = await apiFetch(`/api/guests/${openGuestId}/conversation`, {
            method: 'POST',
            body: JSON.stringify({ message: draft.trim() }),
        });
        setSending(false);
        if (ok) {
            setDraft('');
            loadThread(openGuestId);
            loadList();
        } else {
            toast(json?.message || 'No se pudo enviar el mensaje.');
        }
    };

    const handleResolve = async () => {
        await apiFetch(`/api/guests/${openGuestId}/conversation/resolve`, { method: 'POST' });
        toast('Conversación marcada como resuelta.');
        loadList();
        loadThread(openGuestId, { scroll: false });
    };

    const handleDeleteConversation = async () => {
        if (!window.confirm(`¿Eliminar todos los mensajes con ${thread?.guest?.name}? No se puede deshacer.`)) return;
        const { ok, json } = await apiFetch(`/api/guests/${openGuestId}/conversation`, { method: 'DELETE' });
        if (ok) {
            toast(json?.message);
            setOpenGuestId(null);
            setThread(null);
            loadList();
        }
    };

    const handleDeleteEvent = async () => {
        if (!window.confirm(`¿Eliminar TODOS los mensajes del evento ${event.couple_names || event.title} (${totals.messages} mensajes)? No se puede deshacer.`)) return;
        const { ok, json } = await apiFetch(`/api/events/${event.id}/messages`, { method: 'DELETE' });
        if (ok) {
            toast(json?.message);
            setOpenGuestId(null);
            setThread(null);
            loadList();
        }
    };

    const visible = conversations.filter((c) => {
        if (filter === 'attention' && !c.needs_reply) return false;
        if (filter === 'unread' && !c.unread) return false;
        if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    if (!event) {
        return <div className="p-12 text-center text-xs text-zinc-500">Seleccioná un evento para ver sus mensajes.</div>;
    }

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-rose-500" /> Mensajes
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Conversaciones de WhatsApp de <strong>{event.couple_names || event.title}</strong>. Lo que respondas sale desde el número del sistema.
                    </p>
                </div>
                {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setShowCleanup(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                            <Database className="w-4 h-4 text-amber-500" /> Limpieza
                        </button>
                        {totals.messages > 0 && (
                            <button onClick={handleDeleteEvent} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                                <Trash2 className="w-4 h-4" /> Borrar mensajes del evento
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[60vh]">
                {/* Conversation list */}
                <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden flex flex-col ${openGuestId ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="p-3 space-y-2 border-b border-zinc-100 dark:border-zinc-800">
                        <div className="relative">
                            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar invitado..." className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white pl-9 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-rose-500" />
                        </div>
                        <div className="flex gap-1.5 text-[11px] font-bold">
                            {[
                                ['all', `Todas (${conversations.length})`],
                                ['attention', `Necesitan respuesta (${totals.needs_reply || 0})`],
                                ['unread', `Sin leer (${conversations.filter((c) => c.unread).length})`],
                            ].map(([id, label]) => (
                                <button key={id} onClick={() => setFilter(id)} className={`px-2.5 py-1.5 rounded-lg ${filter === id ? 'bg-rose-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[65vh]">
                        {loading ? (
                            <div className="p-8 text-center text-xs text-zinc-500">Cargando...</div>
                        ) : visible.length === 0 ? (
                            <div className="p-8 text-center text-xs text-zinc-500">
                                {conversations.length === 0 ? 'Todavía no hay mensajes de invitados en este evento.' : 'No hay conversaciones con este filtro.'}
                            </div>
                        ) : (
                            visible.map((c) => (
                                <button
                                    key={c.guest_id}
                                    onClick={() => openConversation(c.guest_id)}
                                    className={`w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors ${openGuestId === c.guest_id ? 'bg-rose-50/70 dark:bg-rose-950/20' : ''}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`text-sm truncate ${c.unread ? 'font-black text-zinc-900 dark:text-white' : 'font-bold text-zinc-800 dark:text-zinc-200'}`}>{c.name}</span>
                                        <span className="text-[10px] text-zinc-400 shrink-0">{formatTime(c.last_message_at)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${(STATUS[c.status] || STATUS.pending).cls}`}>{(STATUS[c.status] || STATUS.pending).label}</span>
                                        {c.needs_reply && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500 text-white">Responder</span>}
                                        {c.channel && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500" title="Número por el que habla">{c.channel === 'cloud' ? 'Oficial' : 'Bot'}</span>}
                                        {c.unread > 0 && <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center">{c.unread}</span>}
                                    </div>
                                    {c.last_message && (
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-1">
                                            {c.last_message.author !== 'guest' && <span className="font-bold">{c.last_message.author === 'bot' ? 'Bot: ' : 'Vos: '}</span>}
                                            {c.last_message.body}
                                        </p>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Conversation */}
                <div className={`lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden flex-col ${openGuestId ? 'flex' : 'hidden lg:flex'}`}>
                    {!thread ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-10 text-xs text-zinc-500 gap-2">
                            <MessageSquare className="w-10 h-10 text-zinc-300" />
                            Elegí una conversación para leerla y responder.
                        </div>
                    ) : (
                        <>
                            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <button onClick={() => { setOpenGuestId(null); setThread(null); }} className="lg:hidden p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                        <ArrowLeft className="w-4 h-4" />
                                    </button>
                                    <div className="min-w-0">
                                        <div className="text-sm font-black text-zinc-900 dark:text-white truncate">{thread.guest.name}</div>
                                        <div className="text-[11px] text-zinc-500">
                                            {thread.guest.phone} · {(STATUS[thread.guest.status] || STATUS.pending).label}
                                            {thread.guest.whatsapp_channel ? ` · por ${thread.guest.whatsapp_channel === 'cloud' ? 'WhatsApp oficial' : 'el bot'}` : ''}
                                            {thread.guest.table_number ? ` · ${thread.guest.table_number}` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {thread.guest.needs_reply && (
                                        <button onClick={handleResolve} title="Ya no necesita respuesta" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Resuelto
                                        </button>
                                    )}
                                    {isAdmin && (
                                        <button onClick={handleDeleteConversation} title="Eliminar conversación" className="p-2 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-zinc-50/60 dark:bg-zinc-950/40 max-h-[55vh]">
                                {thread.messages.map((m) => {
                                    const fromGuest = m.direction === 'in';
                                    return (
                                        <div key={m.id} className={`flex ${fromGuest ? 'justify-start' : 'justify-end'}`}>
                                            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm ${
                                                fromGuest ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-tl-sm'
                                                    : m.author === 'planner' ? 'bg-rose-500 text-white rounded-tr-sm'
                                                    : 'bg-zinc-200/80 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-tr-sm'
                                            }`}>
                                                {!fromGuest && (
                                                    <div className={`text-[10px] font-bold mb-0.5 flex items-center gap-1 ${m.author === 'planner' ? 'text-white/80' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                                        {m.author === 'planner' ? <><User className="w-3 h-3" /> {m.user?.name || 'Organización'}</> : <><Bot className="w-3 h-3" /> Respuesta automática</>}
                                                    </div>
                                                )}
                                                <div className="text-sm whitespace-pre-line break-words">{m.body}</div>
                                                <div className={`text-[10px] mt-1 text-right ${m.author === 'planner' ? 'text-white/70' : 'text-zinc-400'}`}>{formatTime(m.created_at)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={bottomRef} />
                            </div>

                            <form onSubmit={handleSend} className="p-3 border-t border-zinc-100 dark:border-zinc-800 flex items-end gap-2">
                                <textarea
                                    rows={2}
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSend(e); }}
                                    maxLength={2000}
                                    placeholder={`Responder a ${thread.guest.name.split(' ')[0]}... (sale desde el WhatsApp del sistema)`}
                                    className="flex-1 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                                />
                                <button disabled={sending || !draft.trim()} className="h-11 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-50">
                                    <Send className="w-4 h-4" /> {sending ? 'Enviando...' : 'Enviar'}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>

            {isAdmin && showCleanup && <MessagesCleanup onClose={() => setShowCleanup(false)} onDone={(m) => { toast(m); loadList(); }} />}
        </div>
    );
}

/** Admin: how much space messages use, per event, and deletion of old ones. */
function MessagesCleanup({ onClose, onDone }) {
    const [days, setDays] = useState(90);
    const [stats, setStats] = useState(null);
    const [working, setWorking] = useState(false);

    const load = async (d = days) => {
        const { ok, json } = await apiFetch(`/api/messages/stats?older_than_days=${d}`);
        if (ok) setStats(json);
    };

    useEffect(() => { load(); }, []);

    const purge = async () => {
        if (!window.confirm(`¿Eliminar ${stats?.older_count} mensajes con más de ${days} días, de todos los eventos? No se puede deshacer.`)) return;
        setWorking(true);
        const { ok, json } = await apiFetch('/api/messages/purge', { method: 'POST', body: JSON.stringify({ older_than_days: days }) });
        setWorking(false);
        if (ok) {
            onDone(json?.message);
            load();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <div className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2"><Database className="w-5 h-5 text-amber-500" /> Limpieza de mensajes</div>
                    <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4 overflow-y-auto">
                    {!stats ? (
                        <p className="text-xs text-zinc-500">Calculando...</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-3 text-center">
                                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800">
                                    <div className="text-xl font-black text-zinc-900 dark:text-white">{stats.total_messages.toLocaleString('es-ES')}</div>
                                    <div className="text-[11px] text-zinc-500 font-bold">mensajes guardados</div>
                                </div>
                                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800">
                                    <div className="text-xl font-black text-zinc-900 dark:text-white">{formatBytes(stats.total_bytes)}</div>
                                    <div className="text-[11px] text-zinc-500 font-bold">de texto</div>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 space-y-2">
                                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 flex-wrap">
                                    Eliminar mensajes con más de
                                    <input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value) || 1)} onBlur={() => load(days)} className="w-20 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-1.5 text-center" />
                                    días
                                </label>
                                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> {stats.older_count.toLocaleString('es-ES')} mensajes de todos los eventos. El historial de movimientos (confirmaciones, ingresos) no se borra.
                                </p>
                                <button onClick={purge} disabled={working || !stats.older_count} className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black disabled:opacity-50">
                                    {working ? 'Eliminando...' : 'Eliminar mensajes antiguos'}
                                </button>
                            </div>

                            {stats.events.length > 0 && (
                                <div className="space-y-1">
                                    <div className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">Por evento</div>
                                    {stats.events.map((e) => (
                                        <div key={e.event_id} className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                                            <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{e.title}</span>
                                            <span className="text-zinc-500 shrink-0">{e.messages.toLocaleString('es-ES')} · {formatBytes(e.bytes)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
