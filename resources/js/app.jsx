import './bootstrap';
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { apiFetch } from './api';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import StatsCards from './components/StatsCards';
import GuestList from './components/GuestList';
import ExcelUploadModal from './components/ExcelUploadModal';
import AddGuestModal from './components/AddGuestModal';
import EventSettingsModal from './components/EventSettingsModal';
import WhatsAppBulkModal from './components/WhatsAppBulkModal';
import CreateEventModal from './components/CreateEventModal';
import PlannersManagement from './components/PlannersManagement';
import EventsManagement from './components/EventsManagement';
import ConfirmModal from './components/ConfirmModal';
import TableDistribution from './components/TableDistribution';
import PlanUpgradeChatbotModal from './components/PlanUpgradeChatbotModal';
import EventTiming from './components/EventTiming';
import EventTypesManagement from './components/EventTypesManagement';
import HostessesManagement from './components/HostessesManagement';
import AppReleases from './components/AppReleases';
import MessagesInbox from './components/MessagesInbox';
import SendReviewModal from './components/SendReviewModal';
import WhatsAppWeb from './components/WhatsAppWeb';
import AiListAssistant from './components/AiListAssistant';
import EventInteractivePanel from './components/EventInteractivePanel';
import CasitaModule from './components/casita/CasitaModule';
import { usePendingContracts } from './components/ContractPanel';
import { buildDemoInvitation } from './demoInvitation';
import LiveProjectionScreen from './components/LiveProjectionScreen';
import PublicDedicationPage from './components/PublicDedicationPage';
import LiveBroadcastCamera from './pages/LiveBroadcastCamera';
import GuestRsvp from './pages/GuestRsvp';
import Login from './pages/Login';
import { FileSpreadsheet, Heart, Sparkles, Plus, Calendar, MapPin, ShieldCheck, UserCheck, Users, X } from 'lucide-react';

function Dashboard({ user, onLogout }) {
    const [events, setEvents] = useState([]);
    const [activeEvent, setActiveEvent] = useState(null);
    const [guests, setGuests] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const isHostess = user?.role === 'hostess';
    // Confirmation chatbot on? While it's off only the "WhatsApp" module sends (manual messages)
    const botOn = user?.whatsapp_automation === true;
    // Anfitriona: her only screen is the guest list of her assigned events
    const [activeTab, setActiveTab] = useState(isHostess ? 'guests' : 'dashboard');

    useEffect(() => {
        if (isHostess && !['guests', 'app'].includes(activeTab)) setActiveTab('guests');
    }, [isHostess, activeTab]);

    // New mobile app version not downloaded / dismissed yet (planners and hostesses)
    const [appUpdate, setAppUpdate] = useState({ has_update: false, latest: null });
    const loadAppUpdate = async () => {
        const { ok, json } = await apiFetch('/api/app-releases');
        if (ok && json) setAppUpdate({ has_update: Boolean(json.has_update), latest: json.latest });
    };
    useEffect(() => {
        loadAppUpdate();
    }, []);
    const dismissAppUpdate = async () => {
        setAppUpdate((prev) => ({ ...prev, has_update: false }));
        await apiFetch('/api/app-releases/seen', { method: 'POST' });
    };
    // Unread WhatsApp messages of the active event (badge in the sidebar)
    const [unreadMessages, setUnreadMessages] = useState(0);
    // Background bulk send of the active event (runs on the server: shown here even with the modal closed)
    const [bulkProgress, setBulkProgress] = useState(null);
    const [bulkTick, setBulkTick] = useState(0);
    useEffect(() => {
        if (isHostess || !activeEvent?.id) {
            setUnreadMessages(0);
            return;
        }
        const loadUnread = async () => {
            const { ok, json } = await apiFetch(`/api/events/${activeEvent.id}/conversations`);
            if (ok && json) setUnreadMessages(json.totals?.unread || 0);
        };
        loadUnread();
        const timer = setInterval(loadUnread, 60000);
        return () => clearInterval(timer);
    }, [activeEvent?.id, isHostess]);
    useEffect(() => {
        if (isHostess || !activeEvent?.id) {
            setBulkProgress(null);
            return;
        }
        let lastSent = null;
        const load = async () => {
            const { ok, json } = await apiFetch(`/api/events/${activeEvent.id}/bulk-status`);
            if (!ok || !json) return;
            setBulkProgress(json.active ? json : null);
            // New messages went out: refresh the list (sent marks, reminders)
            if (lastSent !== null && json.sent !== lastSent) loadGuests(activeEvent.id);
            lastSent = json.sent ?? null;
        };
        load();
        const timer = setInterval(load, 20000);
        return () => clearInterval(timer);
    }, [activeEvent?.id, isHostess, bulkTick]);

    const [toastMessage, setToastMessage] = useState(null);
    const [preselectedPlannerId, setPreselectedPlannerId] = useState(null);
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
    // Upcoming events without a signed contract (admin only): counters in the sidebar
    const pendingContracts = usePendingContracts(user?.role === 'admin');

    // Modals
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
    const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
    const [isChatbotUpgradeOpen, setIsChatbotUpgradeOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [editingGuest, setEditingGuest] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, variant: 'danger', confirmText: 'Confirmar' });

    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'dark';
    });

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            if (document.body) document.body.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
            if (document.body) document.body.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const handleToggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    useEffect(() => {
        loadEvents();
        if (user?.role === 'admin') {
            fetchPendingRequests();
        }
    }, [user]);

    const fetchPendingRequests = async () => {
        try {
            const { ok, json } = await apiFetch('/api/plan-requests');
            if (ok && json && typeof json.pending_count === 'number') {
                setPendingRequestsCount(json.pending_count);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 4000);
    };

    const loadEvents = async (selectedId = null) => {
        setLoading(true);
        try {
            const { ok, json } = await apiFetch('/api/event');
            const loadedEvents = (ok && json?.events) ? json.events : [];
            setEvents(loadedEvents);

            let selected = null;
            if (selectedId) {
                selected = loadedEvents.find(e => e.id === selectedId);
            }
            if (!selected && loadedEvents.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                selected = loadedEvents.find(e => (e.status === 'active' || !e.status) && (!e.event_date || e.event_date >= today))
                    || loadedEvents.find(e => e.status === 'active' || !e.status)
                    || loadedEvents[0];
            }

            setActiveEvent(selected);
            if (selected) {
                loadGuests(selected.id);
            } else {
                setGuests([]);
                setStats(null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadGuests = async (eventId) => {
        try {
            const { ok, json } = await apiFetch(`/api/events/${eventId}/guests`);
            if (ok && json) {
                setGuests(json.guests || []);
                setStats(json.stats || null);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelectEvent = (ev) => {
        setActiveEvent(ev);
        loadGuests(ev.id);
    };

    const handleSaveEvent = async (id, updatedFields) => {
        try {
            const { ok, json } = await apiFetch(`/api/event/${id}`, {
                method: 'PUT',
                body: JSON.stringify(updatedFields)
            });
            if (ok && json?.event) {
                setActiveEvent(json.event);
                loadEvents(id);
                showToast('Configuración del evento guardada con éxito.');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpdateGuest = async (guestId, fields) => {
        try {
            const { ok } = await apiFetch(`/api/guests/${guestId}`, {
                method: 'PUT',
                body: JSON.stringify(fields)
            });
            if (ok && activeEvent) {
                loadGuests(activeEvent.id);
                showToast('Invitado actualizado correctamente.');
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Reminder to a guest who got the invitation but didn't answer (says the corrected number of places)
    const handleSendReminder = async (guest) => {
        const places = guest.passes || 1;
        if (!window.confirm(`¿Enviar un recordatorio a ${guest.name}?\n\nLe pide que confirme e indica: Lugares reservados: ${places} ${places === 1 ? 'persona' : 'personas'}.`)) return;
        const { json } = await apiFetch(`/api/guests/${guest.id}/reminder`, { method: 'POST' });
        showToast(json?.message || 'No se pudo programar el recordatorio.');
        if (activeEvent) loadGuests(activeEvent.id);
    };

    // Review window before bulk sends: who gets it, what, and how the message looks
    const [sendReview, setSendReview] = useState(null);

    const firstName = (g) => (g.name || '').trim().split(' ')[0];
    const peopleText = (n) => `${n} ${n === 1 ? 'persona' : 'personas'}`;
    const hostsText = () => activeEvent?.couple_names || activeEvent?.title || '';

    // Same texts the server sends (GuestMessages::countCorrection / reminder)
    const apologyPreview = (g) => {
        const places = Math.max(1, g.passes || 1);
        let text = `¡Hola, ${firstName(g)}! 🙏 Te pedimos disculpas por la confusión: revisamos la lista de invitados de la celebración de ${hostsText()} y tu invitación es para *${peopleText(places)}*.`;
        if (g.confirmed_passes > 0 && g.confirmed_passes !== places) {
            text += `\n\nTenemos confirmadas *${g.confirmed_passes}*. Si cambia, respondé este mensaje y lo actualizamos.`;
        }
        return `${text}\n\nTu pase de ingreso sigue siendo el mismo. ¡Gracias por tu comprensión! 💛`;
    };
    const reminderPreview = (g) => {
        const hosts = hostsText();
        const plural = /\s(y|e)\s|&|,/i.test(hosts);
        const deadline = activeEvent?.rsvp_deadline_effective
            ? new Date(`${activeEvent.rsvp_deadline_effective}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
            : '';
        return `¡Hola ${g.name}! 👋 💌 ${hosts} todavía ${plural ? 'esperan' : 'espera'} tu respuesta para su celebración, ¡y nos encantaría contar con vos!`
            + (deadline ? `\n\n⏰ Podés confirmar hasta el ${deadline}.` : '')
            + `\n📍 ${activeEvent?.location || ''}`
            + `\n\n🎟️ Lugares reservados: *${peopleText(Math.max(1, g.passes || 1))}*`
            + '\n\nRespondé este mensaje con:\n*1* — ¡Sí, voy!\n*2* — No voy a poder';
    };

    // Guests told a number of people that later changed (corrected list / edited): reminder or apology
    const handleSendCorrections = () => {
        if (!activeEvent) return;
        const list = guests.filter((g) => g.pending_correction_from != null && g.status !== 'declined' && g.phone);
        setSendReview({
            title: `Enviar correcciones (${list.length})`,
            description: 'Invitados a los que les cambió la cantidad después de recibir la invitación o confirmar. Los que no respondieron reciben un recordatorio con los lugares corregidos; los confirmados, una disculpa con la cantidad correcta (su QR no cambia).',
            confirmLabel: 'Enviar correcciones',
            items: list.map((g) => {
                const confirmed = ['confirmed', 'attended'].includes(g.status);
                return {
                    id: g.id,
                    name: g.name,
                    phone: g.phone,
                    detail: `antes ${g.pending_correction_from} → ahora ${peopleText(Math.max(1, g.passes || 1))}`,
                    tag: confirmed ? 'Disculpa' : 'Recordatorio',
                    tagClass: confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                    preview: confirmed ? apologyPreview(g) : reminderPreview(g),
                };
            }),
            onConfirm: async (ids) => {
                const { json } = await apiFetch(`/api/events/${activeEvent.id}/send-corrections`, { method: 'POST', body: JSON.stringify({ guest_ids: ids }) });
                showToast(json?.message || 'No se pudieron programar las correcciones.');
                setSendReview(null);
                setBulkTick((t) => t + 1);
                loadGuests(activeEvent.id);
            },
        });
    };

    // Apology with the right number of people, only that message (to confirmed guests)
    const handleSendCountCorrection = (list) => {
        if (!activeEvent || !list.length) return;
        setSendReview({
            title: `Enviar cantidad correcta (${list.length})`,
            description: 'Solo este mensaje de disculpa con la cantidad de invitados correcta. No se reenvía el QR (sigue siendo el mismo).',
            confirmLabel: 'Enviar',
            items: list.map((g) => ({
                id: g.id,
                name: g.name,
                phone: g.phone,
                detail: peopleText(Math.max(1, g.passes || 1)) + (g.confirmed_passes > 0 && g.confirmed_passes !== g.passes ? ` · confirmaron ${g.confirmed_passes}` : ''),
                tag: 'Disculpa',
                tagClass: 'bg-emerald-100 text-emerald-700',
                preview: apologyPreview(g),
            })),
            onConfirm: async (ids) => {
                const { json } = await apiFetch(`/api/events/${activeEvent.id}/send-count-correction`, { method: 'POST', body: JSON.stringify({ guest_ids: ids }) });
                showToast(json?.message || 'No se pudo programar la corrección.');
                setSendReview(null);
                setBulkTick((t) => t + 1);
            },
        });
    };

    // The same people loaded once per phone: ONE invitation (messages once; any of the numbers is recognized)
    const handleMergeGuests = async (list, onDone) => {
        if (!activeEvent || list.length < 2) return;
        const totals = list.map((g) => Math.max(1, g.passes || 1));
        const suggested = totals.every((n) => n === totals[0]) && totals[0] > 1 ? totals[0] : totals.reduce((a, b) => a + b, 0);
        const holder = list.find((g) => ['confirmed', 'attended'].includes(g.status)) || list[0];
        const answer = window.prompt(
            `Unir en una sola invitación:\n${list.map((g) => `• ${g.name} (${g.phone}) — ${g.passes || 1}`).join('\n')}\n\nQueda a nombre de "${holder.name}" y los mensajes van solo a ${holder.phone}; los otros números se reconocen como la misma invitación.\n\n¿Para cuántas personas es en total?`,
            String(suggested)
        );
        if (answer === null) return;
        const total = parseInt(answer, 10);
        if (!total || total < 1) {
            showToast('Indicá una cantidad válida de personas.');
            return;
        }
        const { json } = await apiFetch(`/api/events/${activeEvent.id}/guests/merge`, {
            method: 'POST',
            body: JSON.stringify({ guest_ids: [holder.id, ...list.filter((g) => g.id !== holder.id).map((g) => g.id)], total }),
        });
        showToast(json?.message || 'No se pudieron unir las invitaciones.');
        onDone && onDone();
        loadGuests(activeEvent.id);
    };

    const handleRemindAllPending = () => {
        if (!activeEvent) return;
        const list = guests.filter((g) => g.status === 'pending' && g.whatsapp_status === 'sent' && g.phone);
        setSendReview({
            title: `Recordar a pendientes (${list.length})`,
            description: 'Recibieron la invitación y todavía no respondieron. Cada recordatorio dice la cantidad de lugares actual. Salen de a uno, con pausas y respetando el cupo diario (los que ya tuvieron un recordatorio en las últimas 12 h se saltean).',
            confirmLabel: 'Enviar recordatorios',
            items: list.map((g) => ({
                id: g.id,
                name: g.name,
                phone: g.phone,
                detail: peopleText(Math.max(1, g.passes || 1)) + (g.reminder_count ? ` · ${g.reminder_count} recordatorio(s) enviados` : ''),
                tag: 'Recordatorio',
                tagClass: 'bg-amber-100 text-amber-700',
                preview: reminderPreview(g),
            })),
            onConfirm: async (ids) => {
                const { json } = await apiFetch(`/api/events/${activeEvent.id}/send-bulk-queue`, { method: 'POST', body: JSON.stringify({ mode: 'reminder', guest_ids: ids }) });
                showToast(json?.message || 'No se pudieron programar los recordatorios.');
                setSendReview(null);
                setBulkTick((t) => t + 1);
                loadGuests(activeEvent.id);
            },
        });
    };

    // Sends the entry pass again by WhatsApp (e.g. after correcting how many people it is for)
    const handleResendQr = async (guest) => {
        const people = guest.confirmed_passes || guest.passes || 1;
        const partial = guest.confirmed_passes > 0 && guest.confirmed_passes !== guest.passes
            ? `\n(La invitación es para ${guest.passes}; confirmaron ${guest.confirmed_passes}. Si van todos, corregilo antes con ✏️ Editar → Confirmaron.)`
            : '';
        if (!window.confirm(`¿Reenviar el pase QR a ${guest.name} por WhatsApp?\n\nEl mensaje dirá que es válido para ${people} ${people === 1 ? 'persona' : 'personas'}.${partial}`)) return;
        const { json } = await apiFetch(`/api/guests/${guest.id}/resend-qr`, { method: 'POST' });
        showToast(json?.message || 'No se pudo reenviar el QR.');
    };

    const handleMarkSent = async (guestId) => {
        setGuests(prev => prev.map(g => g.id === guestId ? { ...g, whatsapp_status: 'sent' } : g));
        try {
            await apiFetch(`/api/guests/${guestId}/sent`, { method: 'POST' });
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteGuest = (guestId) => {
        setConfirmModal({
            isOpen: true,
            title: 'Eliminar Invitado',
            message: '¿Estás seguro de eliminar este invitado de la lista?',
            confirmText: 'Sí, eliminar',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    const { ok } = await apiFetch(`/api/guests/${guestId}`, { method: 'DELETE' });
                    if (ok && activeEvent) {
                        loadGuests(activeEvent.id);
                        showToast('Invitado eliminado.');
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        });
    };

    const handleClearAll = () => {
        if (!activeEvent) return;
        setConfirmModal({
            isOpen: true,
            title: 'Borrar Toda la Lista',
            message: '¿ATENCIÓN: Querés borrar TODOS los invitados de la lista? Esta acción no se puede deshacer.',
            confirmText: 'Sí, vaciar lista',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    const { ok } = await apiFetch(`/api/events/${activeEvent.id}/guests/clear`, { method: 'DELETE' });
                    if (ok) {
                        loadGuests(activeEvent.id);
                        showToast('Lista de invitados vaciada.');
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        });
    };

    if (loading && !events) {
        return (
            <div className="min-h-screen bg-rose-50/40 dark:bg-zinc-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <Heart className="w-10 h-10 text-rose-500 animate-pulse" />
                    <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">Cargando Wedding Planner...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans antialiased flex transition-colors duration-200">
            {/* Sidebar Navigation */}
            <Sidebar
                user={user}
                events={events}
                activeEvent={activeEvent}
                onSelectEvent={handleSelectEvent}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onOpenCreateEvent={() => setIsCreateEventModalOpen(true)}
                onOpenSettings={user?.role === 'admin' ? () => setIsSettingsModalOpen(true) : null}
                onOpenUpgradeBot={() => setIsChatbotUpgradeOpen(true)}
                onLogout={onLogout}
                theme={theme}
                onToggleTheme={handleToggleTheme}
                pendingRequestsCount={pendingRequestsCount}
                pendingContracts={{
                    event: pendingContracts.items.filter(i => i.type === 'event').length,
                    casita: pendingContracts.items.filter(i => i.type === 'casita').length,
                }}
                hasAppUpdate={appUpdate.has_update}
                unreadMessages={unreadMessages}
            />

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Navbar */}
                <Navbar
                    event={activeEvent}
                    user={user}
                    onOpenSettings={user?.role === 'admin' ? () => setIsSettingsModalOpen(true) : null}
                    onRefresh={() => activeEvent && loadGuests(activeEvent.id)}
                    onLogout={onLogout}
                    theme={theme}
                    onToggleTheme={handleToggleTheme}
                    onOpenUpgradeBot={() => setIsChatbotUpgradeOpen(true)}
                />

                {/* Main Content */}
                <main className="p-4 sm:p-8 space-y-8 flex-1">
                    {/* Background send in progress: visible anywhere in the panel */}
                    {bulkProgress?.active && !isWhatsAppModalOpen && (() => {
                        const label = { invitation: 'Enviando invitaciones', reminder: 'Enviando recordatorios', corrections: 'Enviando correcciones' }[bulkProgress.mode] || 'Enviando mensajes';
                        const next = bulkProgress.next_at ? new Date(bulkProgress.next_at) : null;
                        const nextText = bulkProgress.waiting
                            || (next ? `Próximo envío a las ${next.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} (pausa anti-bloqueo)` : 'Enviando ahora…');
                        return (
                            <div
                                className="fixed bottom-6 left-6 z-40 w-80 max-w-[calc(100vw-3rem)] p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900 shadow-2xl text-left space-y-2 group"
                            >
                                <div className="flex items-center justify-between gap-2 text-xs">
                                    <button
                                        onClick={() => setIsWhatsAppModalOpen(true)}
                                        className="flex items-center gap-2 font-black text-zinc-900 dark:text-white hover:text-emerald-600 transition-colors text-left"
                                        title="Ver el envío"
                                    >
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                                        </span>
                                        {label}
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-emerald-600">{bulkProgress.percent}%</span>
                                        <button
                                            type="button"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                setBulkProgress(null);
                                                if (activeEvent?.id) {
                                                    try {
                                                        await apiFetch(`/api/events/${activeEvent.id}/cancel-bulk-queue`, { method: 'POST' });
                                                    } catch (err) {}
                                                }
                                            }}
                                            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                            title="Cerrar y detener envío"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <div
                                    onClick={() => setIsWhatsAppModalOpen(true)}
                                    className="cursor-pointer space-y-2"
                                    title="Ver el envío"
                                >
                                    <div className="h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 overflow-hidden">
                                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${bulkProgress.percent}%` }} />
                                    </div>
                                    <div className="text-[11px] text-zinc-500">
                                        {bulkProgress.sent} de {bulkProgress.total} enviados{bulkProgress.failed ? ` · ${bulkProgress.failed} con error` : ''} · {nextText}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Toast Notification */}
                    {toastMessage && (
                        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-5 py-3 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-2 animate-bounce">
                            <Sparkles className="w-4 h-4 text-amber-400 dark:text-amber-500" />
                            <span>{toastMessage}</span>
                        </div>
                    )}

                    {/* New app version notice */}
                    {appUpdate.has_update && appUpdate.latest && activeTab !== 'app' && (
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-white/20"><Sparkles className="w-5 h-5" /></div>
                                <div>
                                    <div className="text-sm font-black">Nueva versión de la app: {appUpdate.latest.version}</div>
                                    <div className="text-xs text-white/85">Descargala e instalala en tu celular para tener las últimas mejoras.</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => setActiveTab('app')} className="px-4 py-2 rounded-xl bg-white text-rose-600 text-xs font-black hover:bg-rose-50">
                                    Ver y descargar
                                </button>
                                <button onClick={dismissAppUpdate} className="px-3 py-2 rounded-xl text-xs font-bold text-white/90 hover:bg-white/15">
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Active View based on activeTab */}
                    {activeTab === 'app' ? (
                        <AppReleases user={user} showToast={showToast} onReleasesChanged={loadAppUpdate} />
                    ) : activeTab === 'ai-list' && !isHostess ? (
                        <AiListAssistant event={activeEvent} showToast={showToast} onImported={() => { setActiveTab('guests'); activeEvent && loadGuests(activeEvent.id); }} />
                    ) : activeTab === 'whatsapp' && !isHostess ? (
                        <WhatsAppWeb event={activeEvent} guests={guests} user={user} showToast={showToast} />
                    ) : activeTab === 'messages' && !isHostess ? (
                        <MessagesInbox event={activeEvent} user={user} showToast={showToast} onUnreadChange={setUnreadMessages} />
                    ) : activeTab === 'hostesses' && (user?.role === 'admin' || user?.role === 'planner') ? (
                        <HostessesManagement user={user} events={events} showToast={showToast} />
                    ) : activeTab === 'planners' && user?.role === 'admin' ? (
                        <PlannersManagement
                            onOpenCreateEvent={(plannerId) => {
                                setPreselectedPlannerId(plannerId);
                                setIsCreateEventModalOpen(true);
                            }}
                            onRequestsCountChange={setPendingRequestsCount}
                        />
                    ) : activeTab === 'events_admin' && user?.role === 'admin' ? (
                        <EventsManagement
                            onOpenCreateEvent={() => { setEditingEvent(null); setIsCreateEventModalOpen(true); }}
                            onEditEvent={(ev) => { setEditingEvent(ev); setIsCreateEventModalOpen(true); }}
                            onDeleteEvent={() => loadEvents()}
                            onSelectEvent={(ev) => {
                                handleSelectEvent(ev);
                                setActiveTab('dashboard');
                            }}
                        />
                    ) : activeTab.startsWith('casita_') && user?.role === 'admin' ? (
                        <CasitaModule view={activeTab} setView={setActiveTab} showToast={showToast} />
                    ) : activeTab === 'event_types' && user?.role === 'admin' ? (
                        <EventTypesManagement
                            showToast={showToast}
                        />
                    ) : activeTab === 'tables' ? (
                        <TableDistribution
                            eventId={activeEvent?.id}
                            eventTitle={activeEvent?.couple_names || activeEvent?.title}
                            event={activeEvent}
                            user={user}
                            showToast={showToast}
                            onOpenCreateEvent={user?.role === 'admin' ? () => { setEditingEvent(null); setIsCreateEventModalOpen(true); } : null}
                        />
                    ) : activeTab === 'timing' ? (
                        <EventTiming
                            eventId={activeEvent?.id}
                            event={activeEvent}
                            showToast={showToast}
                            user={user}
                        />
                    ) : activeTab === 'invitation' ? (
                        <EventInteractivePanel
                            event={activeEvent}
                            user={user}
                            onUpdateEvent={handleSelectEvent}
                            showToast={showToast}
                        />
                    ) : activeTab === 'guests' ? (
                        !activeEvent ? (
                            <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4 max-w-lg mx-auto my-12 animate-fade-in font-sans">
                                <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto border border-rose-100 dark:border-rose-900/40">
                                    <Users className="w-8 h-8" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                                        Sin Evento Seleccionado
                                    </h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                                        Para gestionar invitados, importar listas y enviar confirmaciones por WhatsApp, primero debés seleccionar un evento asignado.
                                    </p>
                                </div>
                                {user?.role === 'admin' ? (
                                    <button
                                        onClick={() => { setEditingEvent(null); setIsCreateEventModalOpen(true); }}
                                        className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-extrabold shadow-md shadow-rose-500/20 active:scale-95 transition-all inline-flex items-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Crear Primer Evento</span>
                                    </button>
                                ) : (
                                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl text-xs text-zinc-500 dark:text-zinc-400 font-medium max-w-sm mx-auto border border-zinc-200/60 dark:border-zinc-700/60">
                                        Actualmente no tenés ningún evento activo asignado. El Administrador dará de alta y te asignará tus eventos correspondientes según tu plan.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6 animate-fade-in">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800/80 p-6 rounded-3xl shadow-xl">
                                    <div className="space-y-1">
                                        <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                                            Lista de Invitados — <span className="text-rose-500">{activeEvent?.couple_names || activeEvent?.title}</span>
                                        </h2>
                                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                            {guests.length} {guests.length === 1 ? 'invitado registrado' : 'invitados registrados'} para este evento.
                                        </p>
                                    </div>
                                </div>

                                <GuestList
                                    guests={guests}
                                    readOnly={isHostess}
                                    eventTitle={activeEvent?.couple_names || activeEvent?.title}
                                    onOpenAddModal={() => { setEditingGuest(null); setIsAddModalOpen(true); }}
                                    onOpenExcelModal={() => setActiveTab('ai-list')}
                                    onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
                                    onEditGuest={(guest) => { setEditingGuest(guest); setIsAddModalOpen(true); }}
                                    onUpdateGuest={handleUpdateGuest}
                                    onDeleteGuest={handleDeleteGuest}
                                    onClearAll={handleClearAll}
                                    onMarkSent={handleMarkSent}
                                    onResendQr={handleResendQr}
                                    onSendReminder={handleSendReminder}
                                    onRemindAllPending={handleRemindAllPending}
                                    onSendCorrections={handleSendCorrections}
                                    onSendCountCorrection={handleSendCountCorrection}
                                    onMergeGuests={handleMergeGuests}
                                />
                            </div>
                        )
                    ) : (
                        <>
                            {/* Role Banner / Admin Notification */}
                            {user?.role === 'admin' && (
                                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 text-amber-900 dark:text-amber-300 text-xs font-semibold flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                                        <span>Estás navegando como <strong>Administrador</strong>. Podés crear eventos y asignárselos a tus Wedding Planners.</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setActiveTab('planners')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 hover:bg-amber-200 font-bold transition-all text-xs"
                                        >
                                            <UserCheck className="w-3.5 h-3.5" />
                                            <span>Planners & Planes</span>
                                            {pendingRequestsCount > 0 && (
                                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                                                    {pendingRequestsCount}
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => { setEditingEvent(null); setIsCreateEventModalOpen(true); }}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 text-white hover:bg-amber-700 font-bold transition-all text-xs"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Crear Evento</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!activeEvent ? (
                                <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4 max-w-lg mx-auto my-12 animate-fade-in font-sans">
                                    <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto border border-rose-100 dark:border-rose-900/40">
                                        <Heart className="w-8 h-8 fill-rose-500/20" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                                            ¡Bienvenido al Sistema de Confirmaciones!
                                        </h3>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                                            {user?.role === 'admin'
                                                ? 'Actualmente no hay ningún evento registrado en la plataforma. Creá un evento para comenzar a gestionar invitados y confirmaciones.'
                                                : 'Actualmente no tenés ningún evento activo asignado a tu cuenta.'}
                                        </p>
                                    </div>
                                    {user?.role === 'admin' ? (
                                        <button
                                            onClick={() => { setEditingEvent(null); setIsCreateEventModalOpen(true); }}
                                            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-extrabold shadow-md shadow-rose-500/20 active:scale-95 transition-all inline-flex items-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Crear Mi Primer Evento</span>
                                        </button>
                                    ) : (
                                        <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/30 rounded-2xl text-xs text-rose-700 dark:text-rose-300 font-semibold max-w-md mx-auto border border-rose-200/60 dark:border-rose-900/40">
                                            📌 Tu usuario Planner está activo. El Administrador creará y te habilitará los eventos correspondientes a tu plan.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {/* Hero Banner for Empty State */}
                                    {guests.length === 0 && (
                                        <div className="p-8 rounded-3xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                                            <div className="space-y-2 max-w-xl z-10">
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md">
                                                    {activeEvent.couple_names || activeEvent.title}
                                                </span>
                                                <h2 className="text-2xl sm:text-3xl font-black">¡Comenzá a gestionar la lista de invitados!</h2>
                                                <p className="text-xs sm:text-sm font-medium opacity-90 leading-relaxed">
                                                    Subí tu archivo Excel con los nombres y teléfonos para automatizar los mensajes de WhatsApp y la confirmación de asistencia.
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 shrink-0 z-10">
                                                <button
                                                    onClick={() => setActiveTab('ai-list')}
                                                    className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-zinc-900 font-extrabold text-xs shadow-lg hover:bg-rose-50 transition-all active:scale-95"
                                                >
                                                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                                    <span>Subir Archivo Excel</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Metrics Cards */}
                                    <StatsCards stats={stats} event={activeEvent} />

                                    {/* Guest List Component */}
                                    <GuestList
                                        guests={guests}
                                        onOpenAddModal={() => { setEditingGuest(null); setIsAddModalOpen(true); }}
                                        onOpenExcelModal={() => setActiveTab('ai-list')}
                                        onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
                                        onEditGuest={(guest) => { setEditingGuest(guest); setIsAddModalOpen(true); }}
                                        onUpdateGuest={handleUpdateGuest}
                                        onDeleteGuest={handleDeleteGuest}
                                        onClearAll={handleClearAll}
                                        onMarkSent={handleMarkSent}
                                        onResendQr={handleResendQr}
                                        onSendReminder={handleSendReminder}
                                        onRemindAllPending={handleRemindAllPending}
                                        onSendCorrections={handleSendCorrections}
                                        onSendCountCorrection={handleSendCountCorrection}
                                        onMergeGuests={handleMergeGuests}
                                    />
                                </>
                            )}
                        </>
                    )}
                </main>
            </div>

            {/* Modals */}
            <ExcelUploadModal
                isOpen={isExcelModalOpen}
                onClose={() => setIsExcelModalOpen(false)}
                event={activeEvent}
                currentGuestsCount={guests.length}
                onImportSuccess={(msg) => { showToast(msg); activeEvent && loadGuests(activeEvent.id); }}
                allowAutoSend={botOn}
                onOpenUpgradeBot={() => { setIsExcelModalOpen(false); setIsChatbotUpgradeOpen(true); }}
            />

            <AddGuestModal
                isOpen={isAddModalOpen}
                onClose={() => { setIsAddModalOpen(false); setEditingGuest(null); }}
                eventId={activeEvent?.id}
                guestToEdit={editingGuest}
                onGuestAdded={(guest) => { showToast(`Invitado ${guest.name} agregado`); activeEvent && loadGuests(activeEvent.id); }}
                onGuestUpdated={(guest) => { showToast(`Invitado ${guest.name} actualizado`); activeEvent && loadGuests(activeEvent.id); }}
            />

            {user?.role === 'admin' && activeEvent && (
                <EventSettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={() => setIsSettingsModalOpen(false)}
                    event={activeEvent}
                    user={user}
                    onSave={handleSaveEvent}
                />
            )}

            <WhatsAppBulkModal
                isOpen={isWhatsAppModalOpen}
                onClose={() => setIsWhatsAppModalOpen(false)}
                event={activeEvent}
                guests={guests}
                onMarkSent={handleMarkSent}
                bulkProgress={bulkProgress}
                onBulkChanged={() => setBulkTick((t) => t + 1)}
            />

            {user?.role === 'admin' && (
                <CreateEventModal
                    isOpen={isCreateEventModalOpen}
                    eventToEdit={editingEvent}
                    onClose={() => { setIsCreateEventModalOpen(false); setEditingEvent(null); }}
                    onEventCreated={(newEvent) => {
                        showToast(editingEvent ? `Evento "${newEvent.title}" actualizado` : `Evento "${newEvent.title}" creado`);
                        loadEvents(newEvent.id);
                    }}
                />
            )}

            <SendReviewModal
                open={Boolean(sendReview)}
                title={sendReview?.title}
                description={sendReview?.description}
                items={sendReview?.items || []}
                confirmLabel={sendReview?.confirmLabel || 'Enviar'}
                onConfirm={(ids) => sendReview?.onConfirm(ids)}
                onClose={() => setSendReview(null)}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                variant={confirmModal.variant}
            />

            <PlanUpgradeChatbotModal
                isOpen={isChatbotUpgradeOpen}
                onClose={() => setIsChatbotUpgradeOpen(false)}
                event={activeEvent}
                currentGuestsCount={guests.length}
                user={user}
                onRequestSent={() => {
                    showToast('¡Solicitud de plan enviada con éxito!');
                    if (activeEvent) loadEvents(activeEvent.id);
                }}
            />
        </div>
    );
}

// Main App Router with Authentication State
function App() {
    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);

    const path = window.location.pathname;
    const rsvpMatch = path.match(/^\/confirmar\/(.+)$/);
    const projectionMatch = path.match(/^\/evento\/([A-Za-z0-9]+)\/proyeccion\/?$/);
    const publicDedicationMatch = path.match(/^\/evento\/([A-Za-z0-9]+)\/dedicatoria\/?$/);
    const publicInvitationMatch = path.match(/^\/evento\/([A-Za-z0-9]+)\/invitacion\/?$/);
    const liveBroadcastMatch = path.match(/^\/evento\/([A-Za-z0-9]+)\/en-vivo\/?$/);
    const demoInvitationMatch = path === '/demo/invitacion' || path === '/demo/invitacion/';

    const isPublicRoute = rsvpMatch || projectionMatch || publicDedicationMatch || publicInvitationMatch || liveBroadcastMatch || demoInvitationMatch;

    useEffect(() => {
        if (!isPublicRoute) {
            checkAuth();
        } else {
            setAuthChecked(true);
        }
    }, []);

    const checkAuth = async () => {
        try {
            const { ok, json } = await apiFetch('/api/auth/user');
            if (ok && json?.authenticated) {
                setUser(json.user);
            } else {
                setUser(null);
            }
        } catch (err) {
            console.error(err);
            setUser(null);
        } finally {
            setAuthChecked(true);
        }
    };

    const handleLogout = async () => {
        try {
            await apiFetch('/api/auth/logout', { method: 'POST' });
            setUser(null);
        } catch (err) {
            console.error(err);
        }
    };

    // Public routes that bypass login:
    if (rsvpMatch && rsvpMatch[1]) {
        return <GuestRsvp token={rsvpMatch[1]} />;
    }

    if (demoInvitationMatch) {
        return <GuestRsvp demo={buildDemoInvitation(new URLSearchParams(window.location.search))} />;
    }

    if (publicInvitationMatch && publicInvitationMatch[1]) {
        return <GuestRsvp eventId={publicInvitationMatch[1]} isPublic={true} />;
    }

    if (projectionMatch && projectionMatch[1]) {
        return <LiveProjectionScreen eventId={projectionMatch[1]} />;
    }

    if (publicDedicationMatch && publicDedicationMatch[1]) {
        return <PublicDedicationPage eventId={publicDedicationMatch[1]} />;
    }

    if (liveBroadcastMatch && liveBroadcastMatch[1]) {
        return <LiveBroadcastCamera eventId={liveBroadcastMatch[1]} />;
    }

    if (!authChecked) {
        return (
            <div className="min-h-screen bg-rose-50/40 dark:bg-zinc-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <Heart className="w-10 h-10 text-rose-500 animate-pulse" />
                    <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">Verificando sesión...</span>
                </div>
            </div>
        );
    }

    // Render Login screen if not logged in
    if (!user) {
        return <Login onLoginSuccess={(u) => setUser(u)} />;
    }

    // Render Dashboard if logged in
    return <Dashboard user={user} onLogout={handleLogout} />;
}

// Mount React App
const rootElement = document.getElementById('app');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}
