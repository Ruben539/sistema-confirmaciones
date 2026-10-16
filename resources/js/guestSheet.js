import * as XLSX from 'xlsx';

/**
 * The guest list "as the system expects it": the columns of the downloadable template, the checks of each row,
 * and the conversion to the import payload. Shared by the Excel import preview and the "Asistente de listas".
 */
export const SHEET_COLUMNS = [
    { key: 'name', label: 'Nombre Completo', width: 230 },
    { key: 'phone', label: 'Teléfono (WhatsApp)', width: 270 },
    { key: 'other_phones', label: 'Otros Teléfonos', width: 170 },
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

export const filterConditionalTags = (text, places) => {
    let s = String(text || '');
    if (places === 1) {
        s = s.replace(/\[(?:grupo|grupal|familia)\][\s\S]*?\[\/(?:grupo|grupal|familia)\]/gi, '');
        s = s.replace(/\[individual\]([\s\S]*?)\[\/individual\]/gi, '$1');
    } else {
        s = s.replace(/\[individual\][\s\S]*?\[\/individual\]/gi, '');
        s = s.replace(/\[(?:grupo|grupal|familia)\]([\s\S]*?)\[\/(?:grupo|grupal|familia)\]/gi, '$1');
    }
    return s.trim();
};

export const adaptSinglePluralPhrases = (text, places = 1) => {
    if (places !== 1) return String(text || '');
    let s = String(text || '');
    s = s.replace(/\s*e\s+indicarnos\s+cu[aá]ntas\s+(?:de\s+las\s+)?personas\s+(?:incluidas\s+en\s+su\s+invitaci[oó]n\s+)?asistir[aá]n\s*,?\s*/gi, ' ');
    s = s.replace(/\s*recibirlos\s+de\s+la\s+mejor\s+manera/gi, ' recibirte de la mejor manera');
    s = s.replace(/compartir\s+con\s+ustedes/gi, 'compartir contigo');
    return s;
};

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

const normName = (n) => String(n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const people = (n) => normName(n).split(/\s+(?:y|e)\s+|\s*[,/&+]\s*/).map((p) => p.trim()).filter(Boolean);
const phoneKey = (p) => String(p || '').replace(/[^\d]/g, '').slice(-9);
const hasPhone = (row) => String(row.phone || '').replace(/[^\d]/g, '').length >= 6;

export const isFamilyDescriptor = (part) => /^(?:familia|flia\.?|familiares|hijos?|niños?|bebes?)$/i.test(String(part || '').trim());

export const splitCompoundName = (fullName) => {
    let clean = String(fullName || '').trim().replace(/\s+/g, ' ');
    clean = clean.replace(/\s+(?:y|e|&|\+|\/)$/i, '').trim();
    if (!clean) return { isCompound: false, parts: [] };

    const plusNum = clean.match(/^(.*?)\s*\+\s*(\d+)(?:\s*(?:personas?|acompañantes?|invitados?))?$/i);
    if (plusNum) {
        return { isCompound: true, isPlusNum: true, baseName: plusNum[1].trim(), count: parseInt(plusNum[2], 10) };
    }

    const rawParts = clean.split(/\s+(?:y|e|&|\+|\/)\s+|\s*\/\s*/i).map((s) => s.trim()).filter(Boolean);
    if (rawParts.length >= 2) {
        if (rawParts.length === 2 && isFamilyDescriptor(rawParts[1])) {
            return { isCompound: false, isFamily: true, name: clean, baseName: rawParts[0] };
        }
        return { isCompound: true, parts: rawParts };
    }
    return { isCompound: false, parts: [clean] };
};

/**
 * Splits compound names like "Juan Pérez y María Gómez", "Carlos Benítez & Sra", "Pedro López + 1"
 * Returns: { name: cleanTitularName, companions: [companionNames], extraTotal: number }
 */
export const extractCompanionsFromName = (rawName) => {
    let trimmed = String(rawName || '').trim().replace(/\s+/g, ' ');
    trimmed = trimmed.replace(/\s+(?:y|e|&|\+|\/)$/i, '').trim();
    if (!trimmed) return { name: '', companions: [], extraTotal: 0 };

    if (/^familia\s+/i.test(trimmed) && !/\s+(?:y|e|&|\+)\s+/i.test(trimmed)) {
        return { name: trimmed, companions: [], extraTotal: 0 };
    }

    const split = splitCompoundName(trimmed);
    if (split.isFamily) {
        return { name: split.name, companions: [], extraTotal: 0 };
    }
    if (split.isPlusNum) {
        const count = split.count;
        const compNames = Array.from({ length: count }, (_, i) => (count === 1 ? 'Acompañante' : `Acompañante ${i + 1}`));
        return { name: split.baseName, companions: compNames, extraTotal: count };
    }
    if (split.isCompound && split.parts.length >= 2) {
        const titular = split.parts[0];
        const companionList = split.parts.slice(1).filter((p) => !isFamilyDescriptor(p)).map((part) => {
            if (/^(sra\.?|esposa|señora)$/i.test(part)) {
                const titularWords = titular.split(' ');
                const lastName = titularWords.length > 1 ? titularWords.slice(1).join(' ') : '';
                return lastName ? `Sra. ${lastName}` : 'Sra.';
            }
            if (/^(sr\.?|esposo|señor)$/i.test(part)) return 'Sr.';
            return part;
        });
        return { name: titular, companions: companionList, extraTotal: companionList.length };
    }

    return { name: trimmed, companions: [], extraTotal: 0 };
};

/**
 * Contextual name resolution for the entire guest list:
 * 1. If multiple rows share a compound name ("Nadia Mereles y Enrique Egusquiza") with different phones:
 *    assigns one person per phone with total = 1 (each person with their own phone is their own invitation).
 * 2. If a compound name mentions a companion who already has their own phone row in the list
 *    ("Hector Servian y Karen Bobadilla" where Karen has her own row), Karen is NOT added as a companion.
 * 3. Keeps family descriptors ("Rodrigo Mereles y familia") intact without turning "familia" into a companion.
 */
export const cleanContextualNames = (rows) => {
    const list = (rows || []).map((r) => ({ ...r }));
    const compoundGroups = new Map();
    list.forEach((r, idx) => {
        if (!hasPhone(r)) return;
        const split = splitCompoundName(r.name);
        if (split.isCompound && !split.isPlusNum) {
            const key = split.parts.map(normName).sort().join(' | ');
            if (!compoundGroups.has(key)) compoundGroups.set(key, []);
            compoundGroups.get(key).push({ idx, row: r, split });
        }
    });

    const handledIndices = new Set();
    const changes = [];

    // Distinct phones with same compound name: assign 1 person per phone, each with total = 1
    compoundGroups.forEach((group) => {
        const uniquePhones = new Set(group.map((g) => phoneKey(g.row.phone)));
        if (uniquePhones.size > 1 && group.length === uniquePhones.size) {
            const parts = group[0].split.parts;
            if (parts.length === group.length) {
                const unassignedParts = [...parts];
                group.forEach((item) => {
                    const row = list[item.idx];
                    const oldName = row.name;
                    let partIdx = unassignedParts.findIndex((p) => normName(row.name).startsWith(normName(p)));
                    if (partIdx === -1) partIdx = 0;
                    const assignedPart = unassignedParts.splice(partIdx, 1)[0];

                    row.name = assignedPart;
                    row.companions = '';
                    row.total = '1';
                    handledIndices.add(item.idx);
                    changes.push(`${oldName} (fila ${row._row || item.idx + 1}): se asignó "${assignedPart}" a este número (1 persona)`);
                });
            }
        }
    });

    // Single compound rows or cross-row references
    list.forEach((row, idx) => {
        if (handledIndices.has(idx) || !hasPhone(row)) return;
        const split = splitCompoundName(row.name);
        if (!split.isCompound) return;

        if (split.isPlusNum) {
            row.name = split.baseName;
            const count = split.count;
            const compNames = Array.from({ length: count }, (_, i) => (count === 1 ? 'Acompañante' : `Acompañante ${i + 1}`));
            row.companions = compNames.join(', ');
            row.total = String(Math.max(toInt(row.total, 1), 1 + count));
            changes.push(`${split.baseName}: se separaron +${count} acompañantes`);
            return;
        }

        const titular = split.parts[0];
        const rawCompanions = split.parts.slice(1);
        const validCompanions = [];

        rawCompanions.forEach((c) => {
            let compName = c;
            if (/^(sra\.?|esposa|señora)$/i.test(c)) {
                const titularWords = titular.split(' ');
                const lastName = titularWords.length > 1 ? titularWords.slice(1).join(' ') : '';
                compName = lastName ? `Sra. ${lastName}` : 'Sra.';
            } else if (/^(sr\.?|esposo|señor)$/i.test(c)) {
                compName = 'Sr.';
            }

            const compNorm = normName(compName);
            const words = compNorm.split(' ');
            let hasOwnPhone = false;
            list.forEach((otherRow, otherIdx) => {
                if (otherIdx !== idx && hasPhone(otherRow)) {
                    const otherNorm = normName(otherRow.name);
                    if (words.length >= 2) {
                        if (otherNorm === compNorm || otherNorm.startsWith(compNorm + ' ') || otherNorm.endsWith(' ' + compNorm)) {
                            hasOwnPhone = true;
                        }
                    } else if (otherNorm === compNorm) {
                        hasOwnPhone = true;
                    }
                }
            });

            if (!hasOwnPhone) {
                validCompanions.push(compName);
            }
        });

        const oldName = row.name;
        row.name = titular;
        if (validCompanions.length > 0) {
            row.companions = validCompanions.join(', ');
            row.total = String(Math.max(toInt(row.total, 1), 1 + validCompanions.length));
            changes.push(`${titular}: se separó a ${validCompanions.join(', ')} como acompañante`);
        } else {
            row.companions = '';
            row.total = '1';
            changes.push(`${titular}: los otros nombres ya tienen su propio teléfono/invitación`);
        }
    });

    return { list, changes };
};

export const fillGenericCompanions = (rows) => {
    let filledCount = 0;
    const next = (rows || []).map((row) => {
        if (!isFilledRow(row)) return row;
        const total = Math.max(1, toInt(row.total, 1));
        if (total <= 1) return row;
        const existing = splitList(row.companions);
        const needed = (total - 1) - existing.length;
        if (needed <= 0) return row;

        const newComps = [...existing];
        for (let k = 1; k <= needed; k++) {
            const num = existing.length + k;
            const genName = (total === 2 && existing.length === 0) ? 'Acompañante' : `Acompañante ${num}`;
            newComps.push(genName);
            filledCount++;
        }
        return { ...row, companions: newComps.join(', ') };
    });
    return { rows: next, filledCount };
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

    const initialRows = rows.map((r) => {
        const kids = toInt(cell(r, children), 0);
        let people;
        if (total !== -1 && cell(r, total) !== '') people = toInt(cell(r, total), 1);
        else if (companionAdults !== -1 && cell(r, companionAdults) !== '') people = companionsAreTotal ? toInt(cell(r, companionAdults), 1) : 1 + toInt(cell(r, companionAdults), 0) + kids;
        else people = 1 + kids;
        const cat = cell(r, category).toLowerCase();
        const rawFullName = [cell(r, name), cell(r, lastName)].filter(Boolean).join(' ').replace(/\s{2,}/g, ' ');
        const initialCompanions = splitList(cell(r, companionNames));

        return {
            name: rawFullName,
            phone: cell(r, phone),
            other_phones: cell(r, phone2),
            table: cell(r, table),
            category: /(jov|jóv|teen|adolesc)/.test(cat) ? 'Joven' : /(niñ|nin|child|kid|infant)/.test(cat) ? 'Niño' : 'Adulto',
            total: String(Math.max(1, people, 1 + initialCompanions.length)),
            children: String(kids),
            companions: initialCompanions.join(', '),
            dietary: cell(r, dietary),
            notes: cell(r, notes),
            _row: r.row,
        };
    });

    return cleanContextualNames(initialRows).list;
};

/**
 * The same corrections as the import, applied to the spreadsheet (no AI):
 *  1. contextual compound names ("Nadia y Enrique" across different phones -> 1 person each)
 *  2. rows without phone under an invitation are its companions, while they fit in its total
 *     ("Marcos Pereira 6" + Adriana, Pauli, Abi, Jimena, Asaf -> one invitation with 5 named companions)
 *  3. the same phone in several rows is one invitation (the other rows are companions; totals add up)
 *  4. invitations with total > 1 and empty companions get filled with generic companion names
 * Returns the new rows, what changed and what couldn't be decided.
 */
export const autoFixSheet = (rows) => {
    const { list, changes: ctxChanges } = cleanContextualNames((rows || []).filter(isFilledRow));
    const changes = [...ctxChanges];
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
            addCompanion(holder, row.name.trim());
            const compCount = splitList(holder.companions).length;
            const newTotal = Math.max(total, 1 + compCount);
            holder.total = String(newTotal);
            if (row.category === 'Niño') {
                holder.children = String(toInt(holder.children, 0) + 1);
            }
            row._remove = true;
            changes.push(`${row.name.trim()} → acompañante de ${holder.name} (el total pasa a ${newTotal})`);
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

    // 3. Fill generic companion names for multi-person invitations missing companion names
    kept.forEach((row) => {
        const total = Math.max(1, toInt(row.total, 1));
        if (total <= 1) return;
        const existing = splitList(row.companions);
        const needed = (total - 1) - existing.length;
        if (needed <= 0) return;

        const genNames = [];
        for (let k = 1; k <= needed; k++) {
            const num = existing.length + k;
            const gen = (total === 2 && existing.length === 0) ? 'Acompañante' : `Acompañante ${num}`;
            genNames.push(gen);
        }
        row.companions = [...existing, ...genNames].join(', ');
        changes.push(`${row.name}: se completaron ${needed} acompañante(s) genérico(s)`);
    });

    return { rows: kept, changes, pending };
};

/**
 * Whose companion each row without phone is (the closest row with phone above it), and whether it fits in
 * that invitation's total: { [rowIndex]: { holder, holderName, fits, total, neededTotal, countUnderHolder } }.
 * Shown in the phone cell.
 */
export const companionHints = (rows) => {
    const hints = {};
    let holder = null;
    let used = 0;
    const underHolderCount = {};

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
        underHolderCount[holder] = (underHolderCount[holder] || 0) + 1;
        hints[i] = {
            holder,
            holderName: String(rows[holder].name || '').trim() || 'la fila de arriba',
            fits,
            total,
        };
    });

    Object.keys(hints).forEach((idx) => {
        const h = hints[idx];
        const holderRow = rows[h.holder];
        const existingCount = splitList(holderRow?.companions).length;
        const totalRowsToJoin = underHolderCount[h.holder] || 1;
        h.neededTotal = Math.max(h.total, 1 + existingCount + totalRowsToJoin);
        h.countUnderHolder = totalRowsToJoin;
    });

    return hints;
};

/**
 * Moves the rows without phone under the invitation at holderIndex into its companions.
 * If expandTotal is true, expands holder.total so all companions fit.
 * Returns the new rows and the names moved.
 */
export const joinCompanions = (rows, holderIndex, expandTotal = true) => {
    const hints = companionHints(rows);
    const holder = { ...rows[holderIndex] };
    const moved = [];
    const drop = new Set();
    Object.entries(hints).forEach(([i, h]) => {
        if (h.holder !== holderIndex) return;
        if (!expandTotal && !h.fits) return;
        const row = rows[i];
        const name = String(row.name || '').trim();
        const names = splitList(holder.companions);
        if (!names.map(normName).includes(normName(name))) {
            holder.companions = [...names, name].join(', ');
        }
        if (row.category === 'Niño') {
            holder.children = String(toInt(holder.children, 0) + 1);
        }
        drop.add(Number(i));
        moved.push(name);
    });
    const finalCompanionsCount = splitList(holder.companions).length;
    if (expandTotal) {
        holder.total = String(Math.max(toInt(holder.total, 1), 1 + finalCompanionsCount));
    }
    const next = rows.map((r, i) => (i === holderIndex ? holder : r)).filter((_, i) => !drop.has(i));
    return { rows: next, moved };
};

/**
 * cellHint for SpreadsheetGrid: in the phone cell of a row without phone, whose companion it is with a
 * button to join them directly into that invitation (expanding the total if needed).
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
            const n = fitting[h.holder] || 1;
            return {
                tone: 'ok',
                text: `Acompañante de ${h.holderName} (${h.total})`,
                actionLabel: n > 1 ? `Unir los ${n}` : 'Unir',
                onAction: () => apply(joinCompanions(rows, h.holder, false).rows),
            };
        }
        const n = h.countUnderHolder || 1;
        return {
            tone: 'warn',
            text: `Acompañante de ${h.holderName} (total actual: ${h.total})`,
            actionLabel: n > 1 ? `Unir los ${n} (pasa a ${h.neededTotal})` : `Unir (pasa a ${h.neededTotal})`,
            onAction: () => apply(joinCompanions(rows, h.holder, true).rows),
        };
    };
};
