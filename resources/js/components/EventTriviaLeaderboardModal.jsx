import React, { useState, useEffect } from 'react';
import { Trophy, Award, Trash2, RotateCcw, X, Sparkles, ExternalLink, RefreshCw, Loader2, Users, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../api';

export default function EventTriviaLeaderboardModal({ event, onClose }) {
    const [responses, setResponses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchLeaderboard();
    }, [event.id]);

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            const { ok, json } = await apiFetch(`/api/events/${event.id}/trivia-leaderboard`);
            if (ok && json) {
                setResponses(json.responses || []);
            }
        } catch (err) {
            console.error('Error fetching trivia leaderboard:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteResponse = async (responseId) => {
        if (!confirm('¿Eliminar esta respuesta del ranking?')) return;
        setActionLoading(true);
        try {
            const { ok } = await apiFetch(`/api/events/${event.id}/trivia-responses/${responseId}`, {
                method: 'DELETE',
            });
            if (ok) {
                setResponses(prev => prev.filter(r => r.id !== responseId));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleResetAll = async () => {
        if (!confirm('¿Seguro que querés reiniciar todas las respuestas de la trivia? Úsalo para borrar las pruebas antes de que comience el evento.')) return;
        setActionLoading(true);
        try {
            const { ok } = await apiFetch(`/api/events/${event.id}/trivia-reset`, {
                method: 'POST',
            });
            if (ok) {
                setResponses([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const projectionUrl = `${window.location.origin}/evento/${event.public_code}/proyeccion`;

    return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black text-2xl border border-amber-500/20">
                            🏆
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5" /> Ranking en Vivo
                            </span>
                            <h2 className="text-xl font-black text-zinc-900 dark:text-white">
                                Podio & Ganadores de la Trivia
                            </h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {event.couple_names || event.title} · {responses.length} {responses.length === 1 ? 'jugador registrado' : 'jugadores registrados'}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto space-y-5">
                    {/* Actions Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60">
                        <div className="flex items-center gap-2">
                            <a
                                href={projectionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-zinc-950 font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Ver Pantalla Gigante / Podio</span>
                            </a>
                            <button
                                type="button"
                                onClick={fetchLeaderboard}
                                disabled={loading}
                                className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                                title="Actualizar lista"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {responses.length > 0 && (
                            <button
                                type="button"
                                onClick={handleResetAll}
                                disabled={actionLoading}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-1 transition-colors"
                                title="Borrar respuestas de prueba"
                            >
                                <RotateCcw className="w-3 h-3" />
                                <span>Borrar pruebas / Reiniciar</span>
                            </button>
                        )}
                    </div>

                    {/* Leaderboard Table */}
                    {loading ? (
                        <div className="py-12 text-center text-zinc-400 space-y-2">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-500" />
                            <p className="text-xs">Cargando ranking de trivia...</p>
                        </div>
                    ) : responses.length === 0 ? (
                        <div className="py-12 text-center space-y-3">
                            <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-500 flex items-center justify-center mx-auto text-2xl border border-amber-200 dark:border-amber-900/50">
                                🎯
                            </div>
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Aún no hay respuestas</h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                                Cuando los invitados abran la invitación electrónica o escaneen el QR del cartel de mesa, sus puntajes y nombres aparecerán acá automáticamente.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400 px-2 flex justify-between">
                                <span>Participante</span>
                                <span>Puntaje / Aciertos</span>
                            </div>

                            {responses.map((item, idx) => {
                                const isFirst = idx === 0;
                                const isSecond = idx === 1;
                                const isThird = idx === 2;

                                return (
                                    <div
                                        key={item.id}
                                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                            isFirst
                                                ? 'bg-amber-50/80 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800/60 shadow-sm'
                                                : isSecond
                                                ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-300 dark:border-slate-700/60'
                                                : isThird
                                                ? 'bg-amber-900/5 dark:bg-amber-950/15 border-amber-700/30 dark:border-amber-900/40'
                                                : 'bg-white dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0">
                                                {isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : <span className="text-xs text-zinc-400">#{idx + 1}</span>}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-black text-zinc-900 dark:text-white flex items-center gap-1.5 truncate">
                                                    <span>{item.participant_name}</span>
                                                    {isFirst && (
                                                        <span className="px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950 text-[9px] font-black uppercase">
                                                            Ganador
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-zinc-400">
                                                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-right">
                                                <div className="text-xs font-black text-amber-600 dark:text-amber-400">
                                                    {item.score} de {item.total_questions} aciertos
                                                </div>
                                                <div className="text-[10px] text-zinc-400">
                                                    {Math.round((item.score / (item.total_questions || 1)) * 100)}% acierto
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleDeleteResponse(item.id)}
                                                disabled={actionLoading}
                                                className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                                                title="Eliminar del ranking"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black hover:opacity-90 transition-opacity"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
