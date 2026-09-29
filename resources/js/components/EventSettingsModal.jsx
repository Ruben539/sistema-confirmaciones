import React, { useState, useEffect } from 'react';
import { Settings, Save, X, Sparkles, MessageSquare, Heart, Calendar, MapPin, User, ShieldCheck } from 'lucide-react';
import GoogleLocationPicker from './GoogleLocationPicker';
import { apiFetch } from '../api';

export default function EventSettingsModal({ isOpen, onClose, event, user, onSave }) {
    const [formData, setFormData] = useState({
        title: '',
        couple_names: '',
        event_date: '',
        location: '',
        message_template: '',
        user_id: '',
    });
    const [planners, setPlanners] = useState([]);
    const [loading, setLoading] = useState(false);

    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        if (event) {
            setFormData({
                title: event.title || '',
                couple_names: event.couple_names || '',
                event_date: event.event_date || '',
                location: event.location || '',
                message_template: event.message_template || "¡Hola {nombre}! Te invitamos al evento de {pareja} ✨\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir",
                user_id: event.user_id || '',
            });
        }
        if (isOpen && isAdmin) {
            fetchPlanners();
        }
    }, [event, isOpen, user]);

    const fetchPlanners = async () => {
        try {
            const { ok, json } = await apiFetch('/api/planners');
            if (ok && json) {
                setPlanners(json);
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(event.id, formData);
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/75 backdrop-blur-md animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[90vh] overflow-hidden">
                    {/* Header (Fixed) */}
                    <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-900/80 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl text-rose-600 dark:text-rose-400 border border-rose-200/50">
                                <Settings className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Configuración del Evento</h2>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Personalizá los detalles del evento y la plantilla del mensaje de WhatsApp.</p>
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

                    {/* Form Body (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                    {/* Planner Assignment Bar */}
                    <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60">
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                            <User className="w-4 h-4 text-amber-500" /> Wedding Planner Asignada/o
                        </label>

                        {isAdmin ? (
                            <select
                                value={formData.user_id}
                                onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                            >
                                <option value="">-- Sin Asignar --</option>
                                {planners.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                                ))}
                            </select>
                        ) : (
                            <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 pt-1">
                                <span className="bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-3 py-1 rounded-xl">
                                    {event?.planner?.name || user?.name || 'Asignado a ti'}
                                </span>
                                <span className="text-[11px] text-zinc-400 font-normal italic">(Asignado por el Administrador)</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                <Heart className="w-3.5 h-3.5 text-rose-500" /> Título del Evento *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                                placeholder="ej: Evento Anual / Boda Sofía & Mateo / XV de Valentina"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                <Heart className="w-3.5 h-3.5 text-amber-500" /> Nombres de la Pareja / Anfitriones
                            </label>
                            <input
                                type="text"
                                value={formData.couple_names}
                                onChange={(e) => setFormData({ ...formData, couple_names: e.target.value })}
                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                                placeholder="Sofía & Mateo"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-blue-500" /> Fecha del Evento
                            </label>
                            <input
                                type="date"
                                value={formData.event_date}
                                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Google Maps Location Search & Map Picker */}
                    <div className="pt-1">
                        <GoogleLocationPicker
                            value={formData.location}
                            onChange={(loc) => setFormData({ ...formData, location: loc })}
                            placeholder="Buscar ciudad, calle, barrio o local..."
                        />
                    </div>

                    {/* WhatsApp Template */}
                    <div className="pt-2">
                        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                                <MessageSquare className="w-3.5 h-3.5 text-green-500" /> Plantilla de Mensaje de WhatsApp
                            </span>
                            <span className="text-[11px] text-zinc-400 font-normal">Variables: &#123;nombre&#125;, &#123;pareja&#125;, &#123;lugar&#125;, &#123;link&#125;</span>
                        </label>
                        <textarea
                            rows={4}
                            value={formData.message_template}
                            onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-rose-500 outline-none leading-relaxed"
                        />
                    </div>

                    </div>

                    {/* Footer (Fixed Pinned) */}
                    <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3 bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur-sm shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold transition-all shadow-md hover:bg-rose-600 dark:hover:bg-rose-400 dark:hover:text-white disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            <span>Guardar Cambios</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
