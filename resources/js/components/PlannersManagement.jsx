import React, { useState, useEffect } from 'react';
import { UserPlus, Users, Heart, Mail, Lock, Shield, Calendar, Trash2, Plus, Sparkles, CheckCircle2, User, Award, ExternalLink } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

export default function PlannersManagement({ onOpenCreateEvent }) {
    const [planners, setPlanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    // Form fields for new planner
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    useEffect(() => {
        fetchPlanners();
    }, []);

    const fetchPlanners = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/planners/full');
            const data = await res.json();
            setPlanners(data.planners || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const res = await fetch('/api/planners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const json = await res.json();

            if (res.ok) {
                setSuccessMsg(`¡Wedding Planner ${name} registrada con éxito!`);
                setName('');
                setEmail('');
                setPassword('');
                setIsRegisterOpen(false);
                fetchPlanners();
            } else {
                setError(json.message || (json.errors ? Object.values(json.errors).flat().join(', ') : 'Error al registrar'));
            }
        } catch (err) {
            console.error(err);
            setError('Error de conexión con el servidor');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (planner) => {
        setConfirmModal({
            isOpen: true,
            title: 'Eliminar Wedding Planner',
            message: `¿Estás seguro de eliminar a ${planner.name}? Sus bodas asignadas volverán a ser gestionadas por el Administrador.`,
            confirmText: 'Sí, eliminar',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    const res = await fetch(`/api/planners/${planner.id}`, { method: 'DELETE' });
                    const json = await res.json();

                    if (res.ok) {
                        setSuccessMsg(json.message);
                        fetchPlanners();
                    } else {
                        setError(json.message || 'Error al eliminar');
                    }
                } catch (err) {
                    console.error(err);
                    setError('Error de conexión');
                }
            }
        });
    };

    // Calculate quick stats
    const totalPlanners = planners.length;
    const totalBodas = planners.reduce((acc, p) => acc + (p.events ? p.events.length : 0), 0);

    return (
        <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-10">
            {/* Header section with modern stats & CTA */}
            <div className="relative overflow-hidden bg-gradient-to-r from-white via-zinc-50 to-rose-50/30 dark:from-zinc-900 dark:via-zinc-900/90 dark:to-rose-950/20 border border-zinc-200/80 dark:border-zinc-800/80 p-8 rounded-3xl shadow-xl">
                {/* Decorative background glows */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 dark:bg-rose-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
                <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-amber-500/10 dark:bg-amber-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-start gap-4">
                        <div className="p-4 bg-gradient-to-tr from-rose-500 to-amber-500 text-white rounded-2xl shadow-lg shadow-rose-500/20 shrink-0">
                            <Users className="w-7 h-7" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                                    Equipo de Wedding Planners
                                </h2>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                                    {totalPlanners} Planners
                                </span>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium max-w-xl">
                                Registrá organizadoras de bodas, gestioná sus permisos y supervisá los eventos y bodas asignadas a cada una.
                            </p>
                        </div>
                    </div>

                    {/* Quick Stats Pill Cards & CTA Button */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 shadow-sm">
                            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                                <Heart className="w-4 h-4 fill-amber-500/20" />
                            </div>
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">Total Bodas</span>
                                <span className="text-sm font-black text-zinc-900 dark:text-white">{totalBodas} Eventos</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsRegisterOpen(true)}
                            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-black tracking-wide uppercase transition-all shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 active:scale-95 shrink-0"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span>Registrar Planner</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Success Toast / Notification */}
            {successMsg && (
                <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between shadow-lg backdrop-blur-md animate-fade-in">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1 bg-emerald-500 rounded-lg text-white">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <span>{successMsg}</span>
                    </div>
                    <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs font-extrabold">Cerrar</button>
                </div>
            )}

            {/* Modal: Register New Planner */}
            {isRegisterOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-md animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-2xl text-white shadow-md">
                                    <UserPlus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-zinc-900 dark:text-white">Nueva Wedding Planner</h3>
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Creá un usuario de acceso para el equipo</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsRegisterOpen(false)}
                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white font-bold p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleRegister} className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 text-xs font-semibold">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-extrabold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-rose-500" /> Nombre Completo *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="ej: Sofía Martínez"
                                    className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-white p-3 font-semibold focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5 text-amber-500" /> Correo Electrónico (Login) *
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="sofia@wedding.com"
                                    className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-white p-3 font-semibold focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5 text-blue-500" /> Contraseña *
                                </label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-white p-3 font-semibold focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                                />
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setIsRegisterOpen(false)}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-black transition-all shadow-md disabled:opacity-50 active:scale-95"
                                >
                                    {submitting ? 'Registrando...' : 'Registrar Planner'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Planners Cards Grid */}
            {loading ? (
                <div className="text-center py-20 text-zinc-400 text-xs font-semibold animate-pulse flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                    <span>Cargando equipo de Wedding Planners...</span>
                </div>
            ) : planners.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-16 text-center text-zinc-400 text-xs font-semibold shadow-sm space-y-3">
                    <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 mx-auto flex items-center justify-center">
                        <Users className="w-6 h-6" />
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-300 font-bold text-sm">No hay Wedding Planners registradas aún.</p>
                    <p className="text-zinc-400 text-xs">Hacé clic en el botón superior para agregar la primera Wedding Planner.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {planners.map((planner) => {
                        const isAdmin = planner.role === 'admin';
                        const events = planner.events || [];
                        const initials = planner.name ? planner.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'WP';

                        return (
                            <div
                                key={planner.id}
                                className="group bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-rose-500/40 dark:hover:border-rose-500/40 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-5 relative overflow-hidden"
                            >
                                {/* Top card subtle gradient line */}
                                <div className={`absolute top-0 left-0 right-0 h-1.5 ${isAdmin ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-rose-500 to-amber-400'}`} />

                                <div className="space-y-4">
                                    {/* Card Header: Avatar, Name, Email, and Clean Role Badge */}
                                    <div className="flex items-start justify-between gap-3 pt-1">
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            {/* Avatar Icon / Initial */}
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-md shrink-0 ${
                                                isAdmin ? 'bg-gradient-to-tr from-amber-500 to-orange-400' : 'bg-gradient-to-tr from-rose-500 to-amber-400'
                                            }`}>
                                                {initials}
                                            </div>

                                            <div className="min-w-0">
                                                <h3 className="font-black text-base text-zinc-900 dark:text-white truncate tracking-tight group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors">
                                                    {planner.name}
                                                </h3>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate flex items-center gap-1 mt-0.5">
                                                    <Mail className="w-3 h-3 shrink-0 text-zinc-400" />
                                                    <span className="truncate">{planner.email}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Clean non-overlapping badge pill */}
                                        <span className={`shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border shadow-xs ${
                                            isAdmin
                                                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
                                                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                                        }`}>
                                            {isAdmin ? 'Administrador' : 'Planner'}
                                        </span>
                                    </div>

                                    {/* Bodas Asignadas Section */}
                                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-3">
                                        <div className="flex items-center justify-between text-xs font-black text-zinc-700 dark:text-zinc-300">
                                            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-zinc-500 dark:text-zinc-400">
                                                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" /> Bodas Asignadas:
                                            </span>
                                            <span className="bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 px-2.5 py-0.5 rounded-full font-black text-xs shadow-xs">
                                                {events.length}
                                            </span>
                                        </div>

                                        {events.length > 0 ? (
                                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                                {events.map(ev => (
                                                    <div
                                                        key={ev.id}
                                                        className="flex items-center justify-between text-xs p-3 rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60 hover:border-rose-300 dark:hover:border-rose-800 transition-all"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                                            <span className="font-extrabold text-zinc-800 dark:text-zinc-200 truncate">
                                                                {ev.couple_names || ev.title}
                                                            </span>
                                                        </div>
                                                        {ev.event_date && (
                                                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold bg-white dark:bg-zinc-900 px-2 py-0.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800 shrink-0">
                                                                {ev.event_date}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-4 px-3 rounded-2xl bg-zinc-50/50 dark:bg-zinc-800/20 border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                                                <p className="text-[11px] text-zinc-400 font-medium italic">
                                                    No tiene bodas asignadas actualmente.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card Action Buttons */}
                                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                                    <button
                                        onClick={() => onOpenCreateEvent(planner.id)}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500 text-zinc-700 dark:text-zinc-200 text-xs font-black transition-all border border-zinc-200/60 dark:border-zinc-700/60 shadow-xs active:scale-95 group/btn"
                                    >
                                        <Plus className="w-4 h-4 text-rose-500 group-hover/btn:text-white transition-colors" />
                                        <span>Asignar Boda</span>
                                    </button>

                                    {!isAdmin && (
                                        <button
                                            onClick={() => handleDelete(planner)}
                                            title="Eliminar Wedding Planner"
                                            className="p-2.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 transition-all shrink-0"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
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


