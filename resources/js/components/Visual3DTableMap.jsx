import React, { useState, useRef, useMemo } from 'react';
import { RotateCw, ZoomIn, ZoomOut, Search, Utensils, Sparkles, X, Compass, Printer, ArrowRightLeft, UserPlus, CheckCircle2, Ticket, ChefHat, ShieldAlert, SlidersHorizontal, MapPin } from 'lucide-react';

export default function Visual3DTableMap({ tables = [], unassignedGuests = [], onSelectTable, onAssignGuest, onMoveGuest }) {
    const [selectedTableId, setSelectedTableId] = useState(null);
    const [rotationY, setRotationY] = useState(35); // 0 to 360 deg
    const [rotationX, setRotationX] = useState(55); // 20 to 80 deg (tilt)
    const [zoom, setZoom] = useState(1); // 0.6 to 1.8
    
    // Planner Tool Modes
    const [searchQuery, setSearchQuery] = useState('');
    const [waiterMode, setWaiterMode] = useState(false); // Mode Mozos / Catering Service 3D
    const [filterDiet, setFilterDiet] = useState(false);
    const [filterPendingArrival, setFilterPendingArrival] = useState(false);

    // Quick seating modal inside 3D
    const [quickSeatGuestId, setQuickSeatGuestId] = useState('');
    const [movingGuestId, setMovingGuestId] = useState(null);
    const [targetTableId, setTargetTableId] = useState('');

    const isDraggingRef = useRef(false);
    const lastMouseRef = useRef({ x: 0, y: 0 });

    const selectedTable = useMemo(() => {
        return tables.find(t => t.id === selectedTableId) || null;
    }, [tables, selectedTableId]);

    // Live search highlight table
    const searchMatchTableId = useMemo(() => {
        if (!searchQuery || searchQuery.trim().length < 2) return null;
        const q = searchQuery.toLowerCase().trim();
        const foundTable = tables.find(t => 
            t.name.toLowerCase().includes(q) ||
            t.guests?.some(g => g.name.toLowerCase().includes(q))
        );
        return foundTable ? foundTable.id : null;
    }, [tables, searchQuery]);

    // Calculate layout positions for 3D grid with support for Imperial / Round shapes
    const positionedTables = useMemo(() => {
        if (!tables || tables.length === 0) return [];
        const cols = Math.ceil(Math.sqrt(tables.length * 1.3));
        const spacingX = 150;
        const spacingZ = 150;

        return tables.map((table, idx) => {
            const row = Math.floor(idx / cols);
            const col = idx % cols;

            // Offset centered
            const x = (col - (cols - 1) / 2) * spacingX;
            const z = (row - (Math.ceil(tables.length / cols) - 1) / 2) * spacingZ;

            const guests = table.guests || [];
            const seatedCount = guests.length;
            const capacity = table.capacity || 10;
            const isFull = seatedCount >= capacity;
            
            // Shape: Imperial for "Principal" or "Novios" tables
            const nameLower = table.name.toLowerCase();
            const isImperial = nameLower.includes('principal') || nameLower.includes('novios') || nameLower.includes('imperial') || nameLower.includes('larga');

            // Attended guests & Dietary requirements
            const attendedCount = guests.filter(g => g.status === 'attended' || g.attended_at).length;
            const dietaryGuests = guests.filter(g => g.dietary_restrictions && !['ninguna', 'ninguno', 'sin restricciones', 'normal', 'no'].includes(g.dietary_restrictions.toLowerCase().trim()));

            return {
                ...table,
                gridX: x,
                gridZ: z,
                seatedCount,
                capacity,
                isFull,
                isImperial,
                attendedCount,
                hasDietary: dietaryGuests.length > 0,
                dietaryGuests,
            };
        });
    }, [tables]);

    // Drag rotation controls
    const handleMouseDown = (e) => {
        isDraggingRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
        if (!isDraggingRef.current) return;
        const deltaX = e.clientX - lastMouseRef.current.x;
        const deltaY = e.clientY - lastMouseRef.current.y;

        setRotationY(prev => (prev + deltaX * 0.5) % 360);
        setRotationX(prev => Math.min(80, Math.max(25, prev - deltaY * 0.4)));

        lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
    };

    // Print / Export Plano 3D
    const handlePrintPlan = () => {
        window.print();
    };

    return (
        <div className="space-y-4 font-sans">
            {/* TOP BAR CONTROLS FOR WEDDING PLANNER */}
            <div className="p-4 rounded-2xl bg-zinc-900 text-white border border-zinc-800 flex flex-wrap items-center justify-between gap-3 shadow-xl">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-amber-500 via-rose-500 to-amber-600 rounded-xl text-white shadow-md">
                        <Compass className="w-5 h-5 animate-spin-slow" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black tracking-tight flex items-center gap-2">
                            Herramienta 3D de Distribución y Salón
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                Wedding Planner Mode
                            </span>
                        </h3>
                        <p className="text-xs text-zinc-400">
                            Rotá 3D, buscá invitados en tiempo real o activá el Modo Catering para mozos.
                        </p>
                    </div>
                </div>

                {/* SEARCH & FILTERS */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Live Guest Search inside 3D */}
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar invitado en 3D..."
                            className="w-48 text-xs rounded-xl border-zinc-700 bg-zinc-800 text-white pl-8 pr-3 py-1.5 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    {/* Waiter / Catering Mode Toggle */}
                    <button
                        type="button"
                        onClick={() => setWaiterMode(!waiterMode)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                            waiterMode 
                                ? 'bg-amber-400 text-zinc-950 shadow-lg shadow-amber-400/40 ring-2 ring-amber-300 animate-pulse' 
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}
                    >
                        <ChefHat className="w-4 h-4 text-amber-500" />
                        Modo Mozos / Catering
                    </button>

                    {/* Filter Dietary */}
                    <button
                        type="button"
                        onClick={() => setFilterDiet(!filterDiet)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            filterDiet 
                                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-400' 
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}
                    >
                        <Utensils className="w-3.5 h-3.5" />
                        Dietas Especiales
                    </button>

                    {/* Print Plan */}
                    <button
                        type="button"
                        onClick={handlePrintPlan}
                        title="Imprimir o Guardar Plano en PDF"
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold text-zinc-200 transition-colors flex items-center gap-1"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        Exportar Plano
                    </button>

                    <div className="h-6 w-px bg-zinc-800 mx-0.5"></div>

                    {/* Zoom & Rotation Controls */}
                    <button
                        type="button"
                        title="Acercar 3D"
                        onClick={() => setZoom(z => Math.min(1.8, z + 0.15))}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-200 transition-colors"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        title="Alejar 3D"
                        onClick={() => setZoom(z => Math.max(0.6, z - 0.15))}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-200 transition-colors"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        title="Reiniciar Vista 3D"
                        onClick={() => { setRotationY(35); setRotationX(55); setZoom(1); setSearchQuery(''); }}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-200 transition-colors"
                    >
                        <RotateCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* WAITER MODE ALERT BANNER */}
            {waiterMode && (
                <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ChefHat className="w-5 h-5 text-amber-400 animate-bounce" />
                        <span><strong>MODO SERVICIO DE CATERING / MOZOS ACTIVO:</strong> El plano 3D resalta exactamente las sillas de los invitados que requieren menú especial (Celíacos 🌾, Lactosa 🥛, Veganos 🥬).</span>
                    </div>
                    <button onClick={() => setWaiterMode(false)} className="text-amber-400 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* 3D SCENE CONTAINER */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div 
                    className="lg:col-span-3 h-[600px] bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 rounded-2xl border border-zinc-800 relative overflow-hidden select-none cursor-grab active:cursor-grabbing flex items-center justify-center shadow-2xl"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Stage / Pista de Baile Accent */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-2xl bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black tracking-widest uppercase shadow-xl flex items-center gap-2 pointer-events-none z-20">
                        <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                        Escenario Principal · Pista de Baile
                        <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    </div>

                    {/* Leyenda flotante 3D */}
                    <div className="absolute bottom-4 left-4 p-3 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-zinc-800 text-[11px] text-zinc-300 space-y-1.5 pointer-events-none shadow-xl z-20">
                        <div className="font-bold text-white mb-1">Leyenda 3D:</div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
                            <span>En el salón (Acreditado ✅)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></span>
                            <span>Confirmado (Por llegar)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></span>
                            <span>Menú Especial (🥛 / 🌾)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-zinc-700"></span>
                            <span>Silla Libre</span>
                        </div>
                    </div>

                    {/* 3D CANVAS PERSPECTIVE TRANSFORM WRAPPER */}
                    <div 
                        className="transition-transform duration-75 ease-out flex items-center justify-center"
                        style={{
                            transform: `scale(${zoom}) rotateX(${rotationX}deg) rotateZ(${rotationY}deg)`,
                            transformStyle: 'preserve-3d',
                            perspective: '1000px',
                            width: '650px',
                            height: '520px',
                        }}
                    >
                        {/* 3D Floor Grid */}
                        <div 
                            className="absolute inset-0 rounded-3xl border-2 border-amber-500/20 bg-zinc-900/90 shadow-2xl"
                            style={{
                                backgroundImage: `radial-gradient(circle, rgba(244,63,94,0.12) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)`,
                                backgroundSize: '30px 30px',
                                transformStyle: 'preserve-3d',
                                boxShadow: '0 30px 60px rgba(0,0,0,0.8), inset 0 0 80px rgba(0,0,0,0.9)'
                            }}
                        >
                            {/* TABLES RENDERED IN 3D SPACE */}
                            {positionedTables.map((table) => {
                                const isSelected = selectedTableId === table.id;
                                const isSearchMatch = searchMatchTableId === table.id;
                                const isHighlighted = (filterDiet && table.hasDietary) || (filterPendingArrival && table.attendedCount < table.seatedCount);
                                
                                return (
                                    <div
                                        key={table.id}
                                        onClick={(e) => { e.stopPropagation(); setSelectedTableId(table.id); if (onSelectTable) onSelectTable(table); }}
                                        className="absolute cursor-pointer transition-all duration-300 group"
                                        style={{
                                            left: `calc(50% + ${table.gridX}px)`,
                                            top: `calc(50% + ${table.gridZ}px)`,
                                            transform: `translate(-50%, -50%) translateZ(${isSelected || isSearchMatch ? '30px' : '0px'})`,
                                            transformStyle: 'preserve-3d'
                                        }}
                                    >
                                        {/* 3D TABLE SHADOW */}
                                        <div className="absolute inset-0 -bottom-4 bg-black/60 blur-md rounded-full transform scale-125"></div>

                                        {/* 3D TABLE BODY (ROUND VS IMPERIAL SHAPE) */}
                                        <div 
                                            className={`relative flex flex-col items-center justify-center border-2 transition-all duration-300 shadow-2xl ${
                                                table.isImperial ? 'w-40 h-24 rounded-2xl' : 'w-28 h-28 rounded-full'
                                            } ${
                                                isSearchMatch
                                                    ? 'bg-gradient-to-br from-amber-400 via-rose-500 to-amber-500 border-white ring-8 ring-amber-400 animate-bounce scale-125 z-30'
                                                    : isSelected
                                                    ? 'bg-gradient-to-br from-rose-600 to-amber-600 border-white ring-8 ring-rose-500/40 scale-110'
                                                    : waiterMode && table.hasDietary
                                                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 border-amber-200 ring-6 ring-amber-400/60 scale-105'
                                                    : isHighlighted
                                                    ? 'bg-gradient-to-br from-amber-600 to-amber-700 border-amber-300 ring-4 ring-amber-400/50'
                                                    : table.isFull
                                                    ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-rose-500/50'
                                                    : table.seatedCount > 0
                                                    ? 'bg-gradient-to-br from-emerald-900/90 to-teal-950 border-emerald-500/60'
                                                    : 'bg-zinc-900/90 border-zinc-700'
                                            }`}
                                            style={{
                                                transform: `rotateZ(${-rotationY}deg) rotateX(${-rotationX}deg)`,
                                                transformStyle: 'preserve-3d'
                                            }}
                                        >
                                            {/* Table Name */}
                                            <span className="text-xs font-black text-white drop-shadow-md text-center px-1 truncate max-w-[90%]">
                                                {table.name}
                                            </span>

                                            {/* Seated Count Badge */}
                                            <div className="mt-0.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[10px] font-black text-emerald-300 flex items-center gap-1">
                                                <span>{table.seatedCount}/{table.capacity}</span>
                                            </div>

                                            {/* Dietary Warning Badge */}
                                            {table.hasDietary && (
                                                <div className="absolute -top-2 -right-2 p-1.5 bg-amber-500 text-zinc-950 rounded-full shadow-lg border border-white font-black text-[10px] flex items-center gap-0.5">
                                                    <Utensils className="w-3 h-3" />
                                                    <span>{table.dietaryGuests.length}</span>
                                                </div>
                                            )}

                                            {/* 3D SEATED CHAIRS / GUEST AVATARS AROUND TABLE */}
                                            {Array.from({ length: table.capacity }).map((_, seatIdx) => {
                                                const angle = (seatIdx / table.capacity) * (2 * Math.PI);
                                                const radiusX = table.isImperial ? 85 : 62;
                                                const radiusY = table.isImperial ? 52 : 62;
                                                const chairX = Math.cos(angle) * radiusX;
                                                const chairY = Math.sin(angle) * radiusY;

                                                const guest = table.guests?.[seatIdx] || null;
                                                const isAttended = guest && (guest.status === 'attended' || guest.attended_at);
                                                const isDiet = guest && guest.dietary_restrictions && !['ninguna', 'ninguno', 'sin restricciones', 'normal', 'no'].includes(guest.dietary_restrictions.toLowerCase().trim());

                                                return (
                                                    <div
                                                        key={seatIdx}
                                                        title={guest ? `${guest.name} (${isAttended ? 'En el evento ✅' : 'Confirmado'}${isDiet ? ` · ${guest.dietary_restrictions}` : ''})` : 'Silla Libre'}
                                                        className={`absolute w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-300 shadow-md ${
                                                            waiterMode && isDiet
                                                                ? 'bg-amber-400 border-white ring-4 ring-amber-300 scale-125 animate-bounce'
                                                                : isAttended
                                                                ? 'bg-emerald-500 border-white shadow-emerald-500/80 scale-110'
                                                                : isDiet
                                                                ? 'bg-amber-500 border-white shadow-amber-500/80 scale-110'
                                                                : guest
                                                                ? 'bg-blue-500 border-blue-200 shadow-blue-500/80'
                                                                : 'bg-zinc-800/80 border-zinc-700/60 opacity-60'
                                                        }`}
                                                        style={{
                                                            left: `calc(50% + ${chairX}px - 10px)`,
                                                            top: `calc(50% + ${chairY}px - 10px)`,
                                                        }}
                                                    >
                                                        {guest && (
                                                            <span className="text-[8px] font-black text-white">
                                                                {isAttended ? '✓' : isDiet ? '🍽️' : seatIdx + 1}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* SIDE DETAILS PANEL (WEDDING PLANNER TOOLKIT) */}
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 text-white flex flex-col justify-between h-[600px] overflow-y-auto space-y-4">
                    {selectedTable ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                                        Detalles de Mesa 3D
                                    </span>
                                    <h4 className="text-xl font-extrabold text-white flex items-center gap-2">
                                        {selectedTable.name}
                                        {selectedTable.isImperial && (
                                            <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-md border border-amber-500/30">Imperial</span>
                                        )}
                                    </h4>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedTableId(null)}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Table Capacity & Attendance Stats */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/60">
                                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Capacidad</div>
                                    <div className="text-lg font-black text-white">{selectedTable.seatedCount} / {selectedTable.capacity} pers.</div>
                                </div>
                                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50">
                                    <div className="text-[10px] font-bold text-emerald-400 uppercase">En el Evento</div>
                                    <div className="text-lg font-black text-emerald-300">{selectedTable.attendedCount} ingresados</div>
                                </div>
                            </div>

                            {/* Quick Seat Guest from Unassigned */}
                            {unassignedGuests.length > 0 && selectedTable.seatedCount < selectedTable.capacity && (
                                <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/60 space-y-2">
                                    <label className="text-[11px] font-extrabold text-amber-300 flex items-center gap-1">
                                        <UserPlus className="w-3.5 h-3.5" /> Sentar a alguien sin mesa aquí:
                                    </label>
                                    <div className="flex gap-2">
                                        <select
                                            value={quickSeatGuestId}
                                            onChange={(e) => setQuickSeatGuestId(e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-700 bg-zinc-900 text-white p-2 font-medium outline-none"
                                        >
                                            <option value="">-- Seleccionar Invitado --</option>
                                            {unassignedGuests.map(g => (
                                                <option key={g.id} value={g.id}>{g.name} ({g.passes} pases)</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            disabled={!quickSeatGuestId}
                                            onClick={() => {
                                                if (onAssignGuest && quickSeatGuestId) {
                                                    onAssignGuest(parseInt(quickSeatGuestId, 10), selectedTable.name);
                                                    setQuickSeatGuestId('');
                                                }
                                            }}
                                            className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-black rounded-xl disabled:opacity-50 shrink-0"
                                        >
                                            Sentar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Seated Guests List */}
                            <div className="space-y-2">
                                <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                                    <span>Invitados en esta mesa ({selectedTable.guests?.length || 0})</span>
                                </h5>

                                {selectedTable.guests && selectedTable.guests.length > 0 ? (
                                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                                        {selectedTable.guests.map((g, idx) => {
                                            const isAttended = g.status === 'attended' || g.attended_at;
                                            const hasDiet = g.dietary_restrictions && !['ninguna', 'ninguno', 'sin restricciones', 'normal', 'no'].includes(g.dietary_restrictions.toLowerCase().trim());

                                            return (
                                                <div 
                                                    key={g.id || idx}
                                                    className="p-2.5 rounded-xl bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-between gap-2"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="w-5 h-5 rounded-full bg-zinc-700 text-[10px] font-bold flex items-center justify-center text-zinc-300 shrink-0">
                                                            {idx + 1}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-bold text-white truncate">{g.name}</div>
                                                            {hasDiet && (
                                                                <div className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                                                                    <Utensils className="w-3 h-3" />
                                                                    {g.dietary_restrictions}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                            isAttended 
                                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                        }`}>
                                                            {isAttended ? '✅ En Salón' : '⏳ Confirmado'}
                                                        </span>

                                                        {onMoveGuest && (
                                                            <button
                                                                type="button"
                                                                title="Mover de mesa"
                                                                onClick={() => setMovingGuestId(g.id)}
                                                                className="p-1 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-700"
                                                            >
                                                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-800 text-center text-xs text-zinc-500">
                                        Esta mesa no tiene invitados aún.
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-3">
                            <div className="p-4 rounded-full bg-zinc-800/60 border border-zinc-800 text-zinc-400">
                                <ChefHat className="w-8 h-8 text-amber-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white">Modo Inspección Wedding Planner</h4>
                                <p className="text-xs text-zinc-400 mt-1">
                                    Tocá cualquier mesa 3D para sentar invitados sin mesa, mover de lugar o consultar requerimientos de catering.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
