import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, UserPlus, Heart, Mail, Lock, Shield, Calendar, Trash2, Plus, 
    Sparkles, CheckCircle2, User, Award, ExternalLink, Search, Edit3, 
    ShieldAlert, KeyRound, Filter, Check, X, Phone, MessageSquare, 
    AlertTriangle, ArrowRight, Zap, RefreshCw, Sliders, ChevronDown, 
    ChevronUp, Clock, CheckCircle, XCircle, ArrowUpRight, ShieldCheck, 
    FileText
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { apiFetch } from '../api';

export default function PlannersManagement({ onOpenCreateEvent, onRequestsCountChange }) {
    // Data State
    const [users, setUsers] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Active View Tab inside Module: 'planners_events' | 'requests_inbox' | 'directory'
    const [activeView, setActiveView] = useState('planners_events');

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'with_events'
    const [requestFilter, setRequestFilter] = useState('pending'); // 'all', 'pending', 'approved', 'rejected'

    // Modals
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    // Approval / Rejection Modal State
    const [approvalModal, setApprovalModal] = useState({
        isOpen: false,
        type: 'approve', // 'approve' | 'reject'
        request: null,
        adminNotes: '',
        loading: false
    });

    // Manual Plan Change Modal State
    const [manualPlanModal, setManualPlanModal] = useState({
        isOpen: false,
        event: null,
        planType: 'initial',
        maxGuests: 100,
        loading: false
    });

    // Form fields for create/edit user
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('planner');
    const [submittingUser, setSubmittingUser] = useState(false);
    const [userFormError, setUserFormError] = useState(null);

    // Toast
    const [toastMessage, setToastMessage] = useState(null);

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 4000);
    };

    // Load Data
    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchUsers(), fetchPlanRequests()]);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([fetchUsers(), fetchPlanRequests()]);
            showToast('Datos actualizados');
        } finally {
            setRefreshing(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const { ok, json } = await apiFetch('/api/planners/full');
            if (ok && json) {
                setUsers(json.users || json.planners || []);
                if (typeof json.pending_requests_count === 'number' && onRequestsCountChange) {
                    onRequestsCountChange(json.pending_requests_count);
                }
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

    const fetchPlanRequests = async () => {
        try {
            const { ok, json } = await apiFetch('/api/plan-requests');
            if (ok && json) {
                setRequests(json.requests || []);
                if (typeof json.pending_count === 'number' && onRequestsCountChange) {
                    onRequestsCountChange(json.pending_count);
                }
            }
        } catch (err) {
            console.error('Error fetching requests:', err);
        }
    };

    // Calculate Summary Metrics
    const plannersList = useMemo(() => users.filter(u => u.role === 'planner'), [users]);
    const pendingRequests = useMemo(() => requests.filter(r => r.status === 'pending'), [requests]);
    const totalEventsCount = useMemo(() => {
        return users.reduce((acc, u) => acc + (u.events?.length || 0), 0);
    }, [users]);

    const totalSystemCapacity = useMemo(() => {
        return users.reduce((acc, u) => {
            const userCapacity = (u.events || []).reduce((sum, ev) => sum + (parseInt(ev.max_guests, 10) || 100), 0);
            return acc + userCapacity;
        }, 0);
    }, [users]);

    // Helpers
    const getPlanBadge = (planType) => {
        switch (planType) {
            case 'medium':
                return {
                    label: 'Plan Medio (150)',
                    class: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                };
            case 'premium':
                return {
                    label: 'Plan Premium (+150)',
                    class: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                };
            case 'custom':
                return {
                    label: 'Personalizado',
                    class: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                };
            case 'initial':
            default:
                return {
                    label: 'Plan Inicial (100)',
                    class: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                };
        }
    };

    const getCleanPhone = (phoneStr) => {
        if (!phoneStr) return '';
        let digits = phoneStr.replace(/[^\d]/g, '');
        if (digits.startsWith('09') && digits.length === 10) digits = '595' + digits.substring(1);
        else if (digits.startsWith('9') && digits.length === 9) digits = '595' + digits;
        return digits;
    };

    // Open User Modal
    const openCreateUserModal = () => {
        setEditingUser(null);
        setName('');
        setEmail('');
        setPhone('');
        setUsername('');
        setPassword('');
        setRole('planner');
        setUserFormError(null);
        setIsUserModalOpen(true);
    };

    const openEditUserModal = (targetUser) => {
        setEditingUser(targetUser);
        setName(targetUser.name || '');
        setEmail(targetUser.email || '');
        setPhone(targetUser.phone || '');
        setUsername(targetUser.username || '');
        setPassword('');
        setRole(targetUser.role || 'planner');
        setUserFormError(null);
        setIsUserModalOpen(true);
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        setSubmittingUser(true);
        setUserFormError(null);

        const isEditing = !!editingUser;
        const url = isEditing ? `/api/planners/${editingUser.id}` : '/api/planners';
        const method = isEditing ? 'PUT' : 'POST';

        const payload = {
            name,
            email,
            phone: phone.trim() ? phone.trim() : null,
            username: username.trim() ? username.trim() : null,
            role,
        };

        if (password.trim() || !isEditing) {
            payload.password = password;
        }

        try {
            const { ok, json } = await apiFetch(url, {
                method,
                body: JSON.stringify(payload)
            });

            if (ok) {
                if (json?.whatsapp_sent) {
                    showToast(`¡Wedding Planner '${name}' registrada! Se enviaron sus credenciales de acceso por WhatsApp.`);
                } else {
                    showToast(isEditing ? `Usuario '${name}' actualizado.` : `¡Wedding Planner '${name}' registrada con éxito!`);
                }
                setIsUserModalOpen(false);
                fetchUsers();
            } else {
                setUserFormError(json?.message || (json?.errors ? Object.values(json.errors).flat().join(', ') : 'Error al guardar usuario'));
            }
        } catch (err) {
            console.error(err);
            setUserFormError('Error de conexión con el servidor.');
        } finally {
            setSubmittingUser(false);
        }
    };

    const handleDeleteUser = (userItem) => {
        setConfirmModal({
            isOpen: true,
            title: `Eliminar a ${userItem.name}`,
            message: `¿Estás seguro de eliminar a ${userItem.name} (${userItem.role === 'admin' ? 'Administrador' : 'Wedding Planner'})? Si tiene eventos asignados, volverán al control del administrador general.`,
            confirmText: 'Sí, eliminar',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    const { ok, json } = await apiFetch(`/api/planners/${userItem.id}`, { method: 'DELETE' });
                    if (ok) {
                        showToast(`Usuario ${userItem.name} eliminado.`);
                        fetchUsers();
                    } else {
                        alert(json?.message || 'No se pudo eliminar el usuario.');
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        });
    };

    // Open Approval/Rejection Dialog
    const openApprovalModal = (request, type = 'approve') => {
        setApprovalModal({
            isOpen: true,
            type,
            request,
            adminNotes: type === 'approve' 
                ? 'Aprobado por el Administrador General' 
                : 'Cupo no disponible por el momento',
            loading: false
        });
    };

    const submitApprovalAction = async () => {
        const { request, type, adminNotes } = approvalModal;
        if (!request) return;

        setApprovalModal(prev => ({ ...prev, loading: true }));
        const endpoint = type === 'approve' 
            ? `/api/plan-requests/${request.id}/approve` 
            : `/api/plan-requests/${request.id}/reject`;

        try {
            const { ok, json } = await apiFetch(endpoint, {
                method: 'POST',
                body: JSON.stringify({ admin_notes: adminNotes })
            });

            if (ok) {
                showToast(type === 'approve' 
                    ? `🎉 ¡Plan aprobado para ${request.event?.couple_names || request.event?.title}! Se actualizó la capacidad a ${request.requested_guests} invitados.`
                    : `Solicitud rechazada.`
                );
                setApprovalModal(prev => ({ ...prev, isOpen: false }));
                await fetchAllData();
            } else {
                alert(json?.message || 'Ocurrió un error al procesar la solicitud.');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión al procesar la solicitud.');
        } finally {
            setApprovalModal(prev => ({ ...prev, loading: false }));
        }
    };

    // Manual Plan Change
    const openManualPlanModal = (event) => {
        setManualPlanModal({
            isOpen: true,
            event,
            planType: event.plan_type || 'initial',
            maxGuests: event.max_guests || 100,
            loading: false
        });
    };

    const handleSaveManualPlan = async () => {
        const { event, planType, maxGuests } = manualPlanModal;
        if (!event) return;

        setManualPlanModal(prev => ({ ...prev, loading: true }));
        try {
            const { ok, json } = await apiFetch(`/api/event/${event.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    plan_type: planType,
                    max_guests: parseInt(maxGuests, 10)
                })
            });

            if (ok) {
                showToast(`Plan del evento '${event.couple_names || event.title}' actualizado a ${maxGuests} invitados.`);
                setManualPlanModal(prev => ({ ...prev, isOpen: false }));
                fetchUsers();
            } else {
                alert(json?.message || 'Error al actualizar el plan.');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión con el servidor.');
        } finally {
            setManualPlanModal(prev => ({ ...prev, loading: false }));
        }
    };

    // Filter Planners with Events & Requests
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q || (
                u.name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                (u.phone && u.phone.includes(q)) ||
                (u.username && u.username.toLowerCase().includes(q)) ||
                (u.events && u.events.some(ev => 
                    (ev.couple_names && ev.couple_names.toLowerCase().includes(q)) ||
                    (ev.title && ev.title.toLowerCase().includes(q))
                ))
            );

            if (!matchesSearch) return false;

            const hasPendingRequest = (u.events || []).some(ev => 
                (ev.plan_requests || []).some(r => r.status === 'pending')
            );

            if (statusFilter === 'pending' && !hasPendingRequest) return false;
            if (statusFilter === 'with_events' && (!u.events || u.events.length === 0)) return false;

            return true;
        });
    }, [users, searchQuery, statusFilter]);

    // Filter Requests Inbox
    const filteredRequests = useMemo(() => {
        return requests.filter(r => {
            if (requestFilter === 'pending' && r.status !== 'pending') return false;
            if (requestFilter === 'approved' && r.status !== 'approved') return false;
            if (requestFilter === 'rejected' && r.status !== 'rejected') return false;
            return true;
        });
    }, [requests, requestFilter]);

    return (
        <div className="space-y-6 animate-fade-in font-sans">
            {/* Top Toast */}
            {toastMessage && (
                <div className="fixed top-6 right-6 z-50 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-5 py-3 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-2 animate-bounce border border-amber-500/30">
                    <Sparkles className="w-4 h-4 text-amber-400 dark:text-amber-500" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Header Banner */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-black uppercase tracking-wider mb-2 border border-amber-500/20">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Módulo de Control y Aprobaciones</span>
                        </div>
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-2 tracking-tight">
                            <Users className="w-7 h-7 text-amber-500" />
                            <span>Wedding Planners, Planes & Aprobaciones</span>
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
                            Supervisá cada organizadora registrada, los planes asignados a sus eventos y respondé en 1-click a las solicitudes de aumento de capacidad de invitados.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="p-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-xs font-bold flex items-center gap-1.5"
                            title="Actualizar datos"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-500' : ''}`} />
                            <span className="hidden sm:inline">Actualizar</span>
                        </button>

                        <button
                            onClick={openCreateUserModal}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-extrabold shadow-md shadow-rose-500/20 active:scale-95 transition-all"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span>+ Nueva Wedding Planner</span>
                        </button>
                    </div>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/40">
                        <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" /> Wedding Planners
                        </div>
                        <div className="text-xl font-black text-rose-700 dark:text-rose-300 mt-0.5">
                            {plannersList.length} <span className="text-xs font-semibold text-rose-500">activas</span>
                        </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40">
                        <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> Eventos Asignados
                        </div>
                        <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                            {totalEventsCount} <span className="text-xs font-semibold text-indigo-500">eventos</span>
                        </div>
                    </div>

                    {/* Pending Requests Highlight KPI */}
                    <div 
                        onClick={() => { setActiveView('requests_inbox'); setRequestFilter('pending'); }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                            pendingRequests.length > 0 
                                ? 'bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/20 shadow-sm' 
                                : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/60'
                        }`}
                    >
                        <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Solicitudes Pendientes
                            </span>
                            {pendingRequests.length > 0 && (
                                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                            )}
                        </div>
                        <div className="text-xl font-black text-amber-700 dark:text-amber-300 mt-0.5 flex items-center justify-between">
                            <span>{pendingRequests.length} para aprobar</span>
                            {pendingRequests.length > 0 && (
                                <span className="text-[10px] font-extrabold underline text-amber-700 dark:text-amber-300">
                                    Ver bandeja →
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
                        <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5" /> Capacidad Total
                        </div>
                        <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                            {totalSystemCapacity.toLocaleString()} <span className="text-xs font-semibold text-emerald-500">invitados</span>
                        </div>
                    </div>
                </div>

                {/* Module View Navigation Tabs */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                        onClick={() => setActiveView('planners_events')}
                        className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                            activeView === 'planners_events'
                                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                    >
                        <Heart className="w-3.5 h-3.5 text-rose-500" />
                        <span>💍 Planners y Eventos por Plan</span>
                    </button>

                    <button
                        onClick={() => setActiveView('requests_inbox')}
                        className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                            activeView === 'requests_inbox'
                                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                    >
                        <Zap className="w-3.5 h-3.5" />
                        <span>⚡ Bandeja de Aprobaciones</span>
                        {pendingRequests.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                                {pendingRequests.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveView('directory')}
                        className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                            activeView === 'directory'
                                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                    >
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span>👥 Directorio de Cuentas</span>
                    </button>
                </div>
            </div>

            {/* VIEW 1: PLANNERS AND EVENTS PER PLAN */}
            {activeView === 'planners_events' && (
                <div className="space-y-4">
                    {/* Search & Status Filters */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="relative w-full sm:w-96">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar planner, teléfono, email o evento..."
                                className="w-full text-xs rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white pl-9 pr-3 py-2.5 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>

                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 w-full sm:w-auto justify-end">
                            <Filter className="w-3.5 h-3.5" />
                            <span>Filtrar:</span>
                            <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                <button
                                    onClick={() => setStatusFilter('all')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${statusFilter === 'all' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                                >
                                    Todos ({users.length})
                                </button>
                                <button
                                    onClick={() => setStatusFilter('pending')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-600 dark:text-amber-400 hover:text-amber-800'}`}
                                >
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Con Solicitud ({pendingRequests.length})</span>
                                </button>
                                <button
                                    onClick={() => setStatusFilter('with_events')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${statusFilter === 'with_events' ? 'bg-rose-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                                >
                                    Con Eventos
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Planners Cards Grid */}
                    {loading ? (
                        <div className="p-16 text-center text-zinc-400 text-xs font-bold flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                            <span>Cargando Wedding Planners y planes de eventos...</span>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="p-16 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 text-xs font-semibold space-y-2">
                            <Users className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto" />
                            <p>No se encontraron Wedding Planners con los filtros seleccionados.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredUsers.map(userItem => {
                                const isAdminRole = userItem.role === 'admin';
                                const eventsList = userItem.events || [];
                                const cleanPhone = getCleanPhone(userItem.phone);
                                
                                // Check if this planner has any pending plan request in their events
                                const pendingEvents = eventsList.filter(ev => 
                                    (ev.plan_requests || []).some(r => r.status === 'pending')
                                );
                                const hasPendingRequest = pendingEvents.length > 0;

                                return (
                                    <div
                                        key={userItem.id}
                                        className={`bg-white dark:bg-zinc-900 border rounded-3xl p-6 shadow-sm space-y-5 transition-all ${
                                            hasPendingRequest 
                                                ? 'border-amber-400/80 dark:border-amber-500/50 ring-2 ring-amber-400/20 shadow-amber-500/5' 
                                                : isAdminRole 
                                                    ? 'border-indigo-200 dark:border-indigo-900/40' 
                                                    : 'border-zinc-200 dark:border-zinc-800'
                                        }`}
                                    >
                                        {/* Planner Card Header */}
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                                            <div className="flex items-center gap-3.5">
                                                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-black shadow-sm shrink-0 ${
                                                    isAdminRole 
                                                        ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800' 
                                                        : hasPendingRequest
                                                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse'
                                                            : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                                }`}>
                                                    {userItem.name.charAt(0).toUpperCase()}
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-black text-base text-zinc-900 dark:text-white">
                                                            {userItem.name}
                                                        </h3>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                            isAdminRole 
                                                                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30' 
                                                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30'
                                                        }`}>
                                                            {isAdminRole ? '👑 Admin' : '💍 Wedding Planner'}
                                                        </span>

                                                        {hasPendingRequest && (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-sm flex items-center gap-1 animate-pulse">
                                                                <AlertTriangle className="w-3 h-3" />
                                                                <span>{pendingEvents.length} Solicitud de Plan Pendiente</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
                                                        <span className="flex items-center gap-1">
                                                            <Mail className="w-3.5 h-3.5 text-zinc-400" />
                                                            {userItem.email}
                                                        </span>

                                                        {userItem.phone ? (
                                                            <a 
                                                                href={`https://wa.me/${cleanPhone}`} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                                                                title="Abrir chat de WhatsApp"
                                                            >
                                                                <Phone className="w-3.5 h-3.5 text-emerald-500" />
                                                                <span>+{userItem.phone}</span>
                                                                <ArrowUpRight className="w-3 h-3" />
                                                            </a>
                                                        ) : (
                                                            <span className="text-zinc-400 italic text-[11px]">(Sin WhatsApp registrado)</span>
                                                        )}

                                                        {userItem.username && (
                                                            <span className="text-zinc-400 text-[11px]">@{userItem.username}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Planner Action Buttons */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                {onOpenCreateEvent && (
                                                    <button
                                                        onClick={() => onOpenCreateEvent(userItem.id)}
                                                        className="px-3.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition-all flex items-center gap-1.5"
                                                    >
                                                        <Plus className="w-3.5 h-3.5 text-rose-500" />
                                                        <span>Asignar Evento</span>
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => openEditUserModal(userItem)}
                                                    className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xs font-bold transition-all"
                                                    title="Editar usuario"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>

                                                <button
                                                    onClick={() => handleDeleteUser(userItem)}
                                                    className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-rose-600 text-xs font-bold transition-all"
                                                    title="Eliminar usuario"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Events & Plans Section for this Planner */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-rose-500" />
                                                    <span>Eventos Asignados & Planes de Capacidad:</span>
                                                </span>
                                                <span className="font-extrabold text-zinc-500">
                                                    {eventsList.length} {eventsList.length === 1 ? 'evento registrado' : 'eventos registrados'}
                                                </span>
                                            </div>

                                            {eventsList.length === 0 ? (
                                                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 text-center text-xs text-zinc-400 italic">
                                                    Esta organizadora todavía no tiene eventos asignados.
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-3">
                                                    {eventsList.map(ev => {
                                                        const planBadge = getPlanBadge(ev.plan_type);
                                                        const maxGuests = parseInt(ev.max_guests, 10) || 100;
                                                        const guestsCount = ev.guests_count || 0;
                                                        const pct = Math.min(100, Math.round((guestsCount / maxGuests) * 100));

                                                        // Check pending request on this event
                                                        const pendingReq = (ev.plan_requests || []).find(r => r.status === 'pending');

                                                        return (
                                                            <div
                                                                key={ev.id}
                                                                className={`p-4 rounded-2xl border transition-all ${
                                                                    pendingReq 
                                                                        ? 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-400 dark:border-amber-600/70 shadow-sm' 
                                                                        : 'bg-zinc-50/70 dark:bg-zinc-800/40 border-zinc-200/80 dark:border-zinc-700/60'
                                                                }`}
                                                            >
                                                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                                    {/* Event Info */}
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <h4 className="font-black text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                                                                                <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />
                                                                                <span>{ev.couple_names || ev.title}</span>
                                                                            </h4>
                                                                            
                                                                            {/* Current Plan Badge */}
                                                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${planBadge.class}`}>
                                                                                {planBadge.label}
                                                                            </span>

                                                                            {ev.event_date && (
                                                                                <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                                                                                    <Calendar className="w-3 h-3 text-zinc-400" />
                                                                                    {ev.event_date}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {/* Quota Progress Bar */}
                                                                        <div className="pt-1.5 space-y-1">
                                                                            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500">
                                                                                <span>Capacidad del Plan:</span>
                                                                                <span className={pct >= 100 ? 'text-rose-600 font-extrabold' : 'text-zinc-700 dark:text-zinc-300'}>
                                                                                    <strong>{guestsCount}</strong> de <strong>{maxGuests}</strong> invitados ({pct}%)
                                                                                </span>
                                                                            </div>
                                                                            <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                                                                                <div 
                                                                                    className={`h-full transition-all duration-500 rounded-full ${
                                                                                        pct >= 100 
                                                                                            ? 'bg-rose-500' 
                                                                                            : pct >= 80 
                                                                                                ? 'bg-amber-500' 
                                                                                                : 'bg-emerald-500'
                                                                                    }`}
                                                                                    style={{ width: `${pct}%` }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Quick Action to Manually Adjust Plan */}
                                                                    <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                                                                        <button
                                                                            onClick={() => openManualPlanModal(ev)}
                                                                            className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-bold transition-all flex items-center gap-1.5"
                                                                            title="Ajustar plan o cupo manualmente sin solicitud"
                                                                        >
                                                                            <Sliders className="w-3.5 h-3.5 text-amber-500" />
                                                                            <span>Ajustar Plan</span>
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* Pending Upgrade Alert & Direct Approval Card */}
                                                                {pendingReq && (
                                                                    <div className="mt-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                                                                        <div className="space-y-1">
                                                                            <div className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                                                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                                                                <span>
                                                                                    Solicitud de Aumento: Paso a <strong>{getPlanBadge(pendingReq.requested_plan).label}</strong> ({pendingReq.requested_guests} cupos)
                                                                                </span>
                                                                            </div>

                                                                            {pendingReq.notes && (
                                                                                <div className="text-xs text-amber-900/80 dark:text-amber-200/80 italic pl-5">
                                                                                    💬 "{pendingReq.notes}"
                                                                                </div>
                                                                            )}

                                                                            <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold pl-5">
                                                                                Solicitado el {new Date(pendingReq.created_at).toLocaleDateString()} a las {new Date(pendingReq.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                                                                            <button
                                                                                onClick={() => openApprovalModal(pendingReq, 'reject')}
                                                                                className="px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-all"
                                                                            >
                                                                                Rechazar
                                                                            </button>

                                                                            <button
                                                                                onClick={() => openApprovalModal(pendingReq, 'approve')}
                                                                                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 active:scale-95"
                                                                            >
                                                                                <Check className="w-3.5 h-3.5" />
                                                                                <span>Aprobar Plan</span>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* VIEW 2: DEDICATED REQUESTS INBOX */}
            {activeView === 'requests_inbox' && (
                <div className="space-y-4">
                    {/* Filter Tabs */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-xs font-black text-zinc-900 dark:text-white flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" />
                            <span>Bandeja de Solicitudes de Ampliación de Plan</span>
                        </div>

                        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold">
                            <button
                                onClick={() => setRequestFilter('pending')}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                    requestFilter === 'pending'
                                        ? 'bg-amber-500 text-white shadow-sm'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                <Clock className="w-3.5 h-3.5" />
                                <span>Pendientes ({pendingRequests.length})</span>
                            </button>

                            <button
                                onClick={() => setRequestFilter('approved')}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                    requestFilter === 'approved'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Aprobadas ({requests.filter(r => r.status === 'approved').length})</span>
                            </button>

                            <button
                                onClick={() => setRequestFilter('rejected')}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                    requestFilter === 'rejected'
                                        ? 'bg-rose-600 text-white shadow-sm'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Rechazadas ({requests.filter(r => r.status === 'rejected').length})</span>
                            </button>

                            <button
                                onClick={() => setRequestFilter('all')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${
                                    requestFilter === 'all'
                                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                Todas ({requests.length})
                            </button>
                        </div>
                    </div>

                    {/* Request Cards List */}
                    {filteredRequests.length === 0 ? (
                        <div className="p-16 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 text-xs font-semibold space-y-2">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                            <p className="font-bold text-sm text-zinc-900 dark:text-white">¡No hay solicitudes en esta bandeja!</p>
                            <p className="text-zinc-400">Las solicitudes generadas por las Wedding Planners aparecerán aquí para tu aprobación.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredRequests.map(req => {
                                const isPending = req.status === 'pending';
                                const isApproved = req.status === 'approved';
                                const isRejected = req.status === 'rejected';

                                const currentPlanBadge = getPlanBadge(req.current_plan);
                                const requestedPlanBadge = getPlanBadge(req.requested_plan);
                                const plannerPhone = getCleanPhone(req.planner?.phone);

                                return (
                                    <div
                                        key={req.id}
                                        className={`bg-white dark:bg-zinc-900 border rounded-3xl p-5 shadow-sm space-y-4 transition-all ${
                                            isPending 
                                                ? 'border-amber-400 dark:border-amber-500/60 ring-2 ring-amber-400/20' 
                                                : isApproved 
                                                    ? 'border-emerald-300 dark:border-emerald-800/60' 
                                                    : 'border-zinc-200 dark:border-zinc-800'
                                        }`}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-black ${
                                                    isPending 
                                                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' 
                                                        : isApproved 
                                                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' 
                                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                                                }`}>
                                                    {isPending ? '⏳' : isApproved ? '✓' : '✕'}
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">
                                                            {req.event?.couple_names || req.event?.title || 'Evento'}
                                                        </h4>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                            isPending 
                                                                ? 'bg-amber-500 text-white' 
                                                                : isApproved 
                                                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                                                                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                                        }`}>
                                                            {isPending ? 'Pendiente' : isApproved ? 'Aprobado' : 'Rechazado'}
                                                        </span>
                                                    </div>

                                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-2">
                                                        <span>Planner: <strong>{req.planner?.name || 'Wedding Planner'}</strong></span>
                                                        {plannerPhone && (
                                                            <a 
                                                                href={`https://wa.me/${plannerPhone}`} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold flex items-center gap-0.5"
                                                            >
                                                                <MessageSquare className="w-3 h-3" />
                                                                <span>WhatsApp</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-[11px] text-zinc-400 font-medium">
                                                {new Date(req.created_at).toLocaleDateString()} — {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>

                                        {/* Plan Transformation Card */}
                                        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700/60 flex flex-col md:flex-row items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 w-full md:w-auto">
                                                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-center min-w-[130px]">
                                                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Plan Actual</div>
                                                    <div className="text-xs font-black text-zinc-700 dark:text-zinc-300 mt-0.5">
                                                        {currentPlanBadge.label}
                                                    </div>
                                                </div>

                                                <ArrowRight className="w-5 h-5 text-amber-500 shrink-0" />

                                                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center min-w-[150px]">
                                                    <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">Plan Solicitado</div>
                                                    <div className="text-xs font-black text-amber-800 dark:text-amber-300 mt-0.5">
                                                        {requestedPlanBadge.label} ({req.requested_guests} máx)
                                                    </div>
                                                </div>
                                            </div>

                                            {req.notes && (
                                                <div className="text-xs text-zinc-600 dark:text-zinc-300 italic bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 w-full md:max-w-md">
                                                    💬 "{req.notes}"
                                                </div>
                                            )}
                                        </div>

                                        {/* Review Info or Action Buttons */}
                                        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                                            {isPending ? (
                                                <div className="flex items-center justify-between w-full">
                                                    <span className="text-[11px] text-amber-700 dark:text-amber-400 font-bold">
                                                        👉 Al aprobar, la capacidad se amplía al instante y se le notifica a la planner por WhatsApp.
                                                    </span>

                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => openApprovalModal(req, 'reject')}
                                                            className="px-3.5 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold transition-all"
                                                        >
                                                            Rechazar
                                                        </button>

                                                        <button
                                                            onClick={() => openApprovalModal(req, 'approve')}
                                                            className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-1.5"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                            <span>Aprobar Solicitud</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                                                    <span>Revisado por <strong>{req.reviewer?.name || 'Administrador'}</strong></span>
                                                    {req.admin_notes && (
                                                        <span>• Nota: <em>"{req.admin_notes}"</em></span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* VIEW 3: USERS & PLANNERS DIRECTORY */}
            {activeView === 'directory' && (
                <div className="space-y-4">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                                <Users className="w-4 h-4 text-indigo-500" />
                                <span>Cuentas de Usuarios del Sistema</span>
                            </h3>
                            <p className="text-xs text-zinc-500 mt-0.5">
                                Administrá credenciales, contraseñas y teléfonos de contacto para WhatsApp.
                            </p>
                        </div>

                        <button
                            onClick={openCreateUserModal}
                            className="px-4 py-2 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1.5"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span>Crear Usuario</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {users.map(u => (
                            <div key={u.id} className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">{u.name}</h4>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                        u.role === 'admin' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                    }`}>
                                        {u.role === 'admin' ? '👑 Admin' : '💍 Planner'}
                                    </span>
                                </div>

                                <div className="text-xs space-y-1 text-zinc-500 dark:text-zinc-400">
                                    <div>📧 {u.email}</div>
                                    <div>📱 {u.phone ? `+${u.phone}` : '(Sin teléfono)'}</div>
                                    {u.username && <div>👤 @{u.username}</div>}
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                                    <button
                                        onClick={() => openEditUserModal(u)}
                                        className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>Editar</span>
                                    </button>

                                    <button
                                        onClick={() => handleDeleteUser(u)}
                                        className="text-rose-600 font-bold hover:underline flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Eliminar</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MODAL: APPROVE / REJECT REQUEST */}
            {approvalModal.isOpen && approvalModal.request && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
                        <div className={`p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between ${
                            approvalModal.type === 'approve' ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                        }`}>
                            <h3 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                                {approvalModal.type === 'approve' ? (
                                    <>
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                        <span>Aprobar Ampliación de Plan</span>
                                    </>
                                ) : (
                                    <>
                                        <XCircle className="w-5 h-5 text-rose-500" />
                                        <span>Rechazar Solicitud de Plan</span>
                                    </>
                                )}
                            </h3>
                            <button onClick={() => setApprovalModal(prev => ({ ...prev, isOpen: false }))} className="text-zinc-400 hover:text-zinc-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 text-xs space-y-2">
                                <div className="flex justify-between font-bold">
                                    <span className="text-zinc-500">Evento:</span>
                                    <span className="text-zinc-900 dark:text-white">
                                        {approvalModal.request.event?.couple_names || approvalModal.request.event?.title}
                                    </span>
                                </div>
                                <div className="flex justify-between font-bold">
                                    <span className="text-zinc-500">Wedding Planner:</span>
                                    <span className="text-zinc-900 dark:text-white">
                                        {approvalModal.request.planner?.name}
                                    </span>
                                </div>
                                <div className="flex justify-between font-bold">
                                    <span className="text-zinc-500">Plan Solicitado:</span>
                                    <span className="text-amber-600 dark:text-amber-400 font-extrabold">
                                        {getPlanBadge(approvalModal.request.requested_plan).label} ({approvalModal.request.requested_guests} invitados)
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                    {approvalModal.type === 'approve' ? 'Nota o Mensaje de Aprobación (Opcional)' : 'Motivo del Rechazo'}
                                </label>
                                <textarea
                                    rows={3}
                                    value={approvalModal.adminNotes}
                                    onChange={(e) => setApprovalModal(prev => ({ ...prev, adminNotes: e.target.value }))}
                                    placeholder={approvalModal.type === 'approve' ? 'Aprobado correctamente.' : 'Indicar el motivo a la wedding planner...'}
                                    className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-2">
                                <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                                <span>El bot enviará una notificación automática por WhatsApp a la organizadora avisándole de esta resolución.</span>
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setApprovalModal(prev => ({ ...prev, isOpen: false }))}
                                    className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300"
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="button"
                                    disabled={approvalModal.loading}
                                    onClick={submitApprovalAction}
                                    className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-md transition-all ${
                                        approvalModal.type === 'approve'
                                            ? 'bg-emerald-600 hover:bg-emerald-700'
                                            : 'bg-rose-600 hover:bg-rose-700'
                                    }`}
                                >
                                    {approvalModal.loading ? 'Procesando...' : (approvalModal.type === 'approve' ? 'Confirmar y Aprobar' : 'Confirmar Rechazo')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: MANUAL PLAN ADJUSTMENT */}
            {manualPlanModal.isOpen && manualPlanModal.event && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                            <h3 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                                <Sliders className="w-5 h-5 text-amber-500" />
                                <span>Ajustar Plan del Evento</span>
                            </h3>
                            <button onClick={() => setManualPlanModal(prev => ({ ...prev, isOpen: false }))} className="text-zinc-400 hover:text-zinc-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="text-xs font-bold text-zinc-500">
                                Evento: <span className="text-zinc-900 dark:text-white font-extrabold">{manualPlanModal.event.couple_names || manualPlanModal.event.title}</span>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                    Tipo de Plan *
                                </label>
                                <select
                                    value={manualPlanModal.planType}
                                    onChange={(e) => {
                                        const type = e.target.value;
                                        let guests = 100;
                                        if (type === 'medium') guests = 150;
                                        else if (type === 'premium') guests = 300;
                                        setManualPlanModal(prev => ({ ...prev, planType: type, maxGuests: guests }));
                                    }}
                                    className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                                >
                                    <option value="initial">🌱 Plan Inicial (100 invitados)</option>
                                    <option value="medium">⭐ Plan Medio (150 invitados)</option>
                                    <option value="premium">👑 Plan Premium (+150 invitados / 300 máx)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                    Cupo Máximo de Invitados Permitidos *
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={manualPlanModal.maxGuests}
                                    onChange={(e) => setManualPlanModal(prev => ({ ...prev, maxGuests: e.target.value }))}
                                    className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setManualPlanModal(prev => ({ ...prev, isOpen: false }))}
                                    className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    disabled={manualPlanModal.loading}
                                    onClick={handleSaveManualPlan}
                                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-bold shadow-md"
                                >
                                    {manualPlanModal.loading ? 'Guardando...' : 'Guardar Ajuste'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: CREATE / EDIT USER */}
            {isUserModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                            <h3 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                                <Users className="w-5 h-5 text-amber-500" />
                                <span>{editingUser ? 'Editar Wedding Planner' : 'Registrar Nueva Wedding Planner'}</span>
                            </h3>
                            <button onClick={() => setIsUserModalOpen(false)} className="text-zinc-400 hover:text-zinc-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                            {userFormError && (
                                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold">
                                    {userFormError}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                    Nombre Completo *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="ej: Carolina Ruiz Wedding Planner"
                                    className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                        Email de Acceso *
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="planner@eventos.com"
                                        className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                        WhatsApp / Teléfono
                                    </label>
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="0981 123 456"
                                        className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                        Nombre de Usuario
                                    </label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="carolina.planner"
                                        className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                        Rol *
                                    </label>
                                    <select
                                        value={role}
                                        onChange={(e) => setRole(e.target.value)}
                                        className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                                    >
                                        <option value="planner">💍 Wedding Planner</option>
                                        <option value="admin">👑 Administrador</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                    Contraseña {editingUser ? '(Dejá en blanco si no deseás cambiarla)' : '*'}
                                </label>
                                <input
                                    type="password"
                                    required={!editingUser}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={editingUser ? 'Nueva contraseña (opcional)' : '••••••••'}
                                    className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setIsUserModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingUser}
                                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-bold shadow-md"
                                >
                                    {submittingUser ? 'Guardando...' : (editingUser ? 'Guardar Cambios' : 'Registrar Planner')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                variant={confirmModal.variant}
            />
        </div>
    );
}
