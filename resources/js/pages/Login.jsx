import React, { useState } from 'react';
import { Heart, Lock, Mail, User, ArrowRight, Sparkles, CheckCircle2, FileSpreadsheet, MessageSquare, ShieldCheck, Sun, Moon, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '../api';

export default function Login({ onLoginSuccess }) {
    const [isRegister, setIsRegister] = useState(false);
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const toggleTheme = () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
        const payload = isRegister
            ? { name, username, email, password }
            : { username, password, remember };

        try {
            const { ok, json } = await apiFetch(endpoint, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (ok && json?.user) {
                onLoginSuccess(json.user);
            } else {
                setError(json?.message || json?.errors?.username?.[0] || json?.errors?.email?.[0] || 'Error de autenticación');
            }
        } catch (err) {
            console.error(err);
            setError('Error al conectar con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    const handleDemoLogin = async (demoUsername) => {
        const targetUser = demoUsername || 'planner';
        setUsername(targetUser);
        setPassword('password123');
        setLoading(true);
        setError(null);

        try {
            const { ok, json } = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    username: targetUser,
                    password: 'password123',
                    remember: true
                })
            });

            if (ok && json?.user) {
                onLoginSuccess(json.user);
            } else {
                setError(json?.message || 'Error al iniciar como demo.');
            }
        } catch (err) {
            console.error(err);
            setError('Error de conexión.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-rose-100 via-white to-amber-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center p-4 font-sans relative overflow-hidden">
            {/* Background Blur Accents */}
            <div className="absolute top-1/4 -left-20 w-96 h-96 bg-rose-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />

            {/* Theme Toggle Button */}
            <div className="absolute top-5 right-5 z-30">
                <button
                    onClick={toggleTheme}
                    className="p-3 rounded-2xl bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md border border-rose-200/60 dark:border-zinc-700 shadow-lg text-zinc-700 dark:text-zinc-200 hover:scale-105 transition-all"
                    title="Cambiar Modo Claro / Oscuro"
                >
                    <Sun className="w-5 h-5 hidden dark:block text-amber-400" />
                    <Moon className="w-5 h-5 block dark:hidden text-indigo-600" />
                </button>
            </div>

            <div className="w-full max-w-4xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-rose-200/60 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
                {/* Left Side: Brand & Feature Showcase */}
                <div className="p-8 sm:p-10 bg-gradient-to-b from-rose-500 via-rose-600 to-amber-600 text-white flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="space-y-6 relative z-10">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                                <Heart className="w-7 h-7 text-white fill-white/20 animate-pulse" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black tracking-tight">Wedding Planner Pro</h1>
                                <span className="text-[11px] font-bold uppercase tracking-widest text-rose-100">Confirmación de Asistencia</span>
                            </div>
                        </div>

                        <div className="pt-4 space-y-3">
                            <h2 className="text-2xl font-black leading-tight">
                                La plataforma definitiva para coordinar todos tus eventos.
                            </h2>
                            <p className="text-xs font-medium text-rose-100 leading-relaxed">
                                Carga de listas por Excel, envíos automatizados por WhatsApp y seguimiento de confirmación en tiempo real.
                            </p>
                        </div>

                        {/* Feature Badges */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                                <FileSpreadsheet className="w-5 h-5 text-emerald-300 shrink-0" />
                                <div className="text-xs font-semibold">Importación Inteligente desde Excel</div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                                <MessageSquare className="w-5 h-5 text-green-300 shrink-0" />
                                <div className="text-xs font-semibold">Mensajería Directa por WhatsApp</div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                                <ShieldCheck className="w-5 h-5 text-amber-300 shrink-0" />
                                <div className="text-xs font-semibold">Gestión de Mesas y Listas de Invitados</div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 text-[11px] text-rose-100/80 font-medium relative z-10">
                        © {new Date().getFullYear()} Wedding Planner Pro. Todos los derechos reservados.
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="p-8 sm:p-10 flex flex-col justify-center space-y-6">
                    {/* Header */}
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                            Iniciar Sesión
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Ingresá tus credenciales para administrar tus eventos.
                        </p>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                            {error}
                        </div>
                    )}

                    {/* Form Fields */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-rose-500" /> Usuario
                            </label>
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Ingresá tu usuario"
                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                <Lock className="w-3.5 h-3.5 text-rose-500" /> Contraseña
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 pr-10 font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-1"
                                    title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4 text-rose-500" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                            <label className="flex items-center gap-2 cursor-pointer font-medium text-zinc-600 dark:text-zinc-400">
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    onChange={(e) => setRemember(e.target.checked)}
                                    className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
                                />
                                <span>Recordarme</span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-rose-600 dark:hover:bg-rose-400 dark:hover:text-white text-xs font-black tracking-wide uppercase transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <span>{loading ? 'Procesando...' : 'Iniciar Sesión'}</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
