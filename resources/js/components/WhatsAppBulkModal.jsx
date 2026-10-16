import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, ExternalLink, Copy, Check, X, Filter, Send, Sparkles, CheckCircle2, Play, Square, ShieldAlert, Clock, Pause, AlertCircle, RefreshCw } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { apiFetch } from '../api';

export default function WhatsAppBulkModal({ isOpen, onClose, event, guests, onMarkSent, bulkProgress, onBulkChanged }) {
    const [copiedId, setCopiedId] = useState(null);
    const [sentStatusFilter, setSentStatusFilter] = useState('not_sent'); // 'not_sent', 'all', 'sent'
    const [sendingAutoId, setSendingAutoId] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, variant: 'info', confirmText: 'Confirmar' });

    // Live Bulk Sending State (runs in real time in the browser tab)
    const [isLiveSending, setIsLiveSending] = useState(false);
    const [isLivePaused, setIsLivePaused] = useState(false);
    const [delaySeconds, setDelaySeconds] = useState(15);
    const [currentSendingId, setCurrentSendingId] = useState(null);
    const [liveProgress, setLiveProgress] = useState({
        current: 0,
        total: 0,
        currentName: '',
        status: 'idle', // 'idle' | 'sending' | 'waiting' | 'paused' | 'done'
        countdown: 0
    });
    const [liveStats, setLiveStats] = useState({ success: 0, failed: 0 });
    const [guestErrors, setGuestErrors] = useState({});

    // Legacy server background queue state
    const [bulkQueued, setBulkQueued] = useState(null);

    const isStoppingRef = useRef(false);
    const isPausedRef = useRef(false);

    useEffect(() => {
        isPausedRef.current = isLivePaused;
    }, [isLivePaused]);

    if (!isOpen) return null;

    const pendingGuestsCount = guests.filter(g => g.whatsapp_status === 'not_sent').length;
    const sentGuestsCount = guests.filter(g => g.whatsapp_status === 'sent').length;

    const filteredGuests = guests.filter(g => {
        if (sentStatusFilter === 'not_sent') return g.whatsapp_status === 'not_sent';
        if (sentStatusFilter === 'sent') return g.whatsapp_status === 'sent';
        return true;
    });

    const formatLocation = (loc) => {
        if (!loc || loc === 'Por confirmar') return 'Por confirmar';
        if (loc.startsWith('http://') || loc.startsWith('https://')) return loc;
        const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(loc)}`;
        return `${loc}\n🗺️ Ver en Google Maps: ${mapsUrl}`;
    };

    const formatMessage = (guest) => {
        const template = event?.message_template || "¡Hola {nombre}! Te invitamos al evento de {pareja} ✨\n📍 Lugar: {lugar}\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir";
        const rsvpUrl = `${window.location.origin}/confirmar/${guest.token}`;
        const formattedLocation = formatLocation(event?.location);

        // Same rule as the server: groups get "Lugares reservados" before "Respondé..." (or where {lugares} is)
        const places = Math.max(1, guest.passes || 1);
        const placesText = places === 1 ? '1 persona' : `${places} personas`;
        let text = template;
        if (places > 1 && !text.includes('{lugares}')) {
            const line = '🎟️ Lugares reservados: *{lugares}*';
            text = /^.*respond/im.test(text) ? text.replace(/^(.*respond)/im, `${line}\n\n$1`) : `${text}\n\n${line}`;
        }

        return text
            .replace(/\{nombre\}/g, guest.name)
            .replace(/\{pareja\}/g, event?.couple_names || event?.title || 'nosotros')
            .replace(/\{lugares\}/g, placesText)
            .replace(/\{lugar\}/g, formattedLocation)
            .replace(/\{link\}/g, rsvpUrl);
    };

    const getWhatsAppUrl = (guest) => {
        let cleanPhone = guest.phone.replace(/[^\d]/g, '');
        const text = encodeURIComponent(formatMessage(guest));
        return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`;
    };

    const handleSendClick = (guest) => {
        if (guest.whatsapp_status === 'sent') return;
        const url = getWhatsAppUrl(guest);
        window.open(url, '_blank');
        onMarkSent(guest.id);
    };

    const handleCopyClick = (guest) => {
        const text = formatMessage(guest);
        navigator.clipboard.writeText(text);
        setCopiedId(guest.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Single send via Baileys API
    const handleAutoSend = async (guest) => {
        if (guest.whatsapp_status === 'sent') return;

        setSendingAutoId(guest.id);
        setErrorMessage(null);
        try {
            const { ok, json } = await apiFetch(`/api/guests/${guest.id}/send-auto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'invitation', skip_throttle: true })
            });
            if (ok) {
                onMarkSent(guest.id);
            } else {
                setErrorMessage(json?.message || 'No se pudo enviar el mensaje.');
            }
        } catch (err) {
            console.error(err);
            setErrorMessage('No se pudo conectar con el bot Baileys. Verificá que el servicio en el puerto 3001 esté activo.');
        } finally {
            setSendingAutoId(null);
        }
    };

    // START LIVE BULK SENDING LOOP
    const startLiveBulkSending = async () => {
        const pendingList = guests.filter(g => g.whatsapp_status === 'not_sent');
        if (pendingList.length === 0) {
            setErrorMessage('Todos los invitados ya tienen el mensaje enviado.');
            return;
        }

        // Clear any previous queued banner and errors
        setBulkQueued(null);
        setErrorMessage(null);
        setGuestErrors({});
        isStoppingRef.current = false;
        isPausedRef.current = false;
        setIsLiveSending(true);
        setIsLivePaused(false);
        setLiveStats({ success: 0, failed: 0 });

        const total = pendingList.length;

        for (let i = 0; i < total; i++) {
            if (isStoppingRef.current) break;

            // Handle user pause
            while (isPausedRef.current) {
                if (isStoppingRef.current) break;
                setLiveProgress(prev => ({ ...prev, status: 'paused' }));
                await new Promise(r => setTimeout(r, 500));
            }
            if (isStoppingRef.current) break;

            const guest = pendingList[i];
            setCurrentSendingId(guest.id);
            setLiveProgress({
                current: i + 1,
                total,
                currentName: guest.name,
                status: 'sending',
                countdown: 0
            });

            // Send to current guest
            try {
                const { ok, json } = await apiFetch(`/api/guests/${guest.id}/send-auto`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'invitation', skip_throttle: true })
                });

                if (ok) {
                    onMarkSent(guest.id);
                    setLiveStats(prev => ({ ...prev, success: prev.success + 1 }));
                } else {
                    setLiveStats(prev => ({ ...prev, failed: prev.failed + 1 }));
                    setGuestErrors(prev => ({ ...prev, [guest.id]: json?.message || 'Error al enviar' }));
                }
            } catch (err) {
                setLiveStats(prev => ({ ...prev, failed: prev.failed + 1 }));
                setGuestErrors(prev => ({ ...prev, [guest.id]: 'Error de conexión con el bot' }));
            }

            setCurrentSendingId(null);

            // If not the last guest and not stopped, wait safe interval with countdown
            if (i < total - 1 && !isStoppingRef.current) {
                setLiveProgress(prev => ({ ...prev, status: 'waiting' }));

                for (let c = delaySeconds; c > 0; c--) {
                    if (isStoppingRef.current) break;
                    while (isPausedRef.current) {
                        if (isStoppingRef.current) break;
                        setLiveProgress(prev => ({ ...prev, status: 'paused' }));
                        await new Promise(r => setTimeout(r, 500));
                    }
                    setLiveProgress(prev => ({ ...prev, countdown: c, status: 'waiting' }));
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }

        setIsLiveSending(false);
        setCurrentSendingId(null);
        setLiveProgress(prev => ({
            ...prev,
            status: isStoppingRef.current ? 'idle' : 'done',
            countdown: 0
        }));
    };

    const stopLiveBulkSending = () => {
        isStoppingRef.current = true;
        setIsLiveSending(false);
        setIsLivePaused(false);
        setCurrentSendingId(null);
        setLiveProgress(prev => ({ ...prev, status: 'idle', countdown: 0 }));
    };

    const togglePauseLive = () => {
        setIsLivePaused(prev => !prev);
    };

    // Bulk send in the background on the server: pauses, daily quota and sending window are applied there,
    // and it goes on with this window or the browser closed (progress: bulkProgress, polled by the panel)
    const startServerBulk = async () => {
        setErrorMessage(null);
        const { ok, json } = await apiFetch(`/api/events/${event.id}/send-bulk-queue`, {
            method: 'POST',
            body: JSON.stringify({ mode: 'invitation' }),
        });
        if (ok) {
            setBulkQueued({ message: json?.message });
            onBulkChanged && onBulkChanged();
        } else {
            setErrorMessage(json?.message || 'No se pudo programar el envío.');
        }
    };

    const handlePromptStartBulk = () => {
        const pendingList = guests.filter(g => g.whatsapp_status === 'not_sent');
        if (pendingList.length === 0) {
            setErrorMessage('Todos los invitados ya tienen el mensaje enviado.');
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: 'Iniciar envío masivo',
            message: `Se van a enviar ${pendingList.length} invitaciones en segundo plano, de a una y con pausas para proteger el número. Podés cerrar esta ventana o el navegador: el envío sigue solo y ves el avance en el panel.`,
            confirmText: `Iniciar envío (${pendingList.length})`,
            variant: 'info',
            onConfirm: () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                startServerBulk();
            }
        });
    };

    const stopLegacyBulkQueue = async () => {
        if (!window.confirm('¿Detener el envío? Los mensajes que todavía no salieron no se enviarán.')) return;
        try {
            await apiFetch(`/api/events/${event.id}/cancel-bulk-queue`, { method: 'POST' });
        } catch (e) {
            console.error(e);
        } finally {
            setBulkQueued(null);
            onBulkChanged && onBulkChanged();
        }
    };

    const progressPercentage = liveProgress.total > 0
        ? Math.round((liveProgress.current / liveProgress.total) * 100)
        : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-md animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-50 dark:bg-green-950/40 rounded-2xl text-green-600 dark:text-green-400 border border-green-200/50">
                            <MessageSquare className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-zinc-900 dark:text-white">Envío Masivo de Invitaciones</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Enviá automáticamente las invitaciones por WhatsApp con seguimiento en vivo y protección anti-spam.</p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        disabled={isLiveSending}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        title={isLiveSending ? "Pausá o detené el envío antes de cerrar" : "Cerrar ventana"}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* LIVE BULK SENDING PROGRESS PANEL */}
                {isLiveSending ? (
                    <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-teal-500/10 dark:from-emerald-950/60 dark:via-zinc-900 dark:to-teal-950/40 border-b border-emerald-500/30 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="relative flex items-center justify-center">
                                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping absolute" />
                                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 relative" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-zinc-900 dark:text-white">
                                            {liveProgress.status === 'sending' && `Enviando ${liveProgress.current} de ${liveProgress.total}: ${liveProgress.currentName}`}
                                            {liveProgress.status === 'waiting' && `Esperando pausa anti-bloqueo... (Siguiente: ${liveProgress.current + 1} de ${liveProgress.total})`}
                                            {liveProgress.status === 'paused' && `Envío en Pausa (${liveProgress.current} de ${liveProgress.total})`}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                        {liveProgress.status === 'waiting'
                                            ? `Próximo mensaje se enviará en ${liveProgress.countdown}s para proteger tu línea de WhatsApp...`
                                            : `Procesando invitación por Bot Baileys...`}
                                    </p>
                                </div>
                            </div>

                            {/* Control Buttons */}
                            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                <button
                                    onClick={togglePauseLive}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-md"
                                >
                                    {isLivePaused ? <Play className="w-3.5 h-3.5 fill-white" /> : <Pause className="w-3.5 h-3.5 fill-white" />}
                                    <span>{isLivePaused ? 'Reanudar' : 'Pausar'}</span>
                                </button>
                                <button
                                    onClick={stopLiveBulkSending}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md"
                                >
                                    <Square className="w-3.5 h-3.5 fill-white" />
                                    <span>Detener</span>
                                </button>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                <span>Progreso en Vivo</span>
                                <span className="text-emerald-600 dark:text-emerald-400">{progressPercentage}% ({liveProgress.current}/{liveProgress.total})</span>
                            </div>
                            <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-300 rounded-full"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>
                        </div>

                        {/* Stats Badges */}
                        <div className="flex items-center gap-3 flex-wrap text-xs font-bold pt-1">
                            <span className="px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Enviados con éxito: {liveStats.success}
                            </span>
                            <span className="px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-600" /> Restantes: {Math.max(0, liveProgress.total - liveProgress.current)}
                            </span>
                            {liveStats.failed > 0 && (
                                <span className="px-3 py-1 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Errores: {liveStats.failed}
                                </span>
                            )}
                            {liveProgress.status === 'waiting' && (
                                <span className="px-3 py-1 rounded-xl bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-300/60 dark:border-teal-800 flex items-center gap-1.5 animate-pulse">
                                    ⏱ Pausa activa: {liveProgress.countdown}s
                                </span>
                            )}
                        </div>
                    </div>
                ) : liveProgress.status === 'done' ? (
                    <div className="p-4 bg-emerald-500/10 dark:bg-emerald-950/40 border-b border-emerald-500/30 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-md">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-200">¡Envío Masivo Completado!</h3>
                                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                    Se enviaron exitosamente {liveStats.success} mensajes. {liveStats.failed > 0 && `Hubo ${liveStats.failed} errores.`}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setLiveProgress(prev => ({ ...prev, status: 'idle' }))}
                            className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Aceptar
                        </button>
                    </div>
                ) : (bulkProgress?.active || bulkQueued) ? (
                    <div className="p-4 bg-emerald-500/10 dark:bg-emerald-950/40 border-b border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="space-y-1 text-xs flex-1">
                            <div className="flex items-center gap-2 font-black text-emerald-700 dark:text-emerald-300">
                                <Clock className="w-4 h-4 text-emerald-500" />
                                <span>
                                    Envío en curso{bulkProgress?.active ? `: ${bulkProgress.sent} de ${bulkProgress.total} enviados (${bulkProgress.percent}%)` : ''}
                                </span>
                            </div>
                            {bulkProgress?.active && (
                                <div className="h-1.5 rounded-full bg-emerald-200/60 dark:bg-emerald-900/50 overflow-hidden max-w-md">
                                    <div className="h-full bg-emerald-500" style={{ width: `${Math.round((bulkProgress.sent / Math.max(1, bulkProgress.total)) * 100)}%` }} />
                                </div>
                            )}
                            <p className="text-zinc-600 dark:text-zinc-400">
                                {bulkProgress?.waiting
                                    || (bulkProgress?.next_at ? `Próximo envío a las ${new Date(bulkProgress.next_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} (pausa anti-bloqueo entre mensajes).` : null)
                                    || bulkQueued?.message
                                    || 'Los mensajes salen de a uno, con pausas para proteger el número.'}
                            </p>
                            <p className="text-zinc-500 text-[11px]">Podés cerrar esta ventana o el navegador: el envío sigue en el servidor.</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={onClose}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shrink-0"
                            >
                                <span>Seguir en segundo plano</span>
                            </button>
                            <button
                                onClick={stopLegacyBulkQueue}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-950/50 hover:text-rose-600 transition-colors"
                            >
                                <Square className="w-3.5 h-3.5" />
                                <span>Detener envío</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            <ShieldAlert className="w-4 h-4 text-emerald-500" />
                            <span>Pausas anti-bloqueo automáticas entre mensajes. El envío sigue aunque cierres el navegador.</span>
                        </div>

                        {pendingGuestsCount > 0 ? (
                            <button
                                onClick={handlePromptStartBulk}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white text-xs font-black shadow-lg shadow-green-500/20 transition-all active:scale-95"
                                title={`Enviar en segundo plano a los ${pendingGuestsCount} invitados pendientes`}
                            >
                                <Play className="w-4 h-4 fill-white" />
                                <span>Iniciar Envío Masivo ({pendingGuestsCount})</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800 text-xs font-bold">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span>Todos los mensajes han sido enviados ({sentGuestsCount})</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Active Flyer Notification */}
                {event?.cover_photo_url && (
                    <div className="px-6 py-2.5 bg-rose-50/70 dark:bg-rose-950/30 border-b border-rose-100 dark:border-rose-900/40 flex items-center gap-3">
                        <img
                            src={event.cover_photo_url}
                            alt="Flyer"
                            className="w-8 h-10 object-cover rounded-lg shadow-sm border border-rose-200 dark:border-rose-800 shrink-0"
                        />
                        <div className="text-xs">
                            <span className="font-bold text-rose-700 dark:text-rose-300">Flyer de Invitación Activo: </span>
                            <span className="text-zinc-600 dark:text-zinc-400">El bot enviará automáticamente esta tarjeta con tu texto debajo como pie de foto (*caption*).</span>
                        </div>
                    </div>
                )}

                {/* Filter & Subheader */}
                <div className="px-6 py-3 bg-zinc-100/60 dark:bg-zinc-800/20 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Filter Status */}
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            <Filter className="w-4 h-4 text-zinc-400" />
                            <span>Filtrar:</span>
                            <div className="flex gap-1 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                <button
                                    onClick={() => setSentStatusFilter('not_sent')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${sentStatusFilter === 'not_sent' ? 'bg-green-500 text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                >
                                    Pendientes ({pendingGuestsCount})
                                </button>
                                <button
                                    onClick={() => setSentStatusFilter('sent')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${sentStatusFilter === 'sent' ? 'bg-green-500 text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                >
                                    Enviados ({sentGuestsCount})
                                </button>
                                <button
                                    onClick={() => setSentStatusFilter('all')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${sentStatusFilter === 'all' ? 'bg-green-500 text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                >
                                    Todos ({guests.length})
                                </button>
                            </div>
                        </div>
                    </div>

                    <span className="text-xs text-zinc-500 font-medium">
                        {filteredGuests.length} personas en lista
                    </span>
                </div>

                {/* List of Guests with Message Action */}
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    {filteredGuests.length === 0 ? (
                        <div className="text-center py-12 text-zinc-400 text-sm">
                            No hay invitados que coincidan con este filtro.
                        </div>
                    ) : (
                        filteredGuests.map(guest => {
                            const isSent = guest.whatsapp_status === 'sent';
                            const msgPreview = formatMessage(guest);
                            const isSendingNow = currentSendingId === guest.id || sendingAutoId === guest.id;
                            const hasError = guestErrors[guest.id];

                            return (
                                <div
                                    key={guest.id}
                                    className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                                        isSendingNow
                                            ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/30 shadow-md'
                                            : isSent
                                            ? 'bg-zinc-50/50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-80'
                                            : hasError
                                            ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-green-300 dark:hover:border-green-800 shadow-sm'
                                    }`}
                                >
                                    {/* Left: Guest details & message preview */}
                                    <div className="space-y-1 max-w-xl">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-sm text-zinc-900 dark:text-white">{guest.name}</span>
                                            <span className="text-xs font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">{guest.phone}</span>

                                            {/* People of the invitation (and what they confirmed, if different) */}
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-900" title="Lugares reservados en la invitación">
                                                🎟️ {Math.max(1, guest.passes || 1)} {Math.max(1, guest.passes || 1) === 1 ? 'persona' : 'personas'}
                                            </span>
                                            {['confirmed', 'attended'].includes(guest.status) && guest.confirmed_passes > 0 && guest.confirmed_passes !== guest.passes && (
                                                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400" title="Lo que respondió el invitado">
                                                    ✅ confirmaron {guest.confirmed_passes}
                                                </span>
                                            )}

                                            {isSendingNow && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-300 animate-pulse">
                                                    <Clock className="w-3 h-3 text-amber-600" /> Enviando ahora...
                                                </span>
                                            )}

                                            {isSent && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-900">
                                                    <CheckCircle2 className="w-3 h-3" /> Enviado
                                                </span>
                                            )}

                                            {hasError && !isSent && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-900" title={hasError}>
                                                    <AlertCircle className="w-3 h-3" /> Error: {hasError}
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl italic font-sans border border-zinc-100 dark:border-zinc-800">
                                            "{msgPreview}"
                                        </p>
                                    </div>

                                    {/* Right: Actions */}
                                    {isSent ? (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-bold shadow-sm">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                <span>Enviado</span>
                                            </span>

                                            <button
                                                onClick={() => handleCopyClick(guest)}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                                title="Copiar texto del mensaje"
                                            >
                                                {copiedId === guest.id ? (
                                                    <>
                                                        <Check className="w-4 h-4 text-emerald-500" />
                                                        <span className="text-emerald-600 dark:text-emerald-400">Copiado</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-4 h-4" />
                                                        <span>Copiar</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => handleAutoSend(guest)}
                                                disabled={isSendingNow || isLiveSending}
                                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                                title="Enviar individualmente por Bot Baileys"
                                            >
                                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                                <span>{isSendingNow ? 'Enviando...' : 'Bot Baileys'}</span>
                                            </button>

                                            <button
                                                onClick={() => handleCopyClick(guest)}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                                title="Copiar texto del mensaje"
                                            >
                                                {copiedId === guest.id ? (
                                                    <>
                                                        <Check className="w-4 h-4 text-emerald-500" />
                                                        <span className="text-emerald-600 dark:text-emerald-400">Copiado</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-4 h-4" />
                                                        <span>Copiar</span>
                                                    </>
                                                )}
                                            </button>

                                            <button
                                                onClick={() => handleSendClick(guest)}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-900 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                                                title="Abrir WhatsApp Web manualmente"
                                            >
                                                <Send className="w-3.5 h-3.5" />
                                                <span>Abrir Web</span>
                                                <ExternalLink className="w-3 h-3 opacity-70" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Error Banner */}
                {errorMessage && (
                    <div className="mx-6 mt-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between gap-3">
                        <span>{errorMessage}</span>
                        <button onClick={() => setErrorMessage(null)} className="text-rose-500 font-bold hover:underline">Cerrar</button>
                    </div>
                )}

                {/* Footer */}
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLiveSending}
                        className="px-5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        Cerrar Ventana
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                variant={confirmModal.variant}
            />
        </div>
    );
}

