import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Clock, 
    Upload, 
    FileText, 
    Plus, 
    Printer, 
    Save, 
    Trash2, 
    Edit3, 
    CheckCircle2, 
    Circle, 
    ArrowUp, 
    ArrowDown, 
    Sparkles, 
    RefreshCw, 
    FileUp, 
    Copy, 
    Search, 
    Check, 
    Calendar, 
    MapPin, 
    User, 
    X, 
    AlertCircle
} from 'lucide-react';
import { apiFetch } from '../api';

export default function EventTiming({ eventId, event, showToast, user }) {
    const [items, setItems] = useState([]);
    const [metadata, setMetadata] = useState({
        theme: '',
        subtitle: '',
        date_location: '',
        planner_notes: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    // Modals
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [pasteModalOpen, setPasteModalOpen] = useState(false);
    const [itemModalOpen, setItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // Form inputs for item modal
    const [formTime, setFormTime] = useState('');
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');

    // Paste text state
    const [pastedText, setPastedText] = useState('');
    const [parsing, setParsing] = useState(false);

    // File drag & drop
    const fileInputRef = useRef(null);
    const [dragActive, setDragActive] = useState(false);

    // Filter & Search
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'completed'

    useEffect(() => {
        if (eventId) {
            fetchTiming();
        }
    }, [eventId]);

    const fetchTiming = async () => {
        setLoading(true);
        try {
            const { ok, json } = await apiFetch(`/api/events/${eventId}/timing`);
            if (ok && json) {
                const loadedItems = json.timing || [];
                setItems(loadedItems);
                
                // Set default metadata from event if empty
                setMetadata(prev => ({
                    theme: prev.theme || json.event?.couple_names || json.event?.title || '',
                    subtitle: prev.subtitle || 'Cronograma de actividades y coordinación general',
                    date_location: prev.date_location || (
                        (json.event?.event_date ? new Date(json.event.event_date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '') +
                        (json.event?.location ? ` | ${json.event.location}` : '')
                    ),
                    planner_notes: prev.planner_notes || (json.event?.planner ? `Coordinación general: ${json.event.planner.name}` : ''),
                }));
            }
        } catch (err) {
            console.error('Error fetching timing:', err);
        } finally {
            setLoading(false);
            setDirty(false);
        }
    };

    const handleSave = async (itemsToSave = items) => {
        setSaving(true);
        try {
            const { ok, json } = await apiFetch(`/api/events/${eventId}/timing`, {
                method: 'POST',
                body: JSON.stringify({ timing: itemsToSave })
            });

            if (ok) {
                setItems(json.timing || itemsToSave);
                setDirty(false);
                if (showToast) showToast('¡Timing del evento guardado con éxito!');
            } else {
                alert(json?.message || 'Error guardando el timing');
            }
        } catch (err) {
            console.error('Error saving timing:', err);
        } finally {
            setSaving(false);
        }
    };

    // Toggle completed state
    const handleToggleComplete = async (itemId) => {
        const updated = items.map(it => it.id === itemId ? { ...it, completed: !it.completed } : it);
        setItems(updated);
        setDirty(true);

        try {
            await apiFetch(`/api/events/${eventId}/timing/items/${itemId}/toggle`, {
                method: 'POST'
            });
        } catch (err) {
            console.error('Error toggling timing item:', err);
        }
    };

    // Handle File Upload (.pdf, .docx, .doc, .txt)
    const handleFileUpload = async (file) => {
        if (!file) return;

        setParsing(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`/api/events/${eventId}/timing/upload`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: formData,
            });

            const json = await res.json();
            if (res.ok && json.items) {
                setItems(json.items);
                if (json.metadata) {
                    setMetadata(prev => ({
                        theme: json.metadata.theme || prev.theme,
                        subtitle: json.metadata.subtitle || prev.subtitle,
                        date_location: json.metadata.date_location || prev.date_location,
                        planner_notes: json.metadata.planner_notes || prev.planner_notes,
                    }));
                }
                setDirty(true);
                setUploadModalOpen(false);
                if (showToast) showToast(`¡Se extrajeron ${json.count} momentos del archivo ${file.name}!`);
            } else {
                alert(json.message || 'No se pudieron extraer los horarios del documento.');
            }
        } catch (err) {
            console.error('Error uploading timing file:', err);
            alert('Error al procesar el archivo. Verificá el formato.');
        } finally {
            setParsing(false);
        }
    };

    // Handle Text Paste
    const handlePasteSubmit = async () => {
        if (!pastedText.trim()) return;

        setParsing(true);
        try {
            const { ok, json } = await apiFetch(`/api/events/${eventId}/timing/upload`, {
                method: 'POST',
                body: JSON.stringify({ text: pastedText })
            });

            if (ok && json.items) {
                setItems(json.items);
                if (json.metadata) {
                    setMetadata(prev => ({
                        theme: json.metadata.theme || prev.theme,
                        subtitle: json.metadata.subtitle || prev.subtitle,
                        date_location: json.metadata.date_location || prev.date_location,
                        planner_notes: json.metadata.planner_notes || prev.planner_notes,
                    }));
                }
                setDirty(true);
                setPasteModalOpen(false);
                setPastedText('');
                if (showToast) showToast(`¡Se detectaron ${json.count} momentos del cronograma!`);
            } else {
                alert(json?.message || 'No se pudieron extraer los horarios del texto.');
            }
        } catch (err) {
            console.error('Error parsing pasted timing:', err);
            alert('Error al procesar el texto.');
        } finally {
            setParsing(false);
        }
    };

    // Preload Example (Liam 1 Añito)
    const loadExampleLiam = () => {
        const exampleItems = [
            { id: 'liam_1', time: '07:00', title: 'Ingreso de proveedores', description: 'Inicio del montaje general y recepción de proveedores.', completed: false },
            { id: 'liam_2', time: '15:00', title: 'Montaje finalizado', description: 'Cierre del montaje, orden y revisión general antes del evento.', completed: false },
            { id: 'liam_3', time: '16:00', title: 'Llegada de invitados', description: 'Inicio del evento y bienvenida a los invitados.', completed: false },
            { id: 'liam_4', time: '16:00-17:00', title: 'Recepción', description: 'Bienvenida, fotografías y ubicación de invitados.', completed: false },
            { id: 'liam_5', time: '16:30', title: 'Apertura de Coffee Time', description: 'Inicio del servicio de café para los invitados.', completed: false },
            { id: 'liam_6', time: '16:30', title: 'Bebidas sin alcohol', description: 'Agua con gas, agua sin gas y gaseosas.', completed: false },
            { id: 'liam_7', time: '17:00', title: 'Apertura de Puerto Sabores Helados', description: 'Inicio del servicio de helados artesanales.', completed: false },
            { id: 'liam_8', time: '17:30', title: 'Actividad Makers para niños', description: 'Inicio de la actividad en el área infantil.', completed: false },
            { id: 'liam_9', time: '17:30', title: 'Entrada para adultos', description: 'Servicio de entradas en las mesas de adultos.', completed: false },
            { id: 'liam_10', time: '18:00', title: 'Drinks - área al aire libre', description: 'Drinks con autoservicio. Cervezas Corona 3/4 servidas por los mozos.', completed: false },
            { id: 'liam_11', time: '18:00', title: 'Menú infantil', description: 'Hamburguesa con papas y gaseosa. Servicio en el área de niños.', completed: false },
            { id: 'liam_12', time: '19:00', title: 'Buffet para adultos', description: 'Apertura del servicio principal de buffet.', completed: false },
            { id: 'liam_13', time: '20:00', title: 'Momento del cumpleaños', description: 'Canto, torta y fotografías. Servicio de postres a continuación.', completed: false },
            { id: 'liam_14', time: '21:00', title: 'Finalización del evento', description: 'Cierre del cumpleaños y despedida de invitados.', completed: false },
        ];

        setItems(exampleItems);
        setMetadata({
            theme: 'EL BOSQUE DE LIAM',
            subtitle: 'Cumpleaños y bautismo de Liam - 1 añito',
            date_location: 'Domingo 6 de septiembre de 2026 | La Casita Quinta',
            planner_notes: 'La Orti Eventos | Event Planner: Tania Ortigoza (Coordinación general)',
        });
        setDirty(true);
        if (showToast) showToast('¡Ejemplo de Liam cargado!');
    };

    // Open Add or Edit Item Modal
    const openItemModal = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormTime(item.time || '');
            setFormTitle(item.title || '');
            setFormDescription(item.description || '');
        } else {
            setEditingItem(null);
            setFormTime('');
            setFormTitle('');
            setFormDescription('');
        }
        setItemModalOpen(true);
    };

    // Save Single Item (Add or Edit)
    const handleSaveItem = (e) => {
        e.preventDefault();
        if (!formTime.trim() || !formTitle.trim()) return;

        if (editingItem) {
            const updated = items.map(it => it.id === editingItem.id ? {
                ...it,
                time: formTime.trim(),
                title: formTitle.trim(),
                description: formDescription.trim(),
            } : it);
            setItems(updated);
        } else {
            const newItem = {
                id: 'timing_' + Date.now(),
                time: formTime.trim(),
                title: formTitle.trim(),
                description: formDescription.trim(),
                completed: false,
            };
            setItems([...items, newItem]);
        }

        setDirty(true);
        setItemModalOpen(false);
    };

    // Delete Item
    const handleDeleteItem = (itemId) => {
        if (confirm('¿Eliminar este momento del timing?')) {
            const updated = items.filter(it => it.id !== itemId);
            setItems(updated);
            setDirty(true);
        }
    };

    // Reorder (Move Up / Down)
    const handleMove = (index, direction) => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= items.length) return;

        const newItems = [...items];
        const temp = newItems[index];
        newItems[index] = newItems[newIndex];
        newItems[newIndex] = temp;

        setItems(newItems);
        setDirty(true);
    };

    // Filtered items
    const filteredItems = useMemo(() => {
        return items.filter(it => {
            if (statusFilter === 'pending' && it.completed) return false;
            if (statusFilter === 'completed' && !it.completed) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchTitle = (it.title || '').toLowerCase().includes(q);
                const matchTime = (it.time || '').toLowerCase().includes(q);
                const matchDesc = (it.description || '').toLowerCase().includes(q);
                if (!matchTitle && !matchTime && !matchDesc) return false;
            }

            return true;
        });
    }, [items, statusFilter, searchQuery]);

    // Summary stats
    const totalCount = items.length;
    const completedCount = items.filter(it => it.completed).length;
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
        <div className="space-y-6 animate-fade-in font-sans pb-16">
            {/* Header & Control Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm print:hidden">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-[#2d4a3e]/10 text-[#2d4a3e] dark:bg-emerald-500/20 dark:text-emerald-400">
                            <Clock className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                            Timing del Evento — <span className="text-[#2d4a3e] dark:text-emerald-400">{event?.couple_names || event?.title}</span>
                        </h2>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                        Cronograma minuto a minuto de coordinación y proveedores. Subí un Word (.docx), PDF o pegá el texto.
                    </p>
                </div>

                {/* Main Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setUploadModalOpen(true)}
                        className="px-3.5 py-2 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
                        title="Subir archivo Word o PDF"
                    >
                        <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Subir Word / PDF</span>
                    </button>

                    <button
                        onClick={() => setPasteModalOpen(true)}
                        className="px-3.5 py-2 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
                        title="Pegar texto directo desde WhatsApp o notas"
                    >
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span>Pegar Texto</span>
                    </button>

                    <button
                        onClick={() => openItemModal()}
                        className="px-3.5 py-2 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
                    >
                        <Plus className="w-4 h-4 text-amber-500" />
                        <span>+ Agregar Hito</span>
                    </button>

                    <button
                        onClick={() => window.print()}
                        className="p-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold transition-all shadow-sm"
                        title="Imprimir o guardar como PDF"
                    >
                        <Printer className="w-4 h-4" />
                    </button>

                    {dirty && (
                        <button
                            onClick={() => handleSave()}
                            disabled={saving}
                            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-[#2d4a3e] hover:from-emerald-700 hover:to-[#22382f] text-white text-xs font-black shadow-lg shadow-emerald-600/20 active:scale-95 transition-all inline-flex items-center gap-2 animate-pulse"
                        >
                            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>Guardar Cambios</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Stats & Live Progress Bar on the Day of Event */}
            {items.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar en el timing..."
                                className="w-full sm:w-64 text-xs rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white pl-8 pr-3 py-2 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-bold">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-2.5 py-1 rounded-lg transition-colors ${statusFilter === 'all' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                            >
                                Todos ({totalCount})
                            </button>
                            <button
                                onClick={() => setStatusFilter('pending')}
                                className={`px-2.5 py-1 rounded-lg transition-colors ${statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                            >
                                Pendientes ({totalCount - completedCount})
                            </button>
                            <button
                                onClick={() => setStatusFilter('completed')}
                                className={`px-2.5 py-1 rounded-lg transition-colors ${statusFilter === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                            >
                                Completados ({completedCount})
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex items-center gap-3 w-full sm:w-72">
                        <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                            <div 
                                className="bg-gradient-to-r from-emerald-500 to-[#2d4a3e] h-full rounded-full transition-all duration-500"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            {completedCount}/{totalCount} ({progressPct}%)
                        </span>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {items.length === 0 && !loading && (
                <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5 max-w-lg mx-auto my-12 animate-fade-in font-sans">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-900/40">
                        <Clock className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                            Sin Timing Registrado
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                            Cargá el cronograma del evento subiendo tu archivo Word (.docx) o PDF. El sistema extraerá automáticamente todos los horarios y descripciones.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <button
                            onClick={() => setUploadModalOpen(true)}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-[#2d4a3e] hover:from-emerald-700 hover:to-[#22382f] text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 active:scale-95 transition-all inline-flex items-center justify-center gap-2"
                        >
                            <Upload className="w-4 h-4" />
                            <span>Subir Word / PDF</span>
                        </button>
                        <button
                            onClick={loadExampleLiam}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition-all inline-flex items-center justify-center gap-2"
                        >
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            <span>Cargar Ejemplo (Liam)</span>
                        </button>
                    </div>
                </div>
            )}

            {/* TIMING CARD - EXACT VISUAL FORMAT FROM USER'S PDF SCREENSHOT */}
            {items.length > 0 && (
                <div className="bg-[#fbf9f4] dark:bg-zinc-900 border border-[#e8e4dc] dark:border-zinc-800 shadow-xl rounded-3xl p-6 sm:p-10 max-w-3xl mx-auto transition-all print:border-none print:shadow-none print:p-0 print:max-w-none print:bg-white">
                    {/* Header */}
                    <div className="text-center pb-8 border-b border-[#e2ddd3] dark:border-zinc-800 space-y-1">
                        {metadata.theme && (
                            <div className="text-[11px] font-black tracking-widest text-[#5c6e65] dark:text-emerald-400 uppercase">
                                {metadata.theme}
                            </div>
                        )}
                        <h1 className="text-2xl sm:text-3xl font-black text-[#1e332a] dark:text-white tracking-tight uppercase">
                            TIMING DEL EVENTO
                        </h1>
                        {metadata.subtitle && (
                            <p className="text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                {metadata.subtitle}
                            </p>
                        )}
                        {metadata.date_location && (
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 pt-0.5">
                                {metadata.date_location}
                            </p>
                        )}
                    </div>

                    {/* Timeline List */}
                    <div className="py-6 space-y-4">
                        {filteredItems.map((item, index) => {
                            const isCompleted = item.completed;

                            return (
                                <div 
                                    key={item.id || index}
                                    className={`group flex items-start gap-4 p-3 rounded-2xl transition-all ${
                                        isCompleted 
                                            ? 'bg-emerald-500/5 opacity-70' 
                                            : 'hover:bg-white/80 dark:hover:bg-zinc-800/50'
                                    }`}
                                >
                                    {/* Left: Time Badge (Exact dark green pill from screenshot) */}
                                    <div className="shrink-0 pt-0.5">
                                        <div 
                                            onClick={() => handleToggleComplete(item.id)}
                                            className="bg-[#2d4a3e] hover:bg-[#233a30] text-white px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider text-center min-w-[100px] shadow-sm flex items-center justify-center cursor-pointer transition-all active:scale-95"
                                            title="Click para marcar completado/pendiente"
                                        >
                                            {isCompleted && <Check className="w-3 h-3 mr-1 text-emerald-300" />}
                                            <span>{item.time}</span>
                                        </div>
                                    </div>

                                    {/* Center: Title & Description */}
                                    <div className="flex-1 min-w-0 pt-0.5">
                                        <h3 className={`text-sm font-black text-[#1e332a] dark:text-white leading-tight ${isCompleted ? 'line-through text-zinc-400 dark:text-zinc-500' : ''}`}>
                                            {item.title}
                                        </h3>
                                        {item.description && (
                                            <p className={`text-xs text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed mt-0.5 ${isCompleted ? 'line-through opacity-70' : ''}`}>
                                                {item.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Right: Quick Action Controls (Hidden on Print) */}
                                    <div className="hidden group-hover:flex items-center gap-1 shrink-0 print:hidden transition-all animate-fade-in">
                                        <button
                                            onClick={() => handleMove(index, 'up')}
                                            disabled={index === 0}
                                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white disabled:opacity-30"
                                            title="Subir"
                                        >
                                            <ArrowUp className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleMove(index, 'down')}
                                            disabled={index === items.length - 1}
                                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white disabled:opacity-30"
                                            title="Bajar"
                                        >
                                            <ArrowDown className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => openItemModal(item)}
                                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                            title="Editar"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteItem(item.id)}
                                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer (Planner branding as in screenshot) */}
                    <div className="pt-6 border-t border-[#e2ddd3] dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between text-xs font-semibold text-[#5c6e65] dark:text-zinc-400 gap-2">
                        <div className="flex items-center gap-1.5">
                            <span className="font-black text-[#1e332a] dark:text-zinc-200">
                                {event?.planner?.name || 'Organización'}
                            </span>
                            {metadata.planner_notes && (
                                <span className="opacity-80">· {metadata.planner_notes}</span>
                            )}
                        </div>
                        <div className="italic text-[11px] opacity-75">
                            Coordinación general del evento
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 1: Subir Archivo (Word .docx o PDF) */}
            {uploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-md animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                                    <FileUp className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-black text-zinc-900 dark:text-white">
                                    Subir Timing (Word o PDF)
                                </h3>
                            </div>
                            <button
                                onClick={() => setUploadModalOpen(false)}
                                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Arrastrá tu archivo <strong>.docx</strong>, <strong>.pdf</strong> o <strong>.txt</strong>. Nuestro algoritmo extraerá cada hora, título y notas automáticamente.
                        </p>

                        {/* Drop Zone */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragActive(false);
                                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                    handleFileUpload(e.dataTransfer.files[0]);
                                }
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                                dragActive 
                                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[1.01]' 
                                    : 'border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                            }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.docx,.doc,.txt"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        handleFileUpload(e.target.files[0]);
                                    }
                                }}
                                className="hidden"
                            />

                            {parsing ? (
                                <div className="space-y-3">
                                    <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
                                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                        Analizando y estructurando horarios...
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Upload className="w-8 h-8 text-emerald-600 mx-auto" />
                                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                        Hacé click para seleccionar o arrastrá el archivo acá
                                    </p>
                                    <span className="text-[11px] text-zinc-400 block">
                                        Soporta Microsoft Word (.docx), PDF (.pdf) y texto (.txt)
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: Pegar Texto */}
            {pasteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-md animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                                    <Copy className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-black text-zinc-900 dark:text-white">
                                    Pegar Texto del Cronograma
                                </h3>
                            </div>
                            <button
                                onClick={() => setPasteModalOpen(false)}
                                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Copiá y pegá el timing desde un mensaje de WhatsApp, correo o bloc de notas:
                        </p>

                        <textarea
                            rows={8}
                            value={pastedText}
                            onChange={(e) => setPastedText(e.target.value)}
                            placeholder={"07:00 Ingreso de proveedores\nInicio de montaje general...\n16:00 Llegada de invitados\nBienvenida y fotografías..."}
                            className="w-full text-xs font-mono rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3.5 outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setPasteModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-900"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handlePasteSubmit}
                                disabled={parsing || !pastedText.trim()}
                                className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-500/20 active:scale-95 transition-all inline-flex items-center gap-2"
                            >
                                {parsing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                <span>Procesar Texto</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: Agregar o Editar Hito */}
            {itemModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-md animate-fade-in">
                    <form onSubmit={handleSaveItem} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-black text-zinc-900 dark:text-white">
                                {editingItem ? 'Editar Momento' : 'Agregar Momento al Timing'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setItemModalOpen(false)}
                                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                                Horario (ej: 07:00, 16:00-17:00, 21:30) *
                            </label>
                            <input
                                type="text"
                                required
                                value={formTime}
                                onChange={(e) => setFormTime(e.target.value)}
                                placeholder="16:00"
                                className="w-full text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                                Título de la Actividad *
                            </label>
                            <input
                                type="text"
                                required
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                placeholder="ej: Recepción y Fotos"
                                className="w-full text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                                Detalle / Notas (Opcional)
                            </label>
                            <textarea
                                rows={3}
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="ej: Bienvenida, fotografías y ubicación de invitados."
                                className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setItemModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-900"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2.5 rounded-2xl bg-[#2d4a3e] hover:bg-[#21372e] text-white text-xs font-black shadow-md shadow-emerald-900/20 active:scale-95 transition-all"
                            >
                                {editingItem ? 'Guardar Cambios' : 'Agregar Momento'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
