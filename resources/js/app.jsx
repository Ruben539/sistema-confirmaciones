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
import GuestRsvp from './pages/GuestRsvp';
import Login from './pages/Login';
import { FileSpreadsheet, Heart, Sparkles, Plus, Calendar, MapPin, ShieldCheck, UserCheck } from 'lucide-react';

function Dashboard({ user, onLogout }) {
    const [events, setEvents] = useState([]);
    const [activeEvent, setActiveEvent] = useState(null);
    const [guests, setGuests] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [toastMessage, setToastMessage] = useState(null);
    const [preselectedPlannerId, setPreselectedPlannerId] = useState(null);

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
    }, []);

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
                selected = loadedEvents[0];
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

    const handleMarkSent = async (guestId) => {
        try {
            const { ok } = await apiFetch(`/api/guests/${guestId}/sent`, { method: 'POST' });
            if (ok) {
                setGuests(prev => prev.map(g => g.id === guestId ? { ...g, whatsapp_status: 'sent' } : g));
            }
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
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                onOpenUpgradeBot={() => setIsChatbotUpgradeOpen(true)}
                onLogout={onLogout}
                theme={theme}
                onToggleTheme={handleToggleTheme}
            />

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Navbar */}
                <Navbar
                    event={activeEvent}
                    user={user}
                    onOpenSettings={() => setIsSettingsModalOpen(true)}
                    onRefresh={() => activeEvent && loadGuests(activeEvent.id)}
                    onLogout={onLogout}
                    theme={theme}
                    onToggleTheme={handleToggleTheme}
                    onOpenUpgradeBot={() => setIsChatbotUpgradeOpen(true)}
                />

                {/* Main Content */}
                <main className="p-4 sm:p-8 space-y-8 flex-1">
                    {/* Toast Notification */}
                    {toastMessage && (
                        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-5 py-3 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-2 animate-bounce">
                            <Sparkles className="w-4 h-4 text-amber-400 dark:text-amber-500" />
                            <span>{toastMessage}</span>
                        </div>
                    )}

                    {/* Active View based on activeTab */}
                    {activeTab === 'planners' && user?.role === 'admin' ? (
                        <PlannersManagement
                            onOpenCreateEvent={(plannerId) => {
                                setPreselectedPlannerId(plannerId);
                                setIsCreateEventModalOpen(true);
                            }}
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
                    ) : activeTab === 'tables' ? (
                        <TableDistribution
                            eventId={activeEvent?.id}
                            eventTitle={activeEvent?.couple_names || activeEvent?.title}
                            showToast={showToast}
                        />
                    ) : activeTab === 'guests' ? (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800/80 p-6 rounded-3xl shadow-xl">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                                        Lista de Invitados — <span className="text-rose-500">{activeEvent?.couple_names || activeEvent?.title || 'Sin Evento Seleccionado'}</span>
                                    </h2>
                                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                        {guests.length} {guests.length === 1 ? 'invitado registrado' : 'invitados registrados'} para este evento.
                                    </p>
                                </div>
                            </div>

                            <GuestList
                                guests={guests}
                                onOpenAddModal={() => { setEditingGuest(null); setIsAddModalOpen(true); }}
                                onOpenExcelModal={() => setIsExcelModalOpen(true)}
                                onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
                                onEditGuest={(guest) => { setEditingGuest(guest); setIsAddModalOpen(true); }}
                                onUpdateGuest={handleUpdateGuest}
                                onDeleteGuest={handleDeleteGuest}
                                onClearAll={handleClearAll}
                                onMarkSent={handleMarkSent}
                            />
                        </div>
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
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 hover:bg-amber-200 font-bold transition-all text-xs"
                                        >
                                            <UserCheck className="w-3.5 h-3.5" />
                                            <span>Planners</span>
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

                            {/* Hero Banner for Empty State */}
                            {guests.length === 0 && activeEvent && (
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
                                            onClick={() => setIsExcelModalOpen(true)}
                                            className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-zinc-900 font-extrabold text-xs shadow-lg hover:bg-rose-50 transition-all active:scale-95"
                                        >
                                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                            <span>Subir Archivo Excel</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Metrics Cards */}
                            <StatsCards stats={stats} />

                            {/* Guest List Component */}
                            <GuestList
                                guests={guests}
                                onOpenAddModal={() => { setEditingGuest(null); setIsAddModalOpen(true); }}
                                onOpenExcelModal={() => setIsExcelModalOpen(true)}
                                onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
                                onEditGuest={(guest) => { setEditingGuest(guest); setIsAddModalOpen(true); }}
                                onUpdateGuest={handleUpdateGuest}
                                onDeleteGuest={handleDeleteGuest}
                                onClearAll={handleClearAll}
                                onMarkSent={handleMarkSent}
                            />
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

            <EventSettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                event={activeEvent}
                user={user}
                onSave={handleSaveEvent}
            />

            <WhatsAppBulkModal
                isOpen={isWhatsAppModalOpen}
                onClose={() => setIsWhatsAppModalOpen(false)}
                event={activeEvent}
                guests={guests}
                onMarkSent={handleMarkSent}
            />

            <CreateEventModal
                isOpen={isCreateEventModalOpen}
                eventToEdit={editingEvent}
                onClose={() => { setIsCreateEventModalOpen(false); setEditingEvent(null); }}
                onEventCreated={(newEvent) => {
                    showToast(editingEvent ? `Evento "${newEvent.title}" actualizado` : `Evento "${newEvent.title}" creado`);
                    loadEvents(newEvent.id);
                }}
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

    useEffect(() => {
        if (!rsvpMatch) {
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

    // Public RSVP page for guests
    if (rsvpMatch && rsvpMatch[1]) {
        return <GuestRsvp token={rsvpMatch[1]} />;
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
