import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Send, ArrowLeft, Plus, X, Bot, Phone, Check } from 'lucide-react';
import { apiFetch } from '../api';

const LIST_REFRESH_MS = 15000;
const THREAD_REFRESH_MS = 6000;

const STATUS = {
    confirmed: 'Confirmado',
    attended: 'Ingresó',
    declined: 'No asiste',
    pending: 'Pendiente',
};

const AVATAR_COLORS = ['#25d366', '#00a884', '#53bdeb', '#ff7a59', '#a78bfa', '#f59e0b', '#ec4899', '#14b8a6'];
const avatarColor = (name) => AVATAR_COLORS[[...String(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

const dayLabel = (iso) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Hoy';
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
};
const timeLabel = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '');
const listTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString() ? timeLabel(iso) : d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
};

// WhatsApp formatting (*bold*) shown as in the app
const renderText = (text) =>
    String(text || '').split(/(\*[^*\n]+\*)/g).map((part, i) =>
        /^\*[^*\n]+\*$/.test(part) ? <strong key={i}>{part.slice(1, -1)}</strong> : <React.Fragment key={i}>{part}</React.Fragment>
    );

function Avatar({ name, size = 40 }) {
    return (
        <div
            className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
            style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.38 }}
        >
            {initials(name)}
        </div>
    );
}

/**
 * "WhatsApp": the guests' chats of the event like WhatsApp Web. Write to any guest (also to someone who never
 * wrote), read the whole conversation (bot, organization and guest) and answer. Messages go out from the
 * number each guest talks to.
 */
export default function WhatsAppWeb({ event, guests = [], user, showToast }) {
    const [chats, setChats] = useState([]);
    const [search, setSearch] = useState('');
    const [newChat, setNewChat] = useState(false);
    const [openId, setOpenId] = useState(null);
    const [thread, setThread] = useState(null);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef(null);
    const lastCountRef = useRef(0);

    const loadChats = async () => {
        if (!event?.id) return;
        const { ok, json } = await apiFetch(`/api/events/${event.id}/conversations`);
        if (ok && json) setChats(json.conversations || []);
    };

    const loadThread = async (guestId) => {
        const { ok, json } = await apiFetch(`/api/guests/${guestId}/conversation`);
        if (ok && json) {
            setThread(json);
            // Scroll down only when there are new messages
            if ((json.messages || []).length !== lastCountRef.current) {
                lastCountRef.current = (json.messages || []).length;
                setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            }
        }
    };

    useEffect(() => {
        setOpenId(null);
        setThread(null);
        loadChats();
        const timer = setInterval(loadChats, LIST_REFRESH_MS);
        return () => clearInterval(timer);
    }, [event?.id]);

    useEffect(() => {
        if (!openId) return;
        lastCountRef.current = 0;
        loadThread(openId);
        const timer = setInterval(() => loadThread(openId), THREAD_REFRESH_MS);
        return () => clearInterval(timer);
    }, [openId]);

    const chatIds = useMemo(() => new Set(chats.map((c) => c.guest_id)), [chats]);
    const q = search.trim().toLowerCase();
    const matches = (name, phone) => !q || String(name).toLowerCase().includes(q) || String(phone || '').includes(q);

    const visibleChats = chats.filter((c) => matches(c.name, c.phone));
    // Every guest of the event with a phone: to start a chat with anyone
    const contacts = useMemo(
        () => guests.filter((g) => g.phone && (newChat || !chatIds.has(g.id))).sort((a, b) => a.name.localeCompare(b.name)),
        [guests, chatIds, newChat]
    );
    const visibleContacts = contacts.filter((g) => matches(g.name, g.phone));

    const openChat = (guestId) => {
        setOpenId(guestId);
        setNewChat(false);
        setDraft('');
        setChats((prev) => prev.map((c) => (c.guest_id === guestId ? { ...c, unread: 0 } : c)));
    };

    const send = async (e) => {
        e?.preventDefault();
        const text = draft.trim();
        if (!text || !openId || sending) return;
        setSending(true);
        const { ok, json } = await apiFetch(`/api/guests/${openId}/conversation`, {
            method: 'POST',
            body: JSON.stringify({ message: text }),
        });
        setSending(false);
        if (ok) {
            setDraft('');
            loadThread(openId);
            loadChats();
        } else {
            showToast && showToast(json?.message || 'No se pudo enviar el mensaje.');
        }
    };

    if (!event) {
        return <div className="p-12 text-center text-xs text-zinc-500">Seleccioná un evento para ver sus chats de WhatsApp.</div>;
    }

    const openGuest = thread?.guest || guests.find((g) => g.id === openId);
    const messages = thread?.messages || [];
    const neverContacted = openGuest && openGuest.whatsapp_status !== 'sent' && messages.length === 0;

    return (
        <div className="rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-[#111b21] flex h-[calc(100vh-170px)] min-h-[520px]">
            {/* ───── Chat list ───── */}
            <div className={`w-full md:w-[360px] md:border-r border-zinc-200 dark:border-[#222d34] flex-col bg-white dark:bg-[#111b21] ${openId ? 'hidden md:flex' : 'flex'}`}>
                <div className="h-14 px-4 flex items-center justify-between bg-[#f0f2f5] dark:bg-[#202c33]">
                    <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={event.couple_names || event.title} size={34} />
                        <div className="min-w-0">
                            <div className="text-sm font-bold text-zinc-900 dark:text-[#e9edef] truncate">{event.couple_names || event.title}</div>
                            <div className="text-[11px] text-zinc-500 dark:text-[#8696a0]">{chats.length} chats · {guests.length} invitados</div>
                        </div>
                    </div>
                    <button
                        onClick={() => { setNewChat((v) => !v); setSearch(''); }}
                        title={newChat ? 'Volver a los chats' : 'Nuevo chat'}
                        className="p-2 rounded-full text-zinc-600 dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/5"
                    >
                        {newChat ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </button>
                </div>

                <div className="px-3 py-2 bg-white dark:bg-[#111b21]">
                    <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={newChat ? 'Buscar invitado para escribirle...' : 'Buscar un chat o invitado'}
                            className="w-full text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#202c33] text-zinc-900 dark:text-[#e9edef] placeholder:text-zinc-500 pl-10 pr-3 py-2 outline-none"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {!newChat && visibleChats.map((c) => (
                        <button
                            key={c.guest_id}
                            onClick={() => openChat(c.guest_id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] ${openId === c.guest_id ? 'bg-[#f0f2f5] dark:bg-[#2a3942]' : ''}`}
                        >
                            <Avatar name={c.name} size={46} />
                            <div className="flex-1 min-w-0 border-b border-zinc-100 dark:border-[#222d34] pb-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[15px] text-zinc-900 dark:text-[#e9edef] truncate">{c.name}</span>
                                    <span className={`text-[11px] shrink-0 ${c.unread ? 'text-[#25d366] font-bold' : 'text-zinc-500 dark:text-[#8696a0]'}`}>{listTime(c.last_message_at)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-0.5">
                                    <span className="text-[13px] text-zinc-500 dark:text-[#8696a0] truncate">
                                        {c.last_message?.author === 'bot' && <Bot className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                                        {c.last_message?.author === 'planner' && <Check className="w-3.5 h-3.5 inline mr-0.5 -mt-0.5 text-[#53bdeb]" />}
                                        {c.last_message?.body || STATUS[c.status] || ''}
                                    </span>
                                    {c.unread > 0 && (
                                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#25d366] text-white text-[11px] font-bold flex items-center justify-center shrink-0">{c.unread}</span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}

                    {/* Guests without a chat yet (or all of them in "Nuevo chat") */}
                    {(newChat || q) && visibleContacts.length > 0 && (
                        <div className="px-4 pt-4 pb-2 text-[13px] font-medium text-[#008069] dark:text-[#00a884]">
                            {newChat ? 'Invitados del evento' : 'Otros invitados'}
                        </div>
                    )}
                    {(newChat || q) && visibleContacts.slice(0, 200).map((g) => (
                        <button
                            key={`g${g.id}`}
                            onClick={() => openChat(g.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]"
                        >
                            <Avatar name={g.name} size={46} />
                            <div className="flex-1 min-w-0 border-b border-zinc-100 dark:border-[#222d34] pb-2.5">
                                <div className="text-[15px] text-zinc-900 dark:text-[#e9edef] truncate">{g.name}</div>
                                <div className="text-[13px] text-zinc-500 dark:text-[#8696a0] truncate">{g.phone} · {STATUS[g.status] || ''}</div>
                            </div>
                        </button>
                    ))}

                    {!newChat && !q && visibleChats.length === 0 && (
                        <div className="p-8 text-center text-xs text-zinc-500 dark:text-[#8696a0]">
                            Todavía no hay chats. Tocá <strong>+</strong> para escribirle a un invitado.
                        </div>
                    )}
                </div>
            </div>

            {/* ───── Conversation ───── */}
            <div className={`flex-1 flex-col min-w-0 ${openId ? 'flex' : 'hidden md:flex'}`}>
                {!openGuest ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-[#f0f2f5] dark:bg-[#222e35] border-b-[6px] border-[#25d366]">
                        <div className="w-20 h-20 rounded-full bg-[#25d366]/15 flex items-center justify-center mb-4"><Phone className="w-9 h-9 text-[#25d366]" /></div>
                        <div className="text-2xl font-light text-zinc-700 dark:text-[#e9edef]">WhatsApp del evento</div>
                        <p className="text-sm text-zinc-500 dark:text-[#8696a0] mt-2 max-w-md">
                            Elegí un chat o tocá <strong>+</strong> para escribirle a cualquier invitado. Los mensajes salen desde el número con el que habla cada invitado.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="h-14 px-3 flex items-center gap-3 bg-[#f0f2f5] dark:bg-[#202c33]">
                            <button onClick={() => { setOpenId(null); setThread(null); }} className="md:hidden p-1.5 rounded-full text-zinc-600 dark:text-[#aebac1]"><ArrowLeft className="w-5 h-5" /></button>
                            <Avatar name={openGuest.name} size={40} />
                            <div className="min-w-0 flex-1">
                                <div className="text-[15px] text-zinc-900 dark:text-[#e9edef] truncate">{openGuest.name}</div>
                                <div className="text-[12px] text-zinc-500 dark:text-[#8696a0] truncate">
                                    {openGuest.phone}
                                    {openGuest.passes ? ` · ${openGuest.passes} ${openGuest.passes === 1 ? 'persona' : 'personas'}` : ''}
                                    {openGuest.status ? ` · ${STATUS[openGuest.status] || openGuest.status}` : ''}
                                    {openGuest.whatsapp_channel ? ` · ${openGuest.whatsapp_channel === 'cloud' ? 'WhatsApp oficial' : 'bot'}` : ''}
                                </div>
                            </div>
                        </div>

                        <div
                            className="flex-1 overflow-y-auto px-4 md:px-12 py-4 space-y-1 bg-[#efeae2] dark:bg-[#0b141a]"
                            style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
                        >
                            {neverContacted && (
                                <div className="mx-auto max-w-md text-center text-[12px] bg-[#ffeecd] dark:bg-[#182229] text-zinc-700 dark:text-[#ffd279] rounded-lg px-3 py-2 my-2 shadow-sm">
                                    A este invitado todavía no se le escribió. Si el primer mensaje sale por el bot, cuenta en el cupo diario de primeros mensajes.
                                </div>
                            )}
                            {messages.map((m, i) => {
                                const out = m.direction === 'out';
                                const newDay = i === 0 || new Date(messages[i - 1].created_at).toDateString() !== new Date(m.created_at).toDateString();
                                return (
                                    <React.Fragment key={m.id}>
                                        {newDay && (
                                            <div className="flex justify-center my-3">
                                                <span className="text-[12px] px-3 py-1 rounded-lg bg-white/90 dark:bg-[#182229] text-zinc-600 dark:text-[#8696a0] shadow-sm capitalize">{dayLabel(m.created_at)}</span>
                                            </div>
                                        )}
                                        <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] md:max-w-[65%] rounded-lg px-2.5 pt-1.5 pb-1 shadow-sm text-[14.2px] leading-snug ${out
                                                ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-zinc-900 dark:text-[#e9edef] rounded-tr-none'
                                                : 'bg-white dark:bg-[#202c33] text-zinc-900 dark:text-[#e9edef] rounded-tl-none'}`}
                                            >
                                                {out && (
                                                    <div className={`text-[11px] font-bold mb-0.5 ${m.author === 'bot' ? 'text-zinc-500 dark:text-[#8696a0]' : 'text-[#008069] dark:text-[#00a884]'}`}>
                                                        {m.author === 'bot' ? '🤖 Automático' : (m.user?.name || 'Organización')}
                                                    </div>
                                                )}
                                                <div className="whitespace-pre-wrap break-words">{renderText(m.body)}</div>
                                                <div className="flex items-center justify-end gap-1 text-[11px] text-zinc-500 dark:text-[#8696a0] mt-0.5">
                                                    {timeLabel(m.created_at)}
                                                    {out && <Check className="w-3.5 h-3.5 text-[#53bdeb]" />}
                                                </div>
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                            <div ref={bottomRef} />
                        </div>

                        <form onSubmit={send} className="px-3 py-2.5 flex items-end gap-2 bg-[#f0f2f5] dark:bg-[#202c33]">
                            <textarea
                                rows={1}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e); }}
                                maxLength={2000}
                                placeholder={openGuest.phone ? 'Escribí un mensaje' : 'Este invitado no tiene teléfono'}
                                disabled={!openGuest.phone}
                                className="flex-1 resize-none max-h-32 rounded-lg bg-white dark:bg-[#2a3942] text-[15px] text-zinc-900 dark:text-[#e9edef] placeholder:text-zinc-500 px-3 py-2.5 outline-none"
                            />
                            <button
                                disabled={sending || !draft.trim() || !openGuest.phone}
                                className="w-11 h-11 rounded-full bg-[#00a884] hover:bg-[#008f72] text-white flex items-center justify-center disabled:opacity-40 shrink-0"
                                title="Enviar"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
