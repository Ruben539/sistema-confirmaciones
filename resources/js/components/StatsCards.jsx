import React from 'react';
import { Users, CheckCircle2, XCircle, Clock, MessageSquare, Ticket, QrCode, Utensils, AlertTriangle } from 'lucide-react';

export default function StatsCards({ stats }) {
    const total = stats?.total_guests || 0;
    const confirmed = stats?.confirmed_guests || 0;
    const confirmedPasses = stats?.confirmed_passes || 0;
    const totalPasses = stats?.total_passes || 0;
    const declined = stats?.declined_guests || 0;
    const pending = stats?.pending_guests || 0;
    const sent = stats?.messages_sent || 0;

    const attendedGuests = stats?.attended_guests || 0;
    const attendedPasses = stats?.attended_passes || 0;
    const pendingArrival = stats?.pending_arrival || (confirmed - attendedGuests);

    const totalAdults = stats?.total_adults || 0;
    const totalYouth = stats?.total_youth || 0;
    const totalChildren = stats?.total_children || 0;
    const confAdults = stats?.confirmed_adults || 0;
    const confYouth = stats?.confirmed_youth || 0;
    const confChildren = stats?.confirmed_children || 0;

    const attendedPercent = confirmed > 0 ? Math.min(100, Math.round((attendedGuests / confirmed) * 100)) : 0;

    const dietarySummary = stats?.dietary_summary || { total: 0, lactose: 0, celiac: 0, vegan: 0, list: [] };

    const cards = [
        {
            title: 'Total Invitaciones',
            value: total,
            subtitle: `${totalYouth} jóv · ${totalAdults} ad · ${totalChildren} niñ`,
            icon: Users,
            color: 'from-blue-500 to-indigo-600',
            bgColor: 'bg-blue-50 dark:bg-blue-950/30',
            borderColor: 'border-blue-200/60 dark:border-blue-800/40',
            textColor: 'text-blue-600 dark:text-blue-400',
        },
        {
            title: 'Asistencia Confirmada',
            value: confirmed,
            subtitle: `${confYouth} jóv · ${confAdults} ad · ${confChildren} niñ`,
            icon: CheckCircle2,
            color: 'from-emerald-500 to-teal-600',
            bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
            borderColor: 'border-emerald-200/60 dark:border-emerald-800/40',
            textColor: 'text-emerald-600 dark:text-emerald-400',
        },
        {
            title: 'Ingresaron (Check-In)',
            value: attendedGuests,
            subtitle: `${pendingArrival} pendientes de llegada`,
            icon: Ticket,
            color: 'from-purple-500 to-pink-600',
            bgColor: 'bg-purple-50 dark:bg-purple-950/30',
            borderColor: 'border-purple-200/60 dark:border-purple-800/40',
            textColor: 'text-purple-600 dark:text-purple-400',
        },
        {
            title: 'Pendientes por Responder',
            value: pending,
            subtitle: 'Esperando confirmación',
            icon: Clock,
            color: 'from-amber-500 to-orange-600',
            bgColor: 'bg-amber-50 dark:bg-amber-950/30',
            borderColor: 'border-amber-200/60 dark:border-amber-800/40',
            textColor: 'text-amber-600 dark:text-amber-400',
        },
        {
            title: 'No Asistirán',
            value: declined,
            subtitle: 'Invitaciones canceladas',
            icon: XCircle,
            color: 'from-rose-500 to-red-600',
            bgColor: 'bg-rose-50 dark:bg-rose-950/30',
            borderColor: 'border-rose-200/60 dark:border-rose-800/40',
            textColor: 'text-rose-600 dark:text-rose-400',
        },
    ];

    return (
        <div className="space-y-4">
            {/* LIVE RECEPTION PROGRESS WIDGET */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 text-white border border-zinc-800 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                    <QrCode className="w-64 h-64 text-emerald-400" />
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                Control de Recepción Live
                            </span>
                            <span className="text-xs text-zinc-400 font-medium italic">Sincronizado con App Móvil</span>
                        </div>
                        <h3 className="text-xl font-extrabold tracking-tight">Progreso de Ingreso al Evento</h3>
                    </div>

                    <div className="flex items-center gap-4 bg-zinc-800/80 px-4 py-2 rounded-xl border border-zinc-700/60">
                        <div className="text-right">
                            <div className="text-2xl font-black text-emerald-400">{attendedGuests} / {confirmed}</div>
                            <div className="text-[11px] text-zinc-400 font-medium">Invitados Acreditados</div>
                        </div>
                        <div className="h-8 w-px bg-zinc-700"></div>
                        <div>
                            <div className="text-2xl font-black text-amber-400">{pendingArrival}</div>
                            <div className="text-[11px] text-zinc-400 font-medium">Faltan por llegar</div>
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-2 relative z-10">
                    <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-zinc-300 flex items-center gap-1.5">
                            <Ticket className="w-4 h-4 text-emerald-400" />
                            Ingreso: {attendedGuests} confirmados acreditados ({attendedPasses} pases totales)
                        </span>
                        <span className="text-emerald-400 font-black text-sm">{attendedPercent}% Ingresó</span>
                    </div>

                    <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-700/50">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-500 shadow-lg shadow-emerald-500/50"
                            style={{ width: `${attendedPercent}%` }}
                        ></div>
                    </div>
                </div>

                {/* Catering Quick Summary Banner */}
                {dietarySummary.total > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-zinc-300 font-semibold">
                            <Utensils className="w-4 h-4 text-amber-400" />
                            <span>Resumen de Catering: <strong className="text-white font-bold">{dietarySummary.total} personas</strong> tienen requerimiento alimentario especial</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {dietarySummary.lactose > 0 && (
                                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/30 font-bold">
                                    🥛 Intolerantes Lactosa: {dietarySummary.lactose}
                                </span>
                            )}
                            {dietarySummary.celiac > 0 && (
                                <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 rounded-lg border border-rose-500/30 font-bold">
                                    🌾 Celíacos / Gluten: {dietarySummary.celiac}
                                </span>
                            )}
                            {dietarySummary.vegan > 0 && (
                                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/30 font-bold">
                                    🥬 Vegetariano/Vegano: {dietarySummary.vegan}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* GRID OF STAT CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {cards.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={idx}
                            className={`p-5 rounded-2xl ${card.bgColor} border ${card.borderColor} backdrop-blur-sm transition-all hover:scale-[1.02] shadow-sm flex flex-col justify-between`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                    {card.title}
                                </span>
                                <div className={`p-2.5 rounded-xl bg-white dark:bg-zinc-900 shadow-sm ${card.textColor}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                            </div>

                            <div>
                                <div className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
                                    {card.value}
                                </div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
                                    {card.subtitle}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
