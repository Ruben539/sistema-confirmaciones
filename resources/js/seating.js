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

export const VENUE_ITEMS = {
    stage: { label: 'Escenario', w: 260, h: 54 },
    dance: { label: 'Pista de Baile', w: 230, h: 120 },
    entrance: { label: 'Entrada', w: 170, h: 34 },
};

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
    return {
        stage: { x: 0, y: snap(top - 250) },
        dance: { x: 0, y: snap(top - 150) },
        entrance: { x: 0, y: snap(bottom + 150) },
    };
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
    const fallbackVenue = defaultVenue(positions);
    const venue = {};
    Object.keys(VENUE_ITEMS).forEach(k => { venue[k] = venueLayout?.[k] || fallbackVenue[k]; });
    return { tables: positions, venue };
};

// Floor size that fits every table and venue element, centered on 0,0
export const floorSize = (placedTables, venue) => {
    let maxX = 300, maxY = 250;
    placedTables.forEach(t => {
        const r = Math.max(t.w, t.h) / 2 + 40;
        maxX = Math.max(maxX, Math.abs(t.x) + r);
        maxY = Math.max(maxY, Math.abs(t.y) + r);
    });
    Object.entries(venue).forEach(([k, p]) => {
        maxX = Math.max(maxX, Math.abs(p.x) + VENUE_ITEMS[k].w / 2 + 20);
        maxY = Math.max(maxY, Math.abs(p.y) + VENUE_ITEMS[k].h / 2 + 20);
    });
    return { floorWidth: Math.max(800, 2 * maxX + 80), floorHeight: Math.max(600, 2 * maxY + 80) };
};
