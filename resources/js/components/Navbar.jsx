import React from 'react';
import { Heart, Calendar, MapPin, Sparkles, RefreshCw, LogOut, User, Sun, Moon, Bot } from 'lucide-react';
import { getPlan } from '../plans';

export default function Navbar({ event, user, onRefresh, onLogout, theme, onToggleTheme, onOpenUpgradeBot }) {
    return (
        <header className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30 px-3 sm:px-6 py-2.5 transition-colors shadow-sm w-full overflow-hidden">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
                {/* Left: Icon, Event Title & Badge */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-400 p-0.5 shadow-md shadow-rose-500/20 shrink-0">
                        <div className="h-full w-full bg-white dark:bg-zinc-900 rounded-[14px] flex items-center justify-center">
                            <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20 animate-pulse" />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                        <h1 className="text-sm sm:text-base font-black tracking-tight text-zinc-900 dark:text-white truncate max-w-[140px] sm:max-w-[220px] md:max-w-xs xl:max-w-md" title={event?.couple_names || event?.title}>
                            {event?.couple_names || event?.title || 'Sistema de Eventos'}
                        </h1>
                        {event && (
                            <button
                                type="button"
                                onClick={onOpenUpgradeBot}
                                className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-1 rounded-full bg-gradient-to-r from-rose-500/10 to-amber-500/10 hover:from-rose-500/20 hover:to-amber-500/20 text-rose-600 dark:text-rose-300 border border-rose-300/80 dark:border-rose-800/80 transition-all shrink-0 cursor-pointer shadow-sm hover:scale-[1.02]"
                                title="Cambiar o solicitar ampliación de plan con el Bot de Soporte"
                            >
                                <Bot className="w-3.5 h-3.5 text-rose-500" />
                                <span>{getPlan(event.plan_type).label} ({event.max_guests} máx)</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Right: Actions, Event Info, Theme Toggle & User Info */}
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 shrink-0">
                    {/* Date Pill */}
                    {event?.event_date && (
                        <div className="hidden md:flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/80 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold whitespace-nowrap text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>{new Date(event.event_date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        </div>
                    )}

                    {/* Status Pill (Activo vs Finalizado) */}
                    {event && (
                        (() => {
                            const isPast = event.event_date && new Date(event.event_date + 'T23:59:59') < new Date();
                            const isCompleted = event.status === 'completed' || isPast;
                            return (
                                <span className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                                    isCompleted 
                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700' 
                                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                }`}>
                                    {isCompleted ? '⏳ Finalizado' : '🟢 Activo'}
                                </span>
                            );
                        })()
                    )}

                    {/* Location Pill */}
                    {event?.location && (
                        <div className="hidden xl:flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/80 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold whitespace-nowrap text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span className="max-w-[120px] sm:max-w-[150px] truncate">{event.location}</span>
                        </div>
                    )}

                    {/* Theme Toggle Button */}
                    <button
                        onClick={onToggleTheme}
                        title={theme === 'dark' ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 transition-all border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 font-extrabold shrink-0 shadow-sm text-xs"
                    >
                        {theme === 'dark' ? (
                            <>
                                <Sun className="w-3.5 h-3.5 text-amber-400" />
                                <span className="inline">Claro</span>
                            </>
                        ) : (
                            <>
                                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="inline">Oscuro</span>
                            </>
                        )}
                    </button>

                    {/* Refresh Button */}
                    <button
                        onClick={onRefresh}
                        title="Actualizar datos"
                        className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors border border-zinc-200 dark:border-zinc-700 shrink-0 shadow-sm"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    {/* User Badge & Logout */}
                    {user && (
                        <div className="flex items-center gap-1 sm:gap-1.5 pl-1.5 sm:pl-2 border-l border-zinc-200 dark:border-zinc-700 shrink-0">
                            <div className="flex items-center gap-1.5 bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 px-2 py-1.5 sm:px-2.5 rounded-xl border border-rose-200 dark:border-rose-800/60 font-bold whitespace-nowrap shadow-sm text-xs">
                                <User className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span className="truncate max-w-[80px] sm:max-w-[120px]">{user.name}</span>
                            </div>

                            <button
                                onClick={onLogout}
                                title="Cerrar sesión"
                                className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
