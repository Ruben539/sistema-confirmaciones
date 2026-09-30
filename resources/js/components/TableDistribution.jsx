import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit2, Users, AlertCircle, CheckCircle2, RefreshCw, UserCheck, ArrowRightLeft, Sparkles, X, LayoutGrid, FileSpreadsheet, Search, List, Grid, Maximize2, Minimize2, ChevronDown, ChevronUp, Box, Printer } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import Visual3DTableMap from './Visual3DTableMap';
import ExportDocumentsModal from './ExportDocumentsModal';
import { apiFetch } from '../api';

export default function TableDistribution({ eventId, eventTitle, event, showToast, onOpenCreateEvent }) {
    const [data, setData] = useState({ tables: [], unassigned_guests: [], stats: {} });
    const [loading, setLoading] = useState(true);
    const [isExportOpen, setIsExportOpen] = useState(false);

    // Create / Edit Table Modal State
    const [isTableModalOpen, setIsTableModalOpen] = useState(false);
    const [tableToEdit, setTableToEdit] = useState(null);
    const [tableName, setTableName] = useState('');
    const [tableCapacity, setTableCapacity] = useState(10);
    const [tableNotes, setTableNotes] = useState('');
    const [modalSubmitting, setModalSubmitting] = useState(false);

    // Quick Assign Modal for mobile or click action
    const [assigningGuest, setAssigningGuest] = useState(null);
    const [assignTableSearch, setAssignTableSearch] = useState('');

    // Drag and drop state
    const [draggedGuest, setDraggedGuest] = useState(null);

    // Confirm Modal
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    // Scalability Controls for 300-350 Guests
    const [searchUnassigned, setSearchUnassigned] = useState('');
    const [unassignedCategory, setUnassignedCategory] = useState('all'); // 'all', 'adults', 'youth', 'children'
    
    const [searchTable, setSearchTable] = useState('');
    const [tableStatusFilter, setTableStatusFilter] = useState('all'); // 'all', 'available', 'full', 'empty'
    const [viewMode, setViewMode] = useState('grid'); // 'grid', 'compact', '3d'
    const [collapsedTables, setCollapsedTables] = useState({});

    useEffect(() => {
        if (eventId) {
            fetchTables();
        } else {
            setData({ tables: [], unassigned_guests: [], stats: {} });
            setLoading(false);
        }
    }, [eventId]);

    // silent: refresh data in place without the full-screen spinner (after edits, live refresh)
    const fetchTables = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const { ok, json } = await apiFetch(`/api/events/${eventId}/tables`);
            if (ok && json) {
                setData(json);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveTable = async (e) => {
        e.preventDefault();
        setModalSubmitting(true);

        const isEditing = !!tableToEdit;
        const url = isEditing ? `/api/tables/${tableToEdit.id}` : `/api/events/${eventId}/tables`;
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const { ok, json } = await apiFetch(url, {
                method,
                body: JSON.stringify({
                    name: tableName,
                    capacity: parseInt(tableCapacity, 10) || 10,
                    notes: tableNotes
                })
            });

            if (ok) {
                if (showToast) showToast(isEditing ? 'Mesa actualizada' : 'Mesa creada');
                setIsTableModalOpen(false);
                setTableToEdit(null);
                fetchTables({ silent: true });
            } else {
                alert(json?.message || 'Error al guardar la mesa.');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setModalSubmitting(false);
        }
    };

    const handleDeleteTable = (table) => {
        setConfirmModal({
            isOpen: true,
            title: `Eliminar ${table.name}`,
            message: `¿Estás seguro de eliminar esta mesa? Los invitados asignados a ella volverán a la lista de "Sin Mesa".`,
            confirmText: 'Sí, eliminar',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    const { ok } = await apiFetch(`/api/tables/${table.id}`, { method: 'DELETE' });
                    if (ok) {
                        if (showToast) showToast(`Mesa '${table.name}' eliminada.`);
                        fetchTables({ silent: true });
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        });
    };

    const handleAutoCreateTables = async () => {
        try {
            const { ok, json } = await apiFetch(`/api/events/${eventId}/tables/auto-create`, { method: 'POST' });
            if (ok) {
                if (showToast) showToast(json?.message || 'Mesas automáticas creadas');
                fetchTables({ silent: true });
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleAssignGuest = async (guestId, targetTableName) => {
        try {
            const { ok, json } = await apiFetch(`/api/tables/assign`, {
                method: 'POST',
                body: JSON.stringify({
                    guest_id: guestId,
                    table_name: targetTableName
                })
            });

            if (ok) {
                fetchTables({ silent: true });
            } else if (showToast) {
                showToast(json?.message || 'No se pudo asignar la mesa.');
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Used from the 3D plan while arranging the venue
    const handleCreateTable = async (payload) => {
        try {
            const { ok, json } = await apiFetch(`/api/events/${eventId}/tables`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (ok) {
                await fetchTables({ silent: true });
                return json?.table || null;
            }
            if (showToast) showToast(json?.message || 'No se pudo crear la mesa.');
        } catch (err) {
            console.error(err);
            if (showToast) showToast('Error de conexión al crear la mesa.');
        }
        return null;
    };

    const handleUpdateTable = async (tableId, patch) => {
        try {
            const { ok, json } = await apiFetch(`/api/tables/${tableId}`, {
                method: 'PUT',
                body: JSON.stringify(patch)
            });
            if (ok) {
                await fetchTables({ silent: true });
                return true;
            }
            if (showToast) showToast(json?.message || 'No se pudo actualizar la mesa.');
        } catch (err) {
            console.error(err);
            if (showToast) showToast('Error de conexión al actualizar la mesa.');
        }
        return false;
    };

    const handleSaveLayout = async (payload) => {
        try {
            const { ok, json } = await apiFetch(`/api/events/${eventId}/tables/layout`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (ok) {
                if (showToast) showToast(json?.message || 'Plano del salón guardado');
                await fetchTables({ silent: true });
                return true;
            }
            if (showToast) showToast(json?.message || 'No se pudo guardar el plano.');
        } catch (err) {
            console.error(err);
            if (showToast) showToast('Error de conexión al guardar el plano.');
        }
        return false;
    };

    const openAddTableModal = () => {
        setTableToEdit(null);
        setTableName(`Mesa ${(data.tables?.length || 0) + 1}`);
        setTableCapacity(10);
        setTableNotes('');
        setIsTableModalOpen(true);
    };

    const openEditTableModal = (table) => {
        setTableToEdit(table);
        setTableName(table.name);
        setTableCapacity(table.capacity);
        setTableNotes(table.notes || '');
        setIsTableModalOpen(true);
    };

    // Drag and Drop Handlers
    const handleDragStart = (e, guest) => {
        setDraggedGuest(guest);
        e.dataTransfer.setData('text/plain', guest.id);
    };

    const handleDropOnTable = (e, targetTableName) => {
        e.preventDefault();
        if (draggedGuest) {
            handleAssignGuest(draggedGuest.id, targetTableName);
            setDraggedGuest(null);
        }
    };

    const handleDropOnUnassigned = (e) => {
        e.preventDefault();
        if (draggedGuest) {
            handleAssignGuest(draggedGuest.id, null);
            setDraggedGuest(null);
        }
    };

    const toggleCollapseTable = (tableId) => {
        setCollapsedTables(prev => ({ ...prev, [tableId]: !prev[tableId] }));
    };

    const toggleCollapseAll = (collapse) => {
        const newState = {};
        (data.tables || []).forEach(t => { newState[t.id] = collapse; });
        setCollapsedTables(newState);
    };

    const stats = data.stats || {};
    const tables = data.tables || [];
    const unassigned = data.unassigned_guests || [];

    // Filtered Unassigned Guests
    const filteredUnassigned = useMemo(() => {
        return unassigned.filter(g => {
            const matchesSearch = g.name.toLowerCase().includes(searchUnassigned.toLowerCase());
            if (!matchesSearch) return false;
            if (unassignedCategory === 'adults' && (g.adults || 0) === 0) return false;
            if (unassignedCategory === 'youth' && (g.youth || 0) === 0) return false;
            if (unassignedCategory === 'children' && (g.children || 0) === 0) return false;
            return true;
        });
    }, [unassigned, searchUnassigned, unassignedCategory]);

    // Filtered Tables
    const filteredTables = useMemo(() => {
        return tables.filter(tbl => {
            const matchesSearch = tbl.name.toLowerCase().includes(searchTable.toLowerCase()) ||
                (tbl.notes && tbl.notes.toLowerCase().includes(searchTable.toLowerCase()));
            if (!matchesSearch) return false;

            const occupied = tbl.occupied_passes || 0;
            const cap = tbl.capacity || 10;
            if (tableStatusFilter === 'available' && occupied >= cap) return false;
            if (tableStatusFilter === 'full' && occupied < cap) return false;
            if (tableStatusFilter === 'empty' && occupied > 0) return false;

            return true;
        });
    }, [tables, searchTable, tableStatusFilter]);

    if (loading) {
        return (
            <div className="p-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-rose-500 animate-spin mx-auto" />
                <p className="text-xs font-semibold text-zinc-500">Cargando distribución de mesas...</p>
            </div>
        );
    }

    if (!eventId) {
        return (
            <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4 max-w-lg mx-auto my-12 animate-fade-in font-sans">
                <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto border border-rose-100 dark:border-rose-900/40">
                    <LayoutGrid className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                        Sin Evento Seleccionado
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                        Para organizar la distribución de mesas y asignar a los invitados en el plano, primero debés seleccionar o registrar un evento.
                    </p>
                </div>
                {onOpenCreateEvent && (
                    <button
                        onClick={onOpenCreateEvent}
                        className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-extrabold shadow-md shadow-rose-500/20 active:scale-95 transition-all inline-flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Crear Primer Evento</span>
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in font-sans">
            {/* Header & Stats Banner */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                            <LayoutGrid className="w-6 h-6 text-rose-500" />
                            <span>Distribución de Mesas (Seating Plan)</span>
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            Diseñado para escalar hasta 350+ invitados. Arrastrá y soltá o usá asignación rápida.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        {/* View Switcher: Grid vs 3D */}
                        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                            <button
                                type="button"
                                onClick={() => setViewMode('grid')}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    viewMode === 'grid' 
                                        ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm' 
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                <Grid className="w-3.5 h-3.5" />
                                Lista / Tarjetas
                            </button>

                            <button
                                type="button"
                                onClick={() => setViewMode('3d')}
                                className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                                    viewMode === '3d' 
                                        ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md' 
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                <Box className="w-3.5 h-3.5 animate-pulse" />
                                🏢 Mapa 3D Interactivo
                            </button>
                        </div>

                        <button
                            onClick={() => setIsExportOpen(true)}
                            title="Plano, lista de ubicación, catering, recepción y Excel"
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 text-xs font-bold transition-all border border-zinc-200 dark:border-zinc-700"
                        >
                            <Printer className="w-4 h-4 text-rose-500" />
                            <span>Exportar / Imprimir</span>
                        </button>

                        <button
                            onClick={handleAutoCreateTables}
                            title="Crear mesas automáticamente si los invitados ya tienen números de mesa ingresados"
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 text-xs font-bold transition-all border border-zinc-200 dark:border-zinc-700"
                        >
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            <span>Auto-Detectar Mesas</span>
                        </button>

                        <button
                            onClick={openAddTableModal}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-extrabold transition-all shadow-md active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Crear Nueva Mesa</span>
                        </button>
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                        <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Total Mesas</div>
                        <div className="text-xl font-black text-zinc-900 dark:text-white mt-0.5">{stats.total_tables || 0} mesas</div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                        <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Asientos Asignados</div>
                        <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {stats.assigned_passes || 0} / {stats.total_capacity || 0}
                        </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                        <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Sin Mesa Asignada</div>
                        <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                            {stats.unassigned_passes || 0} pers. ({unassigned.length} invit.)
                        </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                        <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Ocupación Total</div>
                        <div className="text-xl font-black text-rose-500 mt-0.5">
                            {stats.total_capacity > 0 ? Math.round((stats.assigned_passes / stats.total_capacity) * 100) : 0}%
                        </div>
                    </div>
                </div>
            </div>

            {/* CONDITIONAL RENDER: 3D VIEW VS GRID VIEW */}
            {viewMode === '3d' ? (
                <Visual3DTableMap
                    tables={tables}
                    unassignedGuests={unassigned}
                    venueLayout={data.venue_layout}
                    onAssignGuest={handleAssignGuest}
                    onExport={() => setIsExportOpen(true)}
                    onCreateTable={handleCreateTable}
                    onUpdateTable={handleUpdateTable}
                    onDeleteTable={handleDeleteTable}
                    onSaveLayout={handleSaveLayout}
                    onRefresh={() => fetchTables({ silent: true })}
                />
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left Sidebar: Unassigned Guests with Scalable Search & Filters */}
                <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDropOnUnassigned}
                    className="lg:col-span-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-3 flex flex-col max-h-[85vh]"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-amber-500" />
                            <h3 className="text-sm font-black text-zinc-900 dark:text-white">Sin Mesa ({unassigned.length})</h3>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                            {unassigned.reduce((acc, g) => acc + (g.seats ?? g.passes), 0)} pers.
                        </span>
                    </div>

                    {/* Unassigned Search Input */}
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            value={searchUnassigned}
                            onChange={(e) => setSearchUnassigned(e.target.value)}
                            placeholder="Buscar sin mesa..."
                            className="w-full text-xs rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white pl-8 pr-3 py-2 font-medium outline-none focus:ring-2 focus:ring-rose-500"
                        />
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto text-[10px] pb-1">
                        <button
                            onClick={() => setUnassignedCategory('all')}
                            className={`px-2 py-1 rounded-lg font-bold transition-colors ${unassignedCategory === 'all' ? 'bg-amber-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setUnassignedCategory('adults')}
                            className={`px-2 py-1 rounded-lg font-bold transition-colors ${unassignedCategory === 'adults' ? 'bg-amber-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
                        >
                            Adultos
                        </button>
                        <button
                            onClick={() => setUnassignedCategory('youth')}
                            className={`px-2 py-1 rounded-lg font-bold transition-colors ${unassignedCategory === 'youth' ? 'bg-amber-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
                        >
                            Jóvenes
                        </button>
                        <button
                            onClick={() => setUnassignedCategory('children')}
                            className={`px-2 py-1 rounded-lg font-bold transition-colors ${unassignedCategory === 'children' ? 'bg-amber-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
                        >
                            Niños
                        </button>
                    </div>

                    <div className="overflow-y-auto space-y-2 flex-1 pr-1">
                        {filteredUnassigned.length === 0 ? (
                            <div className="p-6 text-center text-xs text-zinc-400 font-medium italic border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                                {unassigned.length === 0 ? '🎉 Todos los invitados tienen mesa asignada.' : 'No se encontraron invitados con este filtro.'}
                            </div>
                        ) : (
                            filteredUnassigned.map(guest => (
                                <div
                                    key={guest.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, guest)}
                                    className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 transition-all cursor-grab active:cursor-grabbing group shadow-sm flex flex-col gap-1.5"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="font-bold text-xs text-zinc-900 dark:text-white group-hover:text-rose-500 transition-colors">
                                            {guest.name}
                                        </div>
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                                            {guest.seats ?? guest.passes} {(guest.seats ?? guest.passes) === 1 ? 'persona' : 'personas'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                                        <span>{guest.youth || 0} Jóv · {guest.adults || 0} Ad · {guest.children || 0} Niñ</span>

                                        <button
                                            onClick={() => { setAssigningGuest(guest); setAssignTableSearch(''); }}
                                            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                                        >
                                            <ArrowRightLeft className="w-3 h-3" /> Asignar Mesa
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Area: Tables View Controls & Grid */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Toolbar for 30+ Tables Filtering & View Options */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                        {/* Table Search & Status Filter */}
                        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 max-w-xs">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <input
                                    type="text"
                                    value={searchTable}
                                    onChange={(e) => setSearchTable(e.target.value)}
                                    placeholder="Buscar mesa..."
                                    className="w-full text-xs rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white pl-8 pr-3 py-2 font-medium outline-none focus:ring-2 focus:ring-rose-500"
                                />
                            </div>

                            <select
                                value={tableStatusFilter}
                                onChange={(e) => setTableStatusFilter(e.target.value)}
                                className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 outline-none"
                            >
                                <option value="all">Todas las Mesas ({tables.length})</option>
                                <option value="available">Con Espacio Disponible</option>
                                <option value="full">Llenas (Capacidad Máxima)</option>
                                <option value="empty">Vacías (0 Sentados)</option>
                            </select>
                        </div>

                        {/* View Modes & Collapse Controls */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <button
                                onClick={() => toggleCollapseAll(true)}
                                className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                title="Colapsar todas las mesas"
                            >
                                <Minimize2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => toggleCollapseAll(false)}
                                className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                title="Expandir todas las mesas"
                            >
                                <Maximize2 className="w-3.5 h-3.5" />
                            </button>

                            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-700 text-rose-500 shadow-sm' : 'text-zinc-500'}`}
                                    title="Vista de Tarjetas"
                                >
                                    <Grid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('compact')}
                                    className={`p-1.5 rounded-lg transition-colors ${viewMode === 'compact' ? 'bg-white dark:bg-zinc-700 text-rose-500 shadow-sm' : 'text-zinc-500'}`}
                                    title="Vista Lista Compacta (30+ Mesas)"
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tables Display */}
                    {filteredTables.length === 0 ? (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-3">
                            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                            <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">No hay mesas creadas o no coinciden con la búsqueda</h3>
                            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                                Hacé clic en "Crear Nueva Mesa" o "Auto-Detectar Mesas" para empezar a organizar tu salón.
                            </p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        /* Grid View */
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredTables.map(table => {
                                const isOverCapacity = (table.occupied_passes || 0) > table.capacity;
                                const isFull = (table.occupied_passes || 0) === table.capacity;
                                const percent = Math.min(100, Math.round(((table.occupied_passes || 0) / table.capacity) * 100));
                                const isCollapsed = !!collapsedTables[table.id];

                                return (
                                    <div
                                        key={table.id}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => handleDropOnTable(e, table.name)}
                                        className={`bg-white dark:bg-zinc-900 border rounded-3xl p-5 shadow-sm space-y-4 transition-all ${isOverCapacity ? 'border-rose-400 bg-rose-50/20 dark:bg-rose-950/20' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                                    >
                                        {/* Table Header */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => toggleCollapseTable(table.id)}
                                                        className="text-zinc-400 hover:text-zinc-600"
                                                    >
                                                        {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                                    </button>
                                                    <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">
                                                        {table.name}
                                                    </h3>
                                                    {table.notes && (
                                                        <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                                                            {table.notes}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => openEditTableModal(table)}
                                                        className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                                        title="Editar mesa"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteTable(table)}
                                                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                        title="Eliminar mesa"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Capacity Progress */}
                                            <div>
                                                <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                                                    <span className={isOverCapacity ? 'text-rose-600' : isFull ? 'text-amber-600' : 'text-emerald-600 dark:text-emerald-400'}>
                                                        {table.occupied_passes} de {table.capacity} asientos
                                                    </span>
                                                    <span className="text-zinc-400 font-normal">{percent}%</span>
                                                </div>
                                                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-300 ${isOverCapacity ? 'bg-rose-500' : isFull ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Breakdown */}
                                            <div className="text-[10px] text-zinc-500 font-semibold pt-1">
                                                {table.youth || 0} Jóv · {table.adults || 0} Ad · {table.children || 0} Niñ
                                            </div>
                                        </div>

                                        {/* Assigned Guests List (Collapsible) */}
                                        {!isCollapsed && (
                                            <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-800/80 pt-3 flex-1 min-h-[100px]">
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                                                    Invitados Sentados ({table.guests?.length || 0})
                                                </div>

                                                {table.guests?.length === 0 ? (
                                                    <div className="p-4 text-center text-[11px] text-zinc-400 italic border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                                                        Arrastrá invitados aquí para sentarlos.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                        {table.guests.map(g => (
                                                            <div
                                                                key={g.id}
                                                                draggable
                                                                onDragStart={(e) => handleDragStart(e, g)}
                                                                className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 flex items-center justify-between text-xs transition-colors group cursor-grab"
                                                            >
                                                                <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[140px]">
                                                                    {g.name}
                                                                </div>

                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <span className="text-[10px] font-bold text-zinc-500 bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                                                                        {g.seats ?? g.passes} pers.
                                                                    </span>
                                                                    <button
                                                                        onClick={() => handleAssignGuest(g.id, null)}
                                                                        className="text-zinc-400 hover:text-rose-500 p-0.5 rounded"
                                                                        title="Quitar de esta mesa"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Compact Density View (Ideal for 30+ tables) */
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {filteredTables.map(tbl => {
                                    const percent = Math.min(100, Math.round(((tbl.occupied_passes || 0) / tbl.capacity) * 100));
                                    return (
                                        <div key={tbl.id} className="p-4 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 flex items-center justify-between gap-4 transition-colors">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="font-extrabold text-sm text-zinc-900 dark:text-white min-w-[100px]">
                                                    {tbl.name}
                                                </div>
                                                <div className="text-xs text-zinc-500 font-semibold min-w-[120px]">
                                                    {tbl.occupied_passes} / {tbl.capacity} asientos
                                                </div>
                                                <div className="w-32 bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden hidden sm:block">
                                                    <div className="h-full bg-rose-500" style={{ width: `${percent}%` }} />
                                                </div>
                                                <div className="text-xs text-zinc-500 truncate hidden md:block">
                                                    {tbl.guests?.map(g => g.name).join(', ') || <span className="italic text-zinc-400">Sin invitados</span>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openEditTableModal(tbl)}
                                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTable(tbl)}
                                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* Create/Edit Table Modal */}
            {isTableModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                <LayoutGrid className="w-5 h-5 text-rose-500" />
                                <span>{tableToEdit ? 'Editar Mesa' : 'Crear Nueva Mesa'}</span>
                            </h3>
                            <button onClick={() => setIsTableModalOpen(false)} className="text-zinc-400 hover:text-zinc-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveTable} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                    Nombre o Número de Mesa *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={tableName}
                                    onChange={(e) => setTableName(e.target.value)}
                                    placeholder="ej: Mesa 1 / Mesa Principal"
                                    className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-rose-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                    Capacidad (Asientos) *
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    required
                                    value={tableCapacity}
                                    onChange={(e) => setTableCapacity(parseInt(e.target.value, 10) || 1)}
                                    className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-rose-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                    Notas o Ubicación (Opcional)
                                </label>
                                <input
                                    type="text"
                                    value={tableNotes}
                                    onChange={(e) => setTableNotes(e.target.value)}
                                    placeholder="ej: Cerca del escenario / Pista de baile"
                                    className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-rose-500"
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setIsTableModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={modalSubmitting}
                                    className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md"
                                >
                                    {modalSubmitting ? 'Guardando...' : (tableToEdit ? 'Guardar Cambios' : 'Crear Mesa')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Quick Assign Guest Modal with Fast Table Search */}
            {assigningGuest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                                Asignar Mesa a <span className="text-rose-500">{assigningGuest.name}</span>
                            </h3>
                            <button onClick={() => setAssigningGuest(null)} className="text-zinc-400 hover:text-zinc-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-xs text-zinc-500">Seleccioná la mesa para sentar a esta persona ({assigningGuest.passes} personas):</p>

                        {/* Search Table inside modal */}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                value={assignTableSearch}
                                onChange={(e) => setAssignTableSearch(e.target.value)}
                                placeholder="Filtrar mesa..."
                                className="w-full text-xs rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white pl-8 pr-3 py-2 font-medium outline-none focus:ring-2 focus:ring-rose-500"
                            />
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {tables
                                .filter(t => t.name.toLowerCase().includes(assignTableSearch.toLowerCase()))
                                .map(tbl => (
                                    <button
                                        key={tbl.id}
                                        onClick={() => {
                                            handleAssignGuest(assigningGuest.id, tbl.name);
                                            setAssigningGuest(null);
                                        }}
                                        className="w-full p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-colors"
                                    >
                                        <span>{tbl.name}</span>
                                        <span className="text-[10px] text-zinc-400">{tbl.occupied_passes} / {tbl.capacity} asientos</span>
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>
            )}

            <ExportDocumentsModal
                isOpen={isExportOpen}
                onClose={() => setIsExportOpen(false)}
                event={event || { id: eventId, title: eventTitle }}
                tables={tables}
                unassigned={unassigned}
                venueLayout={data.venue_layout}
                showToast={showToast}
            />

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
