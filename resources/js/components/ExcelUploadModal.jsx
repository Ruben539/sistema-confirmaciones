import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Download, Check, AlertCircle, X, Sparkles, Users, ShieldCheck, Bot } from 'lucide-react';
import { apiFetch } from '../api';
import { getPlanLabel } from '../plans';

// "Larisa Rojas y " -> "Larisa Rojas", "Gerardo  SANCHEZ Hermosa" -> "Gerardo Sanchez Hermosa":
// extra spaces, a loose connector at the end and words in CAPITALS (initials like "M." stay as they are)
export const cleanGuestName = (name) => {
    let text = String(name || '').replace(/\s+/g, ' ').trim();
    let previous;
    do {
        previous = text;
        text = text.replace(/[\s,/&+-]+(y|e)?$/i, '').replace(/\s+(y|e)$/i, '').trim();
    } while (text !== previous);
    return text.replace(/\p{L}{3,}/gu, (word) => (word === word.toUpperCase() ? word.charAt(0) + word.slice(1).toLowerCase() : word));
};

// Same rule as the server (GuestController::formatParaguayPhone): 0981… / 981… -> 595981…, others as they are
export const normalizePhone = (phone) => {
    const digits = String(phone || '').replace(/[^\d]/g, '');
    if (!digits) return '';
    if (digits.startsWith('09') && digits.length === 10) return `595${digits.slice(1)}`;
    if (digits.startsWith('9') && digits.length === 9) return `595${digits}`;
    if (digits.startsWith('595')) return digits;
    if (digits.length >= 9 && digits.slice(-9).startsWith('9') && !digits.startsWith('54')) return `595${digits.slice(-9)}`;
    return digits;
};

export default function ExcelUploadModal({ isOpen, onClose, event, eventId, currentGuestsCount = 0, onImportSuccess, onOpenUpgradeBot, allowAutoSend = true }) {
    const [file, setFile] = useState(null);
    const [parsedData, setParsedData] = useState([]);
    const [rawRows, setRawRows] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [mapping, setMapping] = useState({ name: '', last_name: '', phone: '', phone2: '', table_number: '', category: '', total_people: '', companion_adults: '', companion_children: '', companions: '', dietary: '', notes: '' });
    // How to read each list: the amount column as total or as companions, and rows without phone under a guest
    const [options, setOptions] = useState({ countMode: 'companions', joinOrphans: true, mergeSamePeople: true });
    // After importing a corrected list: guests already contacted whose number of people changed
    const [corrections, setCorrections] = useState(null);
    // Merged cells of the sheet (e.g. one phone cell merged over the rows of a whole family)
    const [merges, setMerges] = useState([]);
    // Preview: how the list ends up / what has to be fixed / the rows as they came
    const [previewTab, setPreviewTab] = useState('result');
    const [sendingCorrections, setSendingCorrections] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const activeEventId = event?.id || eventId;
    const maxGuests = event?.max_guests || 100;
    const planType = event?.plan_type || 'initial';
    const planName = getPlanLabel(planType, maxGuests);
    const availableSlots = Math.max(0, maxGuests - currentGuestsCount);
    const capacityPercent = Math.min(100, Math.round((currentGuestsCount / maxGuests) * 100));

    if (!isOpen) return null;

    const closeCorrections = () => {
        setCorrections(null);
        onClose();
    };

    const sendCorrectionsNow = async () => {
        setSendingCorrections(true);
        const { json } = await apiFetch(`/api/events/${activeEventId}/send-corrections`, { method: 'POST' });
        setSendingCorrections(false);
        onImportSuccess(json?.message || 'No se pudieron programar las correcciones.');
        closeCorrections();
    };

    // Everything that doesn't add up in the file: it can't be imported until the Excel is fixed
    const excelRow = (r) => (r.sheetRow !== undefined ? r.sheetRow + 1 : r.id + 2);
    const issues = parsedData.filter((r) => r.warnings.length > 0 && !r.attachedTo);
    const invitations = parsedData.filter((r) => r.isValid);
    const templateHeaders = ['nombre completo', 'teléfono (whatsapp)', 'número de mesa', 'tipo de invitado', 'total personas', 'acompañantes niños', 'nombres acompañantes', 'restricción alimentaria', 'familia / notas'];
    const isTemplateFormat = headers.length > 0 && templateHeaders.every((h) => headers.map((x) => x.toLowerCase()).includes(h));

    if (corrections) {
        const reminders = corrections.filter((c) => c.action === 'reminder').length;
        const passes = corrections.filter((c) => c.action === 'correction').length;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                    <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-500" /> Cambió la cantidad de {corrections.length} {corrections.length === 1 ? 'invitación ya enviada' : 'invitaciones ya enviadas'}
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            Estos invitados ya recibieron la invitación o confirmaron con la cantidad anterior. Conviene avisarles:
                            {reminders > 0 && <> <strong>{reminders}</strong> sin responder reciben un recordatorio con los lugares corregidos;</>}
                            {passes > 0 && <> <strong>{passes}</strong> confirmados reciben una disculpa con la cantidad correcta (su QR sigue siendo el mismo).</>}
                        </p>
                    </div>
                    <div className="p-4 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                        {corrections.map((c) => (
                            <div key={c.id} className="flex items-center justify-between gap-3 py-2">
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{c.name}</span>
                                <span className="shrink-0 text-zinc-500">
                                    {c.from} → <strong className="text-zinc-900 dark:text-white">{c.to}</strong> personas ·{' '}
                                    <span className={c.action === 'correction' ? 'text-emerald-600' : 'text-amber-600'}>{c.action === 'correction' ? 'disculpa con la cantidad' : 'recordatorio'}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-end gap-2">
                        <button onClick={closeCorrections} className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            Más tarde (quedan marcados en la lista)
                        </button>
                        <button onClick={sendCorrectionsNow} disabled={sendingCorrections} className="px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold disabled:opacity-50">
                            {sendingCorrections ? 'Programando...' : `Enviar correcciones (${corrections.length})`}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Handle File Drop or Upload
    const handleFileChange = (e) => {
        const uploadedFile = e.target.files?.[0];
        if (uploadedFile) processFile(uploadedFile);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) processFile(droppedFile);
    };

    const processFile = (uploadedFile) => {
        setError(null);
        setFile(uploadedFile);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const buffer = evt.target.result;
                const isText = /\.(csv|txt)$/i.test(uploadedFile.name);
                let wb;
                if (isText) {
                    // CSV saved by Excel on Windows comes in Windows-1252 (ñ, tildes), other ones in UTF-8
                    let text;
                    try {
                        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
                    } catch {
                        text = new TextDecoder('windows-1252').decode(buffer);
                    }
                    wb = XLSX.read(text.replace(/^\uFEFF/, ''), { type: 'string' });
                } else {
                    wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
                }
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                // Convert sheet to json array of objects
                const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true });
                // Remember the sheet row of each row and the merged cells, relative to the table's first column
                const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 } };
                allRows.forEach((row, i) => { row.__r = range.s.r + i; });
                const sheetMerges = (ws['!merges'] || [])
                    .filter((m) => m.e.r > m.s.r)
                    .map((m) => ({ sr: m.s.r, er: m.e.r, c: m.s.c - range.s.c, ec: m.e.c - range.s.c }));
                setMerges(sheetMerges);

                // The header row may come after a title ("Lista de invitados - Boda..."): the row among the
                // first ones that looks most like column names
                const headerScore = (row) => row.filter((c) => /nombre|invitad|tel[eé]f|celular|whatsapp|m[oó]vil|mesa|acompa|cantidad|total|personas/i.test(String(c))).length;
                let headerIndex = 0;
                allRows.slice(0, 10).forEach((row, i) => {
                    if (headerScore(row) > headerScore(allRows[headerIndex] || [])) headerIndex = i;
                });
                const data = allRows.slice(headerIndex);

                if (data.length < 2) {
                    setError('El archivo Excel está vacío o no contiene suficientes filas.');
                    return;
                }

                const fileHeaders = data[0].map(h => String(h || '').trim());
                const fileRows = data.slice(1).filter(row => row.some(cell => cell !== null && String(cell).trim() !== ''));

                setHeaders(fileHeaders);
                setRawRows(fileRows);

                // Auto-detect column mapping
                const autoMapping = { name: '', last_name: '', phone: '', phone2: '', table_number: '', category: '', total_people: '', companion_adults: '', companion_children: '', companions: '', dietary: '', notes: '' };

                fileHeaders.forEach((h, index) => {
                    const lower = h.toLowerCase();
                    // Companion columns first: "Acompañantes Niños" would otherwise match the category/name rules
                    if (lower.includes('acompa')) {
                        if (!autoMapping.companions && (lower.includes('nombre') || lower.includes('quien') || lower.includes('quién'))) {
                            autoMapping.companions = h;
                        } else if (!autoMapping.companion_children && (lower.includes('niñ') || lower.includes('nin') || lower.includes('bebe') || lower.includes('bebé') || lower.includes('hij'))) {
                            autoMapping.companion_children = h;
                        } else if (!autoMapping.companion_adults) {
                            autoMapping.companion_adults = h;
                        }
                        return;
                    }
                    // "Cantidad", "Total personas", "Pases"...: the WHOLE invitation (invited person included).
                    // Before the name rule: "Cantidad de invitados" would otherwise be taken as the name
                    if (!autoMapping.total_people && /(cantidad|total|personas|pases|lugares|cupo)/.test(lower) && !lower.includes('mesa')) {
                        autoMapping.total_people = h;
                        return;
                    }
                    // A second phone column ("Teléfono 2", "Otros teléfonos"): other numbers of the same invitation
                    if (autoMapping.phone && !autoMapping.phone2 && /(tel[eé]f|celular|whatsapp|m[oó]vil)/.test(lower)) {
                        autoMapping.phone2 = h;
                        return;
                    }
                    // Separate surname column ("Nombre" + "Apellido"); "Nombre y Apellido" is a single name column
                    if (!autoMapping.last_name && lower.includes('apellido') && !lower.includes('nombre')) {
                        autoMapping.last_name = h;
                        return;
                    }
                    if (!autoMapping.name && (lower.includes('nombre') || lower.includes('name') || lower.includes('invitado'))) {
                        autoMapping.name = h;
                    } else if (!autoMapping.phone && (lower.includes('telefono') || lower.includes('teléfono') || lower.includes('celular') || lower.includes('phone') || lower.includes('whatsapp') || lower.includes('movil') || lower.includes('móvil'))) {
                        autoMapping.phone = h;
                    } else if (!autoMapping.table_number && (lower.includes('mesa') || lower.includes('table') || lower.includes('asiento') || lower.includes('ubicacion') || lower.includes('ubicación') || lower.includes('lugar') || lower.includes('seating') || lower.includes('nro') || lower.includes('num'))) {
                        autoMapping.table_number = h;
                    } else if (!autoMapping.category && (lower.includes('tipo') || lower.includes('categoria') || lower.includes('categoría') || lower.includes('edad') || lower.includes('rango') || lower.includes('clasificacion') || lower.includes('clasificación') || lower.includes('joven') || lower.includes('adulto') || lower.includes('niño'))) {
                        autoMapping.category = h;
                    } else if (!autoMapping.dietary && (lower.includes('dieta') || lower.includes('alimentari') || lower.includes('restric') || lower.includes('alergi'))) {
                        autoMapping.dietary = h;
                    } else if (!autoMapping.notes && (lower.includes('nota') || lower.includes('observacion') || lower.includes('grupo') || lower.includes('familia') || lower.includes('notes'))) {
                        autoMapping.notes = h;
                    }
                });

                // Fallback to first 2 columns if not auto-detected
                if (!autoMapping.name && fileHeaders.length > 0) autoMapping.name = fileHeaders[0];
                if (!autoMapping.phone && fileHeaders.length > 1) autoMapping.phone = fileHeaders[1];

                // An amount column under "Acompañantes" that never has 0 is usually the TOTAL of each
                // invitation (1 = the guest alone), as many planners fill it
                const autoOptions = { countMode: 'companions', joinOrphans: true, mergeSamePeople: true };
                if (!autoMapping.total_people && autoMapping.companion_adults) {
                    const idx = fileHeaders.indexOf(autoMapping.companion_adults);
                    const values = fileRows
                        .map((r) => String(r[idx] ?? '').trim())
                        .filter((v) => v !== '')
                        .map((v) => parseInt(v.replace(/[^\d]/g, ''), 10))
                        .filter((n) => !Number.isNaN(n));
                    if (values.length > 0 && values.every((n) => n >= 1)) autoOptions.countMode = 'total';
                }
                setOptions(autoOptions);
                setMapping(autoMapping);
                buildParsedList(fileHeaders, fileRows, autoMapping, autoOptions, sheetMerges);
            } catch (err) {
                console.error(err);
                setError('Error al procesar el archivo Excel. Asegúrate de que sea un archivo .xlsx, .xls o .csv válido.');
            }
        };

        reader.readAsArrayBuffer(uploadedFile);
    };

    const buildParsedList = (currentHeaders, currentRows, currentMap, currentOptions = options, currentMerges = merges) => {
        const nameIdx = currentHeaders.indexOf(currentMap.name);
        const lastNameIdx = currentHeaders.indexOf(currentMap.last_name);
        const phone2Idx = currentHeaders.indexOf(currentMap.phone2);
        const phoneIdx = currentHeaders.indexOf(currentMap.phone);
        const tableIdx = currentHeaders.indexOf(currentMap.table_number);
        const categoryIdx = currentHeaders.indexOf(currentMap.category);
        const totalIdx = currentHeaders.indexOf(currentMap.total_people);
        const compAdultsIdx = currentHeaders.indexOf(currentMap.companion_adults);
        const compChildrenIdx = currentHeaders.indexOf(currentMap.companion_children);
        const companionsIdx = currentHeaders.indexOf(currentMap.companions);
        const dietaryIdx = currentHeaders.indexOf(currentMap.dietary);
        const notesIdx = currentHeaders.indexOf(currentMap.notes);

        const list = currentRows.map((row, index) => {
            const lastName = lastNameIdx !== -1 ? String(row[lastNameIdx] || '').trim() : '';
            const rawName = cleanGuestName([nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '', lastName].filter(Boolean).join(' '));
            let rawPhone = phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '';
            
            // Clean phone number (remove spaces, hyphens)
            rawPhone = rawPhone.replace(/[\s\-\(\)]/g, '');

            let tableVal = tableIdx !== -1 ? String(row[tableIdx] || '').trim() : '';
            if (tableVal && /^\d+$/.test(tableVal)) {
                tableVal = `Mesa ${tableVal}`;
            } else if (tableVal && /^mesa\s*(\d+)$/i.test(tableVal)) {
                const match = tableVal.match(/^mesa\s*(\d+)$/i);
                tableVal = `Mesa ${match[1]}`;
            }
            const categoryVal = categoryIdx !== -1 ? String(row[categoryIdx] || '').trim() : '';
            const toCount = (idx) => {
                if (idx === -1) return null;
                const n = parseInt(String(row[idx] ?? '').replace(/[^\d]/g, ''), 10);
                return Number.isNaN(n) ? 0 : Math.min(20, n);
            };
            let compAdults = toCount(compAdultsIdx);
            const compChildren = toCount(compChildrenIdx);
            // Total of the invitation: the rest (minus the invited person and the children) are adult companions
            // "Total" column, or the companions column read as total (see countMode)
            let totalPeople = toCount(totalIdx);
            if (!totalPeople && totalIdx === -1 && currentOptions.countMode === 'total' && compAdults) {
                totalPeople = compAdults;
            }
            if (totalPeople) {
                compAdults = Math.max(0, totalPeople - 1 - (compChildren || 0));
            }
            const companionsVal = companionsIdx !== -1 ? String(row[companionsIdx] || '').trim() : '';
            const dietaryVal = dietaryIdx !== -1 ? String(row[dietaryIdx] || '').trim() : '';
            const notesVal = notesIdx !== -1 ? String(row[notesIdx] || '').trim() : '';

            let safeYouth = 0;
            let safeAdults = 0;
            let safeChildren = 0;
            let categoryLabel = 'Adulto';

            const catLower = categoryVal.toLowerCase();
            if (catLower.includes('joven') || catLower.includes('jóven') || catLower.includes('teen') || catLower.includes('adolescente')) {
                safeYouth = 1;
                categoryLabel = 'Joven';
            } else if (catLower.includes('niño') || catLower.includes('niña') || catLower.includes('nino') || catLower.includes('child') || catLower.includes('kid') || catLower.includes('infantil')) {
                safeChildren = 1;
                categoryLabel = 'Niño';
            } else {
                safeAdults = 1;
                categoryLabel = 'Adulto';
            }

            const isValid = rawName.length > 0 && rawPhone.length >= 6;

            return {
                id: index,
                sheetRow: row.__r,
                name: rawName,
                phone: rawPhone,
                table_number: tableVal,
                adults: safeAdults,
                youth: safeYouth,
                children: safeChildren,
                categoryLabel,
                // Only send a category when the file has one, so re-imports don't reset existing guests to Adulto
                category: categoryVal ? categoryLabel : null,
                companion_adults: compAdults,
                companion_children: compChildren,
                companions: companionsVal,
                passes: 1 + (compAdults || 0) + (compChildren || 0),
                // The amount of people comes from a total: rows below can only fill those places
                hasTotal: Boolean(totalPeople),
                ownCount: totalPeople || null,
                altPhones: phone2Idx !== -1
                    ? String(row[phone2Idx] || '').split(/[,;/]/).map((p) => p.replace(/[\s\-()]/g, '')).filter((p) => p.length >= 6)
                    : [],
                members: [],
                attachedTo: null,
                warnings: [],
                dietary_restrictions: dietaryVal,
                notes: notesVal,
                isValid
            };
        });

        // Rows without phone right under a guest are companions of that invitation ("Marcos Pereira 6"
        // followed by "Adriana Ojeda", "Pauli Ojeda"...): they become named companions instead of being dropped
        // Phone cell merged over several rows: everyone in those rows shares that phone (one invitation)
        const covering = (colIdx) => (colIdx === -1 ? [] : currentMerges.filter((m) => m.c <= colIdx && colIdx <= m.ec));
        const phoneGroups = covering(currentHeaders.indexOf(currentMap.phone));
        const totalGroups = covering(totalIdx);
        const groupStartOf = (sheetRow) => phoneGroups.find((m) => sheetRow > m.sr && sheetRow <= m.er)?.sr;

        let holder = null;
        list.forEach((row) => {
            if (row.isValid) {
                holder = row;
                return;
            }
            if (!row.name) return;

            const groupStart = row.sheetRow !== undefined ? groupStartOf(row.sheetRow) : undefined;
            if (groupStart !== undefined && holder && holder.sheetRow === groupStart) {
                const category = row.children ? 'child' : row.youth ? 'youth' : 'adult';
                holder.members.push({ name: row.name, category });
                const totalCoversGroup = totalGroups.some((m) => m.sr === groupStart);
                // Their own amount when the row has one; otherwise one more person, unless the holder's total
                // (merged over the group, or simply big enough) already counts them
                const extra = row.ownCount
                    ? (totalCoversGroup ? 0 : row.ownCount)
                    : (holder.hasTotal && holder.passes >= 1 + holder.members.length ? 0 : 1);
                if (extra > 0) {
                    if (category === 'child') holder.companion_children = (holder.companion_children || 0) + extra;
                    else holder.companion_adults = (holder.companion_adults || 0) + extra;
                    holder.passes += extra;
                }
                row.attachedTo = holder.name;
                row.sharedPhone = true;
                return;
            }
            if (!row.phone && currentOptions.joinOrphans && holder) {
                const free = holder.hasTotal ? holder.passes - 1 - holder.members.length : Infinity;
                if (free > 0) {
                    const category = row.children ? 'child' : row.youth ? 'youth' : 'adult';
                    holder.members.push({ name: row.name, category });
                    if (!holder.hasTotal) {
                        // No total in the file: each row below adds a person to the invitation
                        if (category === 'child') holder.companion_children = (holder.companion_children || 0) + 1;
                        else holder.companion_adults = (holder.companion_adults || 0) + 1;
                        holder.passes += 1;
                    }
                    row.attachedTo = holder.name;
                    return;
                }
                row.warnings.push(`No entra en la invitación de ${holder.name} (${holder.passes} ${holder.passes === 1 ? 'persona' : 'personas'}): revisá si es invitado aparte o si falta sumar un lugar.`);
                return;
            }
            if (!row.phone) row.warnings.push('Sin teléfono: no se puede invitar por WhatsApp.');
        });
        list.forEach((row) => {
            if (row.isValid || row.attachedTo || row.warnings.length) return;
            if (!row.name && row.phone) row.warnings.push('Falta el nombre del invitado.');
            else if (row.name && row.phone && row.phone.replace(/[^\d]/g, '').length < 6) row.warnings.push('Teléfono incompleto.');
            else row.warnings.push('Fila incompleta: falta el nombre o el teléfono.');
        });

        // The same phone in several rows (a family member per row with the holder's number): ONE invitation
        // for that number, the other rows are its companions. Never several invitations for one number.
        {
            const phoneKeyOf = (p) => String(p || '').replace(/[^\d]/g, '').slice(-9);
            const byPhone = {};
            list.filter((r) => r.isValid).forEach((row) => {
                const key = phoneKeyOf(row.phone);
                const holder = byPhone[key];
                if (!holder) {
                    byPhone[key] = row;
                    return;
                }
                holder.phoneGroups = holder.phoneGroups || [holder.passes];
                holder.phoneGroups.push(row.passes);
                const normName = (n) => String(n || '').toLowerCase().replace(/\s+/g, ' ').trim();
                const sameName = normName(row.name) === normName(holder.name);
                // The exact same row twice: nothing to add. Otherwise each row counts its own people
                const total = sameName && row.passes === holder.passes
                    ? holder.passes
                    : holder.phoneGroups.reduce((x, y) => x + y, 0);
                holder.passes = total;
                holder.companion_adults = Math.max(0, total - 1 - (holder.companion_children || 0));
                holder.hasTotal = true;
                if (!sameName && holder.members.length < total - 1) {
                    holder.members.push({ name: row.name, category: row.children ? 'child' : row.youth ? 'youth' : 'adult' });
                }
                holder.members.push(...row.members.slice(0, Math.max(0, total - 1 - holder.members.length)));
                row.isValid = false;
                row.attachedTo = holder.name;
                row.samePhone = true;
            });
        }

        // The same people loaded in several rows, each with its own phone ("Nadia Mereles y Enrique Egusquiza"
        // twice, or "Hector Servian y Karen Bobadilla" + "Karen Bobadilla"): ONE invitation. The row with the
        // whole group's name keeps it, the other rows become its companions and their phones its other numbers.
        if (currentOptions.mergeSamePeople) {
            const norm = (n) => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
            const people = (n) => norm(n).split(/\s+(?:y|e)\s+|\s*[,/&+]\s*/).map((p) => p.trim()).filter(Boolean);
            const samePeople = (a, b) => norm(a.name) === norm(b.name) || people(a.name).includes(norm(b.name)) || people(b.name).includes(norm(a.name));
            const phoneKey = (p) => String(p || '').replace(/[^\d]/g, '').slice(-9);
            const valid = list.filter((r) => r.isValid);
            for (let i = 0; i < valid.length; i++) {
                for (let j = i + 1; j < valid.length; j++) {
                    const a = valid[i];
                    const b = valid[j];
                    if (a.attachedTo || b.attachedTo || phoneKey(a.phone) === phoneKey(b.phone) || !samePeople(a, b)) continue;
                    // The one named after the whole group keeps the invitation
                    const [holder, other] = people(b.name).length > people(a.name).length ? [b, a] : [a, b];
                    holder.groups = holder.groups || [holder.passes];
                    holder.groups.push(other.passes);
                    // Same amount in every row (e.g. 2 and 2): the same invitation repeated. Otherwise each row
                    // counts its own people (1 + 1 = 2)
                    const allEqual = holder.groups.every((n) => n === holder.groups[0]);
                    const total = allEqual && holder.groups[0] > 1 ? holder.groups[0] : holder.groups.reduce((x, y) => x + y, 0);
                    holder.passes = total;
                    holder.companion_adults = Math.max(0, total - 1 - (holder.companion_children || 0));
                    holder.hasTotal = true;
                    holder.altPhones = [...(holder.altPhones || []), other.phone, ...(other.altPhones || [])];
                    if (norm(other.name) !== norm(holder.name) && holder.members.length < total - 1) {
                        holder.members.push({ name: other.name, category: other.children ? 'child' : other.youth ? 'youth' : 'adult' });
                    }
                    holder.members.push(...other.members.slice(0, Math.max(0, total - 1 - holder.members.length)));
                    other.isValid = false;
                    other.attachedTo = holder.name;
                    other.otherPhone = true;
                }
            }
        }

        // Same name with another phone that wasn't joined (option off): warn, it may be the same invitation
        const byName = {};
        list.filter((r) => r.isValid).forEach((r) => {
            const nameKey = r.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
            (byName[nameKey] = byName[nameKey] || []).push(r);
        });
        Object.values(byName).filter((rows) => rows.length > 1).forEach((rows) => rows.forEach((r) => {
            r.warnings.push(`Nombre repetido (${rows.length} veces con distinto teléfono): verificá que no sea la misma invitación.`);
        }));

        list.forEach((r) => {
            if (r.members.length && !r.companions) r.companions = r.members.map((m) => m.name).join(', ');
        });

        setParsedData(list);
    };

    const changeOptions = (patch) => {
        const updated = { ...options, ...patch };
        setOptions(updated);
        buildParsedList(headers, rawRows, mapping, updated);
    };

    const maxPasses = (a, y, c) => {
        const sum = a + y + c;
        return sum > 0 ? sum : 1;
    };

    const handleMappingChange = (field, selectedHeader) => {
        const updated = { ...mapping, [field]: selectedHeader };
        setMapping(updated);
        buildParsedList(headers, rawRows, updated);
    };

    // The uploaded list in the system's template format (same columns and order as the downloadable template),
    // already interpreted: totals, phones 595…, companions in rows below joined in one cell, clean names.
    // What couldn't be solved goes to a second sheet, "Para revisar".
    const handleDownloadCorrected = () => {
        const valid = parsedData.filter((r) => r.isValid);
        const rows = valid.map((r) => ({
            'Nombre Completo': r.name,
            'Teléfono (WhatsApp)': normalizePhone(r.phone),
            'Otros Teléfonos': (r.altPhones || []).map(normalizePhone).join(', '),
            'Número de Mesa': r.table_number || '',
            'Tipo de Invitado': r.categoryLabel,
            'Total Personas': r.passes,
            'Acompañantes Niños': r.companion_children || 0,
            'Nombres Acompañantes': r.companions || '',
            'Restricción Alimentaria': r.dietary_restrictions || '',
            'Familia / Notas': r.notes || '',
        }));
        const review = parsedData
            .filter((r) => r.warnings.length && !r.attachedTo)
            .map((r) => ({
                'Nombre Completo': r.name || '(sin nombre)',
                'Teléfono (WhatsApp)': r.phone ? normalizePhone(r.phone) : '',
                'Total Personas': r.isValid ? r.passes : '',
                'Motivo': r.warnings.join(' '),
            }));

        const workbook = XLSX.utils.book_new();
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet['!cols'] = [30, 18, 18, 16, 16, 14, 18, 40, 24, 24].map((wch) => ({ wch }));
        XLSX.utils.book_append_sheet(workbook, sheet, 'Invitados');
        if (review.length) {
            const reviewSheet = XLSX.utils.json_to_sheet(review);
            reviewSheet['!cols'] = [30, 18, 14, 70].map((wch) => ({ wch }));
            XLSX.utils.book_append_sheet(workbook, reviewSheet, 'Para revisar');
        }
        const base = (file?.name || 'Lista').replace(/\.[^.]+$/, '');
        XLSX.writeFile(workbook, `${base} - corregida.xlsx`);
    };

    const handleDownloadTemplate = () => {
        const templateData = [
            // "Total Personas" = the whole invitation (the invited person included); "Acompañantes Niños" are part of that total
            { "Nombre Completo": "María García", "Teléfono (WhatsApp)": "595981123456", "Número de Mesa": "Mesa 1", "Tipo de Invitado": "Adulto", "Total Personas": 2, "Acompañantes Niños": 1, "Nombres Acompañantes": "Sofía (hija, 4 años)", "Restricción Alimentaria": "Celíaco", "Familia / Notas": "Familia de la Novia" },
            { "Nombre Completo": "Rubén Flores", "Teléfono (WhatsApp)": "595981777666", "Número de Mesa": "Mesa 3", "Tipo de Invitado": "Adulto", "Total Personas": 5, "Acompañantes Niños": 0, "Nombres Acompañantes": "Ana Flores, Juan Flores, Marta Gómez y Luis Flores", "Restricción Alimentaria": "", "Familia / Notas": "Amigos del Novio" },
            { "Nombre Completo": "Carlos Rodríguez", "Teléfono (WhatsApp)": "595981654321", "Número de Mesa": "Mesa 5", "Tipo de Invitado": "Joven", "Total Personas": 1, "Acompañantes Niños": 0, "Nombres Acompañantes": "", "Restricción Alimentaria": "", "Familia / Notas": "Amigo del Novio" },
            { "Nombre Completo": "Lucas Martínez", "Teléfono (WhatsApp)": "595981999888", "Número de Mesa": "Mesa Principal", "Tipo de Invitado": "Niño", "Total Personas": 1, "Acompañantes Niños": 0, "Nombres Acompañantes": "", "Restricción Alimentaria": "Intolerante a la lactosa", "Familia / Notas": "Hijo de Padrinos" }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Invitados");
        XLSX.writeFile(workbook, "Plantilla_Invitados_Evento.xlsx");
    };

    const handleSubmitImport = async () => {
        if (parsedData.some((r) => r.warnings.length > 0 && !r.attachedTo)) {
            setError('El Excel tiene observaciones sin resolver. Corregilas (podés descargar el Excel corregido y ver la hoja «Para revisar») y volvé a subirlo.');
            return;
        }
        const validGuests = parsedData.filter(g => g.isValid);
        if (validGuests.length === 0) {
            setError('No hay invitados válidos para importar. Revisa el mapeo de columnas.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { ok, json } = await apiFetch(`/api/events/${activeEventId}/guests/import`, {
                method: 'POST',
                body: JSON.stringify({
                    guests: validGuests.map(g => ({
                        name: g.name,
                        phone: g.phone,
                        table_number: g.table_number,
                        category: g.category,
                        companion_adults: g.companion_adults,
                        companion_children: g.companion_children,
                        companions: g.companions,
                        members: g.members,
                        alt_phones: g.altPhones && g.altPhones.length ? g.altPhones : undefined,
                        dietary_restrictions: g.dietary_restrictions,
                        notes: g.notes
                    }))
                })
            });

            if (ok) {
                onImportSuccess(json?.message || 'Invitados importados con éxito');
                if (json?.corrections?.length && allowAutoSend) {
                    setCorrections(json.corrections);
                } else {
                    onClose();
                }
            } else {
                setError(json?.message || 'Error al guardar la lista de invitados');
            }
        } catch (err) {
            console.error(err);
            setError('Error de conexión al servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Modal Header */}
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">
                            <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Importar Lista desde Excel</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Subí un archivo .xlsx, .xls o .csv con los invitados y sus teléfonos.</p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {/* Event Plan & Capacity Header */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-zinc-900 dark:text-white">
                                    {event?.couple_names || event?.title || 'Evento Seleccionado'}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/50">
                                    {planName}
                                </span>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Cupo actual: <strong>{currentGuestsCount}</strong> de <strong>{maxGuests}</strong> invitados registrados.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-left sm:text-right">
                                <div className={`text-sm font-black ${availableSlots > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {availableSlots > 0 ? `${availableSlots} cupos libres` : 'Sin cupos libres'}
                                </div>
                                <div className="text-[10px] text-zinc-400">Capacidad ocupada: {capacityPercent}%</div>
                            </div>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 ${availableSlots > 0 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'}`}>
                                {capacityPercent}%
                            </div>
                        </div>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Plan Limit Reached Alert */}
                    {availableSlots <= 0 && (
                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                                <div>
                                    <strong>Límite del plan alcanzado:</strong> Este evento ya cuenta con {currentGuestsCount} de los {maxGuests} invitados permitidos por su {planName}.
                                </div>
                            </div>
                            {onOpenUpgradeBot && (
                                <button
                                    type="button"
                                    onClick={onOpenUpgradeBot}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all whitespace-nowrap shrink-0"
                                >
                                    <Bot className="w-4 h-4" />
                                    <span>Solicitar Plan con Bot</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Anti-duplicate banner */}
                    <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300 text-xs font-medium flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span><strong>Protección anti-duplicados activa:</strong> Si subís un archivo con números de teléfono ya registrados, el sistema actualizará sus datos o los omitirá automáticamente sin duplicar registros ni restar cupos a tu plan.</span>
                    </div>

                    {/* Step 1: Upload or Dropzone */}
                    {!file ? (
                        <div
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-rose-200 dark:border-zinc-700 hover:border-rose-400 dark:hover:border-rose-500 rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer bg-rose-50/30 dark:bg-zinc-800/30 transition-all hover:scale-[0.99] group"
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800 shadow-md text-rose-500 group-hover:scale-110 transition-transform mb-4">
                                <Upload className="w-8 h-8" />
                            </div>
                            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                                Arrastrá y soltá tu archivo Excel aquí
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
                                Admites formatos <span className="font-semibold text-zinc-700 dark:text-zinc-300">.xlsx, .xls, .csv</span> con nombre, celular, mesa, tipo de invitado y acompañantes.
                            </p>

                            <div className="mt-6 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDownloadTemplate(); }}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                                >
                                    <Download className="w-4 h-4 text-emerald-500" />
                                    Descargar Excel de Ejemplo
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Step 2: Mapping & Preview */
                        <div className="space-y-6">
                            {/* File Info Bar */}
                            <div className="flex flex-wrap items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 gap-3">
                                <div className="flex items-center gap-3">
                                    <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                                    <div>
                                        <div className="text-sm font-bold text-zinc-900 dark:text-white">{file.name}</div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {parsedData.filter(g => g.isValid).length} invitados válidos detectados
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => { setFile(null); setParsedData([]); }}
                                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                                >
                                    Cambiar archivo
                                </button>
                            </div>

                            {/* Capacity Warning if file exceeds available slots */}
                            {parsedData.filter(g => g.isValid).length > availableSlots && (
                                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-300 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                                        <div>
                                            <strong>Atención de Capacidad:</strong> El archivo contiene {parsedData.filter(g => g.isValid).length} invitados, pero quedan solo <strong>{availableSlots} {availableSlots === 1 ? 'cupo libre' : 'cupos libres'}</strong> en el {planName} ({maxGuests} máx).
                                        </div>
                                    </div>
                                    {onOpenUpgradeBot && (
                                        <button
                                            type="button"
                                            onClick={onOpenUpgradeBot}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all whitespace-nowrap shrink-0"
                                        >
                                            <Bot className="w-4 h-4" />
                                            <span>Ampliar con Bot</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Column Mapping Selector */}
                            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                                <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-amber-500" /> Mapeo de Columnas
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Nombre Completo *</label>
                                        <select
                                            value={mapping.name}
                                            onChange={(e) => handleMappingChange('name', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">-- Seleccionar columna --</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Apellido (si viene aparte)</label>
                                        <select
                                            value={mapping.last_name}
                                            onChange={(e) => handleMappingChange('last_name', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">Ninguna</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Teléfono / WhatsApp *</label>
                                        <select
                                            value={mapping.phone}
                                            onChange={(e) => handleMappingChange('phone', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">-- Seleccionar columna --</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Otro teléfono (misma invitación)</label>
                                        <select
                                            value={mapping.phone2}
                                            onChange={(e) => handleMappingChange('phone2', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">Ninguna</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Nº de Mesa (Recepción)</label>
                                        <select
                                            value={mapping.table_number}
                                            onChange={(e) => handleMappingChange('table_number', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">-- Sin asignación --</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Tipo de Invitado</label>
                                        <select
                                            value={mapping.category}
                                            onChange={(e) => handleMappingChange('category', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">Por defecto (Adulto)</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Total de personas (incluye al invitado)</label>
                                        <select
                                            value={mapping.total_people}
                                            onChange={(e) => handleMappingChange('total_people', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">Ninguna</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Acompañantes Adultos (cant.)</label>
                                        <select
                                            value={mapping.companion_adults}
                                            onChange={(e) => handleMappingChange('companion_adults', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">Ninguna</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Acompañantes Niños (cant.)</label>
                                        <select
                                            value={mapping.companion_children}
                                            onChange={(e) => handleMappingChange('companion_children', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">Ninguna</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Nombres Acompañantes</label>
                                        <select
                                            value={mapping.companions}
                                            onChange={(e) => handleMappingChange('companions', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">Ninguna</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Restricción Alimentaria</label>
                                        <select
                                            value={mapping.dietary}
                                            onChange={(e) => handleMappingChange('dietary', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">Ninguna</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Notas / Grupo</label>
                                        <select
                                            value={mapping.notes}
                                            onChange={(e) => handleMappingChange('notes', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">Ninguna</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* How the list is read: amount column (total vs companions) and rows without phone */}
                            {(() => {
                                const valid = parsedData.filter((r) => r.isValid);
                                const people = valid.reduce((acc, r) => acc + r.passes, 0);
                                const joined = parsedData.filter((r) => r.attachedTo).length;
                                const warned = parsedData.filter((r) => r.warnings.length && !r.attachedTo).length;
                                return (
                                    <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 space-y-3 text-[11px] text-zinc-700 dark:text-zinc-300">
                                        <div className="flex flex-wrap gap-2 font-bold">
                                            <span className="px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">{valid.length} invitaciones</span>
                                            <span className="px-2 py-1 rounded-lg bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300">{people} personas</span>
                                            {joined > 0 && <span className="px-2 py-1 rounded-lg bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300">{joined} acompañantes con nombre unidos a su invitación</span>}
                                            {warned > 0 && <span className="px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">{warned} filas para revisar</span>}
                                        </div>

                                        {mapping.total_people ? (
                                            <p>La columna <strong>«{mapping.total_people}»</strong> se toma como el <strong>total de la invitación</strong>: un 5 son 5 personas (el invitado + 4 acompañantes).</p>
                                        ) : mapping.companion_adults ? (
                                            <div className="space-y-1.5">
                                                <p>¿Qué significa el número de la columna <strong>«{mapping.companion_adults}»</strong>?</p>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    {[
                                                        ['total', 'Es el total de la invitación', 'Un 2 = el invitado + 1 acompañante'],
                                                        ['companions', 'Son acompañantes además del invitado', 'Un 2 = el invitado + 2 acompañantes'],
                                                    ].map(([mode, title, hint]) => (
                                                        <label key={mode} className={`flex-1 flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer ${options.countMode === mode ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'border-zinc-200 dark:border-zinc-700'}`}>
                                                            <input type="radio" className="mt-0.5" checked={options.countMode === mode} onChange={() => changeOptions({ countMode: mode })} />
                                                            <span><strong>{title}</strong><br /><span className="text-zinc-500">{hint}</span></span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}

                                        <label className="flex items-start gap-2 cursor-pointer">
                                            <input type="checkbox" className="mt-0.5" checked={options.mergeSamePeople} onChange={(e) => changeOptions({ mergeSamePeople: e.target.checked })} />
                                            <span>Las <strong>mismas personas en varias filas</strong> con distinto teléfono (ej. «Nadia y Enrique» dos veces, o «Hector y Karen» + «Karen») son <strong>una sola invitación</strong>: se envía una vez y cualquiera de sus números se reconoce.</span>
                                        </label>
                                        <label className="flex items-start gap-2 cursor-pointer">
                                            <input type="checkbox" className="mt-0.5" checked={options.joinOrphans} onChange={(e) => changeOptions({ joinOrphans: e.target.checked })} />
                                            <span>Las filas <strong>sin teléfono</strong> debajo de un invitado son <strong>sus acompañantes</strong> (se cargan con su nombre en esa invitación).</span>
                                        </label>
                                    </div>
                                );
                            })()}

                            {/* How the list ends up: invitations, what to fix, and the rows as they came */}
                            {!isTemplateFormat && (
                                <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 text-[11px] text-sky-800 dark:text-sky-200">
                                    Este archivo <strong>no tiene el formato de la plantilla</strong>. Revisá en <strong>Cómo queda</strong> que cada invitación sea correcta, o descargá el <strong>Excel corregido</strong>, revisalo y subí ese.
                                </div>
                            )}

                            <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                                <div className="px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800/80 flex flex-wrap justify-between items-center gap-2">
                                    <div className="flex gap-1 text-xs font-bold">
                                        {[
                                            ['result', `Cómo queda (${invitations.length})`],
                                            ['issues', `Observaciones (${issues.length})`],
                                            ['rows', `Filas del Excel (${parsedData.length})`],
                                        ].map(([id, label]) => (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => setPreviewTab(id)}
                                                className={`px-3 py-1.5 rounded-xl ${previewTab === id
                                                    ? (id === 'issues' && issues.length ? 'bg-rose-600 text-white' : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900')
                                                    : (id === 'issues' && issues.length ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/30' : 'text-zinc-600 dark:text-zinc-300')}`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleDownloadCorrected}
                                        disabled={!parsedData.some((r) => r.isValid)}
                                        title="La lista en el formato de la plantilla, con una hoja «Para revisar» con las observaciones"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold disabled:opacity-50"
                                    >
                                        <Download className="w-3.5 h-3.5" /> Descargar Excel corregido
                                    </button>
                                </div>

                                <div className="max-h-[50vh] overflow-y-auto">
                                    {previewTab === 'result' && (
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-zinc-100/70 dark:bg-zinc-800 text-zinc-500 uppercase tracking-wider sticky top-0">
                                                <tr>
                                                    <th className="p-3">#</th>
                                                    <th className="p-3">Invitación</th>
                                                    <th className="p-3">Teléfono</th>
                                                    <th className="p-3 text-center">Personas</th>
                                                    <th className="p-3">Acompañantes</th>
                                                    <th className="p-3">Mesa</th>
                                                    <th className="p-3">Dieta / Notas</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                                {invitations.map((g, i) => (
                                                    <tr key={g.id} className={g.warnings.length ? 'bg-amber-50/50 dark:bg-amber-950/20' : 'bg-white dark:bg-zinc-900'}>
                                                        <td className="p-3 text-zinc-400">{i + 1}</td>
                                                        <td className="p-3">
                                                            <div className="font-bold text-zinc-900 dark:text-white">{g.name}</div>
                                                            <div className="text-[10px] text-zinc-500">{g.categoryLabel} · fila {excelRow(g)}</div>
                                                            {g.warnings.map((w, k) => (
                                                                <div key={k} className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">⚠️ {w}</div>
                                                            ))}
                                                        </td>
                                                        <td className="p-3 font-mono text-zinc-600 dark:text-zinc-400">
                                                            {normalizePhone(g.phone)}
                                                            {(g.altPhones || []).map((p) => <div key={p} className="text-[10px] text-zinc-400">+ {normalizePhone(p)}</div>)}
                                                        </td>
                                                        <td className="p-3 text-center text-base font-black text-zinc-900 dark:text-white">{g.passes}</td>
                                                        <td className="p-3 text-zinc-600 dark:text-zinc-300">
                                                            {g.members.length ? g.members.map((m) => m.name).join(', ') : (g.companions || (g.passes > 1 ? <span className="text-zinc-400 italic">{g.passes - 1} sin nombre</span> : '—'))}
                                                        </td>
                                                        <td className="p-3 text-amber-600 dark:text-amber-400 font-bold">{g.table_number || '—'}</td>
                                                        <td className="p-3 text-zinc-500">{[g.dietary_restrictions, g.notes].filter(Boolean).join(' · ') || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}

                                    {previewTab === 'issues' && (
                                        issues.length === 0 ? (
                                            <div className="p-8 text-center text-xs text-emerald-700 dark:text-emerald-400 font-bold">✅ Sin observaciones: la lista cuadra.</div>
                                        ) : (
                                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                                {issues.map((r) => (
                                                    <div key={r.id} className="p-3 text-xs flex gap-3">
                                                        <span className="shrink-0 font-mono text-zinc-400">Fila {excelRow(r)}</span>
                                                        <div>
                                                            <div className="font-bold text-zinc-900 dark:text-white">{r.name || '(sin nombre)'} <span className="font-mono font-normal text-zinc-500">{r.phone}</span></div>
                                                            {r.warnings.map((w, k) => <div key={k} className="text-rose-600 dark:text-rose-400">{w}</div>)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    )}

                                    {previewTab === 'rows' && (
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-zinc-100/70 dark:bg-zinc-800 text-zinc-500 uppercase tracking-wider sticky top-0">
                                            <tr>
                                                <th className="p-3">Estado</th>
                                                <th className="p-3">Nombre</th>
                                                <th className="p-3">Teléfono</th>
                                                <th className="p-3">Nº Mesa</th>
                                                <th className="p-3">Tipo Invitado</th>
                                                <th className="p-3">Personas</th>
                                                <th className="p-3">Dieta</th>
                                                <th className="p-3">Notas</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {parsedData.map((row) => (
                                                <tr key={row.id} className={row.attachedTo ? 'bg-violet-50/40 dark:bg-violet-950/10' : row.isValid ? (row.warnings.length ? 'bg-amber-50/50 dark:bg-amber-950/20' : 'bg-white dark:bg-zinc-900') : 'bg-rose-50/40 dark:bg-rose-950/20'}>
                                                    <td className="p-3 font-semibold">
                                                        {row.attachedTo ? (
                                                            <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400">
                                                                <Users className="w-4 h-4" /> Acompañante
                                                            </span>
                                                        ) : row.isValid ? (
                                                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                                <Check className="w-4 h-4" /> Listo
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                                                                <AlertCircle className="w-4 h-4" /> Incompleto
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 font-medium text-zinc-900 dark:text-white">
                                                        {row.attachedTo ? <span className="text-zinc-500">↳ {row.name} <span className="text-[10px]">({row.otherPhone ? `misma invitación que ${row.attachedTo} · su número queda asociado` : `de ${row.attachedTo}`}{row.sharedPhone ? ' · teléfono combinado' : ''}{row.samePhone ? ' · mismo teléfono' : ''})</span></span> : (row.name || '(Sin nombre)')}
                                                        {row.warnings.map((w, i) => (
                                                            <div key={i} className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mt-0.5">⚠️ {w}</div>
                                                        ))}
                                                    </td>
                                                    <td className="p-3 text-zinc-600 dark:text-zinc-400 font-mono">{row.attachedTo ? '—' : (row.phone || '(Sin teléfono)')}</td>
                                                    <td className="p-3 text-amber-600 dark:text-amber-400 font-bold">{row.table_number || '-'}</td>
                                                    <td className="p-3">
                                                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                                                            {row.categoryLabel}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-zinc-500">
                                                        {row.attachedTo ? '' : row.passes > 1 ? (
                                                            <span className="font-bold text-teal-700 dark:text-teal-300">
                                                                {row.passes} <span className="font-normal text-zinc-500">(1 + {row.passes - 1}){row.companions ? ` · ${row.companions}` : ''}</span>
                                                            </span>
                                                        ) : '1'}
                                                    </td>
                                                    <td className="p-3 text-zinc-500">{row.dietary_restrictions || '-'}</td>
                                                    <td className="p-3 text-zinc-500">{row.notes || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        Cancelar
                    </button>

                    {file && (
                        <button
                            type="button"
                            disabled={loading || invitations.length === 0 || issues.length > 0}
                            title={issues.length ? 'Corregí las observaciones en el Excel y volvé a subirlo' : ''}
                            onClick={handleSubmitImport}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 active:scale-95"
                        >
                            {loading ? (
                                <span>Importando...</span>
                            ) : (
                                <>
                                    <Users className="w-4 h-4" />
                                    <span>{issues.length ? `Hay ${issues.length} observaciones: corregí el Excel` : `Importar ${invitations.length} invitaciones`}</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
