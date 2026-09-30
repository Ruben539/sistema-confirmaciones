import React, { useState, useRef, useMemo, useEffect } from 'react';
import { hasDiet, seatsOf, guestState, VENUE_ITEMS, snap, shapeOf, tableSize, chairPositions, autoGrid, defaultVenue, buildLayout, floorSize } from '../seating';
import { RotateCw, ZoomIn, ZoomOut, Search, Utensils, Sparkles, X, Compass, Printer, UserPlus, ChefHat, MapPin, Eye, Layers, Move, Save, RotateCcw, Radio, Users, AlertTriangle, Wand2, GripVertical, Music, Info } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATE_INFO = {
    attended: { label: 'En el salón', chair: 'bg-emerald-500 border-emerald-200 shadow-emerald-500/70', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    confirmed: { label: 'Confirmado · por llegar', chair: 'bg-blue-600 border-blue-300 shadow-blue-500/70', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    pending: { label: 'Sin responder', chair: 'bg-zinc-600 border-amber-300/80 border-dashed', badge: 'bg-zinc-700/60 text-zinc-300 border-zinc-600' },
};

const SHAPES = [
    { id: 'round', label: 'Redonda' },
    { id: 'imperial', label: 'Imperial' },
    { id: 'square', label: 'Cuadrada' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Visual3DTableMap({ tables = [], unassignedGuests = [], venueLayout = null, onAssignGuest, onSaveLayout, onRefresh, onExport }) {
    const [selectedTableId, setSelectedTableId] = useState(null);
    const [rotationY, setRotationY] = useState(35);
    const [rotationX, setRotationX] = useState(55);
    const [zoom, setZoom] = useState(1);

    const [searchQuery, setSearchQuery] = useState('');
    const [waiterMode, setWaiterMode] = useState(false);
    const [dayMode, setDayMode] = useState(false);
    const [filterPendingArrival, setFilterPendingArrival] = useState(false);

    // Layout editing ("Armar salón")
    const [editMode, setEditMode] = useState(false);
    const [draft, setDraft] = useState(null); // { tables: {id: {x,y,shape,rotation}}, venue: {...} }
    const [savingLayout, setSavingLayout] = useState(false);
    const savedCameraRef = useRef(null);
    const itemDragRef = useRef(null);
    const [draggingItem, setDraggingItem] = useState(false);

    // Guest seating
    const [draggedGuest, setDraggedGuest] = useState(null);
    const [dropTargetId, setDropTargetId] = useState(null);
    const [pendingSeat, setPendingSeat] = useState(null); // over-capacity confirmation
    const [quickSeatGuestId, setQuickSeatGuestId] = useState('');
    const [unassignedSearch, setUnassignedSearch] = useState('');
    const [notice, setNotice] = useState(null);
    const [showLegend, setShowLegend] = useState(false);

    // Scene rotation
    const sceneRef = useRef(null);
    const rotateDragRef = useRef(null);
    const movedRef = useRef(false);

    // --- Layout: saved positions, falling back to the automatic grid ---------
    const savedLayout = useMemo(() => buildLayout(tables, venueLayout), [tables, venueLayout]);

    const layout = editMode && draft ? draft : savedLayout;

    // --- Tables enriched with geometry and seats (one chair per person) -----
    const positionedTables = useMemo(() => tables.map(table => {
        const pos = layout.tables[table.id] || { x: 0, y: 0, shape: shapeOf(table), rotation: 0 };
        const capacity = table.capacity || 10;
        const size = tableSize(pos.shape, capacity);
        const guests = table.guests || [];

        const seats = [];
        guests.forEach(g => {
            for (let k = 0; k < seatsOf(g); k++) seats.push({ guest: g, companion: k });
        });
        const chairCount = Math.max(capacity, seats.length);

        const occupied = table.occupied_passes ?? seats.length;
        const attendedSeats = seats.filter(s => guestState(s.guest) === 'attended').length;
        const awaitingSeats = seats.filter(s => guestState(s.guest) === 'confirmed').length;

        return {
            ...table,
            ...pos,
            ...size,
            capacity,
            seats,
            chairs: chairPositions(pos.shape, chairCount, size.w, size.h),
            occupied,
            free: capacity - occupied,
            isFull: occupied >= capacity,
            isOver: occupied > capacity,
            attendedSeats,
            awaitingSeats,
            dietaryGuests: guests.filter(hasDiet),
        };
    }), [tables, layout]);

    const selectedTable = positionedTables.find(t => t.id === selectedTableId) || null;

    // Floor size: fit every table and venue element, centered on 0,0
    const { floorWidth, floorHeight } = useMemo(() => floorSize(positionedTables, layout.venue), [positionedTables, layout]);

    // --- Search: highlight every matching table ------------------------------
    const search = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (q.length < 2) return { tableIds: new Set(), results: [] };
        const tableIds = new Set();
        const results = [];
        positionedTables.forEach(t => {
            if (t.name.toLowerCase().includes(q)) tableIds.add(t.id);
            (t.guests || []).forEach(g => {
                if (g.name.toLowerCase().includes(q) || (g.companions || '').toLowerCase().includes(q)) {
                    tableIds.add(t.id);
                    results.push({ guest: g, table: t });
                }
            });
        });
        unassignedGuests.forEach(g => {
            if (g.name.toLowerCase().includes(q) || (g.companions || '').toLowerCase().includes(q)) {
                results.push({ guest: g, table: null });
            }
        });
        return { tableIds, results };
    }, [searchQuery, positionedTables, unassignedGuests]);

    // --- Day of the event: live counters and auto-refresh --------------------
    const dayStats = useMemo(() => {
        let attended = 0, awaiting = 0, pending = 0;
        positionedTables.forEach(t => t.seats.forEach(s => {
            const st = guestState(s.guest);
            if (st === 'attended') attended++;
            else if (st === 'confirmed') awaiting++;
            else pending++;
        }));
        return { attended, awaiting, pending };
    }, [positionedTables]);

    // Keep the latest callback in a ref so re-renders don't restart the 30 s timer
    const onRefreshRef = useRef(onRefresh);
    onRefreshRef.current = onRefresh;

    useEffect(() => {
        if (!dayMode || editMode) return;
        const id = setInterval(() => onRefreshRef.current?.(), 30000);
        return () => clearInterval(id);
    }, [dayMode, editMode]);

    useEffect(() => {
        if (!notice) return;
        const id = setTimeout(() => setNotice(null), 3500);
        return () => clearTimeout(id);
    }, [notice]);

    // --- Mouse wheel zoom (non-passive so the page doesn't scroll) -----------
    useEffect(() => {
        const el = sceneRef.current;
        if (!el) return;
        const onWheel = (e) => {
            e.preventDefault();
            setZoom(z => Math.min(2, Math.max(0.4, Number((z - e.deltaY * 0.0015).toFixed(2)))));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    // --- Scene rotation (disabled while editing the layout) ------------------
    const handleScenePointerDown = (e) => {
        if (editMode || e.button > 0) return;
        rotateDragRef.current = { x: e.clientX, y: e.clientY };
        movedRef.current = false;
    };

    const handleScenePointerMove = (e) => {
        if (itemDragRef.current) return;
        const start = rotateDragRef.current;
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (!movedRef.current && Math.abs(dx) + Math.abs(dy) < 4) return;
        movedRef.current = true;
        setRotationY(prev => (prev + dx * 0.5) % 360);
        setRotationX(prev => Math.min(80, Math.max(0, prev - dy * 0.4)));
        rotateDragRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleScenePointerUp = () => {
        rotateDragRef.current = null;
        // Keep movedRef until the click event that follows has been ignored
        setTimeout(() => { movedRef.current = false; }, 0);
    };

    // --- Layout editing -------------------------------------------------------
    const startEditMode = () => {
        savedCameraRef.current = { rotationX, rotationY };
        setRotationX(0);
        setRotationY(0);
        setDraft(JSON.parse(JSON.stringify(savedLayout)));
        setEditMode(true);
        setWaiterMode(false);
    };

    const exitEditMode = () => {
        setEditMode(false);
        setDraft(null);
        if (savedCameraRef.current) {
            setRotationX(savedCameraRef.current.rotationX);
            setRotationY(savedCameraRef.current.rotationY);
        }
    };

    const autoArrange = () => {
        const auto = autoGrid(tables);
        setDraft(prev => {
            const next = { tables: {}, venue: defaultVenue(auto) };
            tables.forEach(t => { next.tables[t.id] = { ...prev.tables[t.id], ...auto[t.id] }; });
            return next;
        });
    };

    const updateDraftTable = (id, patch) => {
        setDraft(prev => ({ ...prev, tables: { ...prev.tables, [id]: { ...prev.tables[id], ...patch } } }));
    };

    const saveLayout = async () => {
        if (!onSaveLayout || !draft) return;
        setSavingLayout(true);
        const ok = await onSaveLayout({
            tables: Object.entries(draft.tables).map(([id, p]) => ({ id: Number(id), pos_x: p.x, pos_y: p.y, shape: p.shape, rotation: p.rotation })),
            venue: draft.venue,
        });
        setSavingLayout(false);
        if (ok) exitEditMode();
    };

    const startItemDrag = (e, kind, id) => {
        if (!editMode) return;
        e.stopPropagation();
        e.preventDefault();
        const current = kind === 'table' ? draft.tables[id] : draft.venue[id];
        itemDragRef.current = { kind, id, startX: e.clientX, startY: e.clientY, origX: current.x, origY: current.y };
        setDraggingItem(true);
        if (kind === 'table') setSelectedTableId(id);
    };

    useEffect(() => {
        if (!draggingItem) return;
        const onMove = (e) => {
            const d = itemDragRef.current;
            if (!d) return;
            // The plan is flat (top-down) while editing, so screen deltas map 1:1 to floor deltas
            const x = snap(d.origX + (e.clientX - d.startX) / zoom);
            const y = snap(d.origY + (e.clientY - d.startY) / zoom);
            setDraft(prev => d.kind === 'table'
                ? { ...prev, tables: { ...prev.tables, [d.id]: { ...prev.tables[d.id], x, y } } }
                : { ...prev, venue: { ...prev.venue, [d.id]: { x, y } } });
        };
        const onUp = () => {
            itemDragRef.current = null;
            setDraggingItem(false);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [draggingItem, zoom]);

    // --- Seating guests (drag & drop or quick select) -------------------------
    const requestSeat = (guest, table, force = false) => {
        if (!guest || !table || !onAssignGuest) return;
        if ((table.guests || []).some(g => g.id === guest.id)) return;
        const needed = seatsOf(guest);
        if (!force && needed > table.free) {
            setPendingSeat({ guest, table, needed });
            return;
        }
        onAssignGuest(guest.id, table.name);
        setNotice(`${guest.name}${needed > 1 ? ` (+${needed - 1})` : ''} → ${table.name}`);
        setPendingSeat(null);
    };

    const handleGuestDragStart = (e, guest) => {
        e.dataTransfer.setData('text/plain', String(guest.id));
        e.dataTransfer.effectAllowed = 'move';
        setDraggedGuest(guest);
    };

    const handleGuestDragEnd = () => {
        setDraggedGuest(null);
        setDropTargetId(null);
    };

    const handleTableDrop = (e, table) => {
        e.preventDefault();
        setDropTargetId(null);
        if (draggedGuest) requestSeat(draggedGuest, table);
        setDraggedGuest(null);
    };

    const filteredUnassigned = useMemo(() => {
        const q = unassignedSearch.toLowerCase().trim();
        return q ? unassignedGuests.filter(g => g.name.toLowerCase().includes(q) || (g.companions || '').toLowerCase().includes(q)) : unassignedGuests;
    }, [unassignedGuests, unassignedSearch]);

    const unassignedSeats = unassignedGuests.reduce((acc, g) => acc + seatsOf(g), 0);

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------

    const toolbarBtn = (active, activeCls) => `px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${active ? activeCls : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;

    return (
        <div className="space-y-4 font-sans">
            {/* TOP BAR */}
            <div className="p-4 rounded-2xl bg-zinc-900 text-white border border-zinc-800 flex flex-wrap items-center justify-between gap-3 shadow-xl">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-amber-500 via-rose-500 to-amber-600 rounded-xl text-white shadow-md">
                        <Compass className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black tracking-tight">Plano 3D del Salón</h3>
                        <p className="text-xs text-zinc-400">
                            {editMode
                                ? 'Vista desde arriba: arrastrá mesas, pista, escenario y entrada. Se alinean solas a una grilla.'
                                : 'Arrastrá invitados a las mesas · girá el plano con el mouse · rueda para zoom.'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {editMode ? (
                        <>
                            <button type="button" onClick={autoArrange} className={toolbarBtn(false)}>
                                <Wand2 className="w-3.5 h-3.5 text-amber-400" /> Ordenar automático
                            </button>
                            <button type="button" onClick={exitEditMode} className={toolbarBtn(false)}>
                                <RotateCcw className="w-3.5 h-3.5" /> Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={saveLayout}
                                disabled={savingLayout}
                                className="px-4 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md flex items-center gap-1.5 disabled:opacity-60"
                            >
                                <Save className="w-3.5 h-3.5" /> {savingLayout ? 'Guardando...' : 'Guardar plano'}
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar invitado o mesa..."
                                    className="w-48 text-xs rounded-xl border-zinc-700 bg-zinc-800 text-white pl-8 pr-3 py-1.5 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <button type="button" onClick={startEditMode} className={toolbarBtn(false)} title="Ubicar mesas, pista, escenario y entrada">
                                <Move className="w-3.5 h-3.5 text-sky-400" /> Armar salón
                            </button>

                            <button
                                type="button"
                                onClick={() => { setDayMode(!dayMode); setFilterPendingArrival(false); }}
                                className={toolbarBtn(dayMode, 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/30')}
                                title="Estado de llegada en vivo, se actualiza cada 30 segundos"
                            >
                                <Radio className={`w-3.5 h-3.5 ${dayMode ? 'animate-pulse' : 'text-emerald-400'}`} /> Día del evento
                            </button>

                            <button
                                type="button"
                                onClick={() => setWaiterMode(!waiterMode)}
                                className={toolbarBtn(waiterMode, 'bg-amber-400 text-zinc-950 shadow-lg shadow-amber-400/40')}
                            >
                                <ChefHat className="w-4 h-4" /> Mozos / Menús
                            </button>
                        </>
                    )}

                    <div className="h-6 w-px bg-zinc-800 mx-1"></div>

                    {!editMode && (
                        <div className="flex items-center bg-zinc-800/80 p-0.5 rounded-xl border border-zinc-700/60">
                            <button
                                type="button"
                                onClick={() => { setRotationX(55); setRotationY(35); }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${rotationX !== 0 ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white' : 'text-zinc-400 hover:text-white'}`}
                            >
                                <Layers className="w-3.5 h-3.5" /> 3D
                            </button>
                            <button
                                type="button"
                                onClick={() => { setRotationX(0); setRotationY(0); }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${rotationX === 0 ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white' : 'text-zinc-400 hover:text-white'}`}
                            >
                                <Eye className="w-3.5 h-3.5" /> 2D
                            </button>
                        </div>
                    )}

                    <button type="button" title="Acercar" onClick={() => setZoom(z => Math.min(2, Number((z + 0.15).toFixed(2))))} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-200">
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <button type="button" title="Alejar" onClick={() => setZoom(z => Math.max(0.4, Number((z - 0.15).toFixed(2))))} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-200">
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    {!editMode && (
                        <>
                            <button type="button" title="Reiniciar vista" onClick={() => { setRotationY(35); setRotationX(55); setZoom(1); setSearchQuery(''); }} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-200">
                                <RotateCw className="w-4 h-4" />
                            </button>
                            {onExport && (
                                <button type="button" onClick={onExport} title="Plano, listas y reportes para imprimir o Excel" className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold text-zinc-200 flex items-center gap-1">
                                    <Printer className="w-3.5 h-3.5" /> Exportar
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* DAY OF THE EVENT BAR */}
            {dayMode && !editMode && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-4 font-bold">
                        <span className="text-emerald-300">✅ {dayStats.attended} en el salón</span>
                        <span className="text-blue-300">🕒 {dayStats.awaiting} confirmados por llegar</span>
                        <span className="text-zinc-400">⏳ {dayStats.pending} sin responder</span>
                        <span className="text-zinc-500 font-medium">Se actualiza cada 30 s</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFilterPendingArrival(!filterPendingArrival)}
                        className={toolbarBtn(filterPendingArrival, 'bg-blue-500 text-white')}
                    >
                        <Users className="w-3.5 h-3.5" /> Resaltar mesas con gente por llegar
                    </button>
                </div>
            )}

            {waiterMode && !editMode && (
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ChefHat className="w-5 h-5 text-amber-400" />
                        <span>Modo mozos: se resaltan las sillas y mesas con menú especial (celíacos, lactosa, veganos).</span>
                    </div>
                    <button onClick={() => setWaiterMode(false)} className="text-amber-400 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* 3D SCENE */}
                <div
                    ref={sceneRef}
                    className={`lg:col-span-3 h-[620px] bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 rounded-2xl border border-zinc-800 relative overflow-hidden select-none flex items-center justify-center shadow-2xl ${editMode ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
                    style={{ perspective: '1400px', touchAction: 'none' }}
                    onPointerDown={handleScenePointerDown}
                    onPointerMove={handleScenePointerMove}
                    onPointerUp={handleScenePointerUp}
                    onPointerLeave={handleScenePointerUp}
                >
                    {/* Legend: small toggle so it doesn't cover the plan; hidden while arranging */}
                    {!editMode && (
                        <div
                            className="absolute bottom-3 left-3 z-20"
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            {showLegend ? (
                                <div className="p-3 rounded-xl bg-zinc-900/95 backdrop-blur-md border border-zinc-800 text-[11px] text-zinc-300 space-y-1.5 shadow-xl">
                                    <div className="flex items-center justify-between gap-4 mb-1">
                                        <span className="font-bold text-white">Sillas (una por persona)</span>
                                        <button type="button" onClick={() => setShowLegend(false)} className="text-zinc-500 hover:text-white" title="Ocultar leyenda">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    {Object.entries(STATE_INFO).map(([key, info]) => (
                                        <div key={key} className="flex items-center gap-2">
                                            <span className={`w-3 h-3 rounded-full border ${info.chair}`}></span>
                                            <span>{info.label}</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-200"></span>
                                        <span>Menú especial (modo mozos)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-zinc-800 border border-zinc-600"></span>
                                        <span>Libre</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-rose-600 ring-2 ring-rose-400"></span>
                                        <span>Sobrepasa la capacidad</span>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowLegend(true)}
                                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[11px] font-bold text-zinc-300 hover:text-white flex items-center gap-1.5 shadow-xl"
                                >
                                    <Info className="w-3.5 h-3.5" /> Leyenda
                                </button>
                            )}
                        </div>
                    )}

                    {notice && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-zinc-900/95 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-xl pointer-events-none">
                            {notice}
                        </div>
                    )}


                    {tables.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                            <p className="text-sm text-zinc-500">Todavía no hay mesas. Creá mesas desde la vista de tarjetas.</p>
                        </div>
                    )}

                    {/* SCENE TRANSFORM */}
                    <div
                        className="relative transition-transform duration-100 ease-out"
                        style={{
                            transform: `scale(${zoom}) rotateX(${rotationX}deg) rotateZ(${rotationY}deg)`,
                            transformStyle: 'preserve-3d',
                            width: `${floorWidth}px`,
                            height: `${floorHeight}px`,
                            flexShrink: 0,
                        }}
                    >
                        {/* Floor */}
                        <div
                            className="absolute inset-0 rounded-3xl border-2 border-amber-500/25 bg-zinc-950/95"
                            style={{
                                backgroundImage: `radial-gradient(circle, rgba(245, 158, 11, 0.15) 1.5px, transparent 1.5px), linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)`,
                                backgroundSize: '40px 40px',
                                backgroundPosition: 'center',
                                transformStyle: 'preserve-3d',
                                boxShadow: '0 35px 80px rgba(0,0,0,0.9), inset 0 0 120px rgba(0,0,0,0.95)'
                            }}
                        >
                            {/* Venue elements: stage, dance floor, entrance */}
                            {Object.entries(layout.venue).map(([key, p]) => {
                                const v = VENUE_ITEMS[key];
                                const style = key === 'dance'
                                    ? 'border-amber-400/40 text-amber-300'
                                    : key === 'stage'
                                    ? 'border-rose-400/40 bg-gradient-to-r from-rose-500/20 via-amber-500/20 to-rose-500/20 text-rose-200'
                                    : 'border-zinc-600 bg-zinc-900/80 text-zinc-400';
                                return (
                                    <div
                                        key={key}
                                        onPointerDown={(e) => startItemDrag(e, 'venue', key)}
                                        className={`absolute rounded-2xl border-2 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest ${style} ${editMode ? 'cursor-move ring-2 ring-sky-400/50' : 'pointer-events-none'}`}
                                        style={{
                                            left: `calc(50% + ${p.x}px)`,
                                            top: `calc(50% + ${p.y}px)`,
                                            width: v.w,
                                            height: v.h,
                                            transform: 'translate(-50%, -50%) translateZ(1px)',
                                            // Checkered dance floor
                                            ...(key === 'dance' ? { backgroundImage: 'repeating-conic-gradient(rgba(245,158,11,0.14) 0% 25%, transparent 0% 50%)', backgroundSize: '28px 28px' } : {}),
                                        }}
                                    >
                                        {key === 'entrance' ? <MapPin className="w-3.5 h-3.5 text-rose-400" /> : key === 'dance' ? <Music className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                                        {v.label}
                                    </div>
                                );
                            })}

                            {/* Tables */}
                            {positionedTables.map((table) => {
                                const isSelected = selectedTableId === table.id;
                                const isSearchMatch = search.tableIds.has(table.id);
                                const isDropTarget = dropTargetId === table.id;
                                const dimmed = filterPendingArrival && table.awaitingSeats === 0;
                                const highlightPending = filterPendingArrival && table.awaitingSeats > 0;
                                const waiterHighlight = waiterMode && table.dietaryGuests.length > 0;

                                const surfaceCls = isDropTarget
                                    ? (seatsOf(draggedGuest) > table.free ? 'bg-rose-900/90 border-rose-300 ring-8 ring-rose-500/50' : 'bg-emerald-800/90 border-emerald-200 ring-8 ring-emerald-400/60')
                                    : isSearchMatch
                                    ? 'bg-gradient-to-br from-amber-500 via-rose-600 to-amber-500 border-white ring-8 ring-amber-400 animate-pulse'
                                    : isSelected
                                    ? 'bg-gradient-to-br from-rose-800 via-amber-900 to-rose-900 border-white ring-4 ring-rose-400'
                                    : waiterHighlight
                                    ? 'bg-gradient-to-br from-amber-800 via-orange-900 to-amber-800 border-amber-300 ring-4 ring-amber-400'
                                    : highlightPending
                                    ? 'bg-gradient-to-br from-blue-900 to-blue-950 border-blue-300 ring-4 ring-blue-400/60'
                                    : table.isOver
                                    ? 'bg-rose-950/90 border-rose-500'
                                    : table.isFull
                                    ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-amber-500/50'
                                    : table.occupied > 0
                                    ? 'bg-gradient-to-br from-emerald-900/95 via-teal-950 to-emerald-950 border-emerald-400/60'
                                    : 'bg-zinc-900/95 border-zinc-700/70';

                                return (
                                    <div
                                        key={table.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (movedRef.current) return; // ended a rotation drag, not a click
                                            setSelectedTableId(table.id);
                                        }}
                                        onPointerDown={(e) => startItemDrag(e, 'table', table.id)}
                                        onDragOver={(e) => { if (draggedGuest) { e.preventDefault(); setDropTargetId(table.id); } }}
                                        onDragLeave={() => setDropTargetId(prev => (prev === table.id ? null : prev))}
                                        onDrop={(e) => handleTableDrop(e, table)}
                                        className={`absolute transition-opacity duration-300 ${editMode ? 'cursor-move' : 'cursor-pointer'} ${dimmed ? 'opacity-30' : ''}`}
                                        style={{
                                            left: `calc(50% + ${table.x}px)`,
                                            top: `calc(50% + ${table.y}px)`,
                                            width: table.w,
                                            height: table.h,
                                            transform: `translate(-50%, -50%) translateZ(${isSelected || isSearchMatch ? 18 : 6}px)`,
                                            transformStyle: 'preserve-3d',
                                        }}
                                    >
                                        {/* Surface + chairs (rotated together) */}
                                        <div
                                            className={`absolute inset-0 border-2 transition-colors duration-300 shadow-2xl flex items-center justify-center ${table.shape === 'round' ? 'rounded-full' : 'rounded-2xl'} ${surfaceCls}`}
                                            style={{
                                                transform: `rotateZ(${table.rotation}deg)`,
                                                transformStyle: 'preserve-3d',
                                                boxShadow: '0 12px 25px rgba(0,0,0,0.7), inset 0 2px 4px rgba(255,255,255,0.2)',
                                            }}
                                        >
                                            <div className="w-10 h-10 rounded-full border border-white/15 bg-black/40 flex items-center justify-center pointer-events-none">
                                                <span className="text-xs text-amber-400/70">✨</span>
                                            </div>

                                            {table.chairs.map((c, seatIdx) => {
                                                const seat = table.seats[seatIdx] || null;
                                                const overflow = seatIdx >= table.capacity;
                                                const g = seat?.guest;
                                                const state = g ? guestState(g) : null;
                                                const diet = g && hasDiet(g) && seat.companion === 0;
                                                const title = g
                                                    ? `${g.name}${seat.companion > 0 ? ` · acompañante ${seat.companion}` : ''} (${STATE_INFO[state].label}${diet ? ` · ${g.dietary_restrictions}` : ''})`
                                                    : `Silla ${seatIdx + 1} (libre)`;

                                                const chairCls = overflow
                                                    ? 'bg-rose-600 border-rose-200 ring-2 ring-rose-400'
                                                    : waiterMode && diet
                                                    ? 'bg-amber-400 border-white ring-4 ring-amber-300 scale-125 z-20'
                                                    : g
                                                    ? STATE_INFO[state].chair
                                                    : 'bg-zinc-800/90 border-zinc-700/60 opacity-60';

                                                return (
                                                    <div
                                                        key={seatIdx}
                                                        title={title}
                                                        className={`absolute w-[22px] h-[22px] rounded-full border flex items-center justify-center shadow-md transition-colors ${chairCls}`}
                                                        style={{
                                                            left: `calc(50% + ${c.x}px - 11px)`,
                                                            top: `calc(50% + ${c.y}px - 11px)`,
                                                            transform: 'translateZ(2px)',
                                                        }}
                                                    >
                                                        {g && (
                                                            <span className="text-[9px] font-black text-white drop-shadow" style={{ transform: `rotateZ(${-table.rotation}deg)` }}>
                                                                {state === 'attended' ? '✓' : diet && waiterMode ? '🍽' : seat.companion > 0 ? '+' : (g.name || '?').charAt(0).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Floating label, always facing the camera */}
                                        <div
                                            className="absolute left-1/2 top-1/2 pointer-events-none z-30 flex flex-col items-center"
                                            style={{
                                                transform: `translate(-50%, -50%) translateZ(30px) rotateZ(${-rotationY}deg) rotateX(${-rotationX}deg)`,
                                                transformStyle: 'preserve-3d',
                                            }}
                                        >
                                            <div className="px-2.5 py-1 rounded-xl bg-zinc-950/95 border border-white/25 shadow-2xl flex items-center gap-1.5 whitespace-nowrap">
                                                <span className="text-xs font-black text-white">{table.name}</span>
                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${table.isOver ? 'bg-rose-600 text-white' : table.isFull ? 'bg-amber-500 text-zinc-950' : table.occupied > 0 ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40' : 'bg-zinc-800 text-zinc-400'}`}>
                                                    {table.occupied}/{table.capacity}
                                                </span>
                                                {dayMode && table.occupied > 0 && (
                                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300" title="Personas que ya ingresaron">
                                                        ✓{table.attendedSeats}
                                                    </span>
                                                )}
                                                {table.dietaryGuests.length > 0 && (
                                                    <span className="p-0.5 bg-amber-500 text-zinc-950 rounded-full" title={`${table.dietaryGuests.length} menú(s) especial(es)`}>
                                                        <Utensils className="w-2.5 h-2.5" />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Over-capacity confirmation */}
                    {pendingSeat && (
                        <div className="absolute inset-0 z-40 flex items-center justify-center bg-zinc-950/60" onPointerDown={(e) => e.stopPropagation()}>
                            <div className="w-80 p-4 rounded-2xl bg-zinc-900 border border-rose-500/40 text-white space-y-3 shadow-2xl">
                                <div className="flex items-center gap-2 text-rose-300 font-black text-sm">
                                    <AlertTriangle className="w-4 h-4" /> No hay lugar suficiente
                                </div>
                                <p className="text-xs text-zinc-300">
                                    <strong>{pendingSeat.guest.name}</strong> ocupa {pendingSeat.needed} {pendingSeat.needed === 1 ? 'lugar' : 'lugares'} y en <strong>{pendingSeat.table.name}</strong> {pendingSeat.table.free > 0 ? `quedan ${pendingSeat.table.free}` : 'no queda ninguno'}.
                                </p>
                                <div className="flex justify-end gap-2">
                                    <button type="button" onClick={() => setPendingSeat(null)} className="px-3 py-1.5 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-300">
                                        Cancelar
                                    </button>
                                    <button type="button" onClick={() => requestSeat(pendingSeat.guest, pendingSeat.table, true)} className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-black">
                                        Sentar igual
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* SIDE PANEL */}
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 text-white flex flex-col h-[620px] overflow-y-auto space-y-4">
                    {/* Search results */}
                    {search.results.length > 0 && !editMode && (
                        <div className="space-y-2 pb-3 border-b border-zinc-800">
                            <div className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                                {search.results.length} {search.results.length === 1 ? 'resultado' : 'resultados'}
                            </div>
                            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                {search.results.map(({ guest, table }) => (
                                    <button
                                        key={guest.id}
                                        type="button"
                                        onClick={() => table && setSelectedTableId(table.id)}
                                        className="w-full p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-left text-xs flex items-center justify-between gap-2"
                                    >
                                        <span className="font-bold truncate">{guest.name}</span>
                                        <span className={`shrink-0 text-[10px] font-bold ${table ? 'text-emerald-300' : 'text-amber-300'}`}>
                                            {table ? table.name : 'Sin mesa'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedTable ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">Mesa</span>
                                    <h4 className="text-xl font-extrabold text-white">{selectedTable.name}</h4>
                                </div>
                                <button type="button" onClick={() => setSelectedTableId(null)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Shape & rotation (layout editing) */}
                            {editMode && (
                                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-2">
                                    <div className="text-[11px] font-extrabold text-sky-300">Forma de la mesa</div>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {SHAPES.map(s => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => updateDraftTable(selectedTable.id, { shape: s.id })}
                                                className={`py-1.5 rounded-lg text-[11px] font-bold ${selectedTable.shape === s.id ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                    {selectedTable.shape !== 'round' && (
                                        <button
                                            type="button"
                                            onClick={() => updateDraftTable(selectedTable.id, { rotation: selectedTable.rotation === 90 ? 0 : 90 })}
                                            className="w-full py-1.5 rounded-lg text-[11px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 flex items-center justify-center gap-1.5"
                                        >
                                            <RotateCw className="w-3.5 h-3.5" /> Girar 90°
                                        </button>
                                    )}
                                    <p className="text-[10px] text-zinc-500">La capacidad se cambia desde la vista de tarjetas (editar mesa).</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/60">
                                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Ocupación</div>
                                    <div className={`text-lg font-black ${selectedTable.isOver ? 'text-rose-400' : 'text-white'}`}>
                                        {selectedTable.occupied} / {selectedTable.capacity}
                                    </div>
                                    <div className="text-[10px] text-zinc-500">{selectedTable.free > 0 ? `${selectedTable.free} libres` : selectedTable.isOver ? `${-selectedTable.free} de más` : 'Completa'}</div>
                                </div>
                                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50">
                                    <div className="text-[10px] font-bold text-emerald-400 uppercase">Ingresaron</div>
                                    <div className="text-lg font-black text-emerald-300">{selectedTable.attendedSeats}</div>
                                    <div className="text-[10px] text-zinc-500">{selectedTable.awaitingSeats} por llegar</div>
                                </div>
                            </div>

                            {/* Quick seat (fallback for touch screens, where drag & drop isn't available) */}
                            {!editMode && unassignedGuests.length > 0 && (
                                <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/60 space-y-2">
                                    <label className="text-[11px] font-extrabold text-amber-300 flex items-center gap-1">
                                        <UserPlus className="w-3.5 h-3.5" /> Sentar a alguien sin mesa aquí
                                    </label>
                                    <div className="flex gap-2">
                                        <select
                                            value={quickSeatGuestId}
                                            onChange={(e) => setQuickSeatGuestId(e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-700 bg-zinc-900 text-white p-2 font-medium outline-none"
                                        >
                                            <option value="">-- Seleccionar invitado --</option>
                                            {unassignedGuests.map(g => (
                                                <option key={g.id} value={g.id}>{g.name} ({seatsOf(g)} {seatsOf(g) === 1 ? 'lugar' : 'lugares'})</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            disabled={!quickSeatGuestId}
                                            onClick={() => {
                                                const guest = unassignedGuests.find(g => g.id === parseInt(quickSeatGuestId, 10));
                                                requestSeat(guest, selectedTable);
                                                setQuickSeatGuestId('');
                                            }}
                                            className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-black rounded-xl disabled:opacity-50 shrink-0"
                                        >
                                            Sentar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Seated guests */}
                            <div className="space-y-2">
                                <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                                    Invitados ({selectedTable.guests?.length || 0}) · {selectedTable.occupied} personas
                                </h5>
                                {selectedTable.guests?.length > 0 ? (
                                    <div className="space-y-2 pr-1">
                                        {selectedTable.guests.map((g) => {
                                            const state = guestState(g);
                                            return (
                                                <div
                                                    key={g.id}
                                                    draggable={!editMode}
                                                    onDragStart={(e) => handleGuestDragStart(e, g)}
                                                    onDragEnd={handleGuestDragEnd}
                                                    className="p-2.5 rounded-xl bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-between gap-2 cursor-grab"
                                                    title="Arrastrá a otra mesa para moverlo"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <GripVertical className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-bold text-white truncate">
                                                                {g.name}
                                                                {seatsOf(g) > 1 && <span className="text-zinc-400 font-semibold"> +{seatsOf(g) - 1}</span>}
                                                            </div>
                                                            {g.companions && <div className="text-[10px] text-zinc-400 truncate">+ {g.companions}</div>}
                                                            {hasDiet(g) && (
                                                                <div className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                                                                    <Utensils className="w-3 h-3" /> {g.dietary_restrictions}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${STATE_INFO[state].badge}`}>
                                                            {STATE_INFO[state].label}
                                                        </span>
                                                        {!editMode && onAssignGuest && (
                                                            <button
                                                                type="button"
                                                                title="Quitar de la mesa"
                                                                onClick={() => onAssignGuest(g.id, null)}
                                                                className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-700"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-800 text-center text-xs text-zinc-500">
                                        Mesa vacía. Arrastrá invitados desde "Sin mesa".
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : editMode ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400 space-y-3">
                            <Move className="w-8 h-8 text-sky-400" />
                            <p className="text-xs">Arrastrá mesas, pista, escenario y entrada. Tocá una mesa para cambiar su forma. Al terminar, <strong className="text-white">Guardar plano</strong>.</p>
                        </div>
                    ) : (
                        /* Unassigned guests, draggable onto the plan */
                        <div className="flex flex-col flex-1 min-h-0 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-black flex items-center gap-2">
                                    <Users className="w-4 h-4 text-amber-400" /> Sin mesa ({unassignedGuests.length})
                                </h4>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300">{unassignedSeats} pers.</span>
                            </div>
                            <p className="text-[11px] text-zinc-500">Arrastrá un invitado hasta una mesa del plano. Tocá una mesa para ver el detalle.</p>
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    value={unassignedSearch}
                                    onChange={(e) => setUnassignedSearch(e.target.value)}
                                    placeholder="Buscar sin mesa..."
                                    className="w-full text-xs rounded-xl border-zinc-700 bg-zinc-800 text-white pl-8 pr-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                                {filteredUnassigned.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                                        {unassignedGuests.length === 0 ? '🎉 Todos tienen mesa.' : 'Sin resultados.'}
                                    </div>
                                ) : filteredUnassigned.map(g => {
                                    const state = guestState(g);
                                    return (
                                        <div
                                            key={g.id}
                                            draggable
                                            onDragStart={(e) => handleGuestDragStart(e, g)}
                                            onDragEnd={handleGuestDragEnd}
                                            className={`p-2.5 rounded-xl bg-zinc-800/90 border border-zinc-700/60 hover:border-amber-500/50 cursor-grab active:cursor-grabbing flex items-center justify-between gap-2 ${draggedGuest?.id === g.id ? 'opacity-50' : ''}`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <GripVertical className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                                                <div className="min-w-0">
                                                    <div className="text-xs font-bold truncate">{g.name}</div>
                                                    {g.companions && <div className="text-[10px] text-zinc-400 truncate">+ {g.companions}</div>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {hasDiet(g) && <Utensils className="w-3 h-3 text-amber-400" />}
                                                <span className={`w-2 h-2 rounded-full border ${STATE_INFO[state].chair}`} title={STATE_INFO[state].label}></span>
                                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300">
                                                    {seatsOf(g)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
