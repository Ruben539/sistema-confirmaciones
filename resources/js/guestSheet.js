import * as XLSX from 'xlsx';

/**
 * The guest list "as the system expects it": the columns of the downloadable template, the checks of each row,
 * and the conversion to the import payload. Shared by the Excel import preview and the "Asistente de listas".
 */
export const SHEET_COLUMNS = [
    { key: 'name', label: 'Nombre Completo', width: 230 },
    { key: 'phone', label: 'Teléfono (WhatsApp)', width: 150 },
    { key: 'other_phones', label: 'Otros Teléfonos', width: 150 },
    { key: 'table', label: 'Número de Mesa', width: 120 },
    { key: 'category', label: 'Tipo de Invitado', width: 110, type: 'select', options: ['Adulto', 'Joven', 'Niño'] },
    { key: 'total', label: 'Total Personas', width: 100, type: 'number' },
    { key: 'children', label: 'Acompañantes Niños', width: 130, type: 'number' },
    { key: 'companions', label: 'Nombres Acompañantes', width: 280 },
    { key: 'dietary', label: 'Restricción Alimentaria', width: 170 },
    { key: 'notes', label: 'Familia / Notas', width: 170 },
];

export const splitList = (text) => String(text || '').split(/\s*[,;]\s*|\s+y\s+/i).map((s) => s.trim()).filter(Boolean);

export const toInt = (v, fallback = 0) => {
    const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10);
    return Number.isNaN(n) ? fallback : n;
};

export const emptySheetRow = () => Object.fromEntries(SHEET_COLUMNS.map((c) => [c.key, c.type === 'select' ? c.options[0] : '']));

export const isFilledRow = (row) => SHEET_COLUMNS.some((c) => c.type !== 'select' && String(row[c.key] || '').trim());

// Problems of each row ({ [index]: { [key]: message } }), checked live while editing
export const validateSheet = (rows) => {
    const result = {};
    const phones = {};
    (rows || []).forEach((row, i) => {
        if (!isFilledRow(row)) return;
        const e = {};
        if (!String(row.name || '').trim()) e.name = 'Falta el nombre';
        const digits = String(row.phone || '').replace(/[^\d]/g, '');
        if (digits.length < 6) e.phone = 'Falta el teléfono o está incompleto';
        const total = toInt(row.total, 0);
        if (total < 1) e.total = 'El total tiene que ser 1 o más (incluye al titular)';
        const children = toInt(row.children, 0);
        if (total >= 1 && children > total - 1) e.children = `No puede haber más niños que acompañantes (${total - 1})`;
        const names = splitList(row.companions).length;
        if (total >= 1 && names > total - 1) e.companions = `Hay ${names} nombres pero la invitación tiene ${total - 1} acompañantes`;
        if (digits.length >= 6) {
            const key = digits.slice(-9);
            if (phones[key] !== undefined) e.phone = `Teléfono repetido (fila ${phones[key] + 2}): un número es una sola invitación`;
            else phones[key] = i;
        }
        if (Object.keys(e).length) result[i] = e;
    });
    return result;
};

// A spreadsheet row -> one guest of POST /api/events/{id}/guests/import
export const sheetRowToImport = (row, cleanName = (n) => n) => {
    const total = Math.max(1, toInt(row.total, 1));
    const children = Math.min(total - 1, toInt(row.children, 0));
    const names = splitList(row.companions).slice(0, total - 1);
    return {
        name: cleanName(row.name),
        phone: row.phone,
        table_number: row.table || '',
        category: row.category || null,
        companion_adults: Math.max(0, total - 1 - children),
        companion_children: children,
        companions: names.join(', ').slice(0, 255),
        members: names.map((name) => ({ name, category: 'adult' })),
        alt_phones: splitList(row.other_phones),
        dietary_restrictions: row.dietary || '',
        notes: row.notes || '',
    };
};

export const sheetPeople = (rows) => (rows || []).filter(isFilledRow).reduce((acc, row) => acc + Math.max(1, toInt(row.total, 1)), 0);

// Excel file with the system's columns, from the spreadsheet as it is
export const downloadSheet = (rows, fileName, normalizePhone = (p) => p, extraSheets = []) => {
    const data = (rows || []).filter(isFilledRow).map((row) => Object.fromEntries(SHEET_COLUMNS.map((c) => [
        c.label,
        c.key === 'phone' ? normalizePhone(row.phone)
            : c.key === 'other_phones' ? splitList(row.other_phones).map(normalizePhone).join(', ')
            : c.type === 'number' ? toInt(row[c.key], 0)
            : (row[c.key] || ''),
    ])));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data.length ? data : [Object.fromEntries(SHEET_COLUMNS.map((c) => [c.label, '']))]);
    ws['!cols'] = SHEET_COLUMNS.map((c) => ({ wch: Math.round((c.width || 140) / 7) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Invitados');
    extraSheets.forEach(({ name, rows: extra, cols }) => {
        if (!extra.length) return;
        const sheet = XLSX.utils.json_to_sheet(extra);
        if (cols) sheet['!cols'] = cols.map((wch) => ({ wch }));
        XLSX.utils.book_append_sheet(wb, sheet, name);
    });
    XLSX.writeFile(wb, fileName);
};

/**
 * An uploaded Excel (any layout) as spreadsheet rows with the system's columns, one row per row of the file,
 * so the planner can fix it by hand. Columns are recognized by their header; anything unknown is left out.
 * A quantity column under "Acompañantes" that never has 0 is taken as the total (as many planners fill it).
 */
export const sheetRowsFromFile = (headers, rows) => {
    const lower = headers.map((h) => String(h || '').toLowerCase());
    const used = new Set();
    const find = (test) => {
        const i = lower.findIndex((h, idx) => !used.has(idx) && test(h));
        if (i !== -1) used.add(i);
        return i;
    };
    const companionNames = find((h) => h.includes('acompa') && /(nombre|quien|quién)/.test(h));
    const children = find((h) => /(niñ|nin[oa]s?\b|hij|beb[eé])/.test(h));
    const companionAdults = find((h) => h.includes('acompa'));
    const total = find((h) => /(total|cantidad|personas|pases|lugares|cupo)/.test(h) && !h.includes('mesa'));
    const phone = find((h) => /(tel[eé]f|celular|whatsapp|m[oó]vil|phone)/.test(h));
    const phone2 = find((h) => /(tel[eé]f|celular|whatsapp|m[oó]vil|phone)/.test(h));
    const lastName = find((h) => h.includes('apellido') && !h.includes('nombre'));
    const name = find((h) => /(nombre|invitad|name)/.test(h));
    const table = find((h) => /(mesa|table)/.test(h));
    const category = find((h) => /(tipo|categor|edad|clasific)/.test(h));
    const dietary = find((h) => /(dieta|alimentari|restric|alergi|men[uú])/.test(h));
    const notes = find((h) => /(nota|observ|familia|grupo|comentario)/.test(h));

    const cell = (r, i) => (i === -1 ? '' : String(r.cells[i] ?? '').trim());
    const companionValues = companionAdults === -1 ? [] : rows.map((r) => cell(r, companionAdults)).filter((v) => v !== '').map((v) => toInt(v, 0));
    const companionsAreTotal = total === -1 && companionValues.length > 0 && companionValues.every((n) => n >= 1);

    return rows.map((r) => {
        const kids = toInt(cell(r, children), 0);
        let people;
        if (total !== -1 && cell(r, total) !== '') people = toInt(cell(r, total), 1);
        else if (companionAdults !== -1 && cell(r, companionAdults) !== '') people = companionsAreTotal ? toInt(cell(r, companionAdults), 1) : 1 + toInt(cell(r, companionAdults), 0) + kids;
        else people = 1 + kids;
        const cat = cell(r, category).toLowerCase();
        return {
            name: [cell(r, name), cell(r, lastName)].filter(Boolean).join(' ').replace(/\s{2,}/g, ' '),
            phone: cell(r, phone),
            other_phones: cell(r, phone2),
            table: cell(r, table),
            category: /(jov|jóv|teen|adolesc)/.test(cat) ? 'Joven' : /(niñ|nin|child|kid|infant)/.test(cat) ? 'Niño' : 'Adulto',
            total: String(Math.max(1, people)),
            children: String(kids),
            companions: cell(r, companionNames),
            dietary: cell(r, dietary),
            notes: cell(r, notes),
            _row: r.row,
        };
    });
};
