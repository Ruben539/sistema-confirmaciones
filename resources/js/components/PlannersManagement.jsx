import React, { useState, useEffect, useMemo } from 'react';
import { UserPlus, Users, Heart, Mail, Lock, Shield, Calendar, Trash2, Plus, Sparkles, CheckCircle2, User, Award, ExternalLink, Search, Edit3, ShieldAlert, KeyRound, Filter, Check, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

export default function PlannersManagement({ onOpenCreateEvent }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    // Search and Role Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'admin', 'planner'

    // Form fields for create/edit user
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('planner');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/planners/full');
            const data = await res.json();
            setUsers(data.users || data.planners || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingUser(null);
        setName('');
        setEmail('');
        setUsername('');
        setPassword('');
        setRole('planner');
        setError(null);
        setIsModalOpen(true);
    };

    const openEditModal = (targetUser) => {
        setEditingUser(targetUser);
        setName(targetUser.name || '');
        setEmail(targetUser.email || '');
        setUsername(targetUser.username || '');
        setPassword(''); // Blank unless changing
        setRole(targetUser.role || 'planner');
        setError(null);
        setIsModalOpen(true);
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setSuccessMsg(null);

        const isEditing = !!editingUser;
        const url = isEditing ? `/api/planners/${editingUser.id}` : '/api/planners';
        const method = isEditing ? 'PUT' : 'POST';

        const payload = {
            name,
            email,
            username: username.trim() ? username : null,
            role,
        };

        if (password.trim() || !isEditing) {
            payload.password = password;
        }

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();

            if (res.ok) {
                const roleLabel = role === 'admin' ? 'Administrador' : 'Wedding Planner';
                setSuccessMsg(isEditing ? `Usuario '${name}' actualizado.` : `¡Nuevo usuario '${name}' (${roleLabel}) registrado!`);
                setIsModalOpen(false);
                fetchUsers();
                setTimeout(() => setSuccessMsg(null), 4000);
            } else {
                setError(json.message || (json.errors ? Object.values(json.errors).flat().join(', ') : 'Error al guardar'));
            }
        } catch (err) {
            console.error(err);
            setError('Error de conexión con el servidor.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteUser = (userItem) => {
        setConfirmModal({
            isOpen: true,
            title: `Eliminar ${userItem.name}`,
            message: `¿Estás seguro de eliminar el usuario '${userItem.name}' (${userItem.role === 'admin' ? 'Administrador' : 'Wedding Planner'})? Si tiene bodas asignadas, volverán a ser gestionadas por ti.`,
            confirmText: 'Sí, eliminar',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    const res = await fetch(`/api/planners/${userItem.id}`, { method: 'DELETE' });
                    const json = await res.json();
                    if (res.ok) {
                        setSuccessMsg(`Usuario ${userItem.name} eliminado.`);
                        fetchUsers();
                        setTimeout(() => setSuccessMsg(null), 4000);
                    } else {
                        alert(json.message || 'No se pudo eliminar el usuario.');
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        });
    };

    // Filtered Users
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q || (
                u.name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                (u.username && u.username.toLowerCase().includes(q))
            );

            if (!matchesSearch) return false;
            if (roleFilter === 'admin' && u.role !== 'admin') return false;
            if (roleFilter === 'planner' && u.role !== 'planner') return false;

            return true;
        });
    }, [users, searchQuery, roleFilter]);

    const adminCount = users.filter(u => u.role === 'admin').length;
    const plannerCount = users.filter(u => u.role === 'planner').length;

    return (
        <div className="space-y-6 animate-fade-in font-sans">
            {/* Header Banner */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                            <Users className="w-6 h-6 text-amber-500" />
                            <span>Gestión de Usuarios del Sistema</span>
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            Administrá los accesos de la plataforma: Administradores generales y Wedding Planners organizadoras.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={openCreateModal}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-extrabold shadow-md active:scale-95 transition-all"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span>+ Registrar Nuevo Usuario</span>
                        </button>
                    </div>
                </div>

                {/* Toast Notification */}
                {successMsg && (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{successMsg}</span>
                    </div>
                )}

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                        <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Total Usuarios Registrados</div>
                        <div className="text-xl font-black text-zinc-900 dark:text-white mt-0.5">{users.length} usuarios</div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40">
                        <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">👑 Administradores</div>
                        <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">{adminCount} administradores</div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/40">
                        <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">💍 Wedding Planners</div>
                        <div className="text-xl font-black text-rose-700 dark:text-rose-300 mt-0.5">{plannerCount} organizadoras</div>
                    </div>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre, email o usuario..."
                        className="w-full text-xs rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white pl-9 pr-3 py-2 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                    />
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 w-full sm:w-auto justify-end">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filtrar Rol:</span>
                    <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                        <button
                            onClick={() => setRoleFilter('all')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${roleFilter === 'all' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                        >
                            Todos ({users.length})
                        </button>
                        <button
                            onClick={() => setRoleFilter('admin')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${roleFilter === 'admin' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                        >
                            👑 Admins ({adminCount})
                        </button>
                        <button
                            onClick={() => setRoleFilter('planner')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${roleFilter === 'planner' ? 'bg-rose-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                        >
                            💍 Planners ({plannerCount})
                        </button>
                    </div>
                </div>
            </div>

            {/* Users List Grid */}
            {loading ? (
                <div className="p-12 text-center text-zinc-500 text-xs font-bold">
                    Cargando usuarios...
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 text-xs font-semibold">
                    No se encontraron usuarios registrados con los criterios seleccionados.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredUsers.map(userItem => {
                        const isAdminRole = userItem.role === 'admin';
                        const eventsList = userItem.events || [];

                        return (
                            <div
                                key={userItem.id}
                                className={`bg-white dark:bg-zinc-900 border rounded-3xl p-5 shadow-sm space-y-4 transition-all hover:scale-[1.01] ${
                                    isAdminRole 
                                        ? 'border-indigo-200 dark:border-indigo-900/40 bg-gradient-to-br from-white via-white to-indigo-50/20 dark:from-zinc-900 dark:to-indigo-950/20' 
                                        : 'border-zinc-200 dark:border-zinc-800'
                                }`}
                            >
                                {/* Card Header */}
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-11 w-11 rounded-2xl flex items-center justify-center text-lg font-black ${
                                            isAdminRole 
                                                ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800' 
                                                : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                        }`}>
                                            {userItem.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-base text-zinc-900 dark:text-white flex items-center gap-1.5">
                                                {userItem.name}
                                            </h3>
                                            <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                                                <Mail className="w-3 h-3 text-zinc-400" />
                                                <span>{userItem.email}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Role Badge */}
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                        isAdminRole 
                                            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30' 
                                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30'
                                    }`}>
                                        {isAdminRole ? '👑 Admin' : '💍 Planner'}
                                    </span>
                                </div>

                                {/* Username Info if available */}
                                {userItem.username && (
                                    <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                                        <User className="w-3.5 h-3.5 text-amber-500" />
                                        <span>Usuario: <strong>@{userItem.username}</strong></span>
                                    </div>
                                )}

                                {/* Events Assigned Summary */}
                                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700/60 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5 text-rose-500" /> Bodas Asignadas:
                                        </span>
                                        <span className="font-black text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 px-2 py-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                            {eventsList.length} eventos
                                        </span>
                                    </div>

                                    {eventsList.length > 0 ? (
                                        <div className="space-y-1 max-h-24 overflow-y-auto pt-1">
                                            {eventsList.map(ev => (
                                                <div key={ev.id} className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                                                    <span className="truncate flex items-center gap-1">
                                                        <Heart className="w-3 h-3 text-rose-500 inline" /> {ev.couple_names || ev.title}
                                                    </span>
                                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold shrink-0">
                                                        Activo
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-[11px] text-zinc-400 italic">Sin eventos asignados actualmente.</div>
                                    )}
                                </div>

                                {/* Actions Footer */}
                                <div className="pt-2 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800">
                                    <button
                                        onClick={() => openEditModal(userItem)}
                                        className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>Editar Usuario</span>
                                    </button>

                                    <button
                                        onClick={() => handleDeleteUser(userItem)}
                                        className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:underline"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Eliminar</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create / Edit User Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                <Users className="w-5 h-5 text-amber-500" />
                                <span>{editingUser ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}</span>
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold">
                                    {error}
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
                                    placeholder="ej: Sofía Fernández"
                                    className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-amber-500"
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
                                        placeholder="planner@wedding.com"
                                        className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                        Nombre de Usuario
                                    </label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="sofia.planner"
                                        className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                    Rol del Sistema *
                                </label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                                >
                                    <option value="planner">💍 Wedding Planner / Organizadora</option>
                                    <option value="admin">👑 Administrador General</option>
                                </select>
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
                                    className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-bold shadow-md"
                                >
                                    {submitting ? 'Guardando...' : (editingUser ? 'Guardar Cambios' : 'Registrar Usuario')}
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
