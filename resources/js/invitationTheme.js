import { useEffect } from 'react';

// "Diseño avanzado" of the digital invitation: fonts, colors and background image chosen by the
// planner, applied to the whole invitation through CSS variables (see .inv-themed in app.css).

export const HEADING_FONTS = [
    { id: 'Cinzel', label: 'Cinzel (romana / clásica)' },
    { id: 'Playfair Display', label: 'Playfair Display (editorial)' },
    { id: 'Cormorant Garamond', label: 'Cormorant (elegante)' },
    { id: 'Bodoni Moda', label: 'Bodoni (lujo contemporáneo)' },
    { id: 'Marcellus', label: 'Marcellus (sobria & refinada)' },
    { id: 'Libre Baskerville', label: 'Baskerville (tradicional)' },
    { id: 'Montserrat', label: 'Montserrat (moderna sans)' },
    { id: 'Josefin Sans', label: 'Josefin (minimalista)' },
];

export const SCRIPT_FONTS = [
    { id: 'Great Vibes', label: 'Great Vibes (romántica fluida)' },
    { id: 'Parisienne', label: 'Parisienne (caligrafía francesa)' },
    { id: 'Allura', label: 'Allura (sutil y suave)' },
    { id: 'Alex Brush', label: 'Alex Brush (dinámica de gala)' },
    { id: 'Pinyon Script', label: 'Pinyon Script (cursiva de lujo)' },
    { id: 'Sacramento', label: 'Sacramento (monolínea delicada)' },
    { id: 'Dancing Script', label: 'Dancing Script (fresca e informal)' },
];

export const BODY_FONTS = [
    { id: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans (moderna)' },
    { id: 'Montserrat', label: 'Montserrat' },
    { id: 'Lora', label: 'Lora (serif editorial)' },
    { id: 'Cormorant Garamond', label: 'Cormorant' },
    { id: 'Josefin Sans', label: 'Josefin Sans' },
    { id: 'Poppins', label: 'Poppins' },
];

const SCRIPT_IDS = new Set(SCRIPT_FONTS.map((f) => f.id));
const FALLBACK = { script: 'cursive', serif: 'Georgia, serif', sans: 'ui-sans-serif, system-ui, sans-serif' };
const SERIF_IDS = new Set(['Cinzel', 'Playfair Display', 'Cormorant Garamond', 'Bodoni Moda', 'Marcellus', 'Libre Baskerville', 'Lora']);

export const fontStack = (family) => {
    if (!family) return null;
    const fallback = SCRIPT_IDS.has(family) ? FALLBACK.script : SERIF_IDS.has(family) ? FALLBACK.serif : FALLBACK.sans;
    return `'${family}', ${fallback}`;
};

// Loads the chosen Google Fonts once (a single <link> per set of families)
export function useInvitationFonts(families) {
    const key = (families || []).filter(Boolean).sort().join('|');
    useEffect(() => {
        if (!key) return;
        const params = key
            .split('|')
            .map((f) => `family=${f.replace(/ /g, '+')}${SCRIPT_IDS.has(f) ? '' : ':wght@400;500;600;700'}`)
            .join('&');
        const href = `https://fonts.googleapis.com/css2?${params}&display=swap`;
        if (document.querySelector(`link[data-inv-fonts="${key}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset.invFonts = key;
        document.head.appendChild(link);
    }, [key]);
}

export const hexToRgba = (hex, alpha = 1) => {
    const clean = String(hex || '').trim();
    const m = /^#?([0-9a-f]{6})$/i.exec(clean);
    if (!m) {
        const m3 = /^#?([0-9a-f]{3})$/i.exec(clean);
        if (m3) {
            const r = parseInt(m3[1][0] + m3[1][0], 16);
            const g = parseInt(m3[1][1] + m3[1][1], 16);
            const b = parseInt(m3[1][2] + m3[1][2], 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return hex || 'transparent';
    }
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export const isAdvancedDesign = (styles) => styles?.design === 'advanced';

/**
 * Formats event date gracefully for the formal card (like "Viernes 16.10.26 / 22 horas")
 */
export function formatInvitationDate(dateStr, customTime) {
    if (!dateStr) return { weekday: '', numericDate: '', time: customTime || '' };
    try {
        const clean = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
        const d = new Date(clean.includes('T') ? clean : `${clean}T00:00:00`);
        if (isNaN(d.getTime())) return { weekday: '', numericDate: '', time: customTime || '' };

        const weekdayRaw = d.toLocaleDateString('es-AR', { weekday: 'long' });
        const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);

        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = String(d.getFullYear()).slice(-2);
        const numericDate = `${day}.${month}.${year}`;

        let time = customTime || '';
        if (!time && clean.includes('T')) {
            const timePart = clean.split('T')[1]?.slice(0, 5);
            if (timePart && timePart !== '00:00') {
                const [hh, mm] = timePart.split(':');
                time = mm === '00' ? `${parseInt(hh, 10)} horas` : `${hh}:${mm} hs`;
            }
        }
        return { weekday, numericDate, time };
    } catch {
        return { weekday: '', numericDate: '', time: customTime || '' };
    }
}

/**
 * CSS variables + page background for the advanced design.
 * Returns a style object for the invitation root (or the editor's preview).
 */
export function buildThemeStyle(styles) {
    const s = styles || {};
    const overlayAlpha = Math.min(0.95, Math.max(0, (Number(s.background_overlay_opacity) || 0) / 100));
    const cardAlpha = Math.min(1, Math.max(0, (s.card_opacity ?? 90) / 100));
    const layers = [];
    if (s.background_image_url) {
        layers.push(`linear-gradient(${hexToRgba(s.background_overlay_color || '#ffffff', overlayAlpha)}, ${hexToRgba(s.background_overlay_color || '#ffffff', overlayAlpha)})`);
        layers.push(`url("${s.background_image_url}")`);
    }
    const fit = s.background_fit || 'cover';

    return {
        '--inv-primary': s.primary_color || '#9F1239',
        '--inv-secondary': s.secondary_color || '#BE123C',
        '--inv-heading': s.heading_color || '#8E2F3C',
        '--inv-text': s.text_color || '#4A2C2F',
        '--inv-muted': s.muted_color || '#8A6E6E',
        '--inv-card-bg': hexToRgba(s.card_color || '#FFFBF7', cardAlpha),
        '--inv-border': hexToRgba(s.border_color || '#E7D6CC', 0.85),
        '--inv-heading-font': fontStack(s.heading_font) || "'Cinzel', Georgia, serif",
        '--inv-script-font': fontStack(s.script_font) || "'Great Vibes', cursive",
        '--inv-body-font': fontStack(s.body_font) || "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
        backgroundColor: s.background_color || '#EFE6DF',
        backgroundImage: layers.length ? layers.join(', ') : 'none',
        backgroundSize: fit === 'repeat' ? 'auto' : fit,
        backgroundRepeat: fit === 'repeat' ? 'repeat' : 'no-repeat',
        backgroundPosition: 'center top',
    };
}

/**
 * CURATED PRESETS: 7 complete, distinct design identities
 * Covers 15 años, weddings, galas, botanical, boho, and clean minimalist.
 */
export const ADVANCED_PRESETS = [
    {
        id: 'floral_wine',
        name: 'Floral Vino & Quince',
        desc: 'Marsala, crema y caligrafía romántica con marco floral (como Candela)',
        badge: 'Estilo de la foto',
        primary_color: '#9F1239',
        secondary_color: '#BE123C',
        heading_color: '#8E2F3C',
        text_color: '#4A2C2F',
        muted_color: '#8A6E6E',
        background_color: '#EFE6DF',
        background_overlay_color: '#FFFFFF',
        background_overlay_opacity: 0,
        background_fit: 'cover',
        card_color: '#FBF6F1',
        card_opacity: 92,
        border_color: '#E6CFC6',
        heading_font: 'Cinzel',
        script_font: 'Great Vibes',
        body_font: 'Cormorant Garamond',
        card_style: 'framed',
        card_layout: 'formal_card',
        envelope_color: '#7F1D1D',
        envelope_seal_color: '#BE123C',
        hero_tagline: 'Invita a su fiesta de quince',
        sample_dot: '#8E2F3C',
    },
    {
        id: 'black_gold_gala',
        name: 'Gala Black & Gold',
        desc: 'Negro carbón profundo, oro champaña y tipografía editorial de noche',
        badge: 'Gala Nocturna',
        primary_color: '#D4AF37',
        secondary_color: '#F59E0B',
        heading_color: '#F5D061',
        text_color: '#F4F4F5',
        muted_color: '#A1A1AA',
        background_color: '#09090B',
        background_overlay_color: '#000000',
        background_overlay_opacity: 40,
        background_fit: 'cover',
        card_color: '#18181B',
        card_opacity: 88,
        border_color: '#D4AF37',
        heading_font: 'Bodoni Moda',
        script_font: 'Alex Brush',
        body_font: 'Montserrat',
        card_style: 'framed',
        card_layout: 'formal_card',
        envelope_color: '#18181B',
        envelope_seal_color: '#D4AF37',
        hero_tagline: 'Celebración de Gala',
        sample_dot: '#D4AF37',
    },
    {
        id: 'botanical_sage',
        name: 'Botánica & Eucalipto',
        desc: 'Verde salvia, eucalipto silvestre y blanco natural campestre',
        badge: 'Boda al Aire Libre',
        primary_color: '#2D5A43',
        secondary_color: '#497A5E',
        heading_color: '#204030',
        text_color: '#2A3B31',
        muted_color: '#657B6E',
        background_color: '#EDF1EE',
        background_overlay_color: '#FFFFFF',
        background_overlay_opacity: 10,
        background_fit: 'cover',
        card_color: '#F7F9F7',
        card_opacity: 92,
        border_color: '#CCD8D0',
        heading_font: 'Cormorant Garamond',
        script_font: 'Parisienne',
        body_font: 'Plus Jakarta Sans',
        card_style: 'framed',
        card_layout: 'formal_card',
        envelope_color: '#204030',
        envelope_seal_color: '#527D65',
        hero_tagline: 'Nuestra Boda',
        sample_dot: '#2D5A43',
    },
    {
        id: 'boho_terracotta',
        name: 'Boho Terracota & Arena',
        desc: 'Tonos tierra cálidos, arena del desierto y pampas rústicas',
        badge: 'Atardecer Rústico',
        primary_color: '#A0472E',
        secondary_color: '#C86D51',
        heading_color: '#7D331F',
        text_color: '#4A2A20',
        muted_color: '#8A6D63',
        background_color: '#EFE7DE',
        background_overlay_color: '#FFFFFF',
        background_overlay_opacity: 0,
        background_fit: 'cover',
        card_color: '#FAF5EE',
        card_opacity: 90,
        border_color: '#DECFC1',
        heading_font: 'Playfair Display',
        script_font: 'Pinyon Script',
        body_font: 'Lora',
        card_style: 'framed',
        card_layout: 'formal_card',
        envelope_color: '#7D331F',
        envelope_seal_color: '#C86D51',
        hero_tagline: 'Te esperamos para celebrar',
        sample_dot: '#A0472E',
    },
    {
        id: 'romance_blush',
        name: 'Romance Rosa & Perla',
        desc: 'Rosa empolvado, detalles en cobre y delicadeza romántica',
        badge: 'Quinceañera Princesa',
        primary_color: '#BE185D',
        secondary_color: '#FB7185',
        heading_color: '#9D174D',
        text_color: '#4C1D2F',
        muted_color: '#9C7082',
        background_color: '#F7EBEF',
        background_overlay_color: '#FFFFFF',
        background_overlay_opacity: 0,
        background_fit: 'cover',
        card_color: '#FFFBFD',
        card_opacity: 92,
        border_color: '#ECCCD8',
        heading_font: 'Cinzel',
        script_font: 'Parisienne',
        body_font: 'Montserrat',
        card_style: 'framed',
        card_layout: 'formal_card',
        envelope_color: '#831843',
        envelope_seal_color: '#F43F5E',
        hero_tagline: 'Mis Quince Años',
        sample_dot: '#BE185D',
    },
    {
        id: 'celestial_midnight',
        name: 'Celestial Azul & Estrellas',
        desc: 'Azul noche profundo, destellos plateados y magia cósmica',
        badge: 'Noche Estrellada',
        primary_color: '#6366F1',
        secondary_color: '#818CF8',
        heading_color: '#C7D2FE',
        text_color: '#E0E7FF',
        muted_color: '#94A3B8',
        background_color: '#0B0F19',
        background_overlay_color: '#000000',
        background_overlay_opacity: 30,
        background_fit: 'cover',
        card_color: '#131B2E',
        card_opacity: 88,
        border_color: '#2E3D60',
        heading_font: 'Cinzel',
        script_font: 'Sacramento',
        body_font: 'Plus Jakarta Sans',
        card_style: 'framed',
        card_layout: 'formal_card',
        envelope_color: '#0F172A',
        envelope_seal_color: '#6366F1',
        hero_tagline: 'Bajo las Estrellas',
        sample_dot: '#6366F1',
    },
    {
        id: 'minimal_editorial',
        name: 'Minimal Editorial Clean',
        desc: 'Vanguardista, tipografías limpias y estética de revista de diseño',
        badge: 'Contemporáneo',
        primary_color: '#18181B',
        secondary_color: '#52525B',
        heading_color: '#09090B',
        text_color: '#27272A',
        muted_color: '#71717A',
        background_color: '#F4F4F5',
        background_overlay_color: '#FFFFFF',
        background_overlay_opacity: 0,
        background_fit: 'cover',
        card_color: '#FFFFFF',
        card_opacity: 96,
        border_color: '#E4E4E7',
        heading_font: 'Marcellus',
        script_font: 'Great Vibes',
        body_font: 'Montserrat',
        card_style: 'framed',
        card_layout: 'formal_card',
        envelope_color: '#27272A',
        envelope_seal_color: '#18181B',
        hero_tagline: 'Invitación Especial',
        sample_dot: '#18181B',
    },
];

// Preserving backwards compatibility with previous name
export const FLORAL_WINE_PRESET = ADVANCED_PRESETS[0];
