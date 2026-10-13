import React, { useState, useEffect } from 'react';
import {
    Sparkles, Music, Gift, Tv, Heart, Calendar, MapPin, Disc,
    CheckCircle2, MessageSquare, Send, Clock, ShieldCheck, Link2, HelpCircle, Camera, Star, Eye, ExternalLink
} from 'lucide-react';
import { apiFetch } from '../api';

// Benefits for the event, written for a planner who already uses WhatsApp confirmations
const BENEFITS = [
    {
        icon: Link2, color: 'text-emerald-500',
        title: 'Se suma a lo que ya usás',
        text: 'El link de la invitación va en el mismo mensaje de WhatsApp. El invitado confirma igual que hoy y además la abre desde su celular.',
    },
    {
        icon: HelpCircle, color: 'text-blue-500',
        title: 'Menos consultas repetidas',
        text: 'Ubicación con mapa, horario, dress code y datos para regalos en un solo lugar. Los invitados dejan de preguntarte lo mismo uno por uno.',
    },
    {
        icon: Calendar, color: 'text-rose-500',
        title: 'Invitados más comprometidos',
        text: 'La cuenta regresiva y una invitación con el estilo de los novios generan expectativa y ayudan a que confirmen a tiempo.',
    },
    {
        icon: Disc, color: 'text-teal-500',
        title: 'Una fiesta con la música que quieren',
        text: 'Los invitados piden sus canciones antes del evento y el DJ llega con la lista armada.',
    },
    {
        icon: Tv, color: 'text-pink-500',
        title: 'Un momento wow en el salón',
        text: 'Fotos, videos y dedicatorias de los invitados se proyectan en vivo en la pantalla gigante, con moderación antes de salir.',
    },
    {
        icon: Camera, color: 'text-amber-500',
        title: 'Recuerdos para los novios',
        text: 'Las fotos, videos y mensajes que suben los invitados quedan guardados como recuerdo de la fiesta.',
    },
];

const formatDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : 'Sábado 14/11';
};

/**
 * Shown instead of the Digital Invitation suite when the event doesn't have it:
 * a preview of what it offers and, for planners, a button to request it.
 */
export default function DigitalInvitationDemo({ event, user, showToast, onEnabled }) {
    const isAdmin = user?.role === 'admin';
    const [pendingRequest, setPendingRequest] = useState(null);
    const [notes, setNotes] = useState('');
    const [sending, setSending] = useState(false);
    const [directWhatsAppUrl, setDirectWhatsAppUrl] = useState(null);
    const [enabling, setEnabling] = useState(false);

    // Admin: enable the add-on right here (same as the checkbox in "Configurar Evento")
    const handleEnable = async () => {
        if (!window.confirm(`¿Habilitar la Invitación Digital para el evento de ${event.couple_names || event.title}? Hacelo cuando el cliente la haya contratado.`)) return;
        setEnabling(true);
        const { ok, json } = await apiFetch(`/api/event/${event.id}`, {
            method: 'PUT',
            body: JSON.stringify({ digital_invitation_addon: true }),
        });
        setEnabling(false);
        if (ok && json?.event) {
            if (showToast) showToast('Invitación Digital habilitada para este evento.');
            if (onEnabled) onEnabled(json.event);
        } else if (showToast) {
            showToast(json?.message || 'No se pudo habilitar la Invitación Digital.');
        }
    };

    useEffect(() => {
        if (!isAdmin) fetchPendingRequest();
    }, [event.id]);

    const fetchPendingRequest = async () => {
        try {
            const { ok, json } = await apiFetch('/api/plan-requests');
            if (ok && Array.isArray(json?.requests)) {
                setPendingRequest(json.requests.find(r =>
                    r.event_id === event.id && r.type === 'digital_invitation' && r.status === 'pending'
                ) || null);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleRequest = async () => {
        setSending(true);
        try {
            const { ok, json } = await apiFetch(`/api/events/${event.id}/digital-invitation-request`, {
                method: 'POST',
                body: JSON.stringify({ notes: notes.trim() || null })
            });
            if (ok && json?.request) {
                setPendingRequest(json.request);
                if (json.whatsapp_notified === false && json.direct_whatsapp_url) {
                    setDirectWhatsAppUrl(json.direct_whatsapp_url);
                }
                if (showToast) showToast(json.message);
            } else if (showToast) {
                showToast(json?.message || 'No se pudo enviar la solicitud.');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    const hosts = event.couple_names || event.title || 'Sofía & Mateo';

    // The demo invitation is personalized with this event's names, date and place
    const demoUrl = (() => {
        const params = new URLSearchParams({ n: hosts });
        const date = /^\d{4}-\d{2}-\d{2}/.exec(event.event_date || '');
        if (date) params.set('f', date[0]);
        if (event.location) params.set('l', event.location);
        return `/demo/invitacion?${params.toString()}`;
    })();

    return (
        <div className="space-y-6 font-sans animate-fade-in">
            {/* Header */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 text-white border border-zinc-800 shadow-2xl space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-black tracking-widest uppercase">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ya confirmás invitados por WhatsApp
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                    Llevá el evento de <span className="text-white">{hosts}</span> al siguiente nivel con la{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-400">Invitación Digital</span>
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
                    Podés sumarla a este evento sin cambiar nada de cómo trabajás hoy: las confirmaciones siguen llegando por WhatsApp,
                    y los invitados además reciben una invitación que los entusiasma, les responde todas sus dudas y los hace parte de la fiesta.
                </p>
                <a
                    href={demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-zinc-950 text-xs font-black shadow-lg transition-all hover:scale-105"
                >
                    <Eye className="w-4 h-4" /> Ver invitación de demo con los datos de este evento
                    <ExternalLink className="w-3.5 h-3.5" />
                </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                {/* Phone preview (demo) */}
                <div className="lg:col-span-2 flex justify-center">
                    <div className="relative w-full max-w-[290px] rounded-[2.5rem] border-[10px] border-zinc-900 dark:border-zinc-700 bg-zinc-950 shadow-2xl overflow-hidden" aria-label="Vista previa de ejemplo">
                        <div className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-full bg-black/60 text-[9px] font-black uppercase tracking-wider text-amber-300">Demo</div>
                        <div className="h-40 bg-gradient-to-br from-rose-400 via-amber-300 to-rose-500 flex flex-col items-center justify-center text-center px-4">
                            <Heart className="w-6 h-6 text-white mb-1" />
                            <div className="text-[10px] uppercase tracking-[0.3em] text-white/80">Nos casamos</div>
                            <div className="text-xl font-black text-white leading-tight">{hosts}</div>
                        </div>
                        <div className="p-4 space-y-3 bg-white dark:bg-zinc-900">
                            <div className="grid grid-cols-4 gap-1.5 text-center">
                                {[['24', 'días'], ['08', 'hs'], ['35', 'min'], ['12', 'seg']].map(([n, l]) => (
                                    <div key={l} className="rounded-xl bg-rose-50 dark:bg-zinc-800 py-1.5">
                                        <div className="text-sm font-black text-rose-600 dark:text-rose-300">{n}</div>
                                        <div className="text-[9px] text-zinc-500">{l}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                                <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-rose-500" /> {formatDate(event.event_date)}</div>
                                <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-rose-500" /> {event.location || 'Salón de Eventos'}</div>
                            </div>
                            <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                <Music className="w-3.5 h-3.5" /> Sonando: “Nuestra canción”
                            </div>
                            <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                <Gift className="w-3.5 h-3.5" /> Alias: boda.sofia.mateo <span className="ml-auto underline">Copiar</span>
                            </div>
                            <a
                                href={demoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                            >
                                <Eye className="w-3.5 h-3.5" /> Ver demo
                            </a>
                        </div>
                    </div>
                </div>

                {/* Benefits + call to action */}
                <div className="lg:col-span-3 space-y-5">
                    <h3 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500" /> Cómo mejora tu evento
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {BENEFITS.map(({ icon: Icon, color, title, text }) => (
                            <div key={title} className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex gap-3">
                                <Icon className={`w-5 h-5 shrink-0 ${color}`} />
                                <div>
                                    <div className="text-xs font-black text-zinc-900 dark:text-white">{title}</div>
                                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{text}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-50 to-rose-50 dark:from-amber-950/30 dark:to-rose-950/30 border border-amber-200/70 dark:border-amber-900/40 space-y-3">
                        {isAdmin ? (
                            <div className="space-y-3">
                                <div className="flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                                    <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0" />
                                    <span>
                                        Estás viendo lo mismo que ve la planner: este evento <strong>no tiene la Invitación Digital</strong>,
                                        porque ningún plan la incluye y se habilita por evento cuando el cliente la contrata.
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleEnable}
                                    disabled={enabling}
                                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-black shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span>{enabling ? 'Habilitando...' : 'Habilitar Invitación Digital en este evento'}</span>
                                </button>
                            </div>
                        ) : pendingRequest ? (
                            <div className="space-y-2">
                                <div className="flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                                    <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                                    <span>
                                        <strong>Solicitud enviada</strong> el {new Date(pendingRequest.created_at).toLocaleDateString()}.
                                        La administración te va a contactar para habilitar la Invitación Digital en este evento.
                                    </span>
                                </div>
                                {directWhatsAppUrl && (
                                    <a
                                        href={directWhatsAppUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 dark:text-emerald-400 hover:underline"
                                    >
                                        <MessageSquare className="w-4 h-4" /> Avisar también por WhatsApp
                                    </a>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-500" /> ¿Querés sumarla al evento de {hosts}?
                                </div>
                                <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                                    Envianos la solicitud y te contactamos con el costo. Una vez habilitada, la configurás vos misma desde esta sección,
                                    con el estilo, la música y los datos que quieran los novios.
                                </p>
                                <textarea
                                    rows={2}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    maxLength={1000}
                                    placeholder="Mensaje opcional para la administración (ej: los novios quieren estilo rústico)"
                                    className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleRequest}
                                    disabled={sending}
                                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-black shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                >
                                    <Send className="w-4 h-4" />
                                    <span>{sending ? 'Enviando...' : 'Solicitar Invitación Digital'}</span>
                                </button>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                    Servicio adicional, independiente del plan. Tus confirmaciones por WhatsApp siguen funcionando igual.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
