import React, { useState, useEffect } from 'react';
import { 
    Tag, 
    Plus, 
    Search, 
    Edit3, 
    Trash2, 
    Check, 
    X, 
    AlertCircle, 
    Sparkles, 
    RefreshCw, 
    Calendar,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { apiFetch } from '../api';

const EMOJI_PRESETS = ['💍', '👑', '🎂', '❤️', '🏢', '🎓', '🎈', '🎉', '🥂', '✝️', '🌴', '🎶', '👶', '🍽️', '🏷️'];

export default function EventTypesManagement({ showToast }) {
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [formName, setFormName] = useState('');
    const [formSlug, setFormSlug] = useState('');
    const [formIcon, setFormIcon] = useState('🎉');
    const [formDescription, setFormDescription] = useState('');
    const [formIsActive, setFormIsActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);

    // Delete confirmation state
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        fetchTypes();
    }, []);

    const fetchTypes = async () => {
        setLoading(true);
        try {
            const { ok, json } = await apiFetch('/api/event-types?all=true');
            if (ok && Array.isArray(json)) {
                setTypes(json);
            }
        } catch (err) {
            console.error('Error fetching event types:', err);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingType(null);
        setFormName('');
        setFormSlug('');
        setFormIcon('🎉');
        setFormDescription('');
        setFormIsActive(true);
        setFormError(null);
        setModalOpen(true);
    };

    const openEditModal = (item) => {
        setEditingType(item);
        setFormName(item.name || '');
        setFormSlug(item.slug || '');
        setFormIcon(item.icon || '🎉');
        setFormDescription(item.description || '');
        setFormIsActive(item.is_active !== undefined ? Boolean(item.is_active) : true);
        setFormError(null);
        setModalOpen(true);
    };

    const handleNameChange = (val) => {
        setFormName(val);
        // Auto-generate slug only if creating new item and slug wasn't manually edited
        if (!editingType) {
            const generated = val
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '');
            setFormSlug(generated);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormError(null);

        const url = editingType ? `/api/event-types/${editingType.id}` : '/api/event-types';
        const method = editingType ? 'PUT' : 'POST';

        try {
            const { ok, json } = await apiFetch(url, {
                method,
                body: JSON.stringify({
                    name: formName,
                    slug: formSlug,
                    icon: formIcon,
                    description: formDescription,
                    is_active: formIsActive,
                })
            });

            if (ok) {
                if (showToast) {
                    showToast(editingType ? '¡Tipo de evento actualizado!' : '¡Nuevo tipo de evento creado con éxito!');
                }
                setModalOpen(false);
                fetchTypes();
            } else {
                setFormError(json?.message || 'Error al guardar el tipo de evento.');
            }
        } catch (err) {
            console.error(err);
            setFormError('Error al comunicarse con el servidor.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item) => {
        if (!window.confirm(`¿Estás seguro de eliminar el tipo de evento "${item.name}"?`)) {
            return;
        }

        setDeletingId(item.id);
        try {
            const { ok, json } = await apiFetch(`/api/event-types/${item.id}`, {
                method: 'DELETE'
            });

            if (ok) {
                if (showToast) showToast('Tipo de evento eliminado.');
                setTypes(prev => prev.filter(t => t.id !== item.id));
            } else {
                alert(json?.message || 'Error al eliminar el tipo de evento.');
            }
        } catch (err) {
            console.error(err);
            alert('Error al comunicarse con el servidor.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleToggleActive = async (item) => {
        try {
            const { ok, json } = await apiFetch(`/api/event-types/${item.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: item.name,
                    slug: item.slug,
                    icon: item.icon,
                    description: item.description,
                    is_active: !item.is_active,
                })
            });

            if (ok && json?.event_type) {
                setTypes(prev => prev.map(t => t.id === item.id ? json.event_type : t));
                if (showToast) showToast(`Tipo de evento ${json.event_type.is_active ? 'activado' : 'desactivado'}.`);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const filteredTypes = types.filter(t => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (t.name || '').toLowerCase().includes(q) ||
            (t.slug || '').toLowerCase().includes(q) ||
            (t.description || '').toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6 animate-fade-in font-sans pb-16">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl">
                            <Tag className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                                Tipos de Eventos
                                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                                    {types.length} categorías
                                </span>
                            </h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                                Administrá la lista de tipos de eventos disponibles para asignar al crear un nuevo evento.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={openCreateModal}
                        className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-black shadow-lg shadow-amber-500/20 active:scale-95 transition-all inline-flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nuevo Tipo de Evento</span>
                    </button>
                </div>
            </div>

            {/* Search & Stats Bar */}
            <div className="flex items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm">
                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre, código..."
                        className="w-full text-xs rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white pl-9 pr-3 py-2 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                    />
                </div>

                <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Mostrando <strong className="text-zinc-900 dark:text-white">{filteredTypes.length}</strong> de {types.length} tipos
                </div>
            </div>

            {/* Table of Event Types */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-extrabold text-[10px]">
                                <th className="py-3.5 px-4 w-16 text-center">Ícono</th>
                                <th className="py-3.5 px-4">Nombre & Descripción</th>
                                <th className="py-3.5 px-4">Código (Slug)</th>
                                <th className="py-3.5 px-4 text-center">Eventos Vinculados</th>
                                <th className="py-3.5 px-4 text-center">Estado</th>
                                <th className="py-3.5 px-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-zinc-400">
                                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                                        Cargando tipos de eventos...
                                    </td>
                                </tr>
                            ) : filteredTypes.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-zinc-400">
                                        No se encontraron tipos de eventos que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            ) : (
                                filteredTypes.map((item) => {
                                    const eventsCount = item.events_count || 0;
                                    const isActive = item.is_active;

                                    return (
                                        <tr 
                                            key={item.id}
                                            className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                                        >
                                            {/* Icon */}
                                            <td className="py-3 px-4 text-center">
                                                <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl mx-auto shadow-inner">
                                                    {item.icon || '🎉'}
                                                </div>
                                            </td>

                                            {/* Name & Description */}
                                            <td className="py-3 px-4">
                                                <div className="font-extrabold text-zinc-900 dark:text-white text-sm">
                                                    {item.name}
                                                </div>
                                                {item.description && (
                                                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-md mt-0.5 truncate">
                                                        {item.description}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Slug */}
                                            <td className="py-3 px-4">
                                                <span className="font-mono text-[11px] bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg text-zinc-700 dark:text-zinc-300 font-bold border border-zinc-200/50 dark:border-zinc-700/50">
                                                    {item.slug}
                                                </span>
                                            </td>

                                            {/* Events Count */}
                                            <td className="py-3 px-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                                    eventsCount > 0 
                                                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50' 
                                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                                                }`}>
                                                    <Calendar className="w-3 h-3" />
                                                    {eventsCount} {eventsCount === 1 ? 'evento' : 'eventos'}
                                                </span>
                                            </td>

                                            {/* Status Toggle */}
                                            <td className="py-3 px-4 text-center">
                                                <button
                                                    onClick={() => handleToggleActive(item)}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black transition-all ${
                                                        isActive
                                                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'
                                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-zinc-200'
                                                    }`}
                                                    title="Click para cambiar estado"
                                                >
                                                    {isActive ? (
                                                        <>
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                            <span>Activo</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="w-3.5 h-3.5 text-zinc-400" />
                                                            <span>Inactivo</span>
                                                        </>
                                                    )}
                                                </button>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => openEditModal(item)}
                                                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                                        title="Editar tipo de evento"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item)}
                                                        disabled={deletingId === item.id}
                                                        className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
                                                        title={eventsCount > 0 ? "No se puede eliminar porque tiene eventos asociados" : "Eliminar"}
                                                    >
                                                        {deletingId === item.id ? (
                                                            <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
                                                        ) : (
                                                            <Trash2 className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL: Crear / Editar Tipo de Evento */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-md animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl">
                                    {editingType ? <Edit3 className="w-5 h-5" /> : <Tag className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-zinc-900 dark:text-white">
                                        {editingType ? 'Editar Tipo de Evento' : 'Nuevo Tipo de Evento'}
                                    </h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        Completá los datos del tipo de celebración.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {formError && (
                            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{formError}</span>
                            </div>
                        )}

                        <form onSubmit={handleSave} className="space-y-4">
                            {/* Icon Picker */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                                    Ícono / Emoji del Evento
                                </label>
                                <div className="flex items-center gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={formIcon}
                                        onChange={(e) => setFormIcon(e.target.value)}
                                        className="w-14 text-center text-xl p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                                        maxLength={4}
                                    />
                                    <span className="text-[11px] text-zinc-400 font-medium">
                                        Elegí un preset o pegá tu propio emoji
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 p-2 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                                    {EMOJI_PRESETS.map((emoji) => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => setFormIcon(emoji)}
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all ${
                                                formIcon === emoji 
                                                    ? 'bg-amber-500 text-white shadow-sm scale-110' 
                                                    : 'hover:bg-white dark:hover:bg-zinc-700'
                                            }`}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                                    Nombre del Tipo de Evento *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formName}
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    placeholder="ej: Bautismo / Primera Comunión"
                                    className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-semibold outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            {/* Slug / Code */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                                    <span>Código Único (Slug) *</span>
                                    <span className="text-[10px] text-zinc-400 font-normal">Identificador interno en base de datos</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formSlug}
                                    onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                                    placeholder="ej: bautismo"
                                    className="w-full text-xs font-mono rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                                    Descripción (Opcional)
                                </label>
                                <textarea
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder="Breve descripción o notas sobre este tipo de celebración..."
                                    rows={2}
                                    className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                />
                            </div>

                            {/* Active switch */}
                            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60">
                                <div>
                                    <div className="text-xs font-extrabold text-zinc-900 dark:text-white">
                                        Estado Activo
                                    </div>
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                        Si está activo, aparecerá en el selector al crear nuevos eventos.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={formIsActive} 
                                        onChange={(e) => setFormIsActive(e.target.checked)} 
                                        className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>

                            {/* Submit Buttons */}
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl text-zinc-600 dark:text-zinc-400 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all inline-flex items-center gap-2"
                                >
                                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    <span>{editingType ? 'Guardar Cambios' : 'Crear Tipo de Evento'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
