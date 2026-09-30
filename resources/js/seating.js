// Shared seating helpers: used by the 3D plan and by the printable documents,
// so the printed plan matches what the planner sees on screen.

const NO_DIET = ['ninguna', 'ninguno', 'sin restricciones', 'normal', 'no'];

export const hasDiet = (g) => !!g?.dietary_restrictions && !NO_DIET.includes(g.dietary_restrictions.toLowerCase().trim());

// Seats a guest takes (backend sends `seats`: confirmed amount if answered, else invited)
export const seatsOf = (g) => g?.seats ?? g?.passes ?? 1;

export const guestState = (g) => (g.status === 'attended' || g.attended_at) ? 'attended' : g.status === 'confirmed' ? 'confirmed' : 'pending';

// Adults / youth / children actually coming: confirmed numbers once the guest answered
export const peopleOf = (g) => {
    const answered = (g.status === 'confirmed' || g.status === 'attended' || g.attended_at) && (g.confirmed_passes || 0) > 0;
    return answered
        ? { adults: g.confirmed_adults || 0, youth: g.confirmed_youth || 0, children: g.confirmed_children || 0 }
        : { adults: g.adults || 0, youth: g.youth || 0, children: g.children || 0 };
};

// Same buckets as the backend dietary summary
export const dietType = (g) => {
    if (!hasDiet(g)) return null;
    const d = g.dietary_restrictions.toLowerCase();
    if (d.includes('celiac') || d.includes('celíac') || d.includes('gluten')) return 'celiac';
    if (d.includes('lactos')) return 'lactose';
    if (d.includes('vege') || d.includes('vega')) return 'vegan';
    return 'other';
};

export const DIET_LABELS = { celiac: 'Celíaco / sin gluten', lactose: 'Sin lactosa', vegan: 'Vegetariano / vegano', other: 'Otras' };

// Elements a planner can place on the venue plan, grouped like an event checklist.
// w/h are default sizes on the plan (1 unit ≈ 1 cm at the plan scale); `round` draws a circle.
export const VENUE_CATEGORIES = [
    { id: 'show', label: 'Ceremonia y show' },
    { id: 'food', label: 'Comida y bebida' },
    { id: 'guests', label: 'Invitados' },
    { id: 'structure', label: 'Estructura del salón' },
];

export const VENUE_CATALOG = [
    { type: 'stage', label: 'Escenario', category: 'show', w: 260, h: 54 },
    { type: 'dance', label: 'Pista de Baile', category: 'show', w: 230, h: 120 },
    { type: 'dj', label: 'DJ / Sonido', category: 'show', w: 110, h: 50 },
    { type: 'band', label: 'Banda en vivo', category: 'show', w: 180, h: 70 },
    { type: 'screen', label: 'Pantalla', category: 'show', w: 160, h: 20 },
    { type: 'altar', label: 'Altar / Ceremonia', category: 'show', w: 160, h: 60 },
    { type: 'bar', label: 'Barra de Tragos', category: 'food', w: 200, h: 50 },
    { type: 'buffet', label: 'Buffet / Catering', category: 'food', w: 220, h: 60 },
    { type: 'dessert', label: 'Mesa de Postres', category: 'food', w: 160, h: 50 },
    { type: 'cake', label: 'Torta', category: 'food', w: 60, h: 60, round: true },
    { type: 'coffee', label: 'Estación de Café', category: 'food', w: 110, h: 50 },
    { type: 'kitchen', label: 'Cocina', category: 'food', w: 180, h: 100 },
    { type: 'entrance', label: 'Entrada', category: 'guests', w: 170, h: 34 },
    { type: 'reception', label: 'Recepción', category: 'guests', w: 140, h: 44 },
    { type: 'gifts', label: 'Mesa de Regalos', category: 'guests', w: 110, h: 50 },
    { type: 'photobooth', label: 'Photobooth', category: 'guests', w: 100, h: 100 },
    { type: 'lounge', label: 'Living / Lounge', category: 'guests', w: 180, h: 110 },
    { type: 'kids', label: 'Zona de Niños', category: 'guests', w: 160, h: 120 },
    { type: 'cloakroom', label: 'Guardarropa', category: 'guests', w: 120, h: 60 },
    { type: 'restrooms', label: 'Baños', category: 'structure', w: 120, h: 80 },
    { type: 'exit', label: 'Salida de Emergencia', category: 'structure', w: 140, h: 26 },
    { type: 'column', label: 'Columna', category: 'structure', w: 40, h: 40, round: true },
    { type: 'plant', label: 'Planta / Decoración', category: 'structure', w: 50, h: 50, round: true },
    { type: 'custom', label: 'Otro elemento', category: 'structure', w: 120, h: 60 },
];

export const catalogItem = (type) => VENUE_CATALOG.find(c => c.type === type) || VENUE_CATALOG.find(c => c.type === 'custom');

let venueSeq = 0;
export const newVenueItem = (type, x = 0, y = 0) => {
    const c = catalogItem(type);
    venueSeq += 1;
    return { id: `${c.type}-${Date.now().toString(36)}-${venueSeq}`, type: c.type, label: c.label, x, y, w: c.w, h: c.h, rotation: 0 };
};

// Size on the plan once rotated (90°/270° swap width and height)
export const rotatedSize = (item) => ((item.rotation || 0) % 180 === 0 ? { w: item.w, h: item.h } : { w: item.h, h: item.w });

export const GRID_SNAP = 10;
export const snap = (v) => Math.round(v / GRID_SNAP) * GRID_SNAP;

// Tables without a saved shape: guess from the name ("Mesa Principal" = imperial)
export const shapeOf = (t) => t.shape || (/principal|novios|imperial|larga/i.test(t.name || '') ? 'imperial' : 'round');

export const tableSize = (shape, capacity) => {
    if (shape === 'imperial') return { w: Math.max(150, Math.ceil(capacity / 2) * 30 + 30), h: 70 };
    if (shape === 'square') {
        const side = Math.max(100, Math.ceil(capacity / 4) * 30 + 30);
        return { w: side, h: side };
    }
    const d = Math.max(96, Math.min(170, 70 + capacity * 5));
    return { w: d, h: d };
};

// Chair centers relative to the table center
export const chairPositions = (shape, n, w, h) => {
    const gap = 18;
    if (shape === 'round') {
        const r = w / 2 + gap;
        return Array.from({ length: n }, (_, i) => {
            const a = (i / n) * 2 * Math.PI - Math.PI / 2;
            return { x: Math.cos(a) * r, y: Math.sin(a) * r };
        });
    }
    if (shape === 'imperial') {
        const top = Math.ceil(n / 2);
        const row = (count, y) => Array.from({ length: count }, (_, i) => ({ x: -w / 2 + (w / count) * (i + 0.5), y }));
        return [...row(top, -h / 2 - gap), ...row(n - top, h / 2 + gap)];
    }
    const perSide = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) perSide[i % 4]++;
    const pts = [];
    const side = (count, fn) => { for (let i = 0; i < count; i++) pts.push(fn((i + 0.5) / count)); };
    side(perSide[0], t => ({ x: -w / 2 + w * t, y: -h / 2 - gap }));
    side(perSide[1], t => ({ x: w / 2 + gap, y: -h / 2 + h * t }));
    side(perSide[2], t => ({ x: w / 2 - w * t, y: h / 2 + gap }));
    side(perSide[3], t => ({ x: -w / 2 - gap, y: h / 2 - h * t }));
    return pts;
};

// Automatic grid for tables that were never placed by hand
export const autoGrid = (tables) => {
    const count = tables.length || 1;
    const cols = Math.max(2, Math.ceil(Math.sqrt(count * 1.3)));
    const rows = Math.ceil(count / cols);
    const out = {};
    tables.forEach((t, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        out[t.id] = { x: (col - (cols - 1) / 2) * 230, y: (row - (rows - 1) / 2) * 220 + 60 };
    });
    return out;
};

export const defaultVenue = (tablePositions) => {
    const ys = Object.values(tablePositions).map(p => p.y);
    const top = ys.length ? Math.min(...ys) : 0;
    const bottom = ys.length ? Math.max(...ys) : 0;
    return [
        { ...newVenueItem('stage', 0, snap(top - 250)), id: 'stage' },
        { ...newVenueItem('dance', 0, snap(top - 150)), id: 'dance' },
        { ...newVenueItem('entrance', 0, snap(bottom + 150)), id: 'entrance' },
    ];
};

// Venue elements as a list. Also reads the first saved format ({stage: {x, y}, dance: ..., entrance: ...}).
export const normalizeVenue = (venueLayout, tablePositions) => {
    if (Array.isArray(venueLayout)) {
        return venueLayout.map(item => {
            const c = catalogItem(item.type);
            return { rotation: 0, ...item, type: c.type, label: item.label || c.label, w: item.w || c.w, h: item.h || c.h };
        });
    }
    const defaults = defaultVenue(tablePositions);
    if (venueLayout && typeof venueLayout === 'object') {
        return defaults.map(d => (venueLayout[d.id] ? { ...d, x: venueLayout[d.id].x, y: venueLayout[d.id].y } : d));
    }
    return defaults;
};

// Saved positions/shapes, falling back to the automatic grid and default venue elements
export const buildLayout = (tables, venueLayout) => {
    const auto = autoGrid(tables);
    const positions = {};
    tables.forEach(t => {
        positions[t.id] = {
            x: t.pos_x ?? auto[t.id].x,
            y: t.pos_y ?? auto[t.id].y,
            shape: shapeOf(t),
            rotation: t.rotation || 0,
        };
    });
    return { tables: positions, venue: normalizeVenue(venueLayout, positions) };
};

// Floor size that fits every table and venue element, centered on 0,0
export const floorSize = (placedTables, venue) => {
    let maxX = 300, maxY = 250;
    placedTables.forEach(t => {
        const r = Math.max(t.w, t.h) / 2 + 40;
        maxX = Math.max(maxX, Math.abs(t.x) + r);
        maxY = Math.max(maxY, Math.abs(t.y) + r);
    });
    venue.forEach(item => {
        const { w, h } = rotatedSize(item);
        maxX = Math.max(maxX, Math.abs(item.x) + w / 2 + 20);
        maxY = Math.max(maxY, Math.abs(item.y) + h / 2 + 20);
    });
    return { floorWidth: Math.max(800, 2 * maxX + 80), floorHeight: Math.max(600, 2 * maxY + 80) };
};
