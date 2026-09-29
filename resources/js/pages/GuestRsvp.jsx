import React, { useState, useEffect } from 'react';
import { Heart, Calendar, MapPin, CheckCircle2, XCircle, Utensils, Send, Sparkles, AlertCircle, Sun, Moon } from 'lucide-react';
import { apiFetch } from '../api';

export default function GuestRsvp({ token }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);

    const [status, setStatus] = useState('confirmed');
    const [confirmedAdults, setConfirmedAdults] = useState(1);
    const [confirmedYouth, setConfirmedYouth] = useState(0);
    const [confirmedChildren, setConfirmedChildren] = useState(0);
    const [dietary, setDietary] = useState('');
    const [notes, setNotes] = useState('');

    const toggleTheme = () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    };

    useEffect(() => {
        fetchRsvp();
    }, [token]);

    const fetchRsvp = async () => {
        try {
            const { ok, json } = await apiFetch(`/api/rsvp/${token}`);

            if (ok && json) {
                setData(json);
                if (json.guest) {
                    setStatus(json.guest.status === 'declined' ? 'declined' : 'confirmed');
                    setConfirmedAdults(json.guest.confirmed_adults > 0 ? json.guest.confirmed_adults : (json.guest.adults || 1));
                    setConfirmedYouth(json.guest.confirmed_youth > 0 ? json.guest.confirmed_youth : (json.guest.youth || 0));
                    setConfirmedChildren(json.guest.confirmed_children > 0 ? json.guest.confirmed_children : (json.guest.children || 0));
                    setDietary(json.guest.dietary_restrictions || '');
                    setNotes(json.guest.notes || '');
                }
            } else {
                setError('Enlace de invitación no encontrado o no válido.');
            }
        } catch (err) {
            console.error(err);
            setError('Error al cargar la invitación.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const { ok, json } = await apiFetch(`/api/rsvp/${token}`, {
                method: 'POST',
                body: JSON.stringify({
                    status,
                    confirmed_adults: status === 'confirmed' ? confirmedAdults : 0,
                    confirmed_youth: status === 'confirmed' ? confirmedYouth : 0,
                    confirmed_children: status === 'confirmed' ? confirmedChildren : 0,
                    confirmed_passes: status === 'confirmed' ? (confirmedAdults + confirmedYouth + confirmedChildren) : 0,
                    dietary_restrictions: dietary,
                    notes
                })
            });

            if (ok) {
                setSubmitted(true);
            } else {
                setError(json?.message || 'Error al guardar la respuesta.');
            }
        } catch (err) {
            console.error(err);
            setError('Error de conexión.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-rose-50/40 dark:bg-zinc-950 flex items-center justify-center p-4 font-sans">
                <div className="flex flex-col items-center gap-3">
                    <Heart className="w-10 h-10 text-rose-500 animate-bounce" />
                    <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">Cargando invitación...</span>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-rose-50/40 dark:bg-zinc-950 flex items-center justify-center p-4 font-sans">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-md text-center shadow-xl">
                    <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Invitación No Encontrada</h2>
                    <p className="text-xs text-zinc-500 mt-2">{error || 'El enlace que abriste no existe o ha expirado.'}</p>
                </div>
            </div>
        );
    }

    const { guest, event } = data;

    return (
        <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-amber-50/30 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-rose-100 dark:border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 relative overflow-hidden">
                {/* Decorative glow */}
                <div className="absolute -top-20 -right-20 w-48 h-48 bg-rose-300/30 dark:bg-rose-900/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-amber-300/30 dark:bg-amber-900/20 rounded-full blur-3xl pointer-events-none" />

                {/* Theme Toggle Button */}
                <div className="absolute top-4 right-4 z-20">
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-rose-100 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:scale-105 transition-all shadow-sm"
                        title="Cambiar Modo Claro / Oscuro"
                    >
                        <Sun className="w-4 h-4 hidden dark:block text-amber-400" />
                        <Moon className="w-4 h-4 block dark:hidden text-indigo-600" />
                    </button>
                </div>

                {/* Header / Invitation Banner */}
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                        <Sparkles className="w-3.5 h-3.5" /> Confirmación de Asistencia
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white tracking-tight">
                        {event?.couple_names || event?.title}
                    </h1>

                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                        ¡Hola <span className="font-bold text-zinc-900 dark:text-white">{guest.name}</span>! Nos encantaría compartir este día tan especial con vos.
                    </p>

                    {/* Event Details Pill */}
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {event?.event_date && (
                            <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-zinc-800 px-3.5 py-2 rounded-xl border border-rose-200/60 dark:border-zinc-700">
                                <Calendar className="w-4 h-4 text-rose-500" />
                                <span>{new Date(event.event_date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                        )}

                        {event?.location && (
                            <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-zinc-800 px-3.5 py-2 rounded-xl border border-rose-200/60 dark:border-zinc-700">
                                <MapPin className="w-4 h-4 text-rose-500" />
                                <span>{event.location}</span>
                            </div>
                        )}

                        {data.deadline_date && (
                            <div className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border font-bold ${
                                data.is_expired
                                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            }`}>
                                <AlertCircle className="w-4 h-4 text-amber-500" />
                                <span>⏰ Plazo RSVP: {data.deadline_date}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Expired RSVP Deadline Notice */}
                {data.is_expired ? (
                    <div className="bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-8 text-center space-y-4 animate-fade-in">
                        <div className="w-14 h-14 bg-rose-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-rose-500/30">
                            <AlertCircle className="w-8 h-8" />
                        </div>

                        <h2 className="text-xl font-black text-rose-900 dark:text-rose-200">
                            Plazo de Confirmación Finalizado
                        </h2>

                        <p className="text-xs font-medium text-rose-800 dark:text-rose-300 leading-relaxed max-w-md mx-auto">
                            El plazo límite para responder a este evento fue el <span className="font-bold">{data.deadline_date}</span>. Tu respuesta fue marcada automáticamente como <span className="font-bold uppercase">'No Asistirá'</span> por vencimiento de plazo.
                        </p>

                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                            Si querés comunicarte con la organización para consultar cupos o cambios de último momento, por favor contactá directamente a los novios.
                        </p>
                    </div>
                ) : submitted ? (
                    <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-3xl p-8 text-center space-y-5 animate-fade-in">
                        <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>

                        <h2 className="text-2xl font-black text-emerald-900 dark:text-emerald-200">
                            ¡Respuesta Registrada!
                        </h2>

                        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 leading-relaxed max-w-md mx-auto">
                            {status === 'confirmed'
                                ? `¡Muchas gracias ${guest.name}! Hemos registrado tu confirmación para ${confirmedPasses} ${confirmedPasses === 1 ? 'persona' : 'personas'}. ¡Nos vemos muy pronto!`
                                : `Lamentamos que no puedas acompañarnos, ${guest.name}. ¡Agradecemos mucho que nos hayas avisado!`}
                        </p>

                        {/* Digital QR Entry Pass */}
                        {status === 'confirmed' && (
                            <div className="bg-white dark:bg-zinc-900 border-2 border-emerald-500/30 rounded-3xl p-6 shadow-xl space-y-4 text-center max-w-sm mx-auto my-4 relative overflow-hidden animate-fade-in">
                                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200">
                                        🎫 PASE DIGITAL DE ENTRADA
                                    </span>
                                    <h3 className="text-lg font-black text-zinc-900 dark:text-white pt-2">
                                        {guest.name}
                                    </h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                                        {confirmedPasses} {confirmedPasses === 1 ? 'Persona' : 'Personas'} {guest.table_number ? `· Mesa ${guest.table_number}` : ''}
                                    </p>
                                </div>

                                {/* QR Code Image */}
                                <div className="bg-white p-3 rounded-2xl inline-block border border-zinc-200 shadow-inner">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/confirmar/${guest.token}`)}`}
                                        alt="QR Code Pase de Entrada"
                                        className="w-44 h-44 mx-auto rounded-lg"
                                    />
                                </div>

                                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-semibold italic">
                                    Presentá este código QR en la recepción del evento para registrar tu ingreso.
                                </p>
                            </div>
                        )}

                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                            <a
                                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                                    status === 'confirmed'
                                        ? `¡Hola! Soy ${guest.name} y confirmo mi asistencia (${confirmedPasses} ${confirmedPasses === 1 ? 'persona' : 'personas'}) al evento de ${event?.couple_names || event?.title}.`
                                        : `¡Hola! Soy ${guest.name} y lamentablemente no podré asistir al evento de ${event?.couple_names || event?.title}.`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                            >
                                <Send className="w-4 h-4" />
                                <span>Enviar comprobante por WhatsApp</span>
                            </a>

                            <button
                                onClick={() => setSubmitted(false)}
                                className="text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:underline px-3 py-2"
                            >
                                Modificar mi respuesta
                            </button>
                        </div>
                    </div>
                ) : (
                    /* RSVP Form */
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Attendance Choice */}
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                                ¿Nos acompañás? *
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label
                                    onClick={() => setStatus('confirmed')}
                                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3 ${status === 'confirmed' ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-white shadow-md' : 'bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-emerald-300'}`}
                                >
                                    <input
                                        type="radio"
                                        name="status"
                                        checked={status === 'confirmed'}
                                        onChange={() => setStatus('confirmed')}
                                        className="hidden"
                                    />
                                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${status === 'confirmed' ? 'text-emerald-500' : 'text-zinc-400'}`} />
                                    <span className="text-xs font-bold">¡Sí, asistiré! 🎉</span>
                                </label>

                                <label
                                    onClick={() => setStatus('declined')}
                                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3 ${status === 'declined' ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-white shadow-md' : 'bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-rose-300'}`}
                                >
                                    <input
                                        type="radio"
                                        name="status"
                                        checked={status === 'declined'}
                                        onChange={() => setStatus('declined')}
                                        className="hidden"
                                    />
                                    <XCircle className={`w-5 h-5 shrink-0 ${status === 'declined' ? 'text-rose-500' : 'text-zinc-400'}`} />
                                    <span className="text-xs font-bold">No podré asistir 😔</span>
                                </label>
                            </div>
                        </div>

                        {/* If Attending: Select Category Passes & Dietary */}
                        {status === 'confirmed' && (
                            <div className="space-y-4 bg-zinc-50 dark:bg-zinc-800/40 p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                                        Confirmación de Asistentes ({confirmedAdults + confirmedYouth + confirmedChildren} de {guest.passes} personas)
                                    </label>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Jóvenes</label>
                                            <select
                                                value={confirmedYouth}
                                                onChange={(e) => setConfirmedYouth(parseInt(e.target.value, 10))}
                                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                            >
                                                {Array.from({ length: (guest.youth || 0) + 1 }, (_, i) => i).map(num => (
                                                    <option key={num} value={num}>{num} {num === 1 ? 'Joven' : 'Jóvenes'}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Adultos</label>
                                            <select
                                                value={confirmedAdults}
                                                onChange={(e) => setConfirmedAdults(parseInt(e.target.value, 10))}
                                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                            >
                                                {Array.from({ length: (guest.adults || 1) + 1 }, (_, i) => i).map(num => (
                                                    <option key={num} value={num}>{num} {num === 1 ? 'Adulto' : 'Adultos'}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Niños</label>
                                            <select
                                                value={confirmedChildren}
                                                onChange={(e) => setConfirmedChildren(parseInt(e.target.value, 10))}
                                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                            >
                                                {Array.from({ length: (guest.children || 0) + 1 }, (_, i) => i).map(num => (
                                                    <option key={num} value={num}>{num} {num === 1 ? 'Niño' : 'Niños'}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                        <Utensils className="w-3.5 h-3.5 text-amber-500" /> Restricciones alimentarias / Menú especial
                                    </label>
                                    <input
                                        type="text"
                                        value={dietary}
                                        onChange={(e) => setDietary(e.target.value)}
                                        placeholder="ej: Celíaco, Vegetariano, Alergia a Frutos Secos, etc."
                                        className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Warm message */}
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                                Mensaje o felicitaciones para los novios
                            </label>
                            <textarea
                                rows={3}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="¡Les deseamos lo mejor en esta nueva etapa!"
                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-sm font-black tracking-wide uppercase transition-all shadow-lg shadow-rose-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Send className="w-4 h-4" />
                            <span>{submitting ? 'Enviando...' : 'Confirmar Respuesta'}</span>
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
