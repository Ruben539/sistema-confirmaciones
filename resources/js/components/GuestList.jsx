import React, { useState, useMemo } from 'react';
import { Search, Plus, Upload, Send, Trash2, Copy, Check, Pencil, CheckCircle2, XCircle, Clock, Utensils, ChevronLeft, ChevronRight, ArrowUpDown, Filter, Users } from 'lucide-react';

export default function GuestList({
    guests,
    onOpenAddModal,
    onOpenExcelModal,
    onOpenWhatsAppModal,
    onEditGuest,
    onUpdateGuest,
    onDeleteGuest,
    onClearAll,
    onMarkSent
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'confirmed', 'pending', 'declined'
    const [tableFilter, setTableFilter] = useState('all'); // 'all', 'assigned', 'unassigned'
    const [categoryFilter, setCategoryFilter] = useState('all'); // 'all', 'adults', 'youth', 'children'
    const [copiedToken, setCopiedToken] = useState(null);

    // Sorting State
    const [sortField, setSortField] = useState('name'); // 'name', 'table_number', 'status', 'category'
    const [sortDirection, setSortDirection] = useState('asc');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25); // 10, 25, 50, 100, 350

    // Selection State
    const [selectedGuestIds, setSelectedGuestIds] = useState([]);

    // Filter logic
    const filteredGuests = useMemo(() => {
        return guests.filter(guest => {
            const matchesSearch =
                guest.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                guest.phone.includes(searchTerm) ||
                (guest.table_number && guest.table_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (guest.notes && guest.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (guest.companions && guest.companions.toLowerCase().includes(searchTerm.toLowerCase()));

            if (!matchesSearch) return false;

            if (statusFilter !== 'all' && guest.status !== statusFilter) return false;

            if (tableFilter === 'assigned' && !guest.table_number) return false;
            if (tableFilter === 'unassigned' && guest.table_number) return false;

            if (categoryFilter === 'adults' && (guest.adults || 0) === 0) return false;
            if (categoryFilter === 'youth' && (guest.youth || 0) === 0) return false;
            if (categoryFilter === 'children' && (guest.children || 0) === 0) return false;

            return true;
        });
    }, [guests, searchTerm, statusFilter, tableFilter, categoryFilter]);

    // Sorting logic
    const sortedGuests = useMemo(() => {
        return [...filteredGuests].sort((a, b) => {
            let aVal = a[sortField] || '';
            let bVal = b[sortField] || '';

            if (sortField === 'name') {
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
            } else if (sortField === 'table_number') {
                aVal = a.table_number ? a.table_number.toLowerCase() : 'zzzz';
                bVal = b.table_number ? b.table_number.toLowerCase() : 'zzzz';
            } else if (sortField === 'category') {
                aVal = (a.children || 0) > 0 ? 3 : (a.youth || 0) > 0 ? 2 : 1;
                bVal = (b.children || 0) > 0 ? 3 : (b.youth || 0) > 0 ? 2 : 1;
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredGuests, sortField, sortDirection]);

    // Pagination logic
    const totalPages = Math.ceil(sortedGuests.length / pageSize) || 1;
    const paginatedGuests = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedGuests.slice(start, start + pageSize);
    }, [sortedGuests, currentPage, pageSize]);

    // Summary counts for filtered list
    const summaryStats = useMemo(() => {
        return filteredGuests.reduce((acc, g) => {
            // Count people, not invitations: one invitation can include companions
            acc.adults += g.adults || 0;
            acc.youth += g.youth || 0;
            acc.children += g.children || 0;
            acc.people += Math.max(1, (g.adults || 0) + (g.youth || 0) + (g.children || 0));
            acc.total += 1;
            return acc;
        }, { adults: 0, youth: 0, children: 0, people: 0, total: 0 });
    }, [filteredGuests]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const handleCopyLink = (token) => {
        const url = `${window.location.origin}/confirmar/${token}`;
        navigator.clipboard.writeText(url);
        setCopiedToken(token);
        setTimeout(() => setCopiedToken(null), 2000);
    };

    const toggleSelectAllPage = () => {
        const pageIds = paginatedGuests.map(g => g.id);
        const allSelected = pageIds.every(id => selectedGuestIds.includes(id));
        if (allSelected) {
            setSelectedGuestIds(prev => prev.filter(id => !pageIds.includes(id)));
        } else {
            setSelectedGuestIds(prev => Array.from(new Set([...prev, ...pageIds])));
        }
    };

    const toggleSelectGuest = (id) => {
        setSelectedGuestIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = () => {
        if (window.confirm(`¿Estás seguro de eliminar ${selectedGuestIds.length} invitados seleccionados?`)) {
            selectedGuestIds.forEach(id => onDeleteGuest(id));
            setSelectedGuestIds([]);
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6">
            {/* Top Bar: Search & Action Buttons */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        placeholder="Buscar por nombre, cel, mesa o notas..."
                        className="w-full text-xs rounded-2xl border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white pl-10 pr-4 py-3 font-medium outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                    />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={onOpenAddModal}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-all border border-zinc-200/80 dark:border-zinc-700"
                    >
                        <Plus className="w-4 h-4 text-blue-500" />
                        <span>Agregar Uno</span>
                    </button>

                    <button
                        onClick={onOpenExcelModal}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-xs font-bold transition-all border border-emerald-200/80 dark:border-emerald-800"
                    >
                        <Upload className="w-4 h-4 text-emerald-600" />
                        <span>Subir Excel</span>
                    </button>

                    <button
                        onClick={onOpenWhatsAppModal}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                    >
                        <Send className="w-4 h-4" />
                        <span>Enviar WhatsApp</span>
                    </button>

                    {guests.length > 0 && (
                        <button
                            onClick={onClearAll}
                            title="Borrar toda la lista"
                            className="p-2.5 rounded-2xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Tabs & Options */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                    <button
                        onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${statusFilter === 'all' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                    >
                        Todos ({guests.length})
                    </button>
                    <button
                        onClick={() => { setStatusFilter('confirmed'); setCurrentPage(1); }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${statusFilter === 'confirmed' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                    >
                        Confirmados ({guests.filter(g => g.status === 'confirmed').length})
                    </button>
                    <button
                        onClick={() => { setStatusFilter('pending'); setCurrentPage(1); }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${statusFilter === 'pending' ? 'bg-amber-500 text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                    >
                        Pendientes ({guests.filter(g => g.status === 'pending').length})
                    </button>
                    <button
                        onClick={() => { setStatusFilter('declined'); setCurrentPage(1); }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${statusFilter === 'declined' ? 'bg-rose-600 text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                    >
                        Rechazados ({guests.filter(g => g.status === 'declined').length})
                    </button>
                </div>

                {/* Secondary Filters & Page Size */}
                <div className="flex flex-wrap items-center gap-3 shrink-0 self-end sm:self-auto">
                    {/* Filter by Category */}
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <Filter className="w-3.5 h-3.5" />
                        <select
                            value={categoryFilter}
                            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                            className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-rose-500"
                        >
                            <option value="all">Todas las Categorías</option>
                            <option value="adults">Solo Adultos</option>
                            <option value="youth">Solo Jóvenes</option>
                            <option value="children">Solo Niños</option>
                        </select>
                    </div>

                    {/* Filter by Mesa */}
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <select
                            value={tableFilter}
                            onChange={(e) => { setTableFilter(e.target.value); setCurrentPage(1); }}
                            className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-rose-500"
                        >
                            <option value="all">Todas las Mesas</option>
                            <option value="assigned">Con Mesa Asignada</option>
                            <option value="unassigned">Sin Mesa</option>
                        </select>
                    </div>

                    {/* Page Size Selector */}
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                        <span>Mostrar:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                            className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-1 text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={350}>Todos</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Selection Bar (if items selected) */}
            {selectedGuestIds.length > 0 && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center justify-between animate-fade-in text-xs">
                    <span className="font-bold text-rose-800 dark:text-rose-200 flex items-center gap-2">
                        <Users className="w-4 h-4 text-rose-500" />
                        {selectedGuestIds.length} invitados seleccionados
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleBulkDelete}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors flex items-center gap-1"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar Seleccionados</span>
                        </button>
                        <button
                            onClick={() => setSelectedGuestIds([])}
                            className="px-3 py-1.5 rounded-xl text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-semibold"
                        >
                            Deseleccionar
                        </button>
                    </div>
                </div>
            )}

            {/* Summary Bar */}
            <div className="flex items-center justify-between text-xs text-zinc-500 font-medium px-1">
                <div>
                    Mostrando <strong className="text-zinc-800 dark:text-zinc-200">{filteredGuests.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> - <strong className="text-zinc-800 dark:text-zinc-200">{Math.min(currentPage * pageSize, filteredGuests.length)}</strong> de <strong className="text-zinc-800 dark:text-zinc-200">{filteredGuests.length}</strong> invitados
                </div>
                <div className="hidden md:flex items-center gap-3 text-zinc-600 dark:text-zinc-400 font-bold">
                    <span>Total: {summaryStats.total} invitaciones · {summaryStats.people} personas</span>
                    <span>({summaryStats.adults} Adultos · {summaryStats.youth} Jóvenes · {summaryStats.children} Niños)</span>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                {filteredGuests.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                        <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-800 w-16 h-16 mx-auto flex items-center justify-center text-zinc-400">
                            <Search className="w-8 h-8" />
                        </div>
                        <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">No se encontraron invitados</h3>
                        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                            {guests.length === 0 ? 'Todavía no agregaste invitados. Subí un Excel o agregá uno manualmente.' : 'Probá cambiando el filtro o la búsqueda.'}
                        </p>
                    </div>
                ) : (
                    <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase tracking-wider font-semibold">
                            <tr>
                                <th className="p-3.5 rounded-l-2xl w-10">
                                    <input
                                        type="checkbox"
                                        checked={paginatedGuests.length > 0 && paginatedGuests.every(g => selectedGuestIds.includes(g.id))}
                                        onChange={toggleSelectAllPage}
                                        className="rounded border-zinc-300 dark:border-zinc-700 text-rose-500 focus:ring-rose-500 cursor-pointer"
                                    />
                                </th>
                                <th className="p-3.5 cursor-pointer hover:text-zinc-900 dark:hover:text-white" onClick={() => handleSort('name')}>
                                    <div className="flex items-center gap-1">
                                        <span>Invitado / Teléfono</span>
                                        <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                                    </div>
                                </th>
                                <th className="p-3.5 cursor-pointer hover:text-zinc-900 dark:hover:text-white" onClick={() => handleSort('table_number')}>
                                    <div className="flex items-center gap-1">
                                        <span>Nº de Mesa</span>
                                        <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                                    </div>
                                </th>
                                <th className="p-3.5 cursor-pointer hover:text-zinc-900 dark:hover:text-white" onClick={() => handleSort('status')}>
                                    <div className="flex items-center gap-1">
                                        <span>Estado Asistencia</span>
                                        <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                                    </div>
                                </th>
                                <th className="p-3.5 cursor-pointer hover:text-zinc-900 dark:hover:text-white" onClick={() => handleSort('category')}>
                                    <div className="flex items-center gap-1">
                                        <span>Categoría</span>
                                        <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                                    </div>
                                </th>
                                <th className="p-3.5">Envío WhatsApp</th>
                                <th className="p-3.5">Detalles / Dieta</th>
                                <th className="p-3.5 text-right rounded-r-2xl">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
                            {paginatedGuests.map(guest => (
                                <tr key={guest.id} className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors ${selectedGuestIds.includes(guest.id) ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''}`}>
                                    {/* Selection */}
                                    <td className="p-3.5">
                                        <input
                                            type="checkbox"
                                            checked={selectedGuestIds.includes(guest.id)}
                                            onChange={() => toggleSelectGuest(guest.id)}
                                            className="rounded border-zinc-300 dark:border-zinc-700 text-rose-500 focus:ring-rose-500 cursor-pointer"
                                        />
                                    </td>

                                    {/* Name & Phone */}
                                    <td className="p-3.5">
                                        <div className="font-bold text-sm text-zinc-900 dark:text-white">{guest.name}</div>
                                        <div className="text-xs text-zinc-500 font-mono flex items-center gap-1.5 mt-0.5">
                                            <span>{guest.phone}</span>
                                        </div>
                                    </td>

                                    {/* Table Number */}
                                    <td className="p-3.5">
                                        {guest.table_number ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-black text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-800/60">
                                                {guest.table_number}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-400 text-xs italic">Sin mesa</span>
                                        )}
                                    </td>

                                    {/* Status Badge & Quick Change */}
                                    <td className="p-3.5">
                                        <select
                                            value={guest.status}
                                            onChange={(e) => onUpdateGuest(guest.id, { status: e.target.value })}
                                            className="bg-transparent border-none p-0 text-xs font-bold cursor-pointer focus:ring-0"
                                        >
                                            <option value="pending">⏳ Pendiente</option>
                                            <option value="confirmed">✅ Confirmado</option>
                                            <option value="declined">❌ Rechazado</option>
                                        </select>
                                    </td>

                                    {/* Invitation composition (invited person + companions) */}
                                    <td className="p-3.5">
                                        <div className="flex flex-wrap items-center gap-1">
                                            {(guest.adults || 0) > 0 && (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-xl border border-blue-200 dark:border-blue-800">
                                                    👤 {guest.adults > 1 ? `${guest.adults} Adultos` : 'Adulto'}
                                                </span>
                                            )}
                                            {(guest.youth || 0) > 0 && (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 px-2.5 py-1 rounded-xl border border-violet-200 dark:border-violet-800">
                                                    ⚡ {guest.youth > 1 ? `${guest.youth} Jóvenes` : 'Joven'}
                                                </span>
                                            )}
                                            {(guest.children || 0) > 0 && (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-xl border border-teal-200 dark:border-teal-800">
                                                    👶 {guest.children > 1 ? `${guest.children} Niños` : 'Niño'}
                                                </span>
                                            )}
                                        </div>
                                        {guest.companions && (
                                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 truncate max-w-[180px]" title={guest.companions}>
                                                + {guest.companions}
                                            </div>
                                        )}
                                    </td>

                                    {/* WhatsApp Status */}
                                    <td className="p-3.5">
                                        {guest.whatsapp_status === 'sent' ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Enviado
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400">
                                                <Clock className="w-3.5 h-3.5" /> Sin enviar
                                            </span>
                                        )}
                                    </td>

                                    {/* Notes / Dietary */}
                                    <td className="p-3.5 max-w-xs">
                                        {guest.dietary_restrictions && (
                                            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md mb-1 border border-amber-200/50">
                                                <Utensils className="w-3 h-3" /> {guest.dietary_restrictions}
                                            </div>
                                        )}
                                        {guest.notes && (
                                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                                {guest.notes}
                                            </div>
                                        )}
                                        {!guest.dietary_restrictions && !guest.notes && (
                                            <span className="text-zinc-400">-</span>
                                        )}
                                    </td>

                                    {/* Actions */}
                                    <td className="p-3.5 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {onEditGuest && (
                                                <button
                                                    onClick={() => onEditGuest(guest)}
                                                    className="p-2 rounded-xl text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                                                    title="Editar invitado"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleCopyLink(guest.token)}
                                                className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                                title="Copiar link de confirmación para este invitado"
                                            >
                                                {copiedToken === guest.token ? (
                                                    <Check className="w-4 h-4 text-emerald-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </button>

                                            <button
                                                onClick={() => onDeleteGuest(guest.id)}
                                                className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                                title="Eliminar invitado"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination Controls */}
            {filteredGuests.length > 0 && totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="text-xs text-zinc-500 font-medium">
                        Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-1 max-w-[200px] overflow-x-auto">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${currentPage === page ? 'bg-rose-500 text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
