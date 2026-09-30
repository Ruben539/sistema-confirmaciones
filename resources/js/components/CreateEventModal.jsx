import React, { useState, useEffect } from 'react';
import { PlusCircle, Heart, Calendar, MapPin, User, X, Save, Edit3 } from 'lucide-react';
import GoogleLocationPicker from './GoogleLocationPicker';
import { apiFetch } from '../api';
import { PLANS, getPlanRangeLabel } from '../plans';

export const EVENT_TYPES = [
    { value: 'boda', label: '💍 Boda / Casamiento' },
    { value: 'xv_anos', label: '👑 15 Años / Fiesta de XV' },
    { value: 'cumpleanos', label: '🎂 Cumpleaños' },
    { value: 'aniversario', label: '❤️ Aniversario' },
    { value: 'corporativo', label: '🏢 Evento Corporativo' },
    { value: 'graduacion', label: '🎓 Graduación / Colación' },
    { value: 'baby_shower', label: '🎈 Baby Shower / Fiesta' },
    { value: 'otro', label: '🎉 Otro Evento Especial' },
];

export default function CreateEventModal({ isOpen, onClose, onEventCreated, eventToEdit = null }) {
    const [title, setTitle] = useState('');
    const [eventType, setEventType] = useState('boda');
    const [coupleNames, setCoupleNames] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [location, setLocation] = useState('');
    const [plannerId, setPlannerId] = useState('');
    const [planners, setPlanners] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [planType, setPlanType] = useState('initial');
    const [customMaxGuests, setCustomMaxGuests] = useState(400);
    const [isEnabled, setIsEnabled] = useState(true);
    const [rsvpDeadlineDays, setRsvpDeadlineDays] = useState(7);
    const [autoDeclineExpired, setAutoDeclineExpired] = useState(true);

    const [availableTypes, setAvailableTypes] = useState(EVENT_TYPES);

    useEffect(() => {
        if (isOpen) {
            fetchPlanners();
            fetchEventTypes();
            if (eventToEdit) {
                setTitle(eventToEdit.title || '');
                setEventType(eventToEdit.event_type || 'boda');
                setCoupleNames(eventToEdit.couple_names || '');
                setEventDate(eventToEdit.event_date || '');
                setLocation(eventToEdit.location || '');
                setPlannerId(eventToEdit.user_id || '');
                setPlanType(eventToEdit.plan_type || 'initial');
                setCustomMaxGuests(eventToEdit.max_guests || 400);
                setIsEnabled(eventToEdit.is_enabled !== undefined ? Boolean(eventToEdit.is_enabled) : true);
                setRsvpDeadlineDays(eventToEdit.rsvp_deadline_days !== undefined ? eventToEdit.rsvp_deadline_days : 7);
                setAutoDeclineExpired(eventToEdit.auto_decline_expired !== undefined ? Boolean(eventToEdit.auto_decline_expired) : true);
            } else {
                setTitle('');
                setEventType('boda');
                setCoupleNames('');
                setEventDate('');
                setLocation('');
                setPlannerId('');
                setPlanType('initial');
                setCustomMaxGuests(400);
                setIsEnabled(true);
                setRsvpDeadlineDays(7);
                setAutoDeclineExpired(true);
            }
        }
    }, [isOpen, eventToEdit]);

    const fetchEventTypes = async () => {
        try {
            const { ok, json } = await apiFetch('/api/event-types');
            if (ok && Array.isArray(json) && json.length > 0) {
                const mapped = json.map(t => ({
                    value: t.slug,
                    label: `${t.icon || '🎉'} ${t.name}`,
                }));
                setAvailableTypes(mapped);
            }
        } catch (err) {
            console.error('Error fetching event types:', err);
        }
    };

    const fetchPlanners = async () => {
        try {
            const { ok, json } = await apiFetch('/api/planners');
            if (ok && json) {
                // Ensure only users with role 'planner' are shown
                const onlyPlanners = json.filter(p => p.role === 'planner');
                setPlanners(onlyPlanners);
                if (!eventToEdit && onlyPlanners.length > 0) {
                    setPlannerId(onlyPlanners[0].id);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const url = eventToEdit ? `/api/event/${eventToEdit.id}` : '/api/events';
        const method = eventToEdit ? 'PUT' : 'POST';

        try {
            const { ok, json } = await apiFetch(url, {
                method,
                body: JSON.stringify({
                    title,
                    event_type: eventType,
                    couple_names: coupleNames,
                    event_date: eventDate,
                    location,
                    user_id: plannerId,
                    plan_type: planType,
                    ...(planType === 'custom' ? { max_guests: parseInt(customMaxGuests, 10) || 1 } : {}),
                    is_enabled: isEnabled,
                    rsvp_deadline_days: rsvpDeadlineDays,
                    auto_decline_expired: autoDeclineExpired,
                })
            });

            if (ok && json?.event) {
                onEventCreated(json.event);
                onClose();
            } else {
                setError(json?.message || 'Error al guardar el evento. Verifica que tenés permisos de administrador.');
            }
        } catch (err) {
            console.error(err);
            setError('Error al comunicarse con el servidor.');
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
                            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-2xl text-amber-600 dark:text-amber-400 border border-amber-200/50">
                                {eventToEdit ? <Edit3 className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                                    {eventToEdit ? 'Editar Evento' : 'Crear Nuevo Evento'}
                                </h2>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {eventToEdit ? 'Modificá los datos del evento.' : 'Creá un evento y asignalo a un Wedding Planner.'}
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

                    {/* Form Body (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                        {error && (
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-amber-500" /> Wedding Planner Asignado *
                        </label>
                        <select
                            required
                            value={plannerId}
                            onChange={(e) => setPlannerId(e.target.value)}
                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                        >
                            <option value="">-- Seleccionar Wedding Planner --</option>
                            {planners.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({p.email})
                                </option>
                            ))}
                        </select>
                        {planners.length === 0 && (
                            <p className="text-[11px] text-rose-500 font-semibold mt-1">
                                No hay Wedding Planners con rol "planner" registradas. Creá una primero desde la pestaña "Planners".
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                <PlusCircle className="w-3.5 h-3.5 text-amber-500" /> Tipo de Evento *
                            </label>
                            <select
                                value={eventType}
                                onChange={(e) => setEventType(e.target.value)}
                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                            >
                                {availableTypes.map(type => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                <Heart className="w-3.5 h-3.5 text-rose-500" /> Título del Evento *
                            </label>
                            <input
                                type="text"
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="ej: Gala Anual / Boda de Lucía & Tomas / XV de Sofía"
                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                            <Heart className="w-3.5 h-3.5 text-pink-500" /> Nombres de la Pareja / Anfitriones *
                        </label>
                        <input
                            type="text"
                            required
                            value={coupleNames}
                            onChange={(e) => setCoupleNames(e.target.value)}
                            placeholder="Lucía & Tomas"
                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-blue-500" /> Fecha del Evento
                        </label>
                        <input
                            type="date"
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                    </div>

                    {/* Google Maps Location Search & Map Picker */}
                    <div className="pt-1">
                        <GoogleLocationPicker
                            value={location}
                            onChange={setLocation}
                            placeholder="Buscar ciudad, calle, barrio o local..."
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                                Plan Contratado
                            </label>
                            <select
                                value={planType}
                                onChange={(e) => setPlanType(e.target.value)}
                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 p-3 font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                            >
                                {PLANS.map(plan => (
                                    <option key={plan.id} value={plan.id}>
                                        {plan.emoji} {plan.label} ({getPlanRangeLabel(plan)})
                                    </option>
                                ))}
                            </select>
                            {planType === 'custom' && (
                                <input
                                    type="number"
                                    min="1"
                                    required
                                    value={customMaxGuests}
                                    onChange={(e) => setCustomMaxGuests(e.target.value)}
                                    className="mt-2 w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 p-3 font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                                    placeholder="Cantidad máxima de invitados"
                                />
                            )}
                        </div>

                        <div className="flex flex-col justify-end">
                            <label className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl cursor-pointer hover:bg-zinc-100/80 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={isEnabled}
                                    onChange={(e) => setIsEnabled(e.target.checked)}
                                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                                />
                                <div>
                                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                                        {isEnabled ? '🟢 Evento Habilitado' : '🔒 Evento Deshabilitado'}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">
                                        Permite WhatsApp y confirmaciones
                                    </span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                                Plazo Máximo de Confirmación (RSVP)
                            </label>
                            <select
                                value={rsvpDeadlineDays}
                                onChange={(e) => setRsvpDeadlineDays(Number(e.target.value))}
                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                            >
                                <option value={3}>3 Días antes del evento</option>
                                <option value={5}>5 Días antes del evento</option>
                                <option value={7}>7 Días antes del evento (Recomendado)</option>
                                <option value={10}>10 Días antes del evento</option>
                                <option value={14}>14 Días antes del evento (2 semanas)</option>
                                <option value={30}>30 Días antes del evento (1 mes)</option>
                            </select>
                        </div>

                        <div className="flex flex-col justify-end">
                            <label className="flex items-center gap-3 p-3 bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 rounded-xl cursor-pointer hover:bg-rose-100/60 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={autoDeclineExpired}
                                    onChange={(e) => setAutoDeclineExpired(e.target.checked)}
                                    className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500"
                                />
                                <div>
                                    <span className="text-xs font-bold text-rose-900 dark:text-rose-300 block">
                                        Auto-marcar "No Asistirá"
                                    </span>
                                    <span className="text-[10px] text-rose-600 dark:text-rose-400 block">
                                        Recordatorio 1 día antes y auto-cancelación al vencer
                                    </span>
                                </div>
                            </label>
                        </div>
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
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            <span>{loading ? 'Guardando...' : (eventToEdit ? 'Guardar Cambios' : 'Crear Evento')}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
