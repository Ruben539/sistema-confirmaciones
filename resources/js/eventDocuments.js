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
    // Give fonts/SVG a moment to lay out before opening the print dialog
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        // Safari doesn't always fire onafterprint
        setTimeout(cleanup, 60000);
    }, 300);
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
    style = 'classic',
    config = {},
}) => {
    let sorted = [...tables].sort(byTableName);
    if (selectedTableIds && selectedTableIds.length > 0) {
        sorted = sorted.filter(t => selectedTableIds.includes(t.id));
    }
    if (sorted.length === 0) {
        sorted = [...tables].sort(byTableName);
    }

    // Merge configuration with defaults
    const cfg = {
        title: config.title ?? eventName(event),
        subtitle: config.subtitle ?? formatDate(event?.event_date),
        prefix: config.prefix ?? 'MESA',
        baseText: config.baseText ?? '¡Gracias por celebrar con nosotros!',
        includeGuests: config.includeGuests ?? includeGuests,
        fontTitle: config.fontTitle ?? (style === 'classic' ? 'cursive' : style === 'modern' ? 'sans' : 'serif'),
        fontNumber: config.fontNumber ?? (style === 'modern' ? 'sans' : 'serif'),
        primaryColor: config.primaryColor ?? (style === 'classic' ? '#b58d3d' : style === 'modern' ? '#18181b' : '#3b5e43'),
        numberColor: config.numberColor ?? (style === 'classic' ? '#18181b' : style === 'modern' ? '#09090b' : '#1c2a1f'),
        textColor: config.textColor ?? '#27272a',
        bgColor: config.bgColor ?? '#ffffff',
        borderStyle: config.borderStyle ?? (style === 'modern' ? 'single' : 'double'),
        icon: config.icon ?? 'rings', // 'rings' | 'heart' | 'botanical' | 'toast' | 'star' | 'monogram' | 'none'
        monogram: config.monogram ?? '',
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

    const pagesHtml = sorted.map(t => {
        const guests = [...(t.guests || [])].sort(byName);

        // Parse table title & number
        let tableHeader = cfg.prefix || '';
        let tableMain = t.name;
        const match = t.name.match(/^mesa\s+(.+)$/i);
        if (match) {
            tableMain = match[1];
        } else if (/principal|honor|novios/i.test(t.name)) {
            tableHeader = 'MESA';
            tableMain = t.name.toUpperCase();
        }

        // Build guest list columns HTML
        let guestsHtml = '';
        if (cfg.includeGuests && guests.length > 0) {
            const guestItems = guests.map(g => {
                const companion = g.companions ? ` <small class="comp">(+ ${esc(g.companions)})</small>` : (seatsOf(g) > 1 ? ` <small class="comp">(+${seatsOf(g) - 1})</small>` : '');
                return `<div class="g-item">• ${esc(g.name)}${companion}</div>`;
            });
            const isTwoCol = guestItems.length > 5;
            guestsHtml = `
                <div class="guest-list-box ${isTwoCol ? 'two-col' : 'one-col'}">
                    ${guestItems.join('')}
                </div>
            `;
        } else {
            guestsHtml = `
                <div class="welcome-quote">
                    <p class="quote-text">¡Bienvenidos a nuestra celebración!</p>
                    <div class="ornament" style="color:${cfg.primaryColor};">❦</div>
                </div>
            `;
        }

        const renderFace = (faceType) => `
            <div class="tent-face ${faceType === 'back' ? 'tent-face-back' : 'tent-face-front'} border-${cfg.borderStyle}">
                <div class="tent-inner" style="background-color:${cfg.bgColor};">
                    <div class="face-header">
                        <div class="icon-wrap">${renderIconSvg()}</div>
                        <div class="couple-title font-title-${cfg.fontTitle}" style="color:${cfg.primaryColor};">${esc(cfg.title)}</div>
                        ${cfg.subtitle ? `<div class="event-date">${esc(cfg.subtitle)}</div>` : ''}
                    </div>

                    <div class="face-center">
                        ${tableHeader ? `<div class="table-tag" style="color:${cfg.primaryColor};">${esc(tableHeader)}</div>` : ''}
                        <div class="table-number font-number-${cfg.fontNumber} ${tableMain.length > 4 ? 'table-text-long' : ''}" style="color:${cfg.numberColor};">${esc(tableMain)}</div>
                    </div>

                    <div class="face-body">
                        ${guestsHtml}
                    </div>

                    <div class="face-footer">
                        <span class="subtle-tag" style="color:${cfg.primaryColor};">✦ &nbsp; ${esc(cfg.title)} &nbsp; ✦</span>
                    </div>
                </div>
            </div>
        `;

        return `
            <div class="tent-page">
                <!-- Solapa superior de pegado -->
                <div class="tent-flap">
                    <div class="flap-content">
                        <span>✂ Pestaña de pegado / ensamble (doblar hacia adentro y fijar a la base)</span>
                    </div>
                </div>

                <!-- Línea de pliegue 1 -->
                <div class="guide-line fold-step-1">
                    <span>- - - - - - - - Doblar hacia adentro (Pestaña) - - - - - - - -</span>
                </div>

                <!-- Cara Posterior (invertida 180° para verse derecha al plegar en carpa) -->
                ${renderFace('back')}

                <!-- Línea de pliegue 2: Vértice superior del triángulo -->
                <div class="guide-line apex-line">
                    <span class="apex-badge">▲ ▲ ▲ Doblar aquí (Cúspide / Vértice superior del triángulo) ▲ ▲ ▲</span>
                </div>

                <!-- Cara Frontal (al derecho) -->
                ${renderFace('front')}

                <!-- Línea de pliegue 3: Base del triángulo -->
                <div class="guide-line fold-step-3">
                    <span>▼ ▼ ▼ Doblar hacia adentro (Base inferior del triángulo) ▼ ▼ ▼</span>
                </div>

                <!-- Base de apoyo horizontal -->
                <div class="tent-base" style="background-color:${cfg.bgColor === '#ffffff' ? '#fafafa' : cfg.bgColor};">
                    <div class="base-content">
                        <div class="base-title">BASE DE APOYO (apoya plano sobre el mantel)</div>
                        <div class="base-thanks" style="color:${cfg.textColor};">${esc(cfg.title)} · ${esc(cfg.baseText)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const stylesCss = `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,400&family=Great+Vibes&family=Montserrat:wght@400;600;700;900&family=Playfair+Display:ital,wght@0,600;0,700;0,900;1,400&display=swap');

        @page {
            size: A4 portrait;
            margin: 6mm 10mm;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: ${cfg.textColor};
            font-family: 'Helvetica Neue', Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .tent-page {
            width: 100%;
            height: 284mm;
            page-break-after: always;
            break-after: page;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            box-sizing: border-box;
            background: #ffffff;
        }
        .tent-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
        }

        /* Guías de doblado y solapa */
        .tent-flap {
            height: 18mm;
            background: repeating-linear-gradient(45deg, #fbfbfb, #fbfbfb 10px, #f4f4f5 10px, #f4f4f5 20px);
            border: 1px dashed #a1a1aa;
            border-bottom: none;
            border-radius: 6px 6px 0 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .flap-content {
            font-size: 8pt;
            color: #71717a;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            font-weight: 600;
        }
        .guide-line {
            height: 4mm;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 7pt;
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
            padding: 0 8px;
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
            font-size: 7.5pt;
        }

        /* Caras de la carpa (Front & Back) */
        .tent-face {
            height: 108mm;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4mm;
        }
        .tent-face-back {
            transform: rotate(180deg);
        }
        .tent-inner {
            width: 100%;
            height: 100%;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            text-align: center;
            padding: 10px 16px 8px;
            position: relative;
            box-sizing: border-box;
        }

        /* Estilos de Marco */
        .border-double .tent-inner {
            border: 2px solid ${cfg.primaryColor};
            outline: 1px solid ${cfg.primaryColor};
            outline-offset: -5px;
        }
        .border-single .tent-inner {
            border: 2px solid ${cfg.primaryColor};
        }
        .border-corners .tent-inner {
            border: 1px solid rgba(0,0,0,0.08);
            position: relative;
        }
        .border-corners .tent-inner::before,
        .border-corners .tent-inner::after {
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
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
            border-radius: 18px;
        }
        .border-none .tent-inner {
            border: none;
        }

        /* Tipografías del Título */
        .font-title-cursive {
            font-family: 'Great Vibes', cursive;
            font-size: 22pt;
            line-height: 1.1;
            letter-spacing: 0.5px;
            font-weight: normal;
        }
        .font-title-serif {
            font-family: 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
            font-size: 13pt;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
        }
        .font-title-sans {
            font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;
            font-size: 11pt;
            font-weight: 800;
            letter-spacing: 2px;
            text-transform: uppercase;
        }

        /* Tipografías del Número */
        .font-number-serif {
            font-family: 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
            font-size: 44pt;
            line-height: 1;
            font-weight: 900;
            letter-spacing: -1px;
        }
        .font-number-sans {
            font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;
            font-size: 46pt;
            line-height: 1;
            font-weight: 900;
        }
        .font-number-cursive {
            font-family: 'Great Vibes', cursive;
            font-size: 48pt;
            line-height: 1;
            font-weight: normal;
        }

        .table-tag {
            font-family: 'Montserrat', Arial, sans-serif;
            font-size: 8.5pt;
            letter-spacing: 4px;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 2px;
        }
        .table-text-long {
            font-size: 22pt !important;
            letter-spacing: 0 !important;
        }
        .event-date {
            font-size: 7.5pt;
            color: #71717a;
            margin-top: 1px;
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
            font-family: 'Great Vibes', cursive;
            font-size: 18pt;
            line-height: 1;
            letter-spacing: 1px;
        }

        /* Comensales / Lista de invitados */
        .face-body {
            width: 100%;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 4px 0;
            overflow: hidden;
        }
        .guest-list-box {
            width: 100%;
            max-width: 96%;
            background: rgba(0, 0, 0, 0.02);
            border: 1px solid rgba(0, 0, 0, 0.08);
            border-radius: 6px;
            padding: 5px 8px;
            text-align: left;
        }
        .guest-list-box.two-col {
            column-count: 2;
            column-gap: 14px;
        }
        .guest-list-box.one-col {
            text-align: center;
        }
        .g-item {
            font-size: 8pt;
            color: ${cfg.textColor};
            line-height: 1.3;
            break-inside: avoid;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-family: 'Helvetica Neue', Arial, sans-serif;
        }
        .comp {
            font-size: 7pt;
            color: #71717a;
            font-weight: normal;
        }

        .welcome-quote {
            padding: 4px 10px;
        }
        .quote-text {
            font-size: 9pt;
            font-style: italic;
            color: #52525b;
            margin: 0;
            font-family: Georgia, serif;
        }
        .ornament {
            font-size: 13pt;
            margin-top: 2px;
        }

        .face-footer {
            font-size: 6.5pt;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-family: 'Montserrat', Arial, sans-serif;
            opacity: 0.85;
        }

        /* Base de apoyo */
        .tent-base {
            height: 38mm;
            border: 1px dashed #a1a1aa;
            border-top: none;
            border-radius: 0 0 6px 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 4px 16px;
        }
        .base-title {
            font-size: 7.5pt;
            font-weight: 700;
            color: #52525b;
            letter-spacing: 1px;
            text-transform: uppercase;
            font-family: 'Montserrat', Arial, sans-serif;
        }
        .base-thanks {
            font-size: 9pt;
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

