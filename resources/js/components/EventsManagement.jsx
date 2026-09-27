import React, { useState, useEffect } from 'react';
import { Calendar, Heart, MapPin, User, Plus, Edit2, CheckCircle2, ShieldCheck, RefreshCw, Trash2, Eye } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { apiFetch } from '../api';

export default function EventsManagement({ onOpenCreateEvent, onSelectEvent, onEditEvent, onDeleteEvent }) {
    const [events, setEvents] = useState([]);
    const [planners, setPlanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [resEvents, resPlanners] = await Promise.all([
                apiFetch('/api/event'),
                apiFetch('/api/planners')
            ]);

            setEvents(resEvents.json?.events || []);
            setPlanners(resPlanners.json || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleReassign = async (eventId, newUserId) => {
        setUpdatingId(eventId);
        setErrorMsg(null);
        try {
            const { ok } = await apiFetch(`/api/event/${eventId}`, {
                method: 'PUT',
                body: JSON.stringify({ user_id: newUserId })
            });

            if (ok) {
                setSuccessMsg('Asignación de Wedding Planner actualizada correctamente.');
                loadData();
            } else {
                setErrorMsg('Error al reasignar el evento.');
            }
        } catch (err) {
            console.error(err);
            setErrorMsg('Error de conexión al reasignar.');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDelete = (ev) => {
        setConfirmModal({
            isOpen: true,
            title: 'Eliminar Evento',
            message: `¿Estás seguro de eliminar el evento "${ev.title}"? Esta acción eliminará también todos sus invitados de forma permanente.`,
            confirmText: 'Sí, eliminar evento',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setDeletingId(ev.id);
                setErrorMsg(null);
                try {
                    const { ok, json } = await apiFetch(`/api/event/${ev.id}`, { method: 'DELETE' });
                    if (ok) {
                        setSuccessMsg(`Evento "${ev.title}" eliminado correctamente.`);
                        if (onDeleteEvent) onDeleteEvent(ev.id);
                        loadData();
                    } else {
                        setErrorMsg(json?.message || 'Error al eliminar el evento.');
                    }
                } catch (err) {
                    console.error(err);
                    setErrorMsg('Error de conexión al eliminar evento.');
                } finally {
                    setDeletingId(null);
                }
            }
        });
    };

    const handleToggleEnable = async (ev) => {
        setUpdatingId(ev.id);
        setErrorMsg(null);
        try {
            const { ok } = await apiFetch(`/api/event/${ev.id}`, {
                method: 'PUT',
                body: JSON.stringify({ is_enabled: !ev.is_enabled })
            });

            if (ok) {
                setSuccessMsg(`Estado del evento "${ev.title}" actualizado.`);
                loadData();
            } else {
                setErrorMsg('Error al actualizar estado del evento.');
            }
        } catch (err) {
            console.error(err);
            setErrorMsg('Error de conexión.');
        } finally {
            setUpdatingId(null);
        }
    };

    const getPlanLabel = (plan) => {
        switch (plan) {
            case 'medium': return '🚀 Plan Medio (150)';
            case 'premium': return '👑 Plan Premium (+150)';
            default: return '⭐ Plan Inicial (100)';
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800/80 p-6 rounded-3xl shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-4 z-10">
                    <div className="p-3.5 bg-gradient-to-tr from-amber-500/20 to-rose-500/20 dark:bg-amber-950/40 rounded-2xl text-amber-500 dark:text-amber-400 border border-amber-500/20 shadow-inner">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Gestión de Eventos y Licencias</h2>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Creá eventos, gestioná planes de invitados y habilitá o deshabilitá envíos por WhatsApp por evento.</p>
                    </div>
                </div>

                <button
                    onClick={() => onOpenCreateEvent()}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-black tracking-wide uppercase transition-all shadow-lg shadow-amber-500/20 active:scale-95 z-10 shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    <span>Crear Nuevo Evento</span>
                </button>
            </div>

            {/* Notification */}
            {successMsg && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>{successMsg}</span>
                    </div>
                    <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs">Cerrar</button>
                </div>
            )}

            {/* List of Events */}
            {loading ? (
                <div className="text-center py-12 text-zinc-400 text-xs font-semibold">Cargando eventos...</div>
            ) : events.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center text-zinc-400 text-xs font-semibold">
                    No hay eventos registrados en el sistema.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {events.map((ev) => (
                        <div
                            key={ev.id}
                            className="bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-amber-500/30 transition-all space-y-4 flex flex-col justify-between"
                        >
                            <div className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />
                                            <h3 className="font-black text-base text-zinc-900 dark:text-white tracking-tight">
                                                {ev.couple_names || ev.title}
                                            </h3>
                                        </div>
                                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{ev.title}</p>
                                    </div>

                                    {/* Action Buttons: Edit & Delete */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => onEditEvent && onEditEvent(ev)}
                                            className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500 transition-colors"
                                            title="Editar Evento"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>

                                        <button
                                            onClick={() => handleDelete(ev)}
                                            disabled={deletingId === ev.id}
                                            className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition-colors disabled:opacity-50"
                                            title="Eliminar Evento"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Details & Monetization Badges */}
                                <div className="flex flex-wrap gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 pt-2">
                                    {/* Enablement Badge / Button */}
                                    <button
                                        onClick={() => handleToggleEnable(ev)}
                                        disabled={updatingId === ev.id}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                                            ev.is_enabled
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100'
                                        }`}
                                    >
                                        <span>{ev.is_enabled ? '🟢 Habilitado' : '🔒 Deshabilitado'}</span>
                                    </button>

                                    {/* Plan Badge */}
                                    <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-xl border border-amber-200/60 dark:border-amber-800/60 font-bold">
                                        <span>{getPlanLabel(ev.plan_type)}</span>
                                    </div>

                                    {/* Deadline RSVP Badge */}
                                    {ev.event_date && (
                                        <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 px-3 py-1.5 rounded-xl border border-blue-200/60 dark:border-blue-800/60 font-bold" title="Límite para confirmar asistencia">
                                            <span>⏰ RSVP: {ev.rsvp_deadline_days ?? 7} días antes</span>
                                        </div>
                                    )}

                                    {ev.event_date && (
                                        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/60 px-3 py-1.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                                            <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                            <span>{ev.event_date}</span>
                                        </div>
                                    )}
                                    {ev.location && (
                                        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/60 px-3 py-1.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                            <span className="truncate max-w-[180px]">{ev.location}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                                {/* Reassignment Selector */}
                                <div className="bg-zinc-50/60 dark:bg-zinc-800/30 p-3.5 rounded-2xl space-y-2 border border-zinc-200/50 dark:border-zinc-800/50">
                                    <label className="block text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                                        Wedding Planner Asignada:
                                    </label>

                                    <div className="flex items-center gap-2">
                                        <select
                                            disabled={updatingId === ev.id}
                                            value={ev.user_id || ''}
                                            onChange={(e) => handleReassign(ev.id, e.target.value)}
                                            className="w-full text-xs font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
                                        >
                                            {planners.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({p.role === 'admin' ? 'Administrador' : 'Planner'})
                                                </option>
                                            ))}
                                        </select>

                                        {updatingId === ev.id && (
                                            <RefreshCw className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
                                        )}
                                    </div>
                                </div>

                                {/* Select Event Action */}
                                <button
                                    onClick={() => onSelectEvent(ev)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-black shadow-md transition-all active:scale-95"
                                >
                                    <Eye className="w-4 h-4" />
                                    <span>Ver Confirmaciones de este Evento</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                variant="danger"
            />
        </div>
    );
}
