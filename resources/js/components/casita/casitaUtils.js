// Shared helpers for the "La Casita" module: money, dates, printable documents and
// the reader for the old Excel ("Registro" sheet) used by the import screen.

import * as XLSX from 'xlsx';
import { printHtml } from '../../eventDocuments';

// Logos uploaded from "Logos" (Registro de eventos / Pérdidas), stored in storage/app/public/images
export const CASITA_LOGO = '/api/casita/logos/casita'; // presupuestos, recibos, borrador
export const REAL_LOGO = '/api/casita/logos/real';     // pérdidas y bebidas

const imageCache = {};
export const clearImageCache = () => Object.keys(imageCache).forEach(k => delete imageCache[k]);

/**
 * Loads an image as a data URL for jsPDF (PNG or JPEG; other formats are converted to PNG).
 * Resolves null when the file is missing, so documents still work without it.
 */
export const loadImage = (url) => {
    imageCache[url] ??= fetch(url, { cache: 'no-cache' })
        .then(r => (r.ok ? r.blob() : null))
        .then(blob => blob && blob.type.startsWith('image/') ? new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const width = img.naturalWidth, height = img.naturalHeight;
                    if (/png|jpe?g/.test(blob.type)) {
                        resolve({ dataUrl: reader.result, width, height, format: blob.type.includes('png') ? 'PNG' : 'JPEG' });
                        return;
                    }
                    const canvas = Object.assign(document.createElement('canvas'), { width, height });
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    resolve({ dataUrl: canvas.toDataURL('image/png'), width, height, format: 'PNG' });
                };
                img.onerror = () => resolve(null);
                img.src = reader.result;
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        }) : null)
        .catch(() => null)
        .then(result => { if (!result) delete imageCache[url]; return result; });
    return imageCache[url];
};

export const gs = (n) => `₲ ${Math.round(Number(n) || 0).toLocaleString('es-PY')}`;

// "1.000.000", "₲ 850.000", "  -  " → integer
export const toInt = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : 0;
    const digits = String(value ?? '').replace(/[^\d-]/g, '').replace(/(?!^)-/g, '');
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : 0;
};

export const fmtDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

export const longDate = (iso) => {
    if (!iso) return '';
    const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

export const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const isPast = (iso) => Boolean(iso) && iso < todayIso();

// Key to match a typed detail with the price list: no accents, no case, no extra spaces
export const catalogKey = (name) => String(name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Applies a change to a budget / losses line and keeps its price in sync with the price list:
 * when the detail becomes a different list item, the price becomes that item's price.
 * While the item stays the same, the price is kept (a saved or hand-typed price is respected).
 * priceFor = list key the current price belongs to.
 */
export const applyLineChange = (line, patch, priceByKey) => {
    const next = { ...line, ...patch };
    const currentFor = line.priceFor ?? catalogKey(line.description);
    if (patch.description !== undefined) {
        const key = catalogKey(patch.description);
        if (priceByKey.has(key) && key !== currentFor) {
            next.unit_price = priceByKey.get(key);
            next.priceFor = key;
        }
    } else if (patch.unit_price !== undefined) {
        next.priceFor = catalogKey(next.description); // typed by hand for this item
    }
    return next;
};

export const KIND_LABELS = { garantia: 'Garantía', sena: 'Seña', pago: 'Pago', devolucion: 'Devolución' };

export const SECTION_LABELS = {
    perdida: 'Pérdidas durante el evento',
    agregado: 'Bebidas agregadas durante el evento',
    sobrante: 'Bebidas sobrantes del evento',
};

// Groups of the price list (the bdLista sheet had none; they only organize the screen)
export const CATALOG_CATEGORIES = {
    paquete: 'Paquetes', garantia: 'Garantía', servicio: 'Servicios', personal: 'Personal', comida: 'Comida',
    bebida: 'Bebidas', mobiliario: 'Mobiliario', estructura: 'Estructuras', vajilla: 'Vajilla', otro: 'Otros',
};

// ---------------------------------------------------------------------------
// Printable documents (same look as the Excel sheets)
// ---------------------------------------------------------------------------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSS = `
    *{box-sizing:border-box}
    body{font-family:'Helvetica Neue',Arial,sans-serif;color:#18181b;margin:0;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #18181b;padding-bottom:8px;margin-bottom:14px}
    .head h1{font-size:20px;margin:0}
    .head .logo{display:block;height:64px;margin:0 0 6px auto}
    .head .brand{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#71717a;text-align:right}
    .meta{display:grid;grid-template-columns:140px 1fr;gap:4px 10px;margin-bottom:14px}
    .meta b{color:#52525b;font-weight:600}
    table{width:100%;border-collapse:collapse}
    th{background:#f4f4f5;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#52525b}
    th,td{border-bottom:1px solid #e4e4e7;padding:5px 7px;vertical-align:top}
    td.n,th.n{text-align:right;white-space:nowrap}
    tr{break-inside:avoid}
    .section td{background:#fafafa;font-weight:700}
    .totals{margin-top:14px;margin-left:auto;width:340px}
    .totals div{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #e4e4e7}
    .totals .big{font-size:15px;font-weight:800;border-bottom:2px solid #18181b}
    .notes{margin-top:16px;padding:8px 10px;border:1px solid #e4e4e7;border-radius:6px;white-space:pre-wrap}
    .sign{margin-top:48px;display:flex;justify-content:space-around}
    .sign div{border-top:1px solid #18181b;width:200px;text-align:center;padding-top:4px;font-size:10px;color:#52525b}
    @page{size:A4 portrait;margin:14mm}
`;

const shell = (title, body) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;

// The logo hides itself if the file is missing on the server
const logoTag = (url) => url ? `<img class="logo" src="${esc(`${window.location.origin}${url}?t=${Date.now()}`)}" alt="" onerror="this.remove()">` : '';

const head = (title, event, logo = CASITA_LOGO) => `
    <div class="head">
        <div><h1>${esc(title)}</h1></div>
        <div class="brand">${logoTag(logo)}${esc(event.venue || 'La Casita')}<br>Impreso ${new Date().toLocaleDateString('es-PY')}</div>
    </div>
    <div class="meta">
        <b>Cliente:</b><span>${esc(event.client_name)}</span>
        <b>Fecha del evento:</b><span>${esc(longDate(event.event_date) || 'A confirmar')}</span>
        <b>Horario:</b><span>${esc(event.schedule || '—')}</span>
        <b>Lugar:</b><span>${esc(event.venue || 'La Casita')}</span>
        <b>Menú:</b><span>${esc(event.menu || '—')}</span>
        ${event.planner_name ? `<b>Wedding planner:</b><span>${esc(event.planner_name)}</span>` : ''}
    </div>`;

/** Presupuesto / recibo (hoja "Auxiliar"). withPayments adds the payment history. */
export const printBudget = (event, { withPayments = false } = {}) => {
    const rows = (event.items || []).map(i => `
        <tr><td>${esc(i.description)}</td><td class="n">${gs(i.unit_price)}</td><td class="n">${i.quantity}</td><td class="n">${gs(i.total)}</td></tr>`).join('');

    const payments = withPayments && (event.payments || []).length ? `
        <h3 style="margin:22px 0 6px;font-size:13px">Pagos recibidos</h3>
        <table><thead><tr><th>Fecha</th><th>Motivo</th><th>Detalle</th><th class="n">Monto</th></tr></thead><tbody>
        ${event.payments.map(p => `<tr><td>${fmtDate(p.paid_on)}</td><td>${esc(KIND_LABELS[p.kind] || p.kind)}</td><td>${esc(p.note || '')}</td><td class="n">${p.kind === 'devolucion' ? '− ' : ''}${gs(p.amount)}</td></tr>`).join('')}
        </tbody></table>` : '';

    const body = `
        ${head(withPayments ? 'Recibo' : 'Presupuesto', event)}
        <table><thead><tr><th>Detalle</th><th class="n">Precio</th><th class="n">Cantidad</th><th class="n">Total</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="totals">
            <div class="big"><span>Total de presupuesto</span><span>${gs(event.budget_total)}</span></div>
            <div><span>Total abonado</span><span>${gs(event.paid_total)}</span></div>
            <div class="big"><span>Saldo pendiente</span><span>${gs(event.balance)}</span></div>
        </div>
        ${payments}
        ${event.notes ? `<div class="notes"><b>Observaciones:</b> ${esc(event.notes)}</div>` : ''}`;

    printHtml(shell(`${withPayments ? 'Recibo' : 'Presupuesto'} - ${event.client_name}`, body));
};

/** Liquidación post-evento (hoja "Perdidas"). */
export const printSettlement = (event) => {
    const s = event.settlement || {};
    const section = (key) => {
        const lines = (event.losses || []).filter(l => l.section === key);
        if (!lines.length) return '';
        return `<tr class="section"><td colspan="4">${esc(SECTION_LABELS[key])}</td></tr>` + lines.map(l =>
            `<tr><td>${esc(l.description)}</td><td class="n">${l.quantity}</td><td class="n">${gs(l.unit_price)}</td><td class="n">${gs(l.total)}</td></tr>`).join('');
    };

    const body = `
        ${head('Liquidación de pérdidas y bebidas', event, REAL_LOGO)}
        <table><thead><tr><th>Detalle</th><th class="n">Cantidad</th><th class="n">Precio unitario</th><th class="n">Total</th></tr></thead>
        <tbody>${section('perdida')}${section('agregado')}${section('sobrante')}</tbody></table>
        <div class="totals">
            <div><span>Pérdidas y bebidas agregadas</span><span>${gs(s.charges_total)}</span></div>
            <div><span>Bebidas sobrantes</span><span>${gs(s.leftover_total)}</span></div>
            <div><span>Garantía</span><span>${gs(s.guarantee)}</span></div>
            <div><span>Garantía + sobrantes</span><span>${gs(s.credits_total)}</span></div>
            <div class="big"><span>${s.result >= 0 ? `Deuda a saldar con ${esc(event.venue || 'La Casita')}` : 'A devolver al cliente'}</span><span>${gs(Math.abs(s.result || 0))}</span></div>
        </div>
        <div class="sign"><div>Firma del cliente</div><div>${esc(event.venue || 'La Casita')}</div></div>`;

    printHtml(shell(`Pérdidas - ${event.client_name}`, body));
};

// ---------------------------------------------------------------------------
// Reading the old Excel / CSV ("Registro" sheet)
// ---------------------------------------------------------------------------

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const COLUMNS = {
    date: ['fecha'], venue: ['lugar'], client: ['cliente'], menu: ['menu'], detail: ['detalle'],
    price: ['precio'], quantity: ['cantidad'], total: ['total'], note: ['observacion', 'observaciones'],
};

const pad = (n) => String(n).padStart(2, '0');

// Excel serial (days since 1899-12-30) → yyyy-mm-dd
const fromSerial = (serial) => {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

// dd/mm/yyyy (also fixes typos like 21/11/225 and two-digit years)
const parseDate = (value) => {
    if (value === '' || value == null) return { iso: null };
    if (typeof value === 'number') return { iso: fromSerial(value) };
    if (value instanceof Date) return { iso: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` };
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(String(value).trim());
    if (!m) return { iso: null, warning: `fecha no reconocida "${value}"` };
    let year = m[3];
    let warning;
    if (year.length === 2) year = `20${year}`;
    if (year.length === 3) { warning = `año "${year}" corregido a "2${year.slice(1).padStart(3, '0')}"`; year = `2${year.slice(1).padStart(3, '0')}`; }
    const day = Number(m[1]); const month = Number(m[2]);
    const check = new Date(Number(year), month - 1, day);
    if (check.getMonth() !== month - 1 || check.getDate() !== day) return { iso: null, warning: `fecha inválida "${value}"` };
    return { iso: `${year}-${pad(month)}-${pad(day)}`, warning };
};

const decode = (buffer) => {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
        return new TextDecoder('windows-1252').decode(buffer); // the Excel CSV export
    }
};

const splitCsvLine = (line, sep) => {
    const out = []; let cur = ''; let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') quoted = false;
            else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === sep) { out.push(cur); cur = ''; }
        else cur += ch;
    }
    out.push(cur);
    return out;
};

const readMatrix = async (file) => {
    const buffer = await file.arrayBuffer();
    if (/\.(csv|txt)$/i.test(file.name)) {
        const lines = decode(buffer).split(/\r?\n/);
        const sample = lines.slice(0, 20).join('\n');
        const sep = (sample.match(/;/g) || []).length >= (sample.match(/,/g) || []).length ? ';' : ',';
        return lines.map(l => splitCsvLine(l, sep));
    }
    const wb = XLSX.read(buffer, { type: 'array' });
    const name = wb.SheetNames.find(n => norm(n) === 'registro') || wb.SheetNames[0];
    return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
};

/**
 * Returns { rows, warnings } where each row is
 * { date, client, venue, menu, detail, price, quantity, note } ready for POST /api/casita/events/import.
 */
export const parseRegistroFile = async (file) => {
    const matrix = await readMatrix(file);
    const headerIndex = matrix.findIndex(r => r.some(c => norm(c) === 'fecha') && r.some(c => norm(c) === 'cliente'));
    if (headerIndex < 0) throw new Error('No encontré la fila de títulos (Fecha, Lugar, Cliente, Menú, Detalle, Precio, Cantidad, Total).');

    const header = matrix[headerIndex].map(norm);
    const col = Object.fromEntries(Object.entries(COLUMNS).map(([key, names]) => [key, header.findIndex(h => names.includes(h))]));
    if (col.client < 0 || col.detail < 0) throw new Error('Faltan las columnas "Cliente" o "Detalle".');

    const rows = [];
    const warnings = [];
    matrix.slice(headerIndex + 1).forEach((r, i) => {
        const get = (key) => (col[key] >= 0 ? r[col[key]] : '');
        const client = String(get('client') ?? '').trim();
        const detail = String(get('detail') ?? '').trim();
        if (!client || !detail) return; // empty / subtotal lines

        const line = headerIndex + i + 2;
        const { iso, warning } = parseDate(get('date'));
        if (warning) warnings.push(`Fila ${line} (${client}): ${warning}`);

        const quantity = toInt(get('quantity'));
        let price = toInt(get('price'));
        const total = toInt(get('total'));
        if (!price && total && quantity) price = Math.round(total / quantity);
        if (price > 0 && price < 1000) warnings.push(`Fila ${line} (${client}): precio sospechoso ${gs(price)} en "${detail}"`);

        rows.push({
            date: iso,
            client,
            venue: String(get('venue') ?? '').trim() || null,
            menu: String(get('menu') ?? '').trim() || null,
            detail,
            price: Math.max(0, price),
            quantity: Math.max(0, quantity),
            note: String(get('note') ?? '').trim().replace(/^#.*$/, '') || null,
        });
    });

    return { rows, warnings };
};
