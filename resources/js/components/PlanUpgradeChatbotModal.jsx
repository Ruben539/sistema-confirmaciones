import React, { useState } from 'react';
import { Bot, Send, Sparkles, X, CheckCircle2, MessageSquare, ArrowRight, ShieldCheck, Crown, Zap, AlertCircle } from 'lucide-react';
import { apiFetch } from '../api';

export default function PlanUpgradeChatbotModal({ isOpen, onClose, event, currentGuestsCount = 0, user, onRequestSent }) {
    if (!isOpen || !event) return null;

    const maxGuests = event.max_guests || 100;
    const planType = event.plan_type || 'initial';
    const eventTitle = event.couple_names || event.title;
    const plannerName = user?.name ? user.name.replace(/\s*\([^)]*\)/g, '').trim() : 'Wedding Planner';

    const planOptions = [
        {
            id: 'medium',
            title: 'Plan Medio',
            guests: 150,
            icon: Zap,
            color: 'from-blue-500 to-indigo-600',
            border: 'border-blue-500/40',
            bg: 'bg-blue-50/50 dark:bg-blue-950/30',
            description: 'Ideal para bodas medianas de hasta 150 personas.'
        },
        {
            id: 'premium',
            title: 'Plan Premium',
            guests: 300,
            icon: Crown,
            color: 'from-amber-500 to-rose-600',
            border: 'border-amber-500/40',
            bg: 'bg-amber-50/50 dark:bg-amber-950/30',
            description: 'Para grandes celebraciones de hasta 300 personas.'
        },
        {
            id: 'custom',
            title: 'Cupo Personalizado',
            guests: 0,
            icon: Sparkles,
            color: 'from-purple-500 to-pink-600',
            border: 'border-purple-500/40',
            bg: 'bg-purple-50/50 dark:bg-purple-950/30',
            description: 'Define la cantidad exacta de invitados que necesitas.'
        },
    ];

    const [selectedPlan, setSelectedPlan] = useState('medium');
    const [customGuests, setCustomGuests] = useState(200);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleSendRequest = async () => {
        setLoading(true);
        setError(null);

        const targetGuests = selectedPlan === 'custom'
            ? Number(customGuests)
            : (planOptions.find(p => p.id === selectedPlan)?.guests || 150);

        try {
            const { ok, json } = await apiFetch(`/api/events/${event.id}/plan-request`, {
                method: 'POST',
                body: JSON.stringify({
                    requested_plan: selectedPlan,
                    requested_guests: targetGuests,
                    notes: notes.trim() || null
                })
            });

            if (ok) {
                setResult(json);
                if (onRequestSent) onRequestSent();
            } else {
                setError(json?.message || 'Error al procesar la solicitud.');
            }
        } catch (err) {
            console.error(err);
            setError('Error de conexión al enviar la solicitud.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/80 backdrop-blur-md animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
                {/* Header Chatbot */}
                <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="p-2.5 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-2xl text-white shadow-md shadow-rose-500/20">
                                <Bot className="w-5 h-5" />
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-full animate-pulse"></span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">Asistente de Planes</h3>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                    En línea
                                </span>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Solicitud directa y notificación automática por WhatsApp al Admin</p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body / Conversation */}
                <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
                    {/* Bot Message 1: Status */}
                    <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                            <Bot className="w-3.5 h-3.5" />
                        </div>
                        <div className="bg-zinc-100 dark:bg-zinc-800/80 p-3.5 rounded-2xl rounded-tl-sm text-zinc-800 dark:text-zinc-200 space-y-1.5 max-w-[88%] leading-relaxed border border-zinc-200/50 dark:border-zinc-700/50">
                            <p>
                                ¡Hola <strong>{plannerName}</strong>! 👋 Veo que el evento <strong>"{eventTitle}"</strong> tiene actualmente el <strong>Plan {planType === 'medium' ? 'Medio' : planType === 'premium' ? 'Premium' : 'Inicial'} ({maxGuests} invitados máx)</strong> y ya cuenta con <strong>{currentGuestsCount} registrados</strong>.
                            </p>
                            <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                                Seleccioná el plan que necesitas para que le enviemos la notificación por WhatsApp a los administradores de inmediato:
                            </p>
                        </div>
                    </div>

                    {!result ? (
                        <>
                            {/* Step: Select Target Plan */}
                            <div className="space-y-2.5 pl-9">
                                {planOptions.map((opt) => {
                                    const IconComp = opt.icon;
                                    const isSelected = selectedPlan === opt.id;
                                    return (
                                        <div
                                            key={opt.id}
                                            onClick={() => setSelectedPlan(opt.id)}
                                            className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? `${opt.border} ${opt.bg} shadow-md` : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/60'}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`p-2 rounded-xl bg-gradient-to-tr ${opt.color} text-white shadow-sm`}>
                                                        <IconComp className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                                            <span>{opt.title}</span>
                                                            {opt.guests > 0 && (
                                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                                                    Hasta {opt.guests} invitados
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{opt.description}</p>
                                                    </div>
                                                </div>
                                                <input
                                                    type="radio"
                                                    name="plan_choice"
                                                    checked={isSelected}
                                                    onChange={() => setSelectedPlan(opt.id)}
                                                    className="text-rose-500 focus:ring-rose-500 cursor-pointer"
                                                />
                                            </div>

                                            {opt.id === 'custom' && isSelected && (
                                                <div className="mt-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60 flex items-center gap-3">
                                                    <label className="text-zinc-600 dark:text-zinc-400 font-semibold text-[11px] whitespace-nowrap">
                                                        Cantidad de Invitados deseada:
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={maxGuests + 1}
                                                        max={9999}
                                                        value={customGuests}
                                                        onChange={(e) => setCustomGuests(Math.max(1, parseInt(e.target.value, 10) || 0))}
                                                        className="w-28 p-2 rounded-xl text-xs font-bold border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Additional Notes */}
                            <div className="pl-9 space-y-1.5 pt-1">
                                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                                    Nota o Comentario para el Administrador (Opcional):
                                </label>
                                <textarea
                                    rows={2}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Ej: Nos confirmaron más familiares de último momento..."
                                    className="w-full text-xs rounded-2xl border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed"
                                />
                            </div>

                            {/* Error Alert */}
                            {error && (
                                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Bot Success Result Bubble */
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex items-start gap-2.5">
                                <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-4 rounded-2xl rounded-tl-sm text-emerald-900 dark:text-emerald-200 space-y-2 max-w-[90%]">
                                    <div className="font-extrabold text-sm flex items-center gap-1.5">
                                        <span>🚀 ¡Solicitud enviada con éxito!</span>
                                    </div>
                                    <p className="text-xs leading-relaxed">
                                        Registramos tu pedido para ampliar al <strong>{planOptions.find(p => p.id === selectedPlan)?.title || selectedPlan}</strong> ({result.request?.requested_guests || customGuests} invitados).
                                    </p>
                                    <p className="text-[11px] opacity-90">
                                        {result.whatsapp_notified
                                            ? '✅ El bot de WhatsApp acaba de notificar automáticamente a los administradores con el comando de aprobación rápida.'
                                            : 'ℹ️ Tu solicitud quedó asentada en el sistema. Los administradores la revisarán en breve.'}
                                    </p>
                                </div>
                            </div>

                            {/* Fallback Direct WhatsApp Button */}
                            {result.direct_whatsapp_url && (
                                <div className="pl-9 pt-1">
                                    <a
                                        href={result.direct_whatsapp_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        <span>Abrir Chat de WhatsApp con el Administrador</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        {result ? 'Cerrar' : 'Cancelar'}
                    </button>

                    {!result && (
                        <button
                            type="button"
                            disabled={loading}
                            onClick={handleSendRequest}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-black shadow-lg shadow-rose-500/20 disabled:opacity-50 transition-all active:scale-95"
                        >
                            {loading ? (
                                <span>Enviando al Bot...</span>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    <span>Enviar Solicitud al Admin</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
