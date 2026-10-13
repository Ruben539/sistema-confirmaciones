import React, { useRef, useState } from 'react';
import { Wand2, Upload, Trash2, Palette, Type, Image as ImageIcon, Sparkles, Layout, Check, Clock, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../api';
import {
    BODY_FONTS, ADVANCED_PRESETS, FLORAL_WINE_PRESET, HEADING_FONTS, SCRIPT_FONTS,
    buildThemeStyle, fontStack, isAdvancedDesign, useInvitationFonts, formatInvitationDate,
} from '../invitationTheme';

const labelClass = 'block text-[11px] font-bold text-zinc-300 mb-1';
const inputClass = 'w-full text-xs rounded-xl border border-zinc-700 bg-zinc-900 text-white p-2.5 outline-none focus:ring-2 focus:ring-amber-500 transition-all';

function ColorField({ label, value, onChange }) {
    return (
        <div>
            <label className={labelClass}>{label}</label>
            <div className="flex items-center gap-2 bg-zinc-900 p-1.5 rounded-xl border border-zinc-700/80">
                <input
                    type="color"
                    value={value || '#000000'}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-zinc-700 bg-transparent cursor-pointer shrink-0"
                />
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full text-xs font-mono uppercase bg-transparent text-white outline-none"
                />
            </div>
        </div>
    );
}

function FontField({ label, value, options, sample, onChange }) {
    return (
        <div>
            <label className={labelClass}>{label}</label>
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className={inputClass}
            >
                {options.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                ))}
            </select>
            <div
                className="mt-2 text-lg text-zinc-100 truncate px-2 py-1 rounded bg-zinc-900/60 border border-zinc-800"
                style={{ fontFamily: fontStack(value) }}
            >
                {sample}
            </div>
        </div>
    );
}

export default function AdvancedDesignEditor({ event, styles, setStyles }) {
    const enabled = isAdvancedDesign(styles);
    const fileRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);

    useInvitationFonts(enabled ? [styles.heading_font, styles.script_font, styles.body_font] : []);

    const set = (patch) => setStyles((prev) => ({ ...prev, ...patch, preset: 'custom' }));

    const enable = () => setStyles((prev) => ({
        ...FLORAL_WINE_PRESET,
        ...pickAdvanced(prev),
        design: 'advanced',
        preset: 'custom'
    }));

    const applyPreset = (preset) => {
        setStyles((prev) => ({
            ...prev,
            ...preset,
            background_image_url: prev.background_image_url, // keep uploaded image if any
            hero_subtitle: prev.hero_subtitle || preset.hero_subtitle,
            design: 'advanced',
            preset: preset.id,
        }));
    };

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setUploadError(null);
        const form = new FormData();
        form.append('image', file);
        const { ok, json } = await apiFetch(`/api/events/${event.id}/invitation-background`, {
            method: 'POST',
            body: form
        });
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
        if (ok && json?.url) {
            set({ background_image_url: json.url });
        } else {
            setUploadError(json?.errors ? Object.values(json.errors).flat()[0] : json?.message || 'No se pudo subir la imagen.');
        }
    };

    if (!enabled) {
        return (
            <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-950/30 via-zinc-900 to-amber-950/30 border border-amber-500/40 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-300 tracking-wider">
                        <Wand2 className="w-4 h-4 text-amber-400" />
                        <span>Diseño Avanzado y Personalización Total</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                        Pro Design
                    </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                    Convertí la invitación en una tarjeta de lujo completa (estilo quinceañera o gala formal con marco floral, caligrafías manuscritas, fondo personalizado, y paletas armónicas ilimitadas).
                </p>
                <button
                    type="button"
                    onClick={enable}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-zinc-950 text-xs font-black shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                    <Sparkles className="w-4 h-4" />
                    <span>Activar Diseño Avanzado</span>
                </button>
            </div>
        );
    }

    return (
        <div className="p-5 rounded-3xl bg-zinc-950/80 border border-amber-500/40 space-y-6 shadow-xl">
            {/* Header / Active status */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        <Wand2 className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-xs font-black uppercase text-amber-300 tracking-wider">
                            Diseño Avanzado Activado
                        </div>
                        <div className="text-[10px] text-zinc-400">
                            Personalizá toda la estética: fondos, tarjetas, tipografías y textos formales
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => set({ design: 'basic' })}
                        className="px-3 py-1.5 rounded-xl text-zinc-400 hover:text-rose-300 text-xs font-bold transition-colors cursor-pointer"
                    >
                        Desactivar
                    </button>
                </div>
            </div>

            {/* 1. CURATED PRESETS */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Colección de Diseños Temáticos (1 Clic)</span>
                    </label>
                    <span className="text-[10px] text-zinc-400">Podés modificarlos a gusto</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {ADVANCED_PRESETS.map((preset) => {
                        const isCurrent = styles.preset === preset.id;
                        return (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => applyPreset(preset)}
                                className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                                    isCurrent
                                        ? 'bg-zinc-900 border-amber-400 ring-2 ring-amber-400/30 shadow-md'
                                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="w-3.5 h-3.5 rounded-full border border-white/30 shadow-sm"
                                            style={{ backgroundColor: preset.primary_color }}
                                        />
                                        <span
                                            className="w-3.5 h-3.5 rounded-full border border-white/30 shadow-sm -ml-2"
                                            style={{ backgroundColor: preset.secondary_color }}
                                        />
                                        <span className="text-xs font-bold text-white">{preset.name}</span>
                                    </div>
                                    {isCurrent && (
                                        <span className="p-0.5 rounded-full bg-amber-400 text-zinc-950">
                                            <Check className="w-3 h-3 stroke-[3]" />
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-zinc-400 leading-snug">{preset.desc}</p>
                                {preset.badge && (
                                    <span className="mt-2 inline-block self-start text-[9px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                                        {preset.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. COVER FORMAT & CARD STYLE */}
            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
                <div className="text-[11px] font-black uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
                    <Layout className="w-3.5 h-3.5 text-amber-400" />
                    <span>Formato de Portada & Tarjeta</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={labelClass}>Estructura de la Portada</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'formal_card', label: 'Tarjeta Formal de Lujo', desc: 'Como en la foto (nombres, fecha en números, salón, hora y filigrana)' },
                                { id: 'classic_banner', label: 'Banner Moderno', desc: 'Encabezado con foto de portada y títulos tradicionales' },
                            ].map((f) => (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => set({ card_layout: f.id })}
                                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                        (styles.card_layout || 'formal_card') === f.id
                                            ? 'bg-amber-500/15 border-amber-400 text-amber-200'
                                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                                    }`}
                                >
                                    <div className="text-xs font-bold text-white">{f.label}</div>
                                    <div className="text-[10px] text-zinc-400 leading-tight mt-0.5">{f.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Estilo Visual de Tarjetas</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'framed', label: 'Enmarcada', desc: 'Bordes suaves' },
                                { id: 'glass', label: 'Cristal Glass', desc: 'Translúcida blur' },
                                { id: 'solid', label: 'Sólida Opaca', desc: 'Color uniforme' },
                            ].map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => set({ card_style: c.id })}
                                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                                        (styles.card_style || 'framed') === c.id
                                            ? 'bg-amber-500/15 border-amber-400 text-amber-200'
                                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                                    }`}
                                >
                                    <div className="text-xs font-bold text-white">{c.label}</div>
                                    <div className="text-[10px] text-zinc-400">{c.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. BACKGROUND IMAGE & COLOR */}
            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
                <div className="text-[11px] font-black uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Fondo de la Web / Marco de Invitación</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <div
                        className="w-full sm:w-36 h-44 rounded-2xl border border-zinc-700 shrink-0 bg-center flex items-center justify-center text-[10px] text-zinc-500 shadow-inner overflow-hidden relative"
                        style={{
                            backgroundColor: styles.background_color || '#EFE6DF',
                            backgroundImage: styles.background_image_url ? `url("${styles.background_image_url}")` : 'none',
                            backgroundSize: styles.background_fit === 'repeat' ? 'auto' : (styles.background_fit || 'cover'),
                            backgroundRepeat: styles.background_fit === 'repeat' ? 'repeat' : 'no-repeat',
                        }}
                    >
                        {!styles.background_image_url && <span>Sin imagen de fondo</span>}
                    </div>

                    <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                disabled={uploading}
                                onClick={() => fileRef.current?.click()}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-zinc-700 disabled:opacity-60 cursor-pointer shadow"
                            >
                                <Upload className="w-4 h-4 text-amber-400" />
                                <span>{uploading ? 'Subiendo imagen...' : styles.background_image_url ? 'Cambiar imagen' : 'Subir imagen o marco de fondo'}</span>
                            </button>
                            {styles.background_image_url && (
                                <button
                                    type="button"
                                    onClick={() => set({ background_image_url: null })}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-zinc-400 hover:text-rose-400 text-xs font-bold transition-colors cursor-pointer"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Quitar imagen</span>
                                </button>
                            )}
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={handleUpload}
                            />
                        </div>

                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                            💡 <strong>Consejo pro:</strong> Podés subir una imagen vertical (ej. 1080×1920 px) diseñada en Canva con marco de flores o texturas en los laterales y el centro despejado, igual que en las tarjetas impresas.
                        </p>

                        {uploadError && (
                            <p className="text-xs text-rose-400 font-semibold bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                                {uploadError}
                            </p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div>
                                <label className={labelClass}>Ajuste de la imagen</label>
                                <select
                                    value={styles.background_fit || 'cover'}
                                    onChange={(e) => set({ background_fit: e.target.value })}
                                    className={inputClass}
                                >
                                    <option value="cover">Cubrir toda la pantalla (Cover)</option>
                                    <option value="contain">Imagen completa (Contain)</option>
                                    <option value="repeat">Mosaico / Patrón repetido</option>
                                </select>
                            </div>

                            <ColorField
                                label="Color base de fondo"
                                value={styles.background_color || '#EFE6DF'}
                                onChange={(v) => set({ background_color: v })}
                            />

                            <ColorField
                                label="Color del velo (capa)"
                                value={styles.background_overlay_color || '#FFFFFF'}
                                onChange={(v) => set({ background_overlay_color: v })}
                            />

                            <div>
                                <label className={labelClass}>
                                    Intensidad del velo: {styles.background_overlay_opacity ?? 0}%
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="85"
                                    value={styles.background_overlay_opacity ?? 0}
                                    onChange={(e) => set({ background_overlay_opacity: Number(e.target.value) })}
                                    className="w-full accent-amber-500 mt-2"
                                />
                                <p className="text-[10px] text-zinc-500">Aumentala si el texto cuesta leerse sobre el fondo.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. FORMAL CARD TEXTS */}
            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                <div className="text-[11px] font-black uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-amber-400" />
                    <span>Textos de la Tarjeta Formal</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label className={labelClass}>Frase superior / Ocasión</label>
                        <input
                            value={styles.hero_tagline || ''}
                            onChange={(e) => set({ hero_tagline: e.target.value })}
                            className={inputClass}
                            placeholder="INVITA A SU FIESTA DE QUINCE"
                            maxLength={80}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Subtítulo en cursiva (Apellidos / Romántico)</label>
                        <input
                            value={styles.hero_subtitle || ''}
                            onChange={(e) => set({ hero_subtitle: e.target.value })}
                            className={inputClass}
                            placeholder="Insfran Badgen"
                            maxLength={80}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Horario a mostrar (opcional)</label>
                        <input
                            value={styles.hero_time || ''}
                            onChange={(e) => set({ hero_time: e.target.value })}
                            className={inputClass}
                            placeholder="22 HORAS (o automático)"
                            maxLength={40}
                        />
                    </div>
                </div>
            </div>

            {/* 5. COLOR PALETTE */}
            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                <div className="text-[11px] font-black uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-amber-400" />
                    <span>Paleta Completa de Colores</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <ColorField label="Títulos principales" value={styles.heading_color || '#8E2F3C'} onChange={(v) => set({ heading_color: v })} />
                    <ColorField label="Texto principal" value={styles.text_color || '#4A2C2F'} onChange={(v) => set({ text_color: v })} />
                    <ColorField label="Texto secundario" value={styles.muted_color || '#8A6E6E'} onChange={(v) => set({ muted_color: v })} />
                    <ColorField label="Botones & Acentos" value={styles.primary_color || '#9F1239'} onChange={(v) => set({ primary_color: v })} />
                    <ColorField label="Fondo de tarjetas" value={styles.card_color || '#FBF6F1'} onChange={(v) => set({ card_color: v })} />
                    <ColorField label="Bordes decorativos" value={styles.border_color || '#E6CFC6'} onChange={(v) => set({ border_color: v })} />
                </div>

                <div className="pt-2">
                    <label className={labelClass}>
                        Opacidad de las tarjetas: {styles.card_opacity ?? 90}%
                        {(styles.card_opacity ?? 90) < 75 && ' (efecto translúcido donde se aprecia el fondo)'}
                    </label>
                    <input
                        type="range"
                        min="20"
                        max="100"
                        value={styles.card_opacity ?? 90}
                        onChange={(e) => set({ card_opacity: Number(e.target.value) })}
                        className="w-full accent-amber-500 mt-1"
                    />
                </div>
            </div>

            {/* 6. TYPOGRAPHY */}
            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                <div className="text-[11px] font-black uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tipografías de Google Fonts</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FontField
                        label="Títulos (Nombre / Fecha)"
                        value={styles.heading_font || 'Cinzel'}
                        options={HEADING_FONTS}
                        sample={event.couple_names || event.title || 'CANDELA'}
                        onChange={(v) => set({ heading_font: v })}
                    />
                    <FontField
                        label="Caligrafía Cursiva (Día / Subtítulo)"
                        value={styles.script_font || 'Great Vibes'}
                        options={SCRIPT_FONTS}
                        sample={styles.hero_subtitle || 'Insfran Badgen'}
                        onChange={(v) => set({ script_font: v })}
                    />
                    <FontField
                        label="Cuerpo de texto"
                        value={styles.body_font || 'Plus Jakarta Sans'}
                        options={BODY_FONTS}
                        sample="Te esperamos para celebrar juntos"
                        onChange={(v) => set({ body_font: v })}
                    />
                </div>
            </div>
        </div>
    );
}

function pickAdvanced(prev) {
    const keys = [
        'background_image_url', 'background_fit', 'background_color', 'background_overlay_color', 'background_overlay_opacity',
        'heading_color', 'text_color', 'muted_color', 'card_color', 'card_opacity', 'border_color',
        'heading_font', 'script_font', 'body_font', 'hero_tagline', 'hero_subtitle', 'hero_time',
        'card_layout', 'card_style',
    ];
    return Object.fromEntries(
        keys.filter((k) => prev?.[k] !== undefined && prev?.[k] !== null && prev?.[k] !== '').map((k) => [k, prev[k]])
    );
}

/**
 * LIVE PREVIEW of the formal card design (exactly reproducing the card in the reference photo)
 */
export function AdvancedDesignPreview({ event, styles }) {
    useInvitationFonts([styles.heading_font, styles.script_font, styles.body_font]);
    const themeStyle = { ...buildThemeStyle(styles), backgroundAttachment: 'scroll' };
    const dateInfo = formatInvitationDate(event.event_date, styles.hero_time);

    return (
        <div
            className={`inv-themed ${styles.card_style === 'glass' ? 'inv-glass' : ''} rounded-3xl p-4 sm:p-6 border border-zinc-800 transition-all`}
            style={themeStyle}
        >
            {/* The Formal Card */}
            <div
                className="max-w-xs sm:max-w-sm mx-auto rounded-3xl p-6 sm:p-8 text-center shadow-xl border relative overflow-hidden"
                style={{
                    backgroundColor: 'var(--inv-card-bg)',
                    borderColor: 'var(--inv-border)',
                }}
            >
                {/* 1. Occasion / Tagline */}
                <div
                    className="text-[10px] uppercase font-semibold mb-4 tracking-[0.2em]"
                    style={{ fontFamily: 'var(--inv-heading-font)', color: 'var(--inv-heading)' }}
                >
                    {styles.hero_tagline || 'INVITA A SU FIESTA DE QUINCE'}
                </div>

                {/* 2. Main Name */}
                <h1
                    className="text-3xl sm:text-4xl uppercase tracking-[0.1em] font-normal leading-none mb-1"
                    style={{ fontFamily: 'var(--inv-heading-font)', color: 'var(--inv-heading)' }}
                >
                    {event.couple_names || event.title || 'CANDELA'}
                </h1>

                {/* 3. Cursive Subtitle */}
                {styles.hero_subtitle && (
                    <p
                        className="inv-script text-2xl sm:text-3xl leading-tight -mt-1 mb-5"
                        style={{ fontFamily: 'var(--inv-script-font)', color: 'var(--inv-heading)' }}
                    >
                        {styles.hero_subtitle}
                    </p>
                )}

                {/* 4. Day in script & Date in numbers */}
                <div className="my-5 space-y-1">
                    <div
                        className="inv-script text-2xl leading-none"
                        style={{ fontFamily: 'var(--inv-script-font)', color: 'var(--inv-heading)' }}
                    >
                        {dateInfo.weekday || 'Viernes'}
                    </div>
                    <div
                        className="text-2xl sm:text-3xl font-normal tracking-[0.12em]"
                        style={{ fontFamily: 'var(--inv-heading-font)', color: 'var(--inv-heading)' }}
                    >
                        {dateInfo.numericDate || '16.10.26'}
                    </div>
                </div>

                {/* 5. Location */}
                <div
                    className="text-xs uppercase tracking-[0.15em] font-semibold mt-4"
                    style={{ fontFamily: 'var(--inv-heading-font)', color: 'var(--inv-heading)' }}
                >
                    {(event.location ? event.location.split(',')[0] : 'MORGAN WAREHOUSE')}
                </div>

                {/* 6. Time */}
                <div
                    className="text-[11px] uppercase tracking-[0.15em] font-medium mt-1 opacity-90"
                    style={{ fontFamily: 'var(--inv-heading-font)', color: 'var(--inv-heading)' }}
                >
                    {dateInfo.time || '22 HORAS'}
                </div>

                {/* 7. Dress Code */}
                {(event.dress_code || styles.hero_dress_code) && (
                    <div
                        className="text-[10px] uppercase tracking-[0.18em] font-medium mt-5 opacity-85"
                        style={{ fontFamily: 'var(--inv-heading-font)', color: 'var(--inv-heading)' }}
                    >
                        {event.dress_code || styles.hero_dress_code || 'TENIDA BOLICHE'}
                    </div>
                )}

                {/* 8. Ornamental Divider */}
                <div className="flex items-center justify-center gap-2 mt-3 opacity-70">
                    <div className="h-px w-8" style={{ backgroundColor: 'var(--inv-border)' }} />
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--inv-primary)' }}>
                        <path d="M12 3C12 3 13.5 7 17 8.5C13.5 10 12 14 12 14C12 14 10.5 10 7 8.5C10.5 7 12 3 12 3Z" />
                    </svg>
                    <div className="h-px w-8" style={{ backgroundColor: 'var(--inv-border)' }} />
                </div>
            </div>

            {/* Mini action button below card */}
            <div className="mt-4 text-center">
                <button
                    type="button"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md"
                    style={{ backgroundColor: 'var(--inv-primary)' }}
                >
                    Confirmar Asistencia
                </button>
            </div>
        </div>
    );
}
