import React, { useState, useRef } from 'react';
import { MessageSquare, ExternalLink, Copy, Check, X, Filter, Send, Sparkles, CheckCircle2, Play, Square, ShieldAlert, Clock } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { apiFetch } from '../api';

export default function WhatsAppBulkModal({ isOpen, onClose, event, guests, onMarkSent }) {
    const [copiedId, setCopiedId] = useState(null);
    const [sentStatusFilter, setSentStatusFilter] = useState('not_sent'); // 'not_sent', 'all', 'sent'
    const [messageMode, setMessageMode] = useState('invitation'); // 'invitation' or 'reminder'
    const [sendingAutoId, setSendingAutoId] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, variant: 'info', confirmText: 'Confirmar' });

    // Bulk Anti-Spam Queue state
    const [isBulkSending, setIsBulkSending] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentGuest: null, delayCountdown: 0 });
    const cancelBulkRef = useRef(false);

    if (!isOpen) return null;

    const filteredGuests = guests.filter(g => {
        if (sentStatusFilter === 'not_sent') return g.whatsapp_status === 'not_sent';
        if (sentStatusFilter === 'sent') return g.whatsapp_status === 'sent';
        return true;
    });

    const formatMessage = (guest) => {
        let template;
        if (messageMode === 'reminder') {
            const days = event?.rsvp_deadline_days || 7;
            template = `¡Hola {nombre}! ⏰ Recordatorio: Te recordamos que la fecha límite para confirmar tu asistencia al evento de {pareja} vence pronto.\n📍 Lugar: {lugar}\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir`;
        } else {
            template = event?.message_template || "¡Hola {nombre}! Te invitamos al evento de {pareja} ✨\n📍 Lugar: {lugar}\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir";
        }
        const rsvpUrl = `${window.location.origin}/confirmar/${guest.token}`;

        return template
            .replace(/\{nombre\}/g, guest.name)
            .replace(/\{pareja\}/g, event?.couple_names || event?.title || 'nosotros')
            .replace(/\{lugar\}/g, event?.location || 'Por confirmar')
            .replace(/\{link\}/g, rsvpUrl);
    };

    const getWhatsAppUrl = (guest) => {
        let cleanPhone = guest.phone.replace(/[^\d]/g, '');
        const text = encodeURIComponent(formatMessage(guest));
        return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`;
    };

    const handleSendClick = (guest) => {
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

    const handleAutoSend = async (guest) => {
        setSendingAutoId(guest.id);
        setErrorMessage(null);
        try {
            const { ok, json } = await apiFetch(`/api/guests/${guest.id}/send-auto`, { method: 'POST' });
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

    const processBulkQueue = async (pendingGuests) => {
        setIsBulkSending(true);
        cancelBulkRef.current = false;
        setErrorMessage(null);

        for (let i = 0; i < pendingGuests.length; i++) {
            if (cancelBulkRef.current) break;

            const guest = pendingGuests[i];
            setBulkProgress({
                current: i + 1,
                total: pendingGuests.length,
                currentGuest: guest.name,
                delayCountdown: 0
            });

            await handleAutoSend(guest);

            if (i < pendingGuests.length - 1 && !cancelBulkRef.current) {
                for (let secondsLeft = 15; secondsLeft > 0; secondsLeft--) {
                    if (cancelBulkRef.current) break;
                    setBulkProgress(prev => ({ ...prev, delayCountdown: secondsLeft }));
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        setIsBulkSending(false);
        setBulkProgress({ current: 0, total: 0, currentGuest: null, delayCountdown: 0 });
    };

    // Bulk auto-sending queue with 15 second anti-spam delay
    const startBulkQueue = () => {
        const pendingGuests = guests.filter(g => g.whatsapp_status === 'not_sent');
        if (pendingGuests.length === 0) {
            setErrorMessage('No hay invitados pendientes de envío en esta lista.');
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: 'Iniciar Envío Masivo por WhatsApp',
            message: `¿Iniciar envío automático a ${pendingGuests.length} invitados con un intervalo de seguridad de 15 segundos entre cada número para evitar baneos?`,
            confirmText: 'Sí, Iniciar Envío',
            variant: 'info',
            onConfirm: () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                processBulkQueue(pendingGuests);
            }
        });
    };


    const [queueSuccessMessage, setQueueSuccessMessage] = useState(null);
    const [isQueueStarting, setIsQueueStarting] = useState(false);

    const handleStartBackgroundQueue = async () => {
        const pending = filteredGuests.filter(g => g.whatsapp_status === 'not_sent');
        if (pending.length === 0) {
            setErrorMessage('No hay invitados pendientes en la lista filtrada.');
            return;
        }

        setIsQueueStarting(true);
        setErrorMessage(null);
        setQueueSuccessMessage(null);

        try {
            const guestIds = pending.map(g => g.id);
            const { ok, json } = await apiFetch(`/api/events/${event.id}/send-bulk-queue`, {
                method: 'POST',
                body: JSON.stringify({
                    mode: messageMode,
                    guest_ids: guestIds
                })
            });

            if (ok) {
                setQueueSuccessMessage(json?.message || 'Cola iniciada');
            } else {
                setErrorMessage(json?.message || 'No se pudo iniciar la cola en segundo plano.');
            }
        } catch (err) {
            console.error(err);
            setErrorMessage('Error conectando con el servidor.');
        } finally {
            setIsQueueStarting(false);
        }
    };

    const stopBulkQueue = () => {
        cancelBulkRef.current = true;
        setIsBulkSending(false);
    };

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
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Enviá automáticamente por Bot Baileys con protección anti-spam en segundo plano o en tiempo real.</p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        disabled={isBulkSending}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Queue Success Banner */}
                {queueSuccessMessage && (
                    <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                            <span>{queueSuccessMessage}</span>
                        </div>
                        <button onClick={() => setQueueSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Bulk Auto-Sending Queue Status Card */}
                {isBulkSending ? (
                    <div className="p-4 bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-2 font-black text-amber-700 dark:text-amber-300">
                                <Sparkles className="w-4 h-4 animate-spin text-amber-500" />
                                <span>Envío Masivo en Proceso ({bulkProgress.current} de {bulkProgress.total})</span>
                            </div>
                            <p className="text-zinc-600 dark:text-zinc-400">
                                {bulkProgress.delayCountdown > 0 ? (
                                    <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" /> Pausa Anti-Spam: Enviando próximo en {bulkProgress.delayCountdown}s...
                                    </span>
                                ) : (
                                    <span>Enviando mensaje a: <strong>{bulkProgress.currentGuest?.name}</strong></span>
                                )}
                            </p>
                        </div>

                        <button
                            onClick={stopBulkQueue}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shrink-0"
                        >
                            <Square className="w-3.5 h-3.5 fill-white" />
                            <span>Detener Envío</span>
                        </button>
                    </div>
                ) : (
                    <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            <ShieldAlert className="w-4 h-4 text-emerald-500" />
                            <span>Protección Anti-Spam & Spintax Activa (10-15s entre mensajes)</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleStartBackgroundQueue}
                                disabled={isQueueStarting}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-extrabold shadow-lg transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Sparkles className="w-4 h-4" />
                                <span>{isQueueStarting ? 'Programando...' : '⚡ Programar en Segundo Plano (300+)'}</span>
                            </button>

                            <button
                                onClick={startBulkQueue}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white text-xs font-extrabold shadow-lg shadow-green-500/20 transition-all active:scale-95"
                            >
                                <Play className="w-4 h-4 fill-white" />
                                <span>Enviar en Pantalla</span>
                            </button>
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
                                    Pendientes ({guests.filter(g => g.whatsapp_status === 'not_sent').length})
                                </button>
                                <button
                                    onClick={() => setSentStatusFilter('sent')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${sentStatusFilter === 'sent' ? 'bg-green-500 text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                >
                                    Enviados ({guests.filter(g => g.whatsapp_status === 'sent').length})
                                </button>
                                <button
                                    onClick={() => setSentStatusFilter('all')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${sentStatusFilter === 'all' ? 'bg-green-500 text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                >
                                    Todos ({guests.length})
                                </button>
                            </div>
                        </div>

                        {/* Template Mode */}
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            <span>Mensaje:</span>
                            <div className="flex gap-1 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                <button
                                    onClick={() => setMessageMode('invitation')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${messageMode === 'invitation' ? 'bg-amber-500 text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                >
                                    📩 Invitación Inicial
                                </button>
                                <button
                                    onClick={() => setMessageMode('reminder')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${messageMode === 'reminder' ? 'bg-blue-600 text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                >
                                    ⏰ Recordatorio Límite
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
                            const isAutoSending = sendingAutoId === guest.id;

                            return (
                                <div
                                    key={guest.id}
                                    className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${isSent ? 'bg-zinc-50/50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-80' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-green-300 dark:hover:border-green-800 shadow-sm'}`}
                                >
                                    {/* Left: Guest details & message preview */}
                                    <div className="space-y-1 max-w-xl">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-zinc-900 dark:text-white">{guest.name}</span>
                                            <span className="text-xs font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">{guest.phone}</span>
                                            {isSent && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-900">
                                                    <CheckCircle2 className="w-3 h-3" /> Enviado
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl italic font-sans border border-zinc-100 dark:border-zinc-800">
                                            "{msgPreview}"
                                        </p>
                                    </div>

                                    {/* Right: Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => handleAutoSend(guest)}
                                            disabled={isAutoSending || isBulkSending}
                                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                            title="Enviar automáticamente a través de la API Baileys"
                                        >
                                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                            <span>{isAutoSending ? 'Enviando...' : 'Bot Baileys'}</span>
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
                                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-900 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                            <span>Abrir Web</span>
                                            <ExternalLink className="w-3 h-3 opacity-70" />
                                        </button>
                                    </div>
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
                        disabled={isBulkSending}
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

