import React, { useState, useEffect } from 'react';
import { X, Printer, Check, Layers, Eye, Sparkles, Users, CheckSquare, Square, Box, ChevronLeft, ChevronRight, Palette, Type, Sliders, RotateCcw } from 'lucide-react';
import { printHtml, buildTableTentsDocument } from '../eventDocuments';

const PALETTES = [
    {
        id: 'gold',
        name: 'Oro Champán',
        primary: '#b58d3d',
        number: '#18181b',
        bg: '#ffffff',
        border: 'double',
        icon: 'rings',
        badge: 'Popular',
    },
    {
        id: 'rosegold',
        name: 'Rose Gold',
        primary: '#b76e79',
        number: '#18181b',
        bg: '#fffafa',
        border: 'double',
        icon: 'heart',
    },
    {
        id: 'botanical',
        name: 'Verde Salvia',
        primary: '#3b5e43',
        number: '#1c2a1f',
        bg: '#fbfdfa',
        border: 'corners',
        icon: 'botanical',
    },
    {
        id: 'blacktie',
        name: 'Black Tie',
        primary: '#18181b',
        number: '#09090b',
        bg: '#ffffff',
        border: 'single',
        icon: 'rings',
    },
    {
        id: 'burgundy',
        name: 'Borgoña Vino',
        primary: '#701a35',
        number: '#18181b',
        bg: '#fdfafb',
        border: 'double',
        icon: 'toast',
    },
    {
        id: 'navy',
        name: 'Azul Marino',
        primary: '#1e3a8a',
        number: '#0f172a',
        bg: '#ffffff',
        border: 'rounded',
        icon: 'star',
    },
];

const ICONS = [
    { id: 'rings', label: '💍 Alianzas' },
    { id: 'heart', label: '🤍 Corazón' },
    { id: 'botanical', label: '🌿 Botánico' },
    { id: 'toast', label: '🥂 Brindis' },
    { id: 'star', label: '✦ Destello' },
    { id: 'monogram', label: '🔤 Iniciales' },
    { id: 'none', label: 'Sin ícono' },
];

const BORDER_STYLES = [
    { id: 'double', label: 'Doble con Ribete' },
    { id: 'single', label: 'Línea Fina Simple' },
    { id: 'corners', label: 'Esquinas Barrocas' },
    { id: 'rounded', label: 'Redondeado Suave' },
    { id: 'none', label: 'Sin marco (Limpio)' },
];

export default function TableTentsModal({ isOpen, onClose, event, tables = [], showToast }) {
    if (!isOpen) return null;

    const storageKey = `table_tents_config_${event?.id || 'default'}`;

    const defaultTitle = event?.couple_names || event?.title || 'Nuestra Boda';
    const defaultSubtitle = event?.event_date 
        ? new Date(`${String(event.event_date).slice(0, 10)}T12:00:00`).toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : '';

    // Customization state
    const [title, setTitle] = useState(defaultTitle);
    const [subtitle, setSubtitle] = useState(defaultSubtitle);
    const [prefix, setPrefix] = useState('MESA');
    const [baseText, setBaseText] = useState('¡Gracias por celebrar con nosotros!');
    const [includeGuests, setIncludeGuests] = useState(true);

    const [fontTitle, setFontTitle] = useState('cursive'); // 'cursive' | 'serif' | 'sans'
    const [fontNumber, setFontNumber] = useState('serif'); // 'serif' | 'sans' | 'cursive'

    const [primaryColor, setPrimaryColor] = useState('#b58d3d');
    const [numberColor, setNumberColor] = useState('#18181b');
    const [bgColor, setBgColor] = useState('#ffffff');
    const [borderStyle, setBorderStyle] = useState('double');
    const [icon, setIcon] = useState('rings');
    const [monogram, setMonogram] = useState(() => {
        const words = (event?.couple_names || '').split('&').map(s => s.trim());
        if (words.length >= 2 && words[0] && words[1]) {
            return `${words[0].charAt(0)} & ${words[1].charAt(0)}`;
        }
        return '';
    });

    const [activeTab, setActiveTab] = useState('style'); // 'style' | 'text' | 'tables'
    const [selectedTableIds, setSelectedTableIds] = useState(() => tables.map(t => t.id));
    const [previewIndex, setPreviewIndex] = useState(0);
    const [previewMode, setPreviewMode] = useState('sheet'); // 'sheet' | '3d'

    // Load saved settings if any
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.title) setTitle(parsed.title);
                if (parsed.subtitle) setSubtitle(parsed.subtitle);
                if (parsed.prefix !== undefined) setPrefix(parsed.prefix);
                if (parsed.baseText) setBaseText(parsed.baseText);
                if (parsed.includeGuests !== undefined) setIncludeGuests(parsed.includeGuests);
                if (parsed.fontTitle) setFontTitle(parsed.fontTitle);
                if (parsed.fontNumber) setFontNumber(parsed.fontNumber);
                if (parsed.primaryColor) setPrimaryColor(parsed.primaryColor);
                if (parsed.numberColor) setNumberColor(parsed.numberColor);
                if (parsed.bgColor) setBgColor(parsed.bgColor);
                if (parsed.borderStyle) setBorderStyle(parsed.borderStyle);
                if (parsed.icon) setIcon(parsed.icon);
                if (parsed.monogram) setMonogram(parsed.monogram);
            }
        } catch (e) {}
    }, [storageKey]);

    // Save settings when changed
    const saveCurrentConfig = () => {
        try {
            const cfg = {
                title, subtitle, prefix, baseText, includeGuests,
                fontTitle, fontNumber, primaryColor, numberColor, bgColor,
                borderStyle, icon, monogram,
            };
            localStorage.setItem(storageKey, JSON.stringify(cfg));
        } catch (e) {}
    };

    const applyPalette = (pal) => {
        setPrimaryColor(pal.primary);
        setNumberColor(pal.number);
        setBgColor(pal.bg);
        setBorderStyle(pal.border);
        setIcon(pal.icon);
    };

    const resetDefaults = () => {
        setTitle(defaultTitle);
        setSubtitle(defaultSubtitle);
        setPrefix('MESA');
        setBaseText('¡Gracias por celebrar con nosotros!');
        setIncludeGuests(true);
        setFontTitle('cursive');
        setFontNumber('serif');
        setPrimaryColor('#b58d3d');
        setNumberColor('#18181b');
        setBgColor('#ffffff');
        setBorderStyle('double');
        setIcon('rings');
        localStorage.removeItem(storageKey);
        if (showToast) showToast('Diseño restablecido a valores iniciales.');
    };

    const sortedTables = [...tables].sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' }));
    const currentTable = sortedTables[previewIndex] || sortedTables[0];

    const toggleTable = (id) => {
        setSelectedTableIds(prev => 
            prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]
        );
    };

    const selectAll = () => setSelectedTableIds(tables.map(t => t.id));
    const selectNone = () => setSelectedTableIds([]);

    const handlePrint = () => {
        if (selectedTableIds.length === 0) {
            if (showToast) showToast('Seleccioná al menos una mesa para imprimir.');
            return;
        }

        saveCurrentConfig();

        const html = buildTableTentsDocument({
            event,
            tables,
            selectedTableIds,
            config: {
                title,
                subtitle,
                prefix,
                baseText,
                includeGuests,
                fontTitle,
                fontNumber,
                primaryColor,
                numberColor,
                bgColor,
                borderStyle,
                icon,
                monogram,
            },
        });

        printHtml(html);
        if (showToast) showToast(`Preparando impresión para ${selectedTableIds.length} mesas.`);
    };

    // Table number text for preview
    const tableNumberDisplay = currentTable?.name.replace(/mesa\s+/i, '') || '1';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-zinc-950/75 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div 
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/70">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-amber-500 to-rose-500 rounded-2xl text-white shadow-md shadow-rose-500/20">
                            <Box className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-black text-zinc-900 dark:text-white">Personalizador de Carteles de Mesa (3D con Base)</h2>
                                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/50">
                                    Doble Cara Plegable
                                </span>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                Personalizá los colores, tipografía, textos y comensales. Se pliega en triángulo estable con base para centros de mesa.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body (2 columns: Studio Controls on Left, Live Preview on Right) */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Studio Controls (7 cols) */}
                    <div className="lg:col-span-7 flex flex-col space-y-4">
                        {/* Customizer Tabs */}
                        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                            <button
                                type="button"
                                onClick={() => setActiveTab('style')}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    activeTab === 'style' 
                                        ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm' 
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                <Palette className="w-3.5 h-3.5" />
                                <span>Colores & Marco</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('text')}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    activeTab === 'text' 
                                        ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm' 
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                <Type className="w-3.5 h-3.5" />
                                <span>Textos & Fuentes</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('tables')}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    activeTab === 'tables' 
                                        ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm' 
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Mesas ({selectedTableIds.length})</span>
                            </button>
                        </div>

                        {/* TAB 1: COLORES & MARCO */}
                        {activeTab === 'style' && (
                            <div className="space-y-4">
                                {/* Paletas de boda predefinidas */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                            Paletas de Boda Sugeridas
                                        </span>
                                        <button 
                                            type="button" 
                                            onClick={resetDefaults}
                                            className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center gap-1"
                                        >
                                            <RotateCcw className="w-3 h-3" /> Restablecer
                                        </button>
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {PALETTES.map(pal => (
                                            <button
                                                key={pal.id}
                                                type="button"
                                                onClick={() => applyPalette(pal)}
                                                className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700 text-left transition-all flex items-center gap-2.5"
                                            >
                                                <div 
                                                    className="w-5 h-5 rounded-full border shadow-inner shrink-0" 
                                                    style={{ backgroundColor: pal.primary, borderColor: 'rgba(0,0,0,0.1)' }}
                                                />
                                                <div className="min-w-0">
                                                    <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">{pal.name}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Selectores de color específicos */}
                                <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-3">
                                    <div className="text-xs font-bold text-zinc-900 dark:text-white">Ajuste Fino de Colores</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block mb-1">Color Principal (Borde/Acentos)</label>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="color" 
                                                    value={primaryColor} 
                                                    onChange={e => setPrimaryColor(e.target.value)}
                                                    className="w-9 h-9 rounded-xl border border-zinc-300 dark:border-zinc-700 cursor-pointer p-0.5 bg-white dark:bg-zinc-800"
                                                />
                                                <input 
                                                    type="text" 
                                                    value={primaryColor} 
                                                    onChange={e => setPrimaryColor(e.target.value)}
                                                    className="flex-1 px-2.5 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-mono bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white uppercase"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block mb-1">Color del Número de Mesa</label>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="color" 
                                                    value={numberColor} 
                                                    onChange={e => setNumberColor(e.target.value)}
                                                    className="w-9 h-9 rounded-xl border border-zinc-300 dark:border-zinc-700 cursor-pointer p-0.5 bg-white dark:bg-zinc-800"
                                                />
                                                <input 
                                                    type="text" 
                                                    value={numberColor} 
                                                    onChange={e => setNumberColor(e.target.value)}
                                                    className="flex-1 px-2.5 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-mono bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white uppercase"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block mb-1">Color de Fondo del Papel</label>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="color" 
                                                    value={bgColor} 
                                                    onChange={e => setBgColor(e.target.value)}
                                                    className="w-9 h-9 rounded-xl border border-zinc-300 dark:border-zinc-700 cursor-pointer p-0.5 bg-white dark:bg-zinc-800"
                                                />
                                                <input 
                                                    type="text" 
                                                    value={bgColor} 
                                                    onChange={e => setBgColor(e.target.value)}
                                                    className="flex-1 px-2.5 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-mono bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white uppercase"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Estilo del Marco */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                                        Estilo del Marco Decorativo
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {BORDER_STYLES.map(bs => (
                                            <button
                                                key={bs.id}
                                                type="button"
                                                onClick={() => setBorderStyle(bs.id)}
                                                className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                                                    borderStyle === bs.id
                                                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/20'
                                                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                                                }`}
                                            >
                                                {bs.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Ícono decorativo o monograma */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                                        Ícono Superior o Monograma
                                    </label>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                        {ICONS.map(ic => (
                                            <button
                                                key={ic.id}
                                                type="button"
                                                onClick={() => setIcon(ic.id)}
                                                className={`p-2 rounded-xl border text-xs font-bold text-center transition-all ${
                                                    icon === ic.id
                                                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/20'
                                                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                                                }`}
                                            >
                                                {ic.label}
                                            </button>
                                        ))}
                                    </div>
                                    {icon === 'monogram' && (
                                        <div className="pt-2">
                                            <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block mb-1">Iniciales del Monograma (ej: C & R)</label>
                                            <input 
                                                type="text" 
                                                value={monogram} 
                                                onChange={e => setMonogram(e.target.value)}
                                                placeholder="Ej: A & M"
                                                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-sm font-serif bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 2: TEXTOS & TIPOGRAFÍAS */}
                        {activeTab === 'text' && (
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                                            Título Principal (Nombres o Evento)
                                        </label>
                                        <input 
                                            type="text" 
                                            value={title} 
                                            onChange={e => setTitle(e.target.value)}
                                            placeholder="Nombres de la pareja o título"
                                            className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-300 dark:border-zinc-700 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                                            Subtítulo / Fecha del Evento
                                        </label>
                                        <input 
                                            type="text" 
                                            value={subtitle} 
                                            onChange={e => setSubtitle(e.target.value)}
                                            placeholder="Ej: Sábado 24 de Octubre de 2026"
                                            className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-300 dark:border-zinc-700 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                                                Etiqueta sobre el número
                                            </label>
                                            <input 
                                                type="text" 
                                                value={prefix} 
                                                onChange={e => setPrefix(e.target.value)}
                                                placeholder="Ej: MESA, TABLE, o dejar vacío"
                                                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                                                Frase de la base de apoyo
                                            </label>
                                            <input 
                                                type="text" 
                                                value={baseText} 
                                                onChange={e => setBaseText(e.target.value)}
                                                placeholder="Ej: ¡Gracias por celebrar con nosotros!"
                                                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Tipografía del Título */}
                                <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                                        Fuente del Título
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'cursive', name: 'Caligráfica de Gala', sample: 'Great Vibes', fontClass: 'font-serif italic' },
                                            { id: 'serif', name: 'Imperial Serif', sample: 'Playfair Display', fontClass: 'font-serif' },
                                            { id: 'sans', name: 'Moderna Limpia', sample: 'Montserrat', fontClass: 'font-sans' },
                                        ].map(f => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => setFontTitle(f.id)}
                                                className={`p-2.5 rounded-xl border text-center transition-all ${
                                                    fontTitle === f.id
                                                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/20'
                                                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                                                }`}
                                            >
                                                <div className={`text-base font-bold truncate ${f.fontClass}`}>Aa</div>
                                                <div className="text-[11px] font-bold mt-0.5 truncate">{f.name}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tipografía del Número */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                                        Fuente del Número de Mesa
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'serif', name: 'Romana Clásica', sample: '12', fontClass: 'font-serif font-black' },
                                            { id: 'sans', name: 'Sans Negrita', sample: '12', fontClass: 'font-sans font-black' },
                                            { id: 'cursive', name: 'Caligráfica', sample: '12', fontClass: 'font-serif italic' },
                                        ].map(f => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => setFontNumber(f.id)}
                                                className={`p-2.5 rounded-xl border text-center transition-all ${
                                                    fontNumber === f.id
                                                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/20'
                                                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                                                }`}
                                            >
                                                <div className={`text-xl leading-none ${f.fontClass}`}>{f.sample}</div>
                                                <div className="text-[11px] font-bold mt-1 truncate">{f.name}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Toggle Comensales */}
                                <div 
                                    onClick={() => setIncludeGuests(!includeGuests)}
                                    className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer flex items-center justify-between"
                                >
                                    <div className="space-y-0.5">
                                        <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                            <span>Mostrar comensales sentados en cada mesa</span>
                                        </div>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                            Muestra la lista de invitados en ambas caras. Si se desactiva, se muestra solo el número de mesa y una frase de bienvenida.
                                        </p>
                                    </div>
                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                        includeGuests 
                                            ? 'bg-rose-500 border-rose-500 text-white' 
                                            : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                                    }`}>
                                        {includeGuests && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: SELECCIÓN DE MESAS */}
                        {activeTab === 'tables' && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                                        <span>Seleccionar mesas para imprimir ({selectedTableIds.length} de {tables.length})</span>
                                    </label>
                                    <div className="flex items-center gap-2 text-xs">
                                        <button 
                                            type="button" 
                                            onClick={selectAll} 
                                            className="text-rose-600 dark:text-rose-400 hover:underline font-bold"
                                        >
                                            Todas
                                        </button>
                                        <span className="text-zinc-300 dark:text-zinc-700">·</span>
                                        <button 
                                            type="button" 
                                            onClick={selectNone} 
                                            className="text-zinc-500 hover:underline font-medium"
                                        >
                                            Ninguna
                                        </button>
                                    </div>
                                </div>

                                <div className="max-h-64 overflow-y-auto p-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {sortedTables.map(t => {
                                        const isChecked = selectedTableIds.includes(t.id);
                                        const count = (t.guests || []).length;
                                        return (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => toggleTable(t.id)}
                                                className={`p-2.5 rounded-xl text-left text-xs font-medium border flex items-center justify-between transition-colors ${
                                                    isChecked
                                                        ? 'bg-white dark:bg-zinc-800 border-rose-400 dark:border-rose-800 text-zinc-900 dark:text-white font-bold shadow-xs'
                                                        : 'bg-zinc-100/60 dark:bg-zinc-900/40 border-transparent text-zinc-400 dark:text-zinc-500'
                                                }`}
                                            >
                                                <span className="truncate">{t.name}</span>
                                                <span className="text-[10px] text-zinc-400 shrink-0 ml-1 font-normal">({count} p.)</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 text-[11px] text-amber-900 dark:text-amber-200">
                                    💡 <strong>Tip para la wedding planner:</strong> Cada mesa se imprime en su propia hoja A4. Al imprimir, podés seleccionar en el diálogo del navegador qué páginas imprimir si solo necesitás reimprimir una mesa específica.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Live Interactive Preview (5 cols) */}
                    <div className="lg:col-span-5 flex flex-col space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                                <Eye className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Vista Previa en Vivo</span>
                            </span>
                            
                            {/* Paginador de mesa */}
                            {sortedTables.length > 1 && (
                                <div className="flex items-center gap-1 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => setPreviewIndex(prev => Math.max(0, prev - 1))}
                                        disabled={previewIndex === 0}
                                        className="p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="font-bold px-1 text-zinc-700 dark:text-zinc-300 text-xs">
                                        {currentTable ? currentTable.name : ''}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewIndex(prev => Math.min(sortedTables.length - 1, prev + 1))}
                                        disabled={previewIndex >= sortedTables.length - 1}
                                        className="p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Switcher: Hoja Desplegada vs Maqueta 3D */}
                        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-bold">
                            <button
                                type="button"
                                onClick={() => setPreviewMode('sheet')}
                                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                                    previewMode === 'sheet' 
                                        ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-xs' 
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                Hoja Desplegada (A4)
                            </button>
                            <button
                                type="button"
                                onClick={() => setPreviewMode('3d')}
                                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                                    previewMode === '3d' 
                                        ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-xs' 
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                Prisma Plegado 3D
                            </button>
                        </div>

                        {/* Preview Display Container */}
                        <div className="flex-1 min-h-[420px] p-3 rounded-3xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center overflow-hidden">
                            {previewMode === 'sheet' ? (
                                /* Hoja Desplegada A4 a Escala */
                                <div 
                                    className="w-56 h-[395px] rounded-md shadow-xl border border-zinc-300 p-1.5 flex flex-col justify-between text-[7px] select-none transition-colors"
                                    style={{ backgroundColor: bgColor }}
                                >
                                    {/* Solapa Superior */}
                                    <div className="h-6 border border-dashed border-zinc-400 bg-zinc-50/60 flex items-center justify-center text-[6px] text-zinc-400 font-semibold tracking-wider uppercase">
                                        ✂ Solapa de Pegado
                                    </div>
                                    <div className="text-center text-[5px] text-zinc-400 border-b border-dashed border-zinc-400 py-0.5">
                                        --- Doblar hacia adentro ---
                                    </div>

                                    {/* Cara Posterior (Invertida 180° para que al doblar el triángulo quede derecha) */}
                                    <div 
                                        className={`h-[135px] p-1.5 rounded flex flex-col justify-between text-center transform rotate-180 transition-all ${
                                            borderStyle === 'double' ? 'border-2' :
                                            borderStyle === 'single' ? 'border-2' :
                                            borderStyle === 'rounded' ? 'border-2 rounded-xl' :
                                            borderStyle === 'corners' ? 'border' : 'border-0'
                                        }`}
                                        style={{ 
                                            borderColor: primaryColor,
                                            outline: borderStyle === 'double' ? `1px solid ${primaryColor}` : 'none',
                                            outlineOffset: borderStyle === 'double' ? '-4px' : '0',
                                        }}
                                    >
                                        <div>
                                            <div 
                                                className={`text-[7px] truncate font-bold uppercase ${
                                                    fontTitle === 'cursive' ? 'font-serif italic text-[9px]' : fontTitle === 'sans' ? 'font-sans' : 'font-serif'
                                                }`}
                                                style={{ color: primaryColor }}
                                            >
                                                {title}
                                            </div>
                                            {subtitle && <div className="text-[4.5px] text-zinc-400 truncate">{subtitle}</div>}
                                        </div>

                                        <div>
                                            {prefix && (
                                                <div className="text-[5.5px] uppercase tracking-widest font-black" style={{ color: primaryColor }}>
                                                    {prefix}
                                                </div>
                                            )}
                                            <div 
                                                className={`text-xl font-black leading-none ${fontNumber === 'sans' ? 'font-sans' : 'font-serif'}`}
                                                style={{ color: numberColor }}
                                            >
                                                {tableNumberDisplay}
                                            </div>
                                        </div>

                                        {includeGuests ? (
                                            <div className="text-[5px] text-zinc-600 border border-zinc-200/70 rounded p-0.5 bg-zinc-50/40 leading-tight">
                                                {(currentTable?.guests || []).slice(0, 4).map((g, i) => (
                                                    <div key={i} className="truncate">• {g.name}</div>
                                                ))}
                                                {((currentTable?.guests || []).length > 4) && <div className="text-[4.5px] text-zinc-400">+ más invitados</div>}
                                            </div>
                                        ) : (
                                            <div className="text-[5.5px] italic text-zinc-400">¡Bienvenidos!</div>
                                        )}
                                        <div className="text-[4px] uppercase text-zinc-400 tracking-wider">Cara Posterior</div>
                                    </div>

                                    {/* Línea Cúspide del Triángulo */}
                                    <div 
                                        className="text-center text-[5.5px] font-bold border-y-2 border-dashed py-0.5"
                                        style={{ borderColor: primaryColor, color: primaryColor }}
                                    >
                                        ▲ ▲ ▲ Doblar aquí (Cúspide superior) ▲ ▲ ▲
                                    </div>

                                    {/* Cara Frontal (Al derecho) */}
                                    <div 
                                        className={`h-[135px] p-1.5 rounded flex flex-col justify-between text-center transition-all ${
                                            borderStyle === 'double' ? 'border-2' :
                                            borderStyle === 'single' ? 'border-2' :
                                            borderStyle === 'rounded' ? 'border-2 rounded-xl' :
                                            borderStyle === 'corners' ? 'border' : 'border-0'
                                        }`}
                                        style={{ 
                                            borderColor: primaryColor,
                                            outline: borderStyle === 'double' ? `1px solid ${primaryColor}` : 'none',
                                            outlineOffset: borderStyle === 'double' ? '-4px' : '0',
                                        }}
                                    >
                                        <div>
                                            <div 
                                                className={`text-[7px] truncate font-bold uppercase ${
                                                    fontTitle === 'cursive' ? 'font-serif italic text-[9px]' : fontTitle === 'sans' ? 'font-sans' : 'font-serif'
                                                }`}
                                                style={{ color: primaryColor }}
                                            >
                                                {title}
                                            </div>
                                            {subtitle && <div className="text-[4.5px] text-zinc-400 truncate">{subtitle}</div>}
                                        </div>

                                        <div>
                                            {prefix && (
                                                <div className="text-[5.5px] uppercase tracking-widest font-black" style={{ color: primaryColor }}>
                                                    {prefix}
                                                </div>
                                            )}
                                            <div 
                                                className={`text-xl font-black leading-none ${fontNumber === 'sans' ? 'font-sans' : 'font-serif'}`}
                                                style={{ color: numberColor }}
                                            >
                                                {tableNumberDisplay}
                                            </div>
                                        </div>

                                        {includeGuests ? (
                                            <div className="text-[5px] text-zinc-600 border border-zinc-200/70 rounded p-0.5 bg-zinc-50/40 leading-tight">
                                                {(currentTable?.guests || []).slice(0, 4).map((g, i) => (
                                                    <div key={i} className="truncate">• {g.name}</div>
                                                ))}
                                                {((currentTable?.guests || []).length > 4) && <div className="text-[4.5px] text-zinc-400">+ más invitados</div>}
                                            </div>
                                        ) : (
                                            <div className="text-[5.5px] italic text-zinc-400">¡Bienvenidos!</div>
                                        )}
                                        <div className="text-[4px] uppercase text-zinc-400 tracking-wider">Cara Frontal</div>
                                    </div>

                                    <div className="text-center text-[5px] text-zinc-400 border-t border-dashed border-zinc-400 py-0.5">
                                        ▼ ▼ ▼ Doblar hacia adentro (Base) ▼ ▼ ▼
                                    </div>

                                    {/* Base de Apoyo */}
                                    <div className="h-8 border border-dashed border-zinc-400 bg-zinc-50/60 flex flex-col items-center justify-center text-[5px] text-zinc-500 text-center px-1">
                                        <span className="font-bold text-[5.5px]">BASE DE APOYO</span>
                                        <span className="truncate max-w-full text-zinc-400">{baseText}</span>
                                    </div>
                                </div>
                            ) : (
                                /* Maqueta 3D Plegada Isométrica */
                                <div className="text-center space-y-4 max-w-xs">
                                    <div className="relative w-48 h-52 mx-auto flex items-center justify-center">
                                        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-xl" xmlns="http://www.w3.org/2000/svg">
                                            {/* Sombra sobre el mantel */}
                                            <ellipse cx="100" cy="175" rx="75" ry="14" fill="#000000" opacity="0.12" />
                                            
                                            {/* Cara Frontal Izquierda */}
                                            <polygon points="100,28 35,160 100,175" fill={bgColor} stroke={primaryColor} strokeWidth="1.5" />
                                            
                                            {/* Cara Posterior Derecha */}
                                            <polygon points="100,28 165,160 100,175" fill={bgColor === '#ffffff' ? '#f4f4f5' : bgColor} stroke={primaryColor} strokeWidth="1.5" />
                                            
                                            {/* Base plana oculta */}
                                            <polygon points="35,160 165,160 100,175" fill="#e4e4e7" stroke="#a1a1aa" strokeWidth="1" strokeDasharray="3 3" />
                                            
                                            {/* Línea Cúspide del Triángulo */}
                                            <line x1="100" y1="28" x2="100" y2="175" stroke={primaryColor} strokeWidth="2" strokeDasharray="3 2" />

                                            {/* Contenido Cara Izquierda */}
                                            <g transform="translate(68, 115) rotate(14)">
                                                {prefix && <text textAnchor="middle" fontSize="7" fontWeight="bold" fill={primaryColor}>{prefix}</text>}
                                                <text textAnchor="middle" y="24" fontSize="22" fontWeight="900" fill={numberColor}>
                                                    {tableNumberDisplay}
                                                </text>
                                                {includeGuests && <text textAnchor="middle" y="36" fontSize="5" fill="#71717a">• Invitados •</text>}
                                            </g>

                                            {/* Contenido Cara Derecha */}
                                            <g transform="translate(132, 115) rotate(-14)">
                                                {prefix && <text textAnchor="middle" fontSize="7" fontWeight="bold" fill={primaryColor}>{prefix}</text>}
                                                <text textAnchor="middle" y="24" fontSize="22" fontWeight="900" fill={numberColor}>
                                                    {tableNumberDisplay}
                                                </text>
                                                {includeGuests && <text textAnchor="middle" y="36" fontSize="5" fill="#71717a">• Invitados •</text>}
                                            </g>

                                            {/* Punto de base de apoyo */}
                                            <circle cx="100" cy="175" r="3" fill="#10b981" />
                                        </svg>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs font-bold text-zinc-900 dark:text-white">
                                            Prisma Triangular con Base de Apoyo
                                        </div>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                            Visible desde ambos lados de la mesa. La base horizontal le da soporte rígido para mantenerse firme sobre el mantel.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 text-center sm:text-left">
                        {selectedTableIds.length === 0 ? (
                            <span className="text-rose-500 font-bold">Seleccioná al menos una mesa.</span>
                        ) : (
                            <span>
                                Se imprimirán <strong>{selectedTableIds.length}</strong> {selectedTableIds.length === 1 ? 'cartel triangular' : 'carteles triangulares'} (1 hoja A4 por mesa).
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-colors"
                        >
                            Cerrar
                        </button>
                        <button
                            type="button"
                            onClick={handlePrint}
                            disabled={selectedTableIds.length === 0}
                            className="flex-1 sm:flex-none px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-extrabold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Imprimir Carteles ({selectedTableIds.length})</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
