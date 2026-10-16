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

const normName = (n) => String(n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const people = (n) => normName(n).split(/\s+(?:y|e)\s+|\s*[,/&+]\s*/).map((p) => p.trim()).filter(Boolean);
const phoneKey = (p) => String(p || '').replace(/[^\d]/g, '').slice(-9);
const hasPhone = (row) => String(row.phone || '').replace(/[^\d]/g, '').length >= 6;

/**
 * The same corrections as the import, applied to the spreadsheet (no AI):
 *  1. rows without phone under an invitation are its companions, while they fit in its total
 *     ("Marcos Pereira 6" + Adriana, Pauli, Abi, Jimena, Asaf -> one invitation with 5 named companions)
 *  2. the same phone in several rows is one invitation (the other rows are companions; totals add up)
 *  3. the same people in several rows with another phone ("Nadia y Enrique" twice, "Hector y Karen" +
 *     "Karen") are one invitation, the other number becomes one of its other phones
 * Returns the new rows, what changed and what couldn't be decided.
 */
export const autoFixSheet = (rows) => {
    const list = (rows || []).filter(isFilledRow).map((r) => ({ ...r }));
    const changes = [];
    const pending = [];
    const label = (r) => (r._row ? `fila ${r._row}` : 'fila nueva');
    const addCompanion = (holder, name) => {
        const names = splitList(holder.companions);
        if (name && !names.map(normName).includes(normName(name))) holder.companions = [...names, name].join(', ');
    };

    // 1. Rows without phone under an invitation
    let holder = null;
    list.forEach((row) => {
        if (hasPhone(row)) {
            holder = row;
            return;
        }
        if (!String(row.name || '').trim()) return;
        if (!holder) {
            pending.push(`${row.name} (${label(row)}): no tiene teléfono ni una invitación arriba a la que pertenezca.`);
            return;
        }
        const total = Math.max(1, toInt(holder.total, 1));
        const free = total - 1 - splitList(holder.companions).length;
        if (free > 0) {
            addCompanion(holder, row.name.trim());
            if (row.category === 'Niño' && toInt(holder.children, 0) < total - 1) holder.children = String(toInt(holder.children, 0) + 1);
            row._remove = true;
            changes.push(`${row.name.trim()} → acompañante de ${holder.name}`);
        } else {
            pending.push(`${row.name} (${label(row)}): no entra en la invitación de ${holder.name} (${total} ${total === 1 ? 'persona' : 'personas'}). Subile el total a ${holder.name} o cargale un teléfono si es invitación aparte.`);
        }
    });
    let kept = list.filter((r) => !r._remove);

    // 2. Same phone in several rows
    const byPhone = {};
    kept.forEach((row) => {
        if (!hasPhone(row)) return;
        const key = phoneKey(row.phone);
        const first = byPhone[key];
        if (!first) {
            byPhone[key] = row;
            return;
        }
        const sameRow = normName(row.name) === normName(first.name) && toInt(row.total, 1) === toInt(first.total, 1);
        if (!sameRow) {
            first.total = String(toInt(first.total, 1) + Math.max(1, toInt(row.total, 1)));
            first.children = String(toInt(first.children, 0) + toInt(row.children, 0));
            if (normName(row.name) !== normName(first.name)) addCompanion(first, row.name.trim());
            splitList(row.companions).forEach((n) => addCompanion(first, n));
        }
        row._remove = true;
        changes.push(sameRow
            ? `${row.name} (${label(row)}) estaba repetida: queda una sola vez`
            : `${row.name} (${label(row)}) tiene el mismo teléfono que ${first.name}: es una sola invitación de ${first.total}`);
    });
    kept = kept.filter((r) => !r._remove);

    // 3. Same people with another phone
    const samePeople = (a, b) => normName(a.name) === normName(b.name) || people(a.name).includes(normName(b.name)) || people(b.name).includes(normName(a.name));
    for (let i = 0; i < kept.length; i++) {
        for (let j = i + 1; j < kept.length; j++) {
            const a = kept[i];
            const b = kept[j];
            if (a._remove || b._remove || !hasPhone(a) || !hasPhone(b) || !String(a.name || '').trim() || !samePeople(a, b)) continue;
            const [main, other] = people(b.name).length > people(a.name).length ? [b, a] : [a, b];
            const ta = Math.max(1, toInt(main.total, 1));
            const tb = Math.max(1, toInt(other.total, 1));
            main.total = String(ta === tb && ta > 1 ? ta : ta + tb);
            main.other_phones = [...splitList(main.other_phones), other.phone, ...splitList(other.other_phones)].join(', ');
            if (normName(other.name) !== normName(main.name)) addCompanion(main, other.name.trim());
            other._remove = true;
            changes.push(`${other.name} (${label(other)}) es la misma invitación que ${main.name}: queda una sola de ${main.total}, con su número asociado`);
        }
    }
    kept = kept.filter((r) => !r._remove);

    return { rows: kept, changes, pending };
};

/**
 * Whose companion each row without phone is (the closest row with phone above it), and whether it fits in
 * that invitation's total: { [rowIndex]: { holder, holderName, fits, total } }. Shown in the phone cell.
 */
export const companionHints = (rows) => {
    const hints = {};
    let holder = null;
    let used = 0;
    (rows || []).forEach((row, i) => {
        if (!isFilledRow(row)) return;
        if (hasPhone(row)) {
            holder = i;
            used = splitList(row.companions).length;
            return;
        }
        if (!String(row.name || '').trim() || holder === null) return;
        const total = Math.max(1, toInt(rows[holder].total, 1));
        const fits = used < total - 1;
        if (fits) used++;
        hints[i] = { holder, holderName: String(rows[holder].name || '').trim() || 'la fila de arriba', fits, total };
    });
    return hints;
};

/**
 * Moves the rows without phone under the invitation at holderIndex into its companions (as many as fit in
 * its total; the rest stay as they are). Returns the new rows and the names moved.
 */
export const joinCompanions = (rows, holderIndex) => {
    const hints = companionHints(rows);
    const holder = { ...rows[holderIndex] };
    const total = Math.max(1, toInt(holder.total, 1));
    const moved = [];
    const drop = new Set();
    Object.entries(hints).forEach(([i, h]) => {
        if (h.holder !== holderIndex || !h.fits) return;
        const row = rows[i];
        const name = String(row.name).trim();
        const names = splitList(holder.companions);
        if (!names.map(normName).includes(normName(name))) holder.companions = [...names, name].join(', ');
        if (row.category === 'Niño' && toInt(holder.children, 0) < total - 1) holder.children = String(toInt(holder.children, 0) + 1);
        drop.add(Number(i));
        moved.push(name);
    });
    const next = rows.map((r, i) => (i === holderIndex ? holder : r)).filter((_, i) => !drop.has(i));
    return { rows: next, moved };
};

/**
 * cellHint for SpreadsheetGrid: in the phone cell of a row without phone, whose companion it is with a
 * button to join them all into that invitation, or (if it doesn't fit) a button to add one to its total.
 * apply(newRows) receives the corrected list.
 */
export const companionCellHint = (rows, apply) => {
    const hints = companionHints(rows);
    const fitting = {};
    Object.values(hints).forEach((h) => { if (h.fits) fitting[h.holder] = (fitting[h.holder] || 0) + 1; });
    return (i, key) => {
        const h = key === 'phone' ? hints[i] : null;
        if (!h) return null;
        if (h.fits) {
            const n = fitting[h.holder];
            return {
                tone: 'ok',
                text: `Acompañante de ${h.holderName} (${h.total})`,
                actionLabel: n > 1 ? `Unir los ${n}` : 'Unir',
                onAction: () => apply(joinCompanions(rows, h.holder).rows),
            };
        }
        return {
            tone: 'warn',
            text: `No entra en los ${h.total} de ${h.holderName}`,
            actionLabel: `Pasar a ${h.total + 1}`,
            onAction: () => apply(rows.map((r, j) => (j === h.holder ? { ...r, total: String(h.total + 1) } : r))),
        };
    };
};
