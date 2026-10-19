// Printable documents and Excel export for an event's seating.
// Each build* function returns a full HTML page; printHtml() prints it through a hidden
// iframe (no pop-up window, so browser pop-up blockers don't get in the way).

import * as XLSX from 'xlsx';
import { seatsOf, peopleOf, hasDiet, dietType, DIET_LABELS, guestState, catalogItem, tableSize, chairPositions, buildLayout, floorSize } from './seating';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const byName = (a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });

// Head tables first, then "Mesa 2" before "Mesa 10"
const isHeadTable = (t) => /principal|novios|honor/i.test(t.name || '');
const byTableName = (a, b) => (isHeadTable(b) - isHeadTable(a)) || a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' });

const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(`${String(d).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const eventName = (event) => event?.couple_names || event?.title || 'Evento';

const STATE_LABELS = { attended: 'Ingresó', confirmed: 'Confirmado', pending: 'Sin responder', declined: 'No asiste' };

const BASE_CSS = `
    *{box-sizing:border-box}
    body{font-family:'Helvetica Neue',Arial,sans-serif;color:#18181b;margin:0;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .doc-header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #18181b;padding-bottom:6px;margin-bottom:12px}
    .doc-header h1{font-size:18px;margin:0}
    .doc-header .sub{color:#52525b;font-size:11px;margin-top:2px}
    .doc-header .kind{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#71717a;text-align:right}
    .stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
    .stat{border:1px solid #d4d4d8;border-radius:6px;padding:5px 9px}
    .stat b{display:block;font-size:15px}
    .stat span{font-size:9px;text-transform:uppercase;color:#71717a;letter-spacing:.05em}
    .page-break{break-before:page}
    table.grid{width:100%;border-collapse:collapse}
    table.grid th{background:#f4f4f5;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#52525b}
    table.grid th,table.grid td{border-bottom:1px solid #e4e4e7;padding:4px 6px;vertical-align:top}
    table.grid tr{break-inside:avoid}
    .muted{color:#71717a}
    .warn{color:#b45309}
    .footer-note{margin-top:10px;font-size:9px;color:#a1a1aa}
`;

const shell = (title, body, { landscape = false } = {}) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${BASE_CSS}@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:12mm}</style></head><body>${body}</body></html>`;

const header = (event, kind) => `
    <div class="doc-header">
        <div><h1>${esc(eventName(event))}</h1><div class="sub">${esc([formatDate(event?.event_date), event?.location].filter(Boolean).join(' · '))}</div></div>
        <div class="kind">${esc(kind)}<br>Impreso ${new Date().toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })}</div>
    </div>`;

const stat = (value, label) => `<div class="stat"><b>${value}</b><span>${esc(label)}</span></div>`;

// Every seated / unseated guest with the table they're at
const seatedGuests = (tables, unassigned) => [
    ...tables.flatMap(t => (t.guests || []).map(g => ({ ...g, _table: t.name }))),
    ...unassigned.map(g => ({ ...g, _table: null })),
];

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------

export const printHtml = (html) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    const cleanup = () => setTimeout(() => iframe.remove(), 1000);
    iframe.contentWindow.onafterprint = cleanup;
    // Wait for images (logos) to load, at most 3s, then give fonts/SVG a moment to lay out
    const images = [...doc.images].filter(img => !img.complete);
    const imagesReady = Promise.race([
        Promise.all(images.map(img => new Promise(resolve => { img.addEventListener('load', resolve); img.addEventListener('error', resolve); }))),
        new Promise(resolve => setTimeout(resolve, 3000)),
    ]);
    imagesReady.then(() => setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        // Safari doesn't always fire onafterprint
        setTimeout(cleanup, 60000);
    }, 300));
};

// ---------------------------------------------------------------------------
// 1. Venue plan + one card per table (landscape)
// ---------------------------------------------------------------------------

const planSvg = (tables, venueLayout) => {
    const layout = buildLayout(tables, venueLayout);
    const placed = tables.map(t => {
        const pos = layout.tables[t.id];
        return { ...t, ...pos, ...tableSize(pos.shape, t.capacity || 10) };
    });
    const { floorWidth: W, floorHeight: H } = floorSize(placed, layout.venue);

    // Soft fill per element category, readable in black & white too (dashed outline + label)
    const fills = { show: '#ffe4e6', food: '#ffedd5', guests: '#e0f2fe', structure: '#f4f4f5' };
    const venue = layout.venue.map(item => {
        const c = catalogItem(item.type);
        const fill = item.type === 'dance' ? '#fef3c7' : fills[c.category];
        const shape = c.round
            ? `<ellipse rx="${item.w / 2}" ry="${item.h / 2}" fill="${fill}" stroke="#a1a1aa" stroke-dasharray="6 4" stroke-width="2"/>`
            : `<rect x="${-item.w / 2}" y="${-item.h / 2}" width="${item.w}" height="${item.h}" rx="10" fill="${fill}" stroke="#a1a1aa" stroke-dasharray="6 4" stroke-width="2"/>`;
        const label = (item.label || c.label).toUpperCase();
        // Shrink the text so it fits inside the element (bold caps ≈ 0.72em per character incl. spacing)
        const fontSize = Math.max(5, Math.min(14, item.h / 3, (item.w * 0.9) / (label.length * 0.72)));
        return `<g transform="translate(${item.x} ${item.y}) rotate(${item.rotation || 0})">${shape}
            <text y="${fontSize / 3}" text-anchor="middle" font-size="${fontSize}" font-weight="700" fill="#52525b" letter-spacing="0.5">${esc(label)}</text></g>`;
    }).join('');

    const tablesSvg = placed.map(t => {
        const occupied = t.occupied_passes ?? 0;
        const over = occupied > (t.capacity || 10);
        const chairs = chairPositions(t.shape, Math.max(t.capacity || 10, occupied), t.w, t.h).map((c, i) =>
            `<circle cx="${c.x}" cy="${c.y}" r="8" fill="${i >= (t.capacity || 10) ? '#fecaca' : i < occupied ? '#52525b' : '#fff'}" stroke="#52525b" stroke-width="1.5"/>`).join('');
        const surface = t.shape === 'round'
            ? `<circle r="${t.w / 2}" fill="#fafafa" stroke="${over ? '#dc2626' : '#27272a'}" stroke-width="2.5"/>`
            : `<rect x="${-t.w / 2}" y="${-t.h / 2}" width="${t.w}" height="${t.h}" rx="8" fill="#fafafa" stroke="${over ? '#dc2626' : '#27272a'}" stroke-width="2.5"/>`;
        return `<g transform="translate(${t.x} ${t.y})">
            <g transform="rotate(${t.rotation || 0})">${chairs}${surface}</g>
            <text y="-2" text-anchor="middle" font-size="15" font-weight="800">${esc(t.name)}</text>
            <text y="16" text-anchor="middle" font-size="12" fill="${over ? '#dc2626' : '#71717a'}">${occupied}/${t.capacity}</text>
        </g>`;
    }).join('');

    return `<svg viewBox="${-W / 2} ${-H / 2} ${W} ${H}" style="width:100%;max-height:150mm" xmlns="http://www.w3.org/2000/svg">
        <rect x="${-W / 2 + 4}" y="${-H / 2 + 4}" width="${W - 8}" height="${H - 8}" rx="18" fill="#fff" stroke="#d4d4d8" stroke-width="3"/>
        ${venue}${tablesSvg}</svg>`;
};

export const buildPlanDocument = ({ event, tables, unassigned, venueLayout }) => {
    const sorted = [...tables].sort(byTableName);
    const seated = tables.reduce((a, t) => a + (t.occupied_passes || 0), 0);
    const capacity = tables.reduce((a, t) => a + (t.capacity || 0), 0);
    const unseated = unassigned.reduce((a, g) => a + seatsOf(g), 0);

    const cards = sorted.map(t => {
        const guests = [...(t.guests || [])].sort(byName);
        const over = (t.occupied_passes || 0) > t.capacity;
        return `<div class="card">
            <div class="card-h"><b>${esc(t.name)}</b><span class="${over ? 'warn' : 'muted'}">${t.occupied_passes || 0}/${t.capacity}</span></div>
            ${t.notes ? `<div class="muted" style="font-size:9px;margin-bottom:3px">${esc(t.notes)}</div>` : ''}
            ${guests.length ? `<ol>${guests.map(g => `<li>${esc(g.name)}${seatsOf(g) > 1 ? ` <span class="muted">+${seatsOf(g) - 1}${g.companions ? ` (${esc(g.companions)})` : ''}</span>` : ''}${hasDiet(g) ? ` <span class="warn">· ${esc(g.dietary_restrictions)}</span>` : ''}</li>`).join('')}</ol>` : '<div class="muted">Sin invitados</div>'}
        </div>`;
    }).join('');

    const body = `
        ${header(event, 'Plano del salón')}
        <div class="stats">
            ${stat(tables.length, 'Mesas')}
            ${stat(`${seated}/${capacity}`, 'Lugares ocupados')}
            ${stat(unseated, 'Personas sin mesa')}
        </div>
        ${planSvg(tables, venueLayout)}
        <div class="footer-note">Sillas oscuras = ocupadas · blancas = libres · rojas = sobrepasan la capacidad</div>
        <div class="page-break"></div>
        ${header(event, 'Invitados por mesa')}
        <div class="cards">${cards}</div>
        ${unassigned.length ? `<p class="warn" style="margin-top:10px"><b>Sin mesa asignada (${unseated} personas):</b> ${[...unassigned].sort(byName).map(g => esc(g.name)).join(', ')}</p>` : ''}
        <style>
            .cards{columns:4;column-gap:10px}
            .card{break-inside:avoid;border:1px solid #d4d4d8;border-radius:6px;padding:6px 8px;margin-bottom:8px}
            .card-h{display:flex;justify-content:space-between;font-size:12px;border-bottom:1px solid #e4e4e7;padding-bottom:3px;margin-bottom:3px}
            .card ol{margin:0;padding-left:16px}
        </style>`;
    return shell(`Plano - ${eventName(event)}`, body, { landscape: true });
};

// ---------------------------------------------------------------------------
// 2. Placement list for the entrance: A-Z, name → table, large print
// ---------------------------------------------------------------------------

export const buildPlacementDocument = ({ event, tables }) => {
    const guests = tables.flatMap(t => (t.guests || []).map(g => ({ ...g, _table: t.name }))).sort(byName);

    let lastLetter = '';
    const rows = guests.map(g => {
        const letter = g.name.charAt(0).toLocaleUpperCase('es');
        const letterRow = letter !== lastLetter ? `<div class="letter">${esc(letter)}</div>` : '';
        lastLetter = letter;
        return `${letterRow}<div class="row"><span class="name">${esc(g.name)}${g.companions ? `<small> y ${esc(g.companions)}</small>` : seatsOf(g) > 1 ? `<small> +${seatsOf(g) - 1}</small>` : ''}</span><span class="dots"></span><span class="tbl">${esc(g._table)}</span></div>`;
    }).join('');

    const body = `
        <div class="title"><h1>${esc(eventName(event))}</h1><p>Encontrá tu mesa</p></div>
        <div class="list">${rows || '<p class="muted">Todavía no hay invitados sentados.</p>'}</div>
        <style>
            body{font-family:Georgia,'Times New Roman',serif}
            .title{text-align:center;margin-bottom:14px}
            .title h1{font-size:26px;margin:0}
            .title p{margin:4px 0 0;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#71717a}
            .list{columns:2;column-gap:28px}
            .letter{font-size:18px;font-weight:700;border-bottom:1px solid #a1a1aa;margin:10px 0 4px;break-after:avoid}
            .row{display:flex;align-items:baseline;gap:6px;font-size:14px;padding:2px 0;break-inside:avoid}
            .row small{color:#71717a;font-size:11px}
            .dots{flex:1;border-bottom:1px dotted #a1a1aa;transform:translateY(-3px)}
            .tbl{font-weight:700;white-space:nowrap}
        </style>`;
    return shell(`Ubicación - ${eventName(event)}`, body);
};

// ---------------------------------------------------------------------------
// 3. Catering report: menus per table and special diets
// ---------------------------------------------------------------------------

const cateringRows = (tables, unassigned) => {
    const rows = [...tables].sort(byTableName).map(t => ({ name: t.name, guests: t.guests || [] }));
    if (unassigned.length) rows.push({ name: 'Sin mesa asignada', guests: unassigned, unseated: true });
    return rows.map(r => {
        const totals = r.guests.reduce((acc, g) => {
            const p = peopleOf(g);
            acc.adults += p.adults; acc.youth += p.youth; acc.children += p.children;
            return acc;
        }, { adults: 0, youth: 0, children: 0 });
        return { ...r, ...totals, total: totals.adults + totals.youth + totals.children, diets: r.guests.filter(hasDiet) };
    });
};

export const buildCateringDocument = ({ event, tables, unassigned }) => {
    const rows = cateringRows(tables, unassigned);
    const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
    const diets = rows.flatMap(r => r.diets.map(g => ({ g, table: r.name })));
    const dietCounts = diets.reduce((acc, { g }) => { const t = dietType(g); acc[t] = (acc[t] || 0) + 1; return acc; }, {});

    const body = `
        ${header(event, 'Reporte de catering')}
        <div class="stats">
            ${stat(sum('total'), 'Menús totales')}
            ${stat(sum('adults'), 'Adultos')}
            ${stat(sum('youth'), 'Jóvenes')}
            ${stat(sum('children'), 'Niños')}
            ${Object.entries(dietCounts).map(([k, n]) => stat(n, DIET_LABELS[k])).join('')}
        </div>
        <table class="grid">
            <thead><tr><th>Mesa</th><th style="text-align:right">Adultos</th><th style="text-align:right">Jóvenes</th><th style="text-align:right">Niños</th><th style="text-align:right">Total</th><th>Menús especiales</th></tr></thead>
            <tbody>${rows.map(r => `<tr${r.unseated ? ' class="warn"' : ''}>
                <td><b>${esc(r.name)}</b></td>
                <td style="text-align:right">${r.adults}</td><td style="text-align:right">${r.youth}</td><td style="text-align:right">${r.children}</td>
                <td style="text-align:right"><b>${r.total}</b></td>
                <td>${r.diets.map(g => `${esc(g.name)}: <b>${esc(g.dietary_restrictions)}</b>`).join('<br>') || '<span class="muted">—</span>'}</td>
            </tr>`).join('')}</tbody>
            <tfoot><tr><th>Total</th><th style="text-align:right">${sum('adults')}</th><th style="text-align:right">${sum('youth')}</th><th style="text-align:right">${sum('children')}</th><th style="text-align:right">${sum('total')}</th><th>${diets.length} menús especiales</th></tr></tfoot>
        </table>
        ${diets.length ? `
            <h3 style="margin:16px 0 6px;font-size:13px">Menús especiales por invitado</h3>
            <table class="grid"><thead><tr><th>Invitado</th><th>Mesa</th><th>Tipo</th><th>Detalle</th></tr></thead>
            <tbody>${[...diets].sort((a, b) => byName(a.g, b.g)).map(({ g, table }) => `<tr><td>${esc(g.name)}</td><td>${esc(table)}</td><td>${esc(DIET_LABELS[dietType(g)])}</td><td>${esc(g.dietary_restrictions)}</td></tr>`).join('')}</tbody></table>` : ''}
        <div class="footer-note">Cantidades según lo confirmado por cada invitado (o lo invitado, si todavía no respondió). No incluye a quienes no asisten. La restricción alimentaria se registra por invitación.</div>`;
    return shell(`Catering - ${eventName(event)}`, body);
};

// ---------------------------------------------------------------------------
// 4. Reception check-in list (paper backup of the app check-in)
// ---------------------------------------------------------------------------

export const buildReceptionDocument = ({ event, tables, unassigned }) => {
    const guests = seatedGuests(tables, unassigned).sort(byName);
    const totalSeats = guests.reduce((a, g) => a + seatsOf(g), 0);

    const body = `
        ${header(event, 'Lista de recepción')}
        <div class="stats">
            ${stat(guests.length, 'Invitaciones')}
            ${stat(totalSeats, 'Personas')}
            ${stat(guests.filter(g => guestState(g) === 'pending').length, 'Sin responder')}
        </div>
        <table class="grid">
            <thead><tr><th style="width:22px"></th><th>Invitado</th><th>Acompañantes</th><th style="text-align:right">Pases</th><th>Mesa</th><th>Estado</th></tr></thead>
            <tbody>${guests.map(g => {
                const st = guestState(g);
                const arrived = st === 'attended';
                return `<tr>
                    <td><span class="box">${arrived ? '✓' : ''}</span></td>
                    <td><b>${esc(g.name)}</b></td>
                    <td>${esc(g.companions || (seatsOf(g) > 1 ? `+${seatsOf(g) - 1}` : ''))}</td>
                    <td style="text-align:right"><b>${seatsOf(g)}</b></td>
                    <td>${g._table ? esc(g._table) : '<span class="warn">Sin mesa</span>'}</td>
                    <td class="${st === 'pending' ? 'warn' : 'muted'}">${arrived && g.attended_at ? `Ingresó ${new Date(g.attended_at).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}` : STATE_LABELS[st]}</td>
                </tr>`;
            }).join('')}</tbody>
        </table>
        <style>
            .box{display:inline-block;width:14px;height:14px;border:1.5px solid #52525b;border-radius:3px;text-align:center;line-height:12px;font-weight:700}
            table.grid td{padding:5px 6px;font-size:11px}
        </style>`;
    return shell(`Recepción - ${eventName(event)}`, body);
};

// ---------------------------------------------------------------------------
// 5. Excel: full guest list (including declined), tables and catering
// ---------------------------------------------------------------------------

export const exportGuestsExcel = ({ event, allGuests, tables, unassigned }) => {
    const tableOf = {};
    tables.forEach(t => (t.guests || []).forEach(g => { tableOf[g.id] = t.name; }));

    const guestRows = [...allGuests].sort(byName).map(g => {
        const st = g.status === 'declined' ? 'declined' : guestState(g);
        return {
            'Nombre': g.name,
            'Teléfono': g.phone,
            'Estado': STATE_LABELS[st],
            'Pases invitados': g.passes,
            'Pases confirmados': st === 'declined' ? 0 : (g.confirmed_passes || ''),
            'Adultos': g.adults || 0,
            'Jóvenes': g.youth || 0,
            'Niños': g.children || 0,
            'Acompañantes': g.companions || '',
            'Mesa': tableOf[g.id] || '',
            'Restricción alimentaria': hasDiet(g) ? g.dietary_restrictions : '',
            'Notas': g.notes || '',
            'WhatsApp': g.whatsapp_status === 'sent' ? 'Enviado' : 'Sin enviar',
            'Ingreso': g.attended_at ? new Date(g.attended_at).toLocaleString('es-PY') : '',
        };
    });

    const tableRows = [...tables].sort(byTableName).map(t => ({
        'Mesa': t.name,
        'Capacidad': t.capacity,
        'Ocupados': t.occupied_passes || 0,
        'Libres': Math.max(0, t.capacity - (t.occupied_passes || 0)),
        'Invitados': [...(t.guests || [])].sort(byName).map(g => seatsOf(g) > 1 ? `${g.name} (+${seatsOf(g) - 1})` : g.name).join(', '),
        'Notas': t.notes || '',
    }));

    const cateringSheet = cateringRows(tables, unassigned).map(r => ({
        'Mesa': r.name,
        'Adultos': r.adults,
        'Jóvenes': r.youth,
        'Niños': r.children,
        'Total': r.total,
        'Menús especiales': r.diets.map(g => `${g.name}: ${g.dietary_restrictions}`).join(' | '),
    }));

    const sheet = (rows, widths) => {
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = widths.map(wch => ({ wch }));
        return ws;
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet(guestRows, [28, 15, 13, 8, 10, 8, 8, 8, 24, 16, 24, 24, 11, 18]), 'Invitados');
    XLSX.utils.book_append_sheet(wb, sheet(tableRows, [18, 10, 10, 8, 80, 24]), 'Mesas');
    XLSX.utils.book_append_sheet(wb, sheet(cateringSheet, [20, 9, 9, 9, 8, 60]), 'Catering');

    const safeName = eventName(event).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
    XLSX.writeFile(wb, `Invitados_${safeName || 'Evento'}.xlsx`);
};

// ---------------------------------------------------------------------------
// 6. Triangular Table Tents / Centerpieces with base (3D Foldable)
// ---------------------------------------------------------------------------

export const buildTableTentsDocument = ({
    event,
    tables,
    selectedTableIds = null,
    includeGuests = true,
    style = 'botanical',
    config = {},
}) => {
    let sorted = [...tables].sort(byTableName);
    if (selectedTableIds && selectedTableIds.length > 0) {
        sorted = sorted.filter(t => selectedTableIds.includes(t.id));
    }
    if (sorted.length === 0) {
        sorted = [...tables].sort(byTableName);
    }

    // Wedding initials helper (e.g., Marcos y Sabrina -> M & S)
    const computeEventTitle = () => {
        if (config.title) return config.title;
        const raw = event?.couple_names || '';
        if (raw) {
            const parts = raw.split(/\s*(?:&|y|e|\+)\s*/i).map(s => s.trim()).filter(Boolean);
            if (parts.length >= 2) {
                return `${parts[0].charAt(0).toUpperCase()} & ${parts[1].charAt(0).toUpperCase()}`;
            }
        }
        return eventName(event);
    };

    // Merge configuration with defaults
    const cfg = {
        title: config.title ?? computeEventTitle(),
        subtitle: config.subtitle ?? formatDate(event?.event_date),
        prefix: config.prefix ?? 'MESA',
        baseText: config.baseText ?? '¡Gracias por celebrar con nosotros!',
        size: config.size ?? 'standard', // 'standard' (2 por hoja A4, 10.5x14cm) | 'large' (1 por hoja A4)
        floralMotif: config.floralMotif ?? (config.borderStyle === 'botanical' || style === 'botanical' ? 'eucalyptus' : 'none'),
        bgImage: config.bgImage ?? null,
        bgImageOpacity: config.bgImageOpacity ?? 0.85,
        fontTitle: config.fontTitle ?? 'cursive',
        fontNumber: config.fontNumber ?? (config.borderStyle === 'botanical' || style === 'botanical' ? 'brush' : 'serif'),
        primaryColor: config.primaryColor ?? (style === 'botanical' ? '#557b63' : style === 'classic' ? '#b58d3d' : '#18181b'),
        numberColor: config.numberColor ?? '#1c1c1e',
        textColor: config.textColor ?? '#27272a',
        bgColor: config.bgColor ?? (style === 'botanical' ? '#faf7f2' : '#ffffff'),
        borderStyle: config.borderStyle ?? (style === 'botanical' ? 'botanical' : 'double'),
        icon: config.icon ?? 'none',
        monogram: config.monogram ?? '',
    };

    const isStandardSize = cfg.size === 'standard';

    // 1. Botanical Eucalyptus Vector Artwork
    const EUCALYPTUS_SVGS = `
        <div class="floral-motif-wrap">
            <svg class="floral-corner floral-corner-bl" viewBox="0 0 130 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M-8,140 C22,126 42,98 48,60 C52,32 44,14 38,0" stroke="#52735b" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>
                <path d="M22,106 C38,94 46,82 55,75" stroke="#52735b" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>
                <path d="M40,66 C54,60 66,57 80,59" stroke="#52735b" stroke-width="1.1" stroke-linecap="round" opacity="0.5"/>
                <ellipse cx="14" cy="112" rx="18" ry="10" transform="rotate(-28 14 112)" fill="#537a5f" fill-opacity="0.75"/>
                <ellipse cx="14" cy="112" rx="13" ry="7" transform="rotate(-28 14 112)" fill="#7ba087" fill-opacity="0.7"/>
                <ellipse cx="34" cy="90" rx="16" ry="9" transform="rotate(-42 34 90)" fill="#688c74" fill-opacity="0.75"/>
                <ellipse cx="34" cy="90" rx="11" ry="6" transform="rotate(-42 34 90)" fill="#91b39c" fill-opacity="0.7"/>
                <ellipse cx="46" cy="68" rx="14" ry="8" transform="rotate(-58 46 68)" fill="#4c7057" fill-opacity="0.8"/>
                <ellipse cx="46" cy="68" rx="9" ry="5" transform="rotate(-58 46 68)" fill="#749a80" fill-opacity="0.75"/>
                <ellipse cx="68" cy="58" rx="13" ry="7" transform="rotate(12 68 58)" fill="#6f947a" fill-opacity="0.75"/>
                <ellipse cx="42" cy="36" rx="12" ry="7" transform="rotate(-72 42 36)" fill="#84a991" fill-opacity="0.8"/>
                <ellipse cx="39" cy="16" rx="10" ry="5" transform="rotate(-82 39 16)" fill="#9cbfa8" fill-opacity="0.8"/>
                <circle cx="30" cy="99" r="2.2" fill="#46664f" opacity="0.7"/>
                <circle cx="33" cy="95" r="1.8" fill="#46664f" opacity="0.7"/>
                <circle cx="54" cy="62" r="2" fill="#46664f" opacity="0.7"/>
            </svg>
            <svg class="floral-corner floral-corner-br" viewBox="0 0 130 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M138,140 C108,126 88,98 82,60 C78,32 86,14 92,0" stroke="#52735b" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>
                <path d="M108,106 C92,94 84,82 75,75" stroke="#52735b" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>
                <path d="M90,66 C76,60 64,57 50,59" stroke="#52735b" stroke-width="1.1" stroke-linecap="round" opacity="0.5"/>
                <ellipse cx="116" cy="112" rx="18" ry="10" transform="rotate(28 116 112)" fill="#537a5f" fill-opacity="0.75"/>
                <ellipse cx="116" cy="112" rx="13" ry="7" transform="rotate(28 116 112)" fill="#7ba087" fill-opacity="0.7"/>
                <ellipse cx="96" cy="90" rx="16" ry="9" transform="rotate(42 96 90)" fill="#688c74" fill-opacity="0.75"/>
                <ellipse cx="96" cy="90" rx="11" ry="6" transform="rotate(42 96 90)" fill="#91b39c" fill-opacity="0.7"/>
                <ellipse cx="84" cy="68" rx="14" ry="8" transform="rotate(58 84 68)" fill="#4c7057" fill-opacity="0.8"/>
                <ellipse cx="84" cy="68" rx="9" ry="5" transform="rotate(58 84 68)" fill="#749a80" fill-opacity="0.75"/>
                <ellipse cx="62" cy="58" rx="13" ry="7" transform="rotate(-12 62 58)" fill="#6f947a" fill-opacity="0.75"/>
                <ellipse cx="88" cy="36" rx="12" ry="7" transform="rotate(72 88 36)" fill="#84a991" fill-opacity="0.8"/>
                <ellipse cx="91" cy="16" rx="10" ry="5" transform="rotate(82 91 16)" fill="#9cbfa8" fill-opacity="0.8"/>
                <circle cx="100" cy="99" r="2.2" fill="#46664f" opacity="0.7"/>
                <circle cx="97" cy="95" r="1.8" fill="#46664f" opacity="0.7"/>
                <circle cx="76" cy="62" r="2" fill="#46664f" opacity="0.7"/>
            </svg>
            <svg class="floral-bottom-garland" viewBox="0 0 160 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="50" cy="34" rx="17" ry="9" transform="rotate(-12 50 34)" fill="#688c74" fill-opacity="0.7"/>
                <ellipse cx="80" cy="32" rx="19" ry="9" transform="rotate(4 80 32)" fill="#537a5f" fill-opacity="0.65"/>
                <ellipse cx="110" cy="34" rx="17" ry="9" transform="rotate(16 110 34)" fill="#7da189" fill-opacity="0.7"/>
                <ellipse cx="64" cy="27" rx="13" ry="7" transform="rotate(-6 64 27)" fill="#95b8a0" fill-opacity="0.75"/>
                <ellipse cx="96" cy="27" rx="13" ry="7" transform="rotate(10 96 27)" fill="#87ab93" fill-opacity="0.75"/>
            </svg>
        </div>
    `;

    // 2. Romantic Blush Roses Artwork
    const ROSES_SVGS = `
        <div class="floral-motif-wrap">
            <svg class="floral-corner floral-corner-bl" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="20" cy="118" rx="20" ry="10" transform="rotate(-30 20 118)" fill="#688a70" fill-opacity="0.75"/>
                <ellipse cx="44" cy="98" rx="18" ry="9" transform="rotate(-48 44 98)" fill="#7d9e85" fill-opacity="0.8"/>
                <ellipse cx="60" cy="74" rx="15" ry="8" transform="rotate(-62 60 74)" fill="#58775f" fill-opacity="0.8"/>
                <g transform="translate(32, 105)">
                    <circle cx="0" cy="0" r="16" fill="#f4c6cb" fill-opacity="0.9"/>
                    <path d="M-10,-4 C-8,-12 4,-14 10,-8 C14,-2 12,8 6,12 C0,14 -8,12 -12,4 Z" fill="#e5989f" fill-opacity="0.85"/>
                    <path d="M-6,-2 C-4,-8 4,-8 6,-3 C8,2 4,6 0,6 C-4,6 -7,2 -6,-2 Z" fill="#cf7079" fill-opacity="0.9"/>
                    <circle cx="0" cy="0" r="3.5" fill="#b8525c"/>
                </g>
                <g transform="translate(62, 85)">
                    <circle cx="0" cy="0" r="11" fill="#f7d4d8" fill-opacity="0.9"/>
                    <path d="M-6,-3 C-4,-8 4,-8 6,-2 C7,3 3,7 0,7 C-4,6 -6,1 -6,-3 Z" fill="#e08890" fill-opacity="0.85"/>
                    <circle cx="0" cy="0" r="2.5" fill="#b8525c"/>
                </g>
                <path d="M50,85 C65,70 78,60 88,58" stroke="#58775f" stroke-width="1.2" stroke-linecap="round"/>
                <ellipse cx="82" cy="59" rx="8" ry="4" transform="rotate(-15 82 59)" fill="#93b29b" fill-opacity="0.8"/>
                <circle cx="48" cy="72" r="2.5" fill="#d97c84"/>
                <circle cx="53" cy="68" r="2" fill="#d97c84"/>
            </svg>
            <svg class="floral-corner floral-corner-br" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="120" cy="118" rx="20" ry="10" transform="rotate(30 120 118)" fill="#688a70" fill-opacity="0.75"/>
                <ellipse cx="96" cy="98" rx="18" ry="9" transform="rotate(48 96 98)" fill="#7d9e85" fill-opacity="0.8"/>
                <ellipse cx="80" cy="74" rx="15" ry="8" transform="rotate(62 80 74)" fill="#58775f" fill-opacity="0.8"/>
                <g transform="translate(108, 105)">
                    <circle cx="0" cy="0" r="16" fill="#f4c6cb" fill-opacity="0.9"/>
                    <path d="M10,-4 C8,-12 -4,-14 -10,-8 C-14,-2 -12,8 -6,12 C0,14 8,12 12,4 Z" fill="#e5989f" fill-opacity="0.85"/>
                    <path d="M6,-2 C4,-8 -4,-8 -6,-3 C-8,2 -4,6 0,6 C4,6 7,2 6,-2 Z" fill="#cf7079" fill-opacity="0.9"/>
                    <circle cx="0" cy="0" r="3.5" fill="#b8525c"/>
                </g>
                <g transform="translate(78, 85)">
                    <circle cx="0" cy="0" r="11" fill="#f7d4d8" fill-opacity="0.9"/>
                    <path d="M6,-3 C4,-8 -4,-8 -6,-2 C-7,3 -3,7 0,7 C4,6 6,1 6,-3 Z" fill="#e08890" fill-opacity="0.85"/>
                    <circle cx="0" cy="0" r="2.5" fill="#b8525c"/>
                </g>
                <path d="M90,85 C75,70 62,60 52,58" stroke="#58775f" stroke-width="1.2" stroke-linecap="round"/>
                <ellipse cx="58" cy="59" rx="8" ry="4" transform="rotate(15 58 59)" fill="#93b29b" fill-opacity="0.8"/>
                <circle cx="92" cy="72" r="2.5" fill="#d97c84"/>
                <circle cx="87" cy="68" r="2" fill="#d97c84"/>
            </svg>
        </div>
    `;

    // 3. Elegant Olive Sprigs Artwork
    const OLIVE_SVGS = `
        <div class="floral-motif-wrap">
            <svg class="floral-corner floral-corner-bl" viewBox="0 0 130 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M-5,135 C20,120 40,95 46,60 C50,30 42,12 36,0" stroke="#5a684b" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
                <ellipse cx="22" cy="112" rx="16" ry="6" transform="rotate(-40 22 112)" fill="#788764" fill-opacity="0.8"/>
                <ellipse cx="38" cy="88" rx="15" ry="6" transform="rotate(-52 38 88)" fill="#8c9c76" fill-opacity="0.85"/>
                <ellipse cx="48" cy="64" rx="14" ry="5.5" transform="rotate(-65 48 64)" fill="#687856" fill-opacity="0.85"/>
                <ellipse cx="42" cy="38" rx="12" ry="5" transform="rotate(-75 42 38)" fill="#8c9c76" fill-opacity="0.85"/>
                <ellipse cx="38" cy="16" rx="10" ry="4.5" transform="rotate(-85 38 16)" fill="#a0b08b" fill-opacity="0.9"/>
                <ellipse cx="28" cy="100" rx="4" ry="5.5" transform="rotate(-20 28 100)" fill="#353b2d" opacity="0.85"/>
                <ellipse cx="45" cy="52" rx="3.5" ry="5" transform="rotate(-30 45 52)" fill="#353b2d" opacity="0.85"/>
            </svg>
            <svg class="floral-corner floral-corner-br" viewBox="0 0 130 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M135,135 C110,120 90,95 84,60 C80,30 88,12 94,0" stroke="#5a684b" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
                <ellipse cx="108" cy="112" rx="16" ry="6" transform="rotate(40 108 112)" fill="#788764" fill-opacity="0.8"/>
                <ellipse cx="92" cy="88" rx="15" ry="6" transform="rotate(52 92 88)" fill="#8c9c76" fill-opacity="0.85"/>
                <ellipse cx="82" cy="64" rx="14" ry="5.5" transform="rotate(65 82 64)" fill="#687856" fill-opacity="0.85"/>
                <ellipse cx="88" cy="38" rx="12" ry="5" transform="rotate(75 88 38)" fill="#8c9c76" fill-opacity="0.85"/>
                <ellipse cx="92" cy="16" rx="10" ry="4.5" transform="rotate(85 92 16)" fill="#a0b08b" fill-opacity="0.9"/>
                <ellipse cx="102" cy="100" rx="4" ry="5.5" transform="rotate(20 102 100)" fill="#353b2d" opacity="0.85"/>
                <ellipse cx="85" cy="52" rx="3.5" ry="5" transform="rotate(30 85 52)" fill="#353b2d" opacity="0.85"/>
            </svg>
        </div>
    `;

    // 4. Circular Floral Wreath around the table number
    const WREATH_SVGS = `
        <div class="floral-wreath-wrap">
            <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
                <circle cx="80" cy="80" r="64" stroke="${cfg.primaryColor}" stroke-width="1.2" stroke-dasharray="4 2" opacity="0.6"/>
                <circle cx="80" cy="80" r="58" stroke="#52735b" stroke-width="1" opacity="0.45"/>
                <ellipse cx="80" cy="20" rx="7" ry="3.5" fill="#7ba087" opacity="0.85"/>
                <ellipse cx="68" cy="23" rx="6" ry="3" transform="rotate(-25 68 23)" fill="#5a7b64" opacity="0.8"/>
                <ellipse cx="92" cy="23" rx="6" ry="3" transform="rotate(25 92 23)" fill="#5a7b64" opacity="0.8"/>
                <ellipse cx="80" cy="140" rx="7" ry="3.5" fill="#7ba087" opacity="0.85"/>
                <ellipse cx="68" cy="137" rx="6" ry="3" transform="rotate(25 68 137)" fill="#5a7b64" opacity="0.8"/>
                <ellipse cx="92" cy="137" rx="6" ry="3" transform="rotate(-25 92 137)" fill="#5a7b64" opacity="0.8"/>
                <ellipse cx="20" cy="80" rx="3.5" ry="7" fill="#7ba087" opacity="0.85"/>
                <ellipse cx="23" cy="68" rx="3" ry="6" transform="rotate(25 23 68)" fill="#5a7b64" opacity="0.8"/>
                <ellipse cx="23" cy="92" rx="3" ry="6" transform="rotate(-25 23 92)" fill="#5a7b64" opacity="0.8"/>
                <ellipse cx="140" cy="80" rx="3.5" ry="7" fill="#7ba087" opacity="0.85"/>
                <ellipse cx="137" cy="68" rx="3" ry="6" transform="rotate(-25 137 68)" fill="#5a7b64" opacity="0.8"/>
                <ellipse cx="137" cy="92" rx="3" ry="6" transform="rotate(25 137 92)" fill="#5a7b64" opacity="0.8"/>
                <circle cx="48" cy="36" r="2.5" fill="${cfg.primaryColor}"/>
                <circle cx="112" cy="36" r="2.5" fill="${cfg.primaryColor}"/>
                <circle cx="48" cy="124" r="2.5" fill="${cfg.primaryColor}"/>
                <circle cx="112" cy="124" r="2.5" fill="${cfg.primaryColor}"/>
            </svg>
        </div>
    `;

    // 5. Warm Terracotta Boho & Pampa Grass
    const BOHO_SVGS = `
        <div class="floral-motif-wrap">
            <svg class="floral-corner floral-corner-bl" viewBox="0 0 130 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0,130 Q35,100 50,55" stroke="#b67d58" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
                <path d="M40,75 Q55,50 68,30" stroke="#cf9d7c" stroke-width="1.4" stroke-linecap="round" opacity="0.75"/>
                <path d="M25,100 Q48,85 70,78" stroke="#a06e49" stroke-width="1.3" opacity="0.6"/>
                <ellipse cx="50" cy="50" rx="18" ry="6" transform="rotate(-55 50 50)" fill="#dfbaa1" fill-opacity="0.85"/>
                <ellipse cx="64" cy="34" rx="16" ry="5.5" transform="rotate(-65 64 34)" fill="#edd5c5" fill-opacity="0.9"/>
                <ellipse cx="32" cy="80" rx="17" ry="7" transform="rotate(-40 32 80)" fill="#c9916b" fill-opacity="0.8"/>
                <ellipse cx="62" cy="74" rx="14" ry="5" transform="rotate(-15 62 74)" fill="#dfbaa1" fill-opacity="0.85"/>
                <path d="M12,120 L28,88 M16,122 L36,94 M20,124 L42,102" stroke="#8d6447" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
            </svg>
            <svg class="floral-corner floral-corner-br" viewBox="0 0 130 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M130,130 Q95,100 80,55" stroke="#b67d58" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
                <path d="M90,75 Q75,50 62,30" stroke="#cf9d7c" stroke-width="1.4" stroke-linecap="round" opacity="0.75"/>
                <path d="M105,100 Q82,85 60,78" stroke="#a06e49" stroke-width="1.3" opacity="0.6"/>
                <ellipse cx="80" cy="50" rx="18" ry="6" transform="rotate(55 80 50)" fill="#dfbaa1" fill-opacity="0.85"/>
                <ellipse cx="66" cy="34" rx="16" ry="5.5" transform="rotate(65 66 34)" fill="#edd5c5" fill-opacity="0.9"/>
                <ellipse cx="98" cy="80" rx="17" ry="7" transform="rotate(40 98 80)" fill="#c9916b" fill-opacity="0.8"/>
                <ellipse cx="68" cy="74" rx="14" ry="5" transform="rotate(15 68 74)" fill="#dfbaa1" fill-opacity="0.85"/>
                <path d="M118,120 L102,88 M114,122 L94,94 M110,124 L88,102" stroke="#8d6447" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
            </svg>
        </div>
    `;

    const renderFloralMotif = (motif) => {
        if (motif === 'eucalyptus') return EUCALYPTUS_SVGS;
        if (motif === 'roses') return ROSES_SVGS;
        if (motif === 'olive') return OLIVE_SVGS;
        if (motif === 'wreath') return WREATH_SVGS;
        if (motif === 'boho') return BOHO_SVGS;
        return '';
    };

    // Render decorative icon SVG
    const renderIconSvg = () => {
        if (cfg.icon === 'none') return '';
        if (cfg.icon === 'monogram' && cfg.monogram) {
            return `<div class="monogram-badge" style="color:${cfg.primaryColor};">${esc(cfg.monogram)}</div>`;
        }
        if (cfg.icon === 'heart') {
            return `<svg class="tent-icon" viewBox="0 0 24 24" fill="${cfg.primaryColor}" width="16" height="16"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
        }
        if (cfg.icon === 'botanical') {
            return `<svg class="tent-icon" viewBox="0 0 24 24" fill="none" stroke="${cfg.primaryColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12c0-2.76 1.12-5.26 2.93-7.07"/><path d="M8 14c1.5-1.5 3.5-2 6-2"/><path d="M9 9c1-1 2.5-1.5 4.5-1.5"/><path d="M14 6c.5-.5 1.5-.8 2.5-.8"/></svg>`;
        }
        if (cfg.icon === 'toast') {
            return `<svg class="tent-icon" viewBox="0 0 24 24" fill="none" stroke="${cfg.primaryColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M8 22h8"/><path d="M12 15v7"/><path d="m16 8 3 7h-6l3-7z"/><path d="m8 8-3 7h6l-3-7z"/><path d="M6 3h4l1 5H5l1-5z"/><path d="M14 3h4l1 5h-6l1-5z"/></svg>`;
        }
        if (cfg.icon === 'star') {
            return `<span class="tent-icon" style="color:${cfg.primaryColor};font-size:14pt;line-height:1;">✦</span>`;
        }
        // Default: Wedding rings
        return `<svg class="tent-icon" viewBox="0 0 32 20" fill="none" stroke="${cfg.primaryColor}" stroke-width="2" width="22" height="14"><circle cx="11" cy="10" r="7"/><circle cx="21" cy="10" r="7"/></svg>`;
    };

    // Render a single face (front or back rotated 180deg)
    const renderFace = (table, faceType) => {
        // Parse table title & number
        let tableHeader = cfg.prefix || '';
        let tableMain = table.name;
        const match = table.name.match(/^mesa\s+(.+)$/i);
        if (match) {
            tableMain = match[1];
        } else if (/principal|honor|novios/i.test(table.name)) {
            tableHeader = 'MESA';
            tableMain = table.name.toUpperCase();
        }

        return `
            <div class="tent-face ${faceType === 'back' ? 'tent-face-back' : 'tent-face-front'} border-${cfg.borderStyle}">
                <div class="tent-inner" style="background-color:${cfg.bgColor};">
                    ${cfg.bgImage ? `
                        <div class="custom-bg-layer" style="background-image: url('${cfg.bgImage}'); opacity: ${cfg.bgImageOpacity};"></div>
                    ` : ''}

                    ${renderFloralMotif(cfg.floralMotif)}

                    <div class="tent-content-layer">
                        <!-- Bloque central unificado: Número + Nombre/Iniciales bajo el número + Fecha -->
                        <div class="tent-center-stack">
                            ${tableHeader ? `<div class="table-tag" style="color:${cfg.primaryColor};">${esc(tableHeader)}</div>` : ''}
                            <div class="table-number font-number-${cfg.fontNumber} ${tableMain.length > 4 ? 'table-text-long' : ''}" style="color:${cfg.numberColor};">${esc(tableMain)}</div>
                            ${cfg.title ? `<div class="couple-title font-title-${cfg.fontTitle}" style="color:${cfg.primaryColor};">${esc(cfg.title)}</div>` : ''}
                            ${cfg.subtitle ? `<div class="event-date">${esc(cfg.subtitle)}</div>` : ''}
                            ${(cfg.icon && cfg.icon !== 'none') ? `<div class="face-footer">${renderIconSvg()}</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    // Render a single complete folding column/strip
    const renderSingleTentColumn = (table) => `
        <div class="tent-strip">
            <!-- Solapa superior de pegado -->
            <div class="tent-flap">
                <div class="flap-content">
                    <span>✂ Pestaña de pegado (doblar hacia adentro)</span>
                </div>
            </div>

            <!-- Línea de pliegue 1 -->
            <div class="guide-line fold-step-1">
                <span>- - - - Doblar hacia adentro - - - -</span>
            </div>

            <!-- Cara Posterior (invertida 180° para verse derecha al plegar en carpa) -->
            ${renderFace(table, 'back')}

            <!-- Línea de pliegue 2: Vértice superior del triángulo -->
            <div class="guide-line apex-line">
                <span class="apex-badge">▲ ▲ ▲ Doblar aquí (Cúspide superior) ▲ ▲ ▲</span>
            </div>

            <!-- Cara Frontal (al derecho) -->
            ${renderFace(table, 'front')}

            <!-- Línea de pliegue 3: Base del triángulo -->
            <div class="guide-line fold-step-3">
                <span>▼ ▼ ▼ Doblar hacia adentro (Base) ▼ ▼ ▼</span>
            </div>

            <!-- Base de apoyo horizontal -->
            <div class="tent-base" style="background-color:${cfg.bgColor === '#ffffff' ? '#fafafa' : cfg.bgColor};">
                <div class="base-content">
                    <div class="base-title">BASE DE APOYO · APOYA PLANO SOBRE EL MANTEL</div>
                    <div class="base-thanks" style="color:${cfg.textColor};">${esc(cfg.title)} · ${esc(cfg.baseText)}</div>
                </div>
            </div>
        </div>
    `;

    // Render empty placeholder column if odd number of tables in 2-per-sheet mode
    const renderEmptyColumn = () => `
        <div class="tent-strip tent-strip-empty">
            <div class="empty-col-inner">
                <div class="empty-note">
                    <p>Espacio reservado (número impar de mesas)</p>
                    <span>Podés usar esta sección para notas del salón o mesa de niños</span>
                </div>
            </div>
        </div>
    `;

    let pagesHtml = '';

    if (isStandardSize) {
        // Mode Standard: 2 complete tents per A4 sheet side-by-side (10.5 x 14 cm tabletop size)
        const pairs = [];
        for (let i = 0; i < sorted.length; i += 2) {
            pairs.push([sorted[i], sorted[i + 1] || null]);
        }

        pagesHtml = pairs.map(([tA, tB]) => `
            <div class="tent-sheet-standard">
                <div class="tent-col">
                    ${renderSingleTentColumn(tA)}
                </div>
                <div class="center-cut-divider">
                    <div class="cut-line"></div>
                    <div class="cut-badge">✂ Cortar por la línea central (2 carteles de mesa por hoja A4) ✂</div>
                    <div class="cut-line"></div>
                </div>
                <div class="tent-col">
                    ${tB ? renderSingleTentColumn(tB) : renderEmptyColumn()}
                </div>
            </div>
        `).join('');
    } else {
        // Mode Large: 1 tent per A4 sheet (full width 21 cm)
        pagesHtml = sorted.map(t => `
            <div class="tent-page-large">
                ${renderSingleTentColumn(t)}
            </div>
        `).join('');
    }

    const stylesCss = `
        @import url('https://fonts.googleapis.com/css2?family=Alex+Brush&family=Caveat:wght@600;700&family=Cormorant+Garamond:ital,wght@0,600;0,700;1,400&family=Great+Vibes&family=Montserrat:wght@400;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,900;1,400&display=swap');

        @page {
            size: A4 portrait;
            margin: 4mm 5mm;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: ${cfg.textColor};
            font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        /* Standard 2 per sheet layout (10.5 x 14 cm table centerpieces) */
        .tent-sheet-standard {
            width: 200mm;
            height: 289mm;
            display: flex;
            justify-content: space-between;
            page-break-after: always;
            break-after: page;
            margin: 0 auto;
            position: relative;
            background: #ffffff;
        }
        .tent-sheet-standard:last-child {
            page-break-after: avoid;
            break-after: avoid;
        }
        .tent-col {
            width: 96mm;
            height: 289mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
        }

        /* Central Cut Divider */
        .center-cut-divider {
            width: 8mm;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .cut-line {
            flex: 1;
            width: 0;
            border-left: 1px dashed #a1a1aa;
        }
        .cut-badge {
            writing-mode: vertical-rl;
            transform: rotate(180deg);
            font-size: 6.5pt;
            color: #71717a;
            letter-spacing: 1px;
            padding: 10px 0;
            white-space: nowrap;
            text-transform: uppercase;
            font-weight: 600;
        }

        /* Large single page layout */
        .tent-page-large {
            width: 195mm;
            height: 289mm;
            page-break-after: always;
            break-after: page;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            margin: 0 auto;
            position: relative;
            background: #ffffff;
        }
        .tent-page-large:last-child {
            page-break-after: avoid;
            break-after: avoid;
        }

        .tent-strip {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .tent-strip-empty {
            border: 1px dashed #e4e4e7;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .empty-note {
            text-align: center;
            color: #a1a1aa;
            font-size: 8pt;
        }
        .empty-note p { font-weight: 700; margin: 0 0 4px; }
        .empty-note span { font-size: 7pt; }

        /* Guías de doblado y solapa */
        .tent-flap {
            height: 14mm;
            background: repeating-linear-gradient(45deg, #fbfbfb, #fbfbfb 8px, #f4f4f5 8px, #f4f4f5 16px);
            border: 1px dashed #a1a1aa;
            border-bottom: none;
            border-radius: 6px 6px 0 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .flap-content {
            font-size: 7pt;
            color: #71717a;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            font-weight: 600;
        }
        .guide-line {
            height: 3.5mm;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 6pt;
            color: #71717a;
            position: relative;
        }
        .guide-line::before {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            top: 50%;
            border-bottom: 1px dashed #a1a1aa;
            z-index: 1;
        }
        .guide-line span {
            background: #fff;
            padding: 0 6px;
            position: relative;
            z-index: 2;
            letter-spacing: 0.5px;
        }
        .apex-line::before {
            border-bottom: 2px dashed ${cfg.primaryColor};
        }
        .apex-badge {
            color: ${cfg.primaryColor} !important;
            font-weight: 700;
            font-size: 6.5pt;
        }

        /* Caras de la carpa (Front & Back) */
        .tent-face {
            height: 114mm;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2mm;
        }
        .tent-face-back {
            transform: rotate(180deg);
        }
        .tent-inner {
            width: 100%;
            height: 100%;
            border-radius: 8px;
            position: relative;
            box-sizing: border-box;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
        }
        .tent-content-layer {
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            z-index: 2;
        }

        /* Custom Background Image Layer */
        .custom-bg-layer {
            position: absolute;
            inset: 0;
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            pointer-events: none;
            z-index: 0;
        }

        /* Floral Motifs Layer */
        .floral-motif-wrap {
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 1;
        }
        .floral-corner {
            position: absolute;
            bottom: -2px;
            width: 48mm;
            height: 48mm;
        }
        .floral-corner-bl { left: -4px; }
        .floral-corner-br { right: -4px; }
        .floral-bottom-garland {
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 44mm;
            height: 14mm;
        }
        .floral-wreath-wrap {
            position: absolute;
            top: 42%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 48mm;
            height: 48mm;
            pointer-events: none;
            z-index: 1;
        }

        /* Estilos de Marco */
        .border-double .tent-inner {
            border: 2px solid ${cfg.primaryColor};
            outline: 1px solid ${cfg.primaryColor};
            outline-offset: -4px;
        }
        .border-single .tent-inner {
            border: 2px solid ${cfg.primaryColor};
        }
        .border-botanical .tent-inner {
            border: 1px solid rgba(85, 123, 99, 0.25);
            box-shadow: inset 0 0 0 3px rgba(85, 123, 99, 0.08);
        }
        .border-corners .tent-inner {
            border: 1px solid rgba(0,0,0,0.08);
            position: relative;
        }
        .border-corners .tent-inner::before,
        .border-corners .tent-inner::after {
            content: '';
            position: absolute;
            width: 16px;
            height: 16px;
            border-color: ${cfg.primaryColor};
            border-style: solid;
        }
        .border-corners .tent-inner::before {
            top: 4px; left: 4px;
            border-width: 2px 0 0 2px;
        }
        .border-corners .tent-inner::after {
            bottom: 4px; right: 4px;
            border-width: 0 2px 2px 0;
        }
        .border-rounded .tent-inner {
            border: 2px solid ${cfg.primaryColor};
            border-radius: 16px;
        }
        .border-none .tent-inner {
            border: none;
        }

        /* Tipografías del Título */
        .font-title-cursive {
            font-family: 'Alex Brush', 'Great Vibes', cursive;
            font-size: 20pt;
            line-height: 1.1;
            letter-spacing: 0.5px;
            font-weight: normal;
        }
        .font-title-serif {
            font-family: 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
            font-size: 11pt;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
        }
        .font-title-sans {
            font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;
            font-size: 10pt;
            font-weight: 800;
            letter-spacing: 2px;
            text-transform: uppercase;
        }

        /* Tipografías del Número */
        .font-number-brush {
            font-family: 'Caveat', cursive;
            font-size: 64pt;
            line-height: 0.88;
            font-weight: 700;
            letter-spacing: -1px;
        }
        .font-number-serif {
            font-family: 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
            font-size: 44pt;
            line-height: 1;
            font-weight: 900;
            letter-spacing: -1px;
        }
        .font-number-sans {
            font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;
            font-size: 44pt;
            line-height: 1;
            font-weight: 900;
        }
        .font-number-cursive {
            font-family: 'Great Vibes', 'Alex Brush', cursive;
            font-size: 50pt;
            line-height: 1;
            font-weight: normal;
        }

        .tent-center-stack {
            width: 90%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            margin: 0 auto;
            transform: translateY(-3mm);
        }
        .couple-title {
            margin-top: 1.5mm;
            margin-bottom: 0.5mm;
            max-width: 92%;
            word-wrap: break-word;
        }

        .table-tag {
            font-family: 'Montserrat', Arial, sans-serif;
            font-size: 7.5pt;
            letter-spacing: 3px;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 0px;
        }
        .table-text-long {
            font-size: 22pt !important;
            letter-spacing: 0 !important;
        }
        .event-date {
            font-size: 7.5pt;
            color: #52525b;
            margin-top: 2px;
            letter-spacing: 0.5px;
            font-family: 'Montserrat', Arial, sans-serif;
        }
        .icon-wrap {
            margin-bottom: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .monogram-badge {
            font-family: 'Alex Brush', 'Great Vibes', cursive;
            font-size: 16pt;
            line-height: 1;
            letter-spacing: 1px;
        }

        .face-footer {
            font-size: 6pt;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            font-family: 'Montserrat', Arial, sans-serif;
            opacity: 0.8;
            margin-bottom: 3mm;
        }

        /* Base de apoyo */
        .tent-base {
            height: 36mm;
            border: 1px dashed #a1a1aa;
            border-top: none;
            border-radius: 0 0 6px 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 4px 10px;
        }
        .base-title {
            font-size: 6.5pt;
            font-weight: 700;
            color: #52525b;
            letter-spacing: 1px;
            text-transform: uppercase;
            font-family: 'Montserrat', Arial, sans-serif;
        }
        .base-thanks {
            font-size: 8pt;
            font-weight: 600;
            margin-top: 2px;
            font-family: Georgia, serif;
        }
    `;

    const html = `<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Carteles de Mesa (3D) - ${esc(cfg.title)}</title>
    <style>${stylesCss}</style>
</head>
<body>
    ${pagesHtml}
</body>
</html>`;

    return html;
};

