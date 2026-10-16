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
