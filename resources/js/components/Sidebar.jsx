import React, { useState } from 'react';
import { Heart, LayoutDashboard, Calendar, Users, Settings, Plus, LogOut, ChevronLeft, ChevronRight, Sparkles, ShieldCheck, UserCheck, CheckCircle, Radio, Sun, Moon, LayoutGrid, Bot } from 'lucide-react';

export default function Sidebar({
    user,
    events,
    activeEvent,
    onSelectEvent,
    activeTab,
    setActiveTab,
    onOpenCreateEvent,
    onOpenSettings,
    onOpenUpgradeBot,
    onLogout,
    theme,
    onToggleTheme,
    pendingRequestsCount = 0
}) {
    const [collapsed, setCollapsed] = useState(false);
    const [showEventsList, setShowEventsList] = useState(false);

    const isAdmin = user?.role === 'admin';

    return (
        <aside className={`bg-white dark:bg-zinc-900 border-r border-rose-100 dark:border-zinc-800 transition-all duration-300 flex flex-col justify-between sticky top-0 h-screen z-40 ${collapsed ? 'w-20' : 'w-64'}`}>
            {/* Top Logo & Collapse Toggle */}
            <div className="overflow-y-auto">
                <div className="p-4 border-b border-rose-100 dark:border-zinc-800 flex items-center justify-between">
                    {!collapsed && (
                        <div className="flex items-center gap-2.5">
                            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-400 p-0.5 shadow-md shadow-rose-500/20">
                                <div className="h-full w-full bg-white dark:bg-zinc-900 rounded-[14px] flex items-center justify-center">
                                    <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20 animate-pulse" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-base font-black tracking-tight text-zinc-900 dark:text-white">Wedding Planner</h1>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Pro System</span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors mx-auto"
                        title={collapsed ? "Expandir menú" : "Colapsar menú"}
                    >
                        {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                    </button>
                </div>

                {/* Event Selector Header */}
                {events && events.length > 0 && !collapsed && (
                    <div className="p-4 border-b border-rose-50 dark:border-zinc-800/60 bg-rose-50/40 dark:bg-zinc-800/30">
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-rose-500" /> Evento Activo
                            </label>
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-full">
                                {events.length} {events.length === 1 ? 'evento' : 'eventos'}
                            </span>
                        </div>

                        <select
                            value={activeEvent?.id || ''}
                            onChange={(e) => {
                                const ev = events.find(item => item.id === parseInt(e.target.value, 10));
                                if (ev) onSelectEvent(ev);
                            }}
                            className="w-full text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white pl-3 pr-8 py-2.5 shadow-sm outline-none focus:ring-2 focus:ring-rose-500 truncate cursor-pointer transition-all"
                        >
                            {events.map(ev => {
                                const plannerCleanName = ev.planner?.name ? ev.planner.name.replace(/\s*\([^)]*\)/g, '').trim() : '';
                                const titleText = ev.couple_names || ev.title;
                                const isPast = ev.event_date && new Date(ev.event_date + 'T23:59:59') < new Date();
                                const isCompleted = ev.status === 'completed' || isPast;
                                const statusSuffix = isCompleted ? ' (Finalizado)' : '';
                                const optionLabel = (plannerCleanName ? `${titleText} (${plannerCleanName})` : titleText) + statusSuffix;
                                return (
                                    <option key={ev.id} value={ev.id} title={optionLabel}>
                                        {optionLabel}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                )}

                {/* Main Navigation Items */}
                <nav className="p-3 space-y-1">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-extrabold transition-all ${activeTab === 'dashboard' ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/20' : 'text-zinc-600 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-zinc-800/60'}`}
                    >
                        <LayoutDashboard className="w-4 h-4 shrink-0" />
                        {!collapsed && <span>Panel de Confirmaciones</span>}
                    </button>

                    <button
                        onClick={() => setActiveTab('guests')}
                        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-extrabold transition-all ${activeTab === 'guests' ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/20' : 'text-zinc-600 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-zinc-800/60'}`}
                    >
                        <Users className="w-4 h-4 shrink-0" />
                        {!collapsed && <span>Lista de Invitados</span>}
                    </button>

                    <button
                        onClick={() => setActiveTab('tables')}
                        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-extrabold transition-all ${activeTab === 'tables' ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/20' : 'text-zinc-600 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-zinc-800/60'}`}
                    >
                        <LayoutGrid className="w-4 h-4 shrink-0" />
                        {!collapsed && <span>Distribución de Mesas</span>}
                    </button>

                    {/* Admin Navigation Options */}
                    {isAdmin && (
                        <div className="pt-2 space-y-1">
                            {!collapsed && (
                                <div className="px-3 text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">
                                    Administración
                                </div>
                            )}
                            <button
                                onClick={() => setActiveTab('planners')}
                                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-extrabold transition-all ${activeTab === 'planners' ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-lg shadow-amber-500/20' : 'text-zinc-600 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-zinc-800/60'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <UserCheck className={`w-4 h-4 shrink-0 ${activeTab === 'planners' ? 'text-white' : 'text-amber-500'}`} />
                                    {!collapsed && <span>Planners & Planes</span>}
                                </div>
                                {!collapsed && pendingRequestsCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse shadow-sm">
                                        {pendingRequestsCount}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => setActiveTab('events_admin')}
                                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-extrabold transition-all ${activeTab === 'events_admin' ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-lg shadow-amber-500/20' : 'text-zinc-600 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-zinc-800/60'}`}
                            >
                                <Calendar className={`w-4 h-4 shrink-0 ${activeTab === 'events_admin' ? 'text-white' : 'text-amber-500'}`} />
                                {!collapsed && <span>Eventos & Asignaciones</span>}
                            </button>
                        </div>
                    )}

                    {/* Assigned Events Sub-List */}
                    {!collapsed && events.length > 0 && (
                        <div className="pt-3">
                            <div className="px-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                                Mis Eventos Asignados
                            </div>
                            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                {events.map(ev => {
                                    const isCurrent = activeEvent?.id === ev.id;
                                    const isPast = ev.event_date && new Date(ev.event_date + 'T23:59:59') < new Date();
                                    const isCompleted = ev.status === 'completed' || isPast;

                                    return (
                                        <button
                                            key={ev.id}
                                            onClick={() => { onSelectEvent(ev); setActiveTab('dashboard'); }}
                                            className={`w-full flex items-center justify-between text-left p-2.5 rounded-xl text-xs font-semibold transition-all ${isCurrent ? 'bg-rose-500/10 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-500/30 font-extrabold shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'}`}
                                        >
                                            <div className="truncate pr-1">
                                                <div className="truncate">{ev.couple_names || ev.title}</div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {ev.event_date && (
                                                        <span className="text-[10px] text-zinc-400 font-normal">{ev.event_date}</span>
                                                    )}
                                                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                                        isCompleted 
                                                            ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300' 
                                                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                                    }`}>
                                                        {isCompleted ? 'Finalizado' : 'Activo'}
                                                    </span>
                                                </div>
                                            </div>
                                            {isCurrent && <Radio className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeEvent && (
                        <button
                            onClick={onOpenUpgradeBot}
                            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-extrabold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-all border border-amber-200/60 dark:border-amber-900/50"
                            title="Solicitar ampliación o cambio de plan al bot"
                        >
                            <Bot className="w-4 h-4 shrink-0 text-amber-500" />
                            {!collapsed && <span>Solicitar Cambio de Plan</span>}
                        </button>
                    )}

                    <button
                        onClick={onOpenSettings}
                        className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-extrabold text-zinc-600 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-zinc-800/60 transition-all"
                    >
                        <Settings className="w-4 h-4 shrink-0" />
                        {!collapsed && <span>Configurar Mensaje</span>}
                    </button>

                    <button
                        onClick={onToggleTheme}
                        className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-extrabold text-zinc-600 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-zinc-800/60 transition-all"
                        title={theme === 'dark' ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
                    >
                        {theme === 'dark' ? (
                            <Sun className="w-4 h-4 shrink-0 text-amber-400" />
                        ) : (
                            <Moon className="w-4 h-4 shrink-0 text-indigo-600" />
                        )}
                        {!collapsed && <span>Modo {theme === 'dark' ? 'Claro' : 'Oscuro'}</span>}
                    </button>

                    {/* Admin Action: Create Event */}
                    {isAdmin && (
                        <div className="pt-3">
                            <button
                                onClick={onOpenCreateEvent}
                                className="w-full flex items-center justify-center gap-2 px-3.5 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-black tracking-wide transition-all shadow-lg shadow-rose-500/20 active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                                {!collapsed && <span>Crear Evento</span>}
                            </button>
                        </div>
                    )}
                </nav>
            </div>

            {/* Bottom User Info & Logout */}
            <div className="p-3 border-t border-rose-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                {!collapsed ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className={`p-2 rounded-xl text-white ${isAdmin ? 'bg-amber-500' : 'bg-rose-500'}`}>
                                    {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                </div>
                                <div className="truncate">
                                    <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">{user?.name}</div>
                                    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                                        {isAdmin ? 'Administrador' : 'Wedding Planner'}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={onLogout}
                                title="Cerrar Sesión"
                                className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={onLogout}
                        title="Cerrar Sesión"
                        className="w-full p-2.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                )}
            </div>
        </aside>
    );
}
