import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Check, Layers, Eye, Sparkles, Box, ChevronLeft, ChevronRight, Palette, Type, RotateCcw, Scissors, Upload, Trash2, Image, Flower2 } from 'lucide-react';
import { printHtml, buildTableTentsDocument } from '../eventDocuments';

const FLORAL_MOTIFS = [
    { id: 'eucalyptus', name: '🌿 Eucalipto Acuarela', desc: 'Ramas en base y esquinas (Estilo Aloprint)' },
    { id: 'roses', name: '🌸 Rosas & Flores Silvestres', desc: 'Rosas y peonías blush en acuarela delicada' },
    { id: 'olive', name: '🌿 Ramas de Olivo Nupcial', desc: 'Hojas de olivo mediterráneo y frutos' },
    { id: 'wreath', name: '✨ Corona Floral Envolvente', desc: 'Aro botánico que rodea el número' },
    { id: 'boho', name: '🌾 Pampa Boho & Secas', desc: 'Flores secas y pampas en tonos terracota' },
    { id: 'none', name: '🚫 Sin Flores / Minimalista', desc: 'Diseño limpio sin follaje vegetal' },
];

const PALETTES = [
    {
        id: 'eucalyptus',
        name: '🌿 Eucalipto Acuarela',
        primary: '#557b63',
        number: '#1c1c1e',
        bg: '#faf7f2',
        border: 'botanical',
        motif: 'eucalyptus',
        icon: 'none',
        fontTitle: 'cursive',
        fontNumber: 'brush',
        badge: 'Foto Aloprint',
    },
    {
        id: 'roses',
        name: '🌸 Rosas Blush',
        primary: '#b8525c',
        number: '#1c1c1e',
        bg: '#fff9fa',
        border: 'single',
        motif: 'roses',
        icon: 'none',
        fontTitle: 'cursive',
        fontNumber: 'brush',
        badge: 'Romántico',
    },
    {
        id: 'olive',
        name: '🌿 Olivo Nupcial',
        primary: '#5a684b',
        number: '#1c1c1e',
        bg: '#fbfcf8',
        border: 'botanical',
        motif: 'olive',
        icon: 'none',
        fontTitle: 'cursive',
        fontNumber: 'brush',
    },
    {
        id: 'wreath',
        name: '✨ Corona Dorada',
        primary: '#b58d3d',
        number: '#18181b',
        bg: '#ffffff',
        border: 'double',
        motif: 'wreath',
        icon: 'none',
        fontTitle: 'serif',
        fontNumber: 'serif',
        badge: 'Clásico',
    },
    {
        id: 'boho',
        name: '🌾 Boho Terracota',
        primary: '#b67d58',
        number: '#231c18',
        bg: '#fdfaf6',
        border: 'single',
        motif: 'boho',
        icon: 'none',
        fontTitle: 'cursive',
        fontNumber: 'brush',
    },
    {
        id: 'gold',
        name: 'Oro Champán',
        primary: '#b58d3d',
        number: '#18181b',
        bg: '#ffffff',
        border: 'double',
        motif: 'none',
        icon: 'rings',
    },
    {
        id: 'blacktie',
        name: 'Black Tie Minimal',
        primary: '#18181b',
        number: '#09090b',
        bg: '#ffffff',
        border: 'single',
        motif: 'none',
        icon: 'none',
        fontTitle: 'sans',
        fontNumber: 'sans',
    },
];

const ICONS = [
    { id: 'none', label: 'Sin ícono (Limpio)' },
    { id: 'rings', label: '💍 Alianzas' },
    { id: 'heart', label: '🤍 Corazón' },
    { id: 'toast', label: '🥂 Brindis' },
    { id: 'star', label: '✦ Destello' },
    { id: 'monogram', label: '🔤 Iniciales' },
];

const BORDER_STYLES = [
    { id: 'botanical', label: '🌿 Borde Botánico Suave' },
    { id: 'double', label: 'Doble con Ribete' },
    { id: 'single', label: 'Línea Fina Simple' },
    { id: 'corners', label: 'Esquinas Barrocas' },
    { id: 'rounded', label: 'Redondeado Suave' },
    { id: 'none', label: 'Sin marco' },
];

const getInitialsFromName = (str) => {
    if (!str) return 'M & S';
    const parts = str.split(/\s*(?:&|y|e|\+)\s*/i).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0].charAt(0).toUpperCase()} & ${parts[1].charAt(0).toUpperCase()}`;
    }
    const words = str.trim().split(/\s+/);
    if (words.length >= 2) {
        return `${words[0].charAt(0).toUpperCase()} & ${words[1].charAt(0).toUpperCase()}`;
    }
    return str.slice(0, 3).toUpperCase();
};

export default function TableTentsModal({ isOpen, onClose, event, tables = [], showToast, user }) {
    if (!isOpen) return null;
    if (user && user.role !== 'admin') return null;

    const storageKey = `table_tents_config_${event?.id || 'default'}`;
    const fileInputRef = useRef(null);

    // Default wedding initials (e.g., Marcos y Sabrina -> M & S)
    const weddingInitials = event?.couple_names ? getInitialsFromName(event.couple_names) : 'M & S';
    const fullEventName = event?.couple_names || event?.title || 'Nuestra Boda';
    const defaultTitle = event?.couple_names ? weddingInitials : (event?.title || 'M & S');

    const defaultSubtitle = event?.event_date 
        ? new Date(`${String(event.event_date).slice(0, 10)}T12:00:00`).toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : '';

    // Customization state
    const [title, setTitle] = useState(defaultTitle);
    const [subtitle, setSubtitle] = useState(defaultSubtitle);
    const [prefix, setPrefix] = useState('MESA');
    const [baseText, setBaseText] = useState('¡Gracias por celebrar con nosotros!');
    const [size, setSize] = useState('standard'); // 'standard' (10.5x14cm, 2 por hoja) | 'large' (21x14cm, 1 por hoja)
    const [floralMotif, setFloralMotif] = useState('eucalyptus'); // 'eucalyptus' | 'roses' | 'olive' | 'wreath' | 'boho' | 'none'
    const [bgImage, setBgImage] = useState(null); // Custom background image base64
    const [bgImageOpacity, setBgImageOpacity] = useState(0.85);

    const [fontTitle, setFontTitle] = useState('cursive'); // 'cursive' | 'serif' | 'sans'
    const [fontNumber, setFontNumber] = useState('brush'); // 'brush' | 'serif' | 'sans' | 'cursive'

    const [primaryColor, setPrimaryColor] = useState('#557b63');
    const [numberColor, setNumberColor] = useState('#1c1c1e');
    const [bgColor, setBgColor] = useState('#faf7f2');
    const [borderStyle, setBorderStyle] = useState('botanical');
    const [icon, setIcon] = useState('none');
    const [monogram, setMonogram] = useState('');

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
                if (parsed.size) setSize(parsed.size);
                if (parsed.floralMotif) setFloralMotif(parsed.floralMotif);
                if (parsed.bgImage) setBgImage(parsed.bgImage);
                if (parsed.bgImageOpacity !== undefined) setBgImageOpacity(parsed.bgImageOpacity);
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
                title, subtitle, prefix, baseText, size, floralMotif, bgImage, bgImageOpacity,
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
        if (pal.motif) setFloralMotif(pal.motif);
        if (pal.fontTitle) setFontTitle(pal.fontTitle);
        if (pal.fontNumber) setFontNumber(pal.fontNumber);
    };

    const resetDefaults = () => {
        setTitle(defaultTitle);
        setSubtitle(defaultSubtitle);
        setPrefix('MESA');
        setBaseText('¡Gracias por celebrar con nosotros!');
        setSize('standard');
        setFloralMotif('eucalyptus');
        setBgImage(null);
        setBgImageOpacity(0.85);
        setFontTitle('cursive');
        setFontNumber('brush');
        setPrimaryColor('#557b63');
        setNumberColor('#1c1c1e');
        setBgColor('#faf7f2');
        setBorderStyle('botanical');
        setIcon('none');
        localStorage.removeItem(storageKey);
        if (showToast) showToast('Diseño restablecido.');
    };

    const handleBgImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) {
            if (showToast) showToast('La imagen debe pesar menos de 8MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setBgImage(ev.target.result);
            if (showToast) showToast('Imagen de fondo cargada.');
        };
        reader.readAsDataURL(file);
    };

    const sortedTables = [...tables].sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' }));
    const currentTable = sortedTables[previewIndex] || sortedTables[0];
    const nextTable = sortedTables[previewIndex + 1] || sortedTables[0];

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
                size,
                floralMotif,
                bgImage,
                bgImageOpacity,
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

    const tableNumberDisplay = currentTable?.name.replace(/mesa\s+/i, '') || '4';
    const nextTableNumberDisplay = nextTable?.name.replace(/mesa\s+/i, '') || '5';

    // Decorative Floral Motifs preview helper
    const renderFloralMotifPreview = () => {
        if (floralMotif === 'eucalyptus') {
            return (
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                    <svg className="absolute -bottom-1 -left-1 w-11 h-11" viewBox="0 0 130 130" fill="none">
                        <path d="M-8,140 C22,126 42,98 48,60 C52,32 44,14 38,0" stroke="#52735b" strokeWidth="2.5" strokeLinecap="round" opacity="0.65"/>
                        <ellipse cx="14" cy="112" rx="18" ry="10" transform="rotate(-28 14 112)" fill="#537a5f" fillOpacity="0.75"/>
                        <ellipse cx="34" cy="90" rx="16" ry="9" transform="rotate(-42 34 90)" fill="#688c74" fillOpacity="0.75"/>
                        <ellipse cx="46" cy="68" rx="14" ry="8" transform="rotate(-58 46 68)" fill="#4c7057" fillOpacity="0.8"/>
                        <ellipse cx="68" cy="58" rx="13" ry="7" transform="rotate(12 68 58)" fill="#6f947a" fillOpacity="0.75"/>
                        <circle cx="30" cy="99" r="2.5" fill="#46664f" opacity="0.7"/>
                    </svg>
                    <svg className="absolute -bottom-1 -right-1 w-11 h-11" viewBox="0 0 130 130" fill="none">
                        <path d="M138,140 C108,126 88,98 82,60 C78,32 86,14 92,0" stroke="#52735b" strokeWidth="2.5" strokeLinecap="round" opacity="0.65"/>
                        <ellipse cx="116" cy="112" rx="18" ry="10" transform="rotate(28 116 112)" fill="#537a5f" fillOpacity="0.75"/>
                        <ellipse cx="96" cy="90" rx="16" ry="9" transform="rotate(42 96 90)" fill="#688c74" fillOpacity="0.75"/>
                        <ellipse cx="84" cy="68" rx="14" ry="8" transform="rotate(58 84 68)" fill="#4c7057" fillOpacity="0.8"/>
                        <ellipse cx="62" cy="58" rx="13" ry="7" transform="rotate(-12 62 58)" fill="#6f947a" fillOpacity="0.75"/>
                        <circle cx="100" cy="99" r="2.5" fill="#46664f" opacity="0.7"/>
                    </svg>
                </div>
            );
        }
        if (floralMotif === 'roses') {
            return (
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                    <svg className="absolute -bottom-1 -left-1 w-11 h-11" viewBox="0 0 140 140" fill="none">
                        <ellipse cx="20" cy="118" rx="20" ry="10" transform="rotate(-30 20 118)" fill="#688a70" fillOpacity="0.75"/>
                        <ellipse cx="44" cy="98" rx="18" ry="9" transform="rotate(-48 44 98)" fill="#7d9e85" fillOpacity="0.8"/>
                        <g transform="translate(32, 105)">
                            <circle cx="0" cy="0" r="16" fill="#f4c6cb" fillOpacity="0.9"/>
                            <circle cx="0" cy="0" r="10" fill="#e5989f" fillOpacity="0.85"/>
                            <circle cx="0" cy="0" r="4" fill="#b8525c"/>
                        </g>
                    </svg>
                    <svg className="absolute -bottom-1 -right-1 w-11 h-11" viewBox="0 0 140 140" fill="none">
                        <ellipse cx="120" cy="118" rx="20" ry="10" transform="rotate(30 120 118)" fill="#688a70" fillOpacity="0.75"/>
                        <ellipse cx="96" cy="98" rx="18" ry="9" transform="rotate(48 96 98)" fill="#7d9e85" fillOpacity="0.8"/>
                        <g transform="translate(108, 105)">
                            <circle cx="0" cy="0" r="16" fill="#f4c6cb" fillOpacity="0.9"/>
                            <circle cx="0" cy="0" r="10" fill="#e5989f" fillOpacity="0.85"/>
                            <circle cx="0" cy="0" r="4" fill="#b8525c"/>
                        </g>
                    </svg>
                </div>
            );
        }
        if (floralMotif === 'olive') {
            return (
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                    <svg className="absolute -bottom-1 -left-1 w-11 h-11" viewBox="0 0 130 130" fill="none">
                        <path d="M-5,135 C20,120 40,95 46,60 C50,30 42,12 36,0" stroke="#5a684b" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
                        <ellipse cx="22" cy="112" rx="16" ry="6" transform="rotate(-40 22 112)" fill="#788764" fillOpacity="0.8"/>
                        <ellipse cx="38" cy="88" rx="15" ry="6" transform="rotate(-52 38 88)" fill="#8c9c76" fillOpacity="0.85"/>
                        <ellipse cx="28" cy="100" rx="4" ry="5.5" transform="rotate(-20 28 100)" fill="#353b2d" opacity="0.85"/>
                    </svg>
                    <svg className="absolute -bottom-1 -right-1 w-11 h-11" viewBox="0 0 130 130" fill="none">
                        <path d="M135,135 C110,120 90,95 84,60 C80,30 88,12 94,0" stroke="#5a684b" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
                        <ellipse cx="108" cy="112" rx="16" ry="6" transform="rotate(40 108 112)" fill="#788764" fillOpacity="0.8"/>
                        <ellipse cx="92" cy="88" rx="15" ry="6" transform="rotate(52 92 88)" fill="#8c9c76" fillOpacity="0.85"/>
                        <ellipse cx="102" cy="100" rx="4" ry="5.5" transform="rotate(20 102 100)" fill="#353b2d" opacity="0.85"/>
                    </svg>
                </div>
            );
        }
        if (floralMotif === 'wreath') {
            return (
                <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 pointer-events-none z-0">
                    <svg viewBox="0 0 160 160" fill="none" className="w-full h-full">
                        <circle cx="80" cy="80" r="64" stroke={primaryColor} strokeWidth="1.5" strokeDasharray="4 2" opacity="0.6"/>
                        <circle cx="80" cy="80" r="58" stroke="#52735b" strokeWidth="1" opacity="0.45"/>
                        <ellipse cx="80" cy="20" rx="7" ry="3.5" fill="#7ba087" opacity="0.85"/>
                        <ellipse cx="80" cy="140" rx="7" ry="3.5" fill="#7ba087" opacity="0.85"/>
                        <ellipse cx="20" cy="80" rx="3.5" ry="7" fill="#7ba087" opacity="0.85"/>
                        <ellipse cx="140" cy="80" rx="3.5" ry="7" fill="#7ba087" opacity="0.85"/>
                    </svg>
                </div>
            );
        }
        if (floralMotif === 'boho') {
            return (
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                    <svg className="absolute -bottom-1 -left-1 w-11 h-11" viewBox="0 0 130 130" fill="none">
                        <path d="M0,130 Q35,100 50,55" stroke="#b67d58" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
                        <ellipse cx="50" cy="50" rx="18" ry="6" transform="rotate(-55 50 50)" fill="#dfbaa1" fillOpacity="0.85"/>
                        <ellipse cx="32" cy="80" rx="17" ry="7" transform="rotate(-40 32 80)" fill="#c9916b" fillOpacity="0.8"/>
                    </svg>
                    <svg className="absolute -bottom-1 -right-1 w-11 h-11" viewBox="0 0 130 130" fill="none">
                        <path d="M130,130 Q95,100 80,55" stroke="#b67d58" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
                        <ellipse cx="80" cy="50" rx="18" ry="6" transform="rotate(55 80 50)" fill="#dfbaa1" fillOpacity="0.85"/>
                        <ellipse cx="98" cy="80" rx="17" ry="7" transform="rotate(40 98 80)" fill="#c9916b" fillOpacity="0.8"/>
                    </svg>
                </div>
            );
        }
        return null;
    };

    // Render Face Preview Box
    const renderPreviewFace = (tableObj, faceLabel, isBack = false) => {
        const numDisplay = tableObj?.name.replace(/mesa\s+/i, '') || '4';
        return (
            <div 
                className={`h-[110px] p-1.5 rounded relative overflow-hidden flex items-center justify-center text-center transition-all ${
                    isBack ? 'transform rotate-180' : ''
                } ${
                    borderStyle === 'double' ? 'border-2' :
                    borderStyle === 'single' ? 'border-2' :
                    borderStyle === 'botanical' ? 'border border-emerald-800/20 shadow-inner' :
                    borderStyle === 'rounded' ? 'border-2 rounded-xl' :
                    borderStyle === 'corners' ? 'border' : 'border-0'
                }`}
                style={{ 
                    borderColor: primaryColor,
                    outline: borderStyle === 'double' ? `1px solid ${primaryColor}` : 'none',
                    outlineOffset: borderStyle === 'double' ? '-3px' : '0',
                    backgroundColor: bgColor,
                }}
            >
                {/* Custom Background Image if present */}
                {bgImage && (
                    <div 
                        className="absolute inset-0 bg-cover bg-center pointer-events-none z-0" 
                        style={{ backgroundImage: `url(${bgImage})`, opacity: bgImageOpacity }} 
                    />
                )}

                {/* Built-in Floral Motif */}
                {renderFloralMotifPreview()}

                {/* Bloque Central Unificado: Número + Nombre/Iniciales bajo el número + Fecha */}
                <div className="relative z-10 w-full flex flex-col items-center justify-center text-center -translate-y-1 pointer-events-none px-1">
                    {prefix && (
                        <div className="text-[5.5px] uppercase tracking-widest font-black leading-none mb-0.5" style={{ color: primaryColor }}>
                            {prefix}
                        </div>
                    )}
                    <div 
                        className={`leading-none ${
                            fontNumber === 'brush' ? 'font-serif italic text-3xl font-black' :
                            fontNumber === 'sans' ? 'font-sans text-2xl font-black' :
                            fontNumber === 'cursive' ? 'font-serif italic text-2xl' : 'font-serif text-2xl font-black'
                        }`}
                        style={{ color: numberColor }}
                    >
                        {numDisplay}
                    </div>

                    {/* Nombre o Iniciales DIRECTAMENTE bajo el número, bien alineados */}
                    <div 
                        className={`truncate font-bold leading-tight mt-1 max-w-[95%] ${
                            fontTitle === 'cursive' ? 'font-serif italic text-[11px]' : fontTitle === 'sans' ? 'font-sans text-[8px]' : 'font-serif uppercase tracking-wider text-[8px]'
                        }`}
                        style={{ color: primaryColor }}
                    >
                        {title}
                    </div>

                    {/* Fecha del evento directamente bajo el nombre */}
                    {subtitle && (
                        <div className="text-[5px] text-zinc-500 truncate mt-0.5 leading-none max-w-[95%]">
                            {subtitle}
                        </div>
                    )}

                    <div className="text-[4px] uppercase text-zinc-400 tracking-wider mt-1 leading-none">
                        {faceLabel}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-zinc-950/75 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div 
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/70">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-500 rounded-2xl text-white shadow-md shadow-emerald-500/20">
                            <Box className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-black text-zinc-900 dark:text-white">Carteles de Mesa Plegables (3D)</h2>
                                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/50">
                                    {size === 'standard' ? '2 por Hoja A4 · Escala Real' : '1 por Hoja A4'}
                                </span>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                Agregá flores, subí tu propio fondo o elegí las iniciales de los novios. Se pliega en triángulo con base para el mantel.
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
                                        ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                <Flower2 className="w-3.5 h-3.5" />
                                <span>Flores & Diseño</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('text')}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    activeTab === 'text' 
                                        ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                <Type className="w-3.5 h-3.5" />
                                <span>Iniciales & Textos</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('tables')}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    activeTab === 'tables' 
                                        ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Mesas ({selectedTableIds.length})</span>
                            </button>
                        </div>

                        {/* TAB 1: FLORES, FONDO & COLORES */}
                        {activeTab === 'style' && (
                            <div className="space-y-4">
                                {/* Selector de Tamaño de Impresión */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                                        Tamaño en Mesa y Formato de Impresión
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setSize('standard')}
                                            className={`p-3 rounded-2xl border text-left transition-all ${
                                                size === 'standard'
                                                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                                                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 hover:border-zinc-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black text-zinc-900 dark:text-white">Estándar Mesa (10.5 × 14 cm)</span>
                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                                                    Recomendado (Foto)
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                                                <strong>2 carteles por hoja A4</strong> con corte al medio. Tamaño de mano perfecto para centro de mesa.
                                            </p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setSize('large')}
                                            className={`p-3 rounded-2xl border text-left transition-all ${
                                                size === 'large'
                                                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                                                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 hover:border-zinc-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black text-zinc-900 dark:text-white">Grande (21 × 14 cm)</span>
                                            </div>
                                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                                                <strong>1 cartel por hoja A4</strong>. Ocupa todo el ancho, ideal para buffet o entrada.
                                            </p>
                                        </button>
                                    </div>
                                </div>

                                {/* Motivos Florales Integrados */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            <Flower2 className="w-3.5 h-3.5 text-rose-500" />
                                            Agregar Flores & Motivos Botánicos
                                        </span>
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {FLORAL_MOTIFS.map(m => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setFloralMotif(m.id)}
                                                className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                                                    floralMotif === m.id
                                                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                                                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 hover:border-zinc-300'
                                                }`}
                                            >
                                                <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">{m.name}</div>
                                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 leading-tight line-clamp-2">{m.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Subir Imagen de Fondo Personalizada */}
                                <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                                                <Image className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                <span>Imagen de Fondo Propia (Opcional)</span>
                                            </div>
                                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                Podés subir una acuarela personalizada, diseño de Canva, membrete o textura.
                                            </p>
                                        </div>

                                        <input 
                                            ref={fileInputRef}
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handleBgImageUpload}
                                            className="hidden" 
                                        />

                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 flex items-center gap-1.5 shadow-xs"
                                        >
                                            <Upload className="w-3.5 h-3.5" />
                                            <span>Subir Imagen</span>
                                        </button>
                                    </div>

                                    {bgImage && (
                                        <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2.5">
                                                <img 
                                                    src={bgImage} 
                                                    alt="Preview Fondo" 
                                                    className="w-10 h-10 object-cover rounded-lg border border-zinc-300 dark:border-zinc-700" 
                                                />
                                                <div className="space-y-0.5">
                                                    <div className="text-[11px] font-bold text-zinc-900 dark:text-white">Imagen activa</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-zinc-500">Opacidad: {Math.round(bgImageOpacity * 100)}%</span>
                                                        <input 
                                                            type="range" 
                                                            min="0.1" 
                                                            max="1.0" 
                                                            step="0.05"
                                                            value={bgImageOpacity}
                                                            onChange={e => setBgImageOpacity(parseFloat(e.target.value))}
                                                            className="w-24 accent-emerald-500 cursor-pointer"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setBgImage(null)}
                                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-xs flex items-center gap-1 font-bold"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Quitar
                                            </button>
                                        </div>
                                    )}
                                </div>

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
                                                className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 relative ${
                                                    primaryColor === pal.primary && floralMotif === (pal.motif || 'none')
                                                        ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-1 ring-emerald-500/30'
                                                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700'
                                                }`}
                                            >
                                                <div 
                                                    className="w-5 h-5 rounded-full border shadow-inner shrink-0" 
                                                    style={{ backgroundColor: pal.primary, borderColor: 'rgba(0,0,0,0.1)' }}
                                                />
                                                <div className="min-w-0">
                                                    <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">{pal.name}</div>
                                                    {pal.badge && (
                                                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                                            ★ {pal.badge}
                                                        </span>
                                                    )}
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
                                            <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block mb-1">Color Principal (Iniciales/Marco)</label>
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
                            </div>
                        )}

                        {/* TAB 2: INICIALES, TEXTOS & TIPOGRAFÍAS */}
                        {activeTab === 'text' && (
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                                Texto Principal (Iniciales o Nombre)
                                            </label>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setTitle(weddingInitials)}
                                                    className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800"
                                                >
                                                    💍 Iniciales ({weddingInitials})
                                                </button>
                                                {event?.couple_names && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setTitle(event.couple_names)}
                                                        className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
                                                    >
                                                        Nombre completo
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <input 
                                            type="text" 
                                            value={title} 
                                            onChange={e => setTitle(e.target.value)}
                                            placeholder="Ej: M & S, o Mis 15 Valentina"
                                            className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-300 dark:border-zinc-700 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-serif"
                                        />
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                                            💡 Para bodas se recomienda poner únicamente las iniciales (ej: <strong>M & S</strong>). Si es cumpleaños o evento corporativo, podés colocar el nombre del homenajeado.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                                            Fecha del Evento o Subtítulo (Opcional)
                                        </label>
                                        <input 
                                            type="text" 
                                            value={subtitle} 
                                            onChange={e => setSubtitle(e.target.value)}
                                            placeholder="Ej: Julio del 2025 (o dejar vacío)"
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
                                                placeholder="Ej: MESA o dejar vacío"
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

                                {/* Tipografía del Número */}
                                <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                                        Tipografía del Número de Mesa
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {[
                                            { id: 'brush', name: 'Pincel Artesanal (Foto)', sample: '4', fontClass: 'font-serif text-2xl font-black italic' },
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
                                                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                                                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                                                }`}
                                            >
                                                <div className={`text-xl leading-none ${f.fontClass}`}>{f.sample}</div>
                                                <div className="text-[11px] font-bold mt-1 truncate">{f.name}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tipografía del Título / Iniciales */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                                        Tipografía de las Iniciales
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'cursive', name: 'Caligráfica de Gala', sample: 'Alex Brush', fontClass: 'font-serif italic text-lg' },
                                            { id: 'serif', name: 'Imperial Serif', sample: 'Playfair', fontClass: 'font-serif' },
                                            { id: 'sans', name: 'Moderna Limpia', sample: 'Montserrat', fontClass: 'font-sans' },
                                        ].map(f => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => setFontTitle(f.id)}
                                                className={`p-2.5 rounded-xl border text-center transition-all ${
                                                    fontTitle === f.id
                                                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                                                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                                                }`}
                                            >
                                                <div className={`text-base font-bold truncate ${f.fontClass}`}>Aa</div>
                                                <div className="text-[11px] font-bold mt-0.5 truncate">{f.name}</div>
                                            </button>
                                        ))}
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
                                            className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
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
                                                        ? 'bg-white dark:bg-zinc-800 border-emerald-400 dark:border-emerald-800 text-zinc-900 dark:text-white font-bold shadow-xs'
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
                                    💡 <strong>Tip para el evento:</strong> Cada hoja A4 rinde para <strong>2 mesas completas</strong>. Se cortan por la línea punteada central y se pliegan los vértices en segundos.
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
                                        ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs' 
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                {size === 'standard' ? 'Hoja A4 (2 por hoja)' : 'Hoja A4 (1 por hoja)'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setPreviewMode('3d')}
                                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                                    previewMode === '3d' 
                                        ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs' 
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                Prisma Plegado 3D
                            </button>
                        </div>

                        {/* Preview Display Container */}
                        <div className="flex-1 min-h-[440px] p-3 rounded-3xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center overflow-hidden">
                            {previewMode === 'sheet' ? (
                                size === 'standard' ? (
                                    /* Hoja A4 con 2 Carteles lado a lado */
                                    <div 
                                        className="w-[330px] h-[415px] rounded-lg shadow-xl border border-zinc-300 p-2 flex justify-between select-none relative"
                                        style={{ backgroundColor: '#ffffff' }}
                                    >
                                        {/* Columna Izquierda: Mesa actual */}
                                        <div className="w-[145px] h-full flex flex-col justify-between text-[6.5px]">
                                            <div className="h-5 border border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center text-[5px] text-zinc-400 uppercase">
                                                ✂ Solapa
                                            </div>
                                            <div className="text-center text-[4.5px] text-zinc-400 border-b border-dashed border-zinc-300 py-0.5">
                                                - - Doblar - -
                                            </div>

                                            {renderPreviewFace(currentTable, 'Cara Posterior', true)}

                                            <div className="text-center text-[4.5px] font-bold border-y border-dashed py-0.5" style={{ borderColor: primaryColor, color: primaryColor }}>
                                                ▲ Cúspide ▲
                                            </div>

                                            {renderPreviewFace(currentTable, 'Cara Frontal', false)}

                                            <div className="text-center text-[4.5px] text-zinc-400 border-t border-dashed border-zinc-300 py-0.5">
                                                - - Base - -
                                            </div>
                                            <div className="h-6 border border-dashed border-zinc-300 bg-zinc-50 flex flex-col items-center justify-center text-[4.5px] text-zinc-500 px-1 text-center">
                                                <span className="font-bold text-[5px]">BASE DE APOYO</span>
                                                <span className="truncate max-w-full text-zinc-400">{baseText}</span>
                                            </div>
                                        </div>

                                        {/* Línea Central de Corte */}
                                        <div className="w-5 flex flex-col items-center justify-center relative">
                                            <div className="w-0 flex-1 border-l border-dashed border-zinc-300" />
                                            <div className="my-1 py-1 px-0.5 bg-zinc-100 rounded text-[7px] text-zinc-400 font-bold flex flex-col items-center gap-1">
                                                <Scissors className="w-2.5 h-2.5 text-zinc-400" />
                                                <span className="[writing-mode:vertical-rl] transform rotate-180 text-[5px] uppercase tracking-wider">Corte central</span>
                                            </div>
                                            <div className="w-0 flex-1 border-l border-dashed border-zinc-300" />
                                        </div>

                                        {/* Columna Derecha: Siguiente Mesa */}
                                        <div className="w-[145px] h-full flex flex-col justify-between text-[6.5px]">
                                            <div className="h-5 border border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center text-[5px] text-zinc-400 uppercase">
                                                ✂ Solapa
                                            </div>
                                            <div className="text-center text-[4.5px] text-zinc-400 border-b border-dashed border-zinc-300 py-0.5">
                                                - - Doblar - -
                                            </div>

                                            {renderPreviewFace(nextTable, 'Cara Posterior', true)}

                                            <div className="text-center text-[4.5px] font-bold border-y border-dashed py-0.5" style={{ borderColor: primaryColor, color: primaryColor }}>
                                                ▲ Cúspide ▲
                                            </div>

                                            {renderPreviewFace(nextTable, 'Cara Frontal', false)}

                                            <div className="text-center text-[4.5px] text-zinc-400 border-t border-dashed border-zinc-300 py-0.5">
                                                - - Base - -
                                            </div>
                                            <div className="h-6 border border-dashed border-zinc-300 bg-zinc-50 flex flex-col items-center justify-center text-[4.5px] text-zinc-500 px-1 text-center">
                                                <span className="font-bold text-[5px]">BASE DE APOYO</span>
                                                <span className="truncate max-w-full text-zinc-400">{baseText}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* Hoja A4 con 1 solo Cartel Grande */
                                    <div 
                                        className="w-56 h-[395px] rounded-md shadow-xl border border-zinc-300 p-1.5 flex flex-col justify-between text-[7px] select-none transition-colors"
                                        style={{ backgroundColor: bgColor }}
                                    >
                                        <div className="h-6 border border-dashed border-zinc-400 bg-zinc-50/60 flex items-center justify-center text-[6px] text-zinc-400 font-semibold tracking-wider uppercase">
                                            ✂ Solapa de Pegado
                                        </div>
                                        <div className="text-center text-[5px] text-zinc-400 border-b border-dashed border-zinc-400 py-0.5">
                                            --- Doblar hacia adentro ---
                                        </div>

                                        {renderPreviewFace(currentTable, 'Cara Posterior', true)}

                                        <div className="text-center text-[5.5px] font-bold border-y-2 border-dashed py-0.5" style={{ borderColor: primaryColor, color: primaryColor }}>
                                            ▲ ▲ ▲ Doblar aquí (Cúspide superior) ▲ ▲ ▲
                                        </div>

                                        {renderPreviewFace(currentTable, 'Cara Frontal', false)}

                                        <div className="text-center text-[5px] text-zinc-400 border-t border-dashed border-zinc-400 py-0.5">
                                            ▼ ▼ ▼ Doblar hacia adentro (Base) ▼ ▼ ▼
                                        </div>
                                        <div className="h-8 border border-dashed border-zinc-400 bg-zinc-50/60 flex flex-col items-center justify-center text-[5px] text-zinc-500 text-center px-1">
                                            <span className="font-bold text-[5.5px]">BASE DE APOYO</span>
                                            <span className="truncate max-w-full text-zinc-400">{baseText}</span>
                                        </div>
                                    </div>
                                )
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
                                            
                                            {/* Base plana oculta sobre mantel */}
                                            <polygon points="35,160 165,160 100,175" fill="#e4e4e7" stroke="#a1a1aa" strokeWidth="1" strokeDasharray="3 3" />
                                            
                                            {/* Línea Cúspide del Triángulo */}
                                            <line x1="100" y1="28" x2="100" y2="175" stroke={primaryColor} strokeWidth="2" strokeDasharray="3 2" />

                                            {/* Hojas botánicas en la base 3D */}
                                            {floralMotif !== 'none' && (
                                                <g opacity="0.8">
                                                    <ellipse cx="45" cy="155" rx="8" ry="4" transform="rotate(-15 45 155)" fill={primaryColor} />
                                                    <ellipse cx="58" cy="160" rx="9" ry="5" transform="rotate(10 58 160)" fill="#7ba087" />
                                                    <ellipse cx="155" cy="155" rx="8" ry="4" transform="rotate(15 155 155)" fill={primaryColor} />
                                                    <ellipse cx="142" cy="160" rx="9" ry="5" transform="rotate(-10 142 160)" fill="#7ba087" />
                                                </g>
                                            )}

                                            {/* Contenido Cara Izquierda */}
                                            <g transform="translate(68, 115) rotate(14)">
                                                {prefix && <text textAnchor="middle" fontSize="6.5" fontWeight="bold" fill={primaryColor}>{prefix}</text>}
                                                <text textAnchor="middle" y="24" fontSize="24" fontWeight="900" fill={numberColor}>
                                                    {tableNumberDisplay}
                                                </text>
                                                <text textAnchor="middle" y="35" fontSize="7" fontStyle="italic" fontWeight="bold" fill={primaryColor}>
                                                    {title}
                                                </text>
                                                {subtitle && <text textAnchor="middle" y="43" fontSize="4.5" fill="#71717a">{subtitle}</text>}
                                            </g>

                                            {/* Contenido Cara Derecha */}
                                            <g transform="translate(132, 115) rotate(-14)">
                                                {prefix && <text textAnchor="middle" fontSize="6.5" fontWeight="bold" fill={primaryColor}>{prefix}</text>}
                                                <text textAnchor="middle" y="24" fontSize="24" fontWeight="900" fill={numberColor}>
                                                    {tableNumberDisplay}
                                                </text>
                                                <text textAnchor="middle" y="35" fontSize="7" fontStyle="italic" fontWeight="bold" fill={primaryColor}>
                                                    {title}
                                                </text>
                                                {subtitle && <text textAnchor="middle" y="43" fontSize="4.5" fill="#71717a">{subtitle}</text>}
                                            </g>

                                            {/* Punto de base de apoyo */}
                                            <circle cx="100" cy="175" r="3" fill="#10b981" />
                                        </svg>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs font-bold text-zinc-900 dark:text-white">
                                            Prisma Triangular con Base de Apoyo (10.5 × 14 cm)
                                        </div>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                            Visible desde ambos lados de la mesa. La base horizontal le da soporte rígido para que no se caiga sobre el mantel.
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
                                Se imprimirán <strong>{selectedTableIds.length}</strong> {selectedTableIds.length === 1 ? 'cartel triangular' : 'carteles triangulares'} ({size === 'standard' ? `${Math.ceil(selectedTableIds.length / 2)} hojas A4 · 2 carteles por hoja (10.5 × 14 cm)` : `${selectedTableIds.length} hojas A4 · 1 por hoja`}).
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
                            className="flex-1 sm:flex-none px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
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
