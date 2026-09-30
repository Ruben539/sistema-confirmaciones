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
