import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Filter, RotateCcw, RotateCw, ArrowUpDown, Search } from 'lucide-react';

/**
 * Spreadsheet in the browser that behaves like Excel: click / drag / Shift to select a range, row and column
 * headers select whole rows / columns, Ctrl+C / Ctrl+X / Ctrl+V with Excel or Google Sheets, Supr clears,
 * typing or double click edits, Ctrl+Z / Ctrl+Y, and a filter / sort menu per column (filter and sort only
 * change what is shown, never the order of the list: rows without phone stay under their holder).
 * Rows with a problem show it on hover and their wrong cells in red.
 *
 * columns: [{ key, label, width, type?: 'text'|'number'|'select', options? }]
 * rows:    [{ [key]: string }]   (extra keys like _row are kept)
 * errors:  { [rowIndex]: { [key]: message } }  (a '_row' key marks the whole row)
 * readOnly: select, copy and filter only (a preview of what will be saved)
 * rowLabels: optional label per row instead of the row number (e.g. the Excel rows it comes from)
 * cellHint: optional (rowIndex, key) => { text, tone: 'ok'|'warn', actionLabel?, onAction? } shown inside an
 *           empty cell (e.g. "Acompañante de Marcos Pereira · Unir" in the phone of a row without phone)
 */

const EMPTY = '(Vacías)';
const cellText = (v) => String(v ?? '').trim();
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// Tab separated text as Excel puts it in the clipboard (quoted cells may hold tabs or line breaks)
const parseTsv = (text) => {
    const s = text.replace(/\r\n?/g, '\n');
    const out = [[]];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (quoted) {
            if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') quoted = false;
            else cell += ch;
        } else if (ch === '"' && cell === '') quoted = true;
        else if (ch === '\t') { out[out.length - 1].push(cell); cell = ''; }
        else if (ch === '\n') { out[out.length - 1].push(cell); out.push([]); cell = ''; }
        else cell += ch;
    }
    out[out.length - 1].push(cell);
    const last = out[out.length - 1];
    if (out.length > 1 && last.length === 1 && last[0] === '') out.pop();
    return out;
};

const toTsv = (matrix) => matrix
    .map((line) => line.map((v) => {
        const s = String(v ?? '');
        return /[\t\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join('\t'))
    .join('\n');

const toNumber = (v) => {
    const n = parseFloat(String(v ?? '').replace(',', '.'));
    return Number.isNaN(n) ? null : n;
};

export default function SpreadsheetGrid({ columns, rows, onChange, errors = {}, readOnly = false, rowLabels = null, cellHint = null }) {
    const scrollRef = useRef(null);
    const keysRef = useRef(null); // hidden textarea that keeps the keyboard focus, so copy / paste work in every browser
    const history = useRef({ past: [], future: [] });
    const editRef = useRef(null);
    const dragging = useRef(null); // 'cell' | 'row' | 'col'

    // Rows replaced from outside (new upload, automatic corrections) refresh the filtered / sorted view
    const lastEmitted = useRef(rows);
    const outsideVersion = useRef(0);
    if (rows !== lastEmitted.current) {
        outsideVersion.current += 1;
        lastEmitted.current = rows;
    }

    const [sel, setSel] = useState({ r1: 0, c1: 0, r2: 0, c2: 0 });
    const [editing, setEditingState] = useState(null);
    const [filters, setFilters] = useState({}); // { [key]: Set of allowed values }
    const [sort, setSort] = useState(null); // { key, dir: 'asc' | 'desc' }
    const [menu, setMenu] = useState(null); // filter menu: { c, x, y }

    const setEditing = (value) => { editRef.current = value; setEditingState(value); };

    const emptyRow = () => Object.fromEntries(columns.map((c) => [c.key, c.type === 'select' ? c.options[0] : '']));

    // Row indexes in display order. Edits don't re-filter on the spot (like Excel): only when the filter,
    // the sort, the number of rows or the list itself changes.
    const view = useMemo(() => {
        let idx = rows.map((_, i) => i);
        Object.entries(filters).forEach(([key, allowed]) => {
            idx = idx.filter((i) => allowed.has(cellText(rows[i][key]) || EMPTY));
        });
        if (sort) {
            const col = columns.find((c) => c.key === sort.key);
            idx = [...idx].sort((a, b) => {
                const x = cellText(rows[a][sort.key]);
                const y = cellText(rows[b][sort.key]);
                if (!x || !y) return x ? -1 : y ? 1 : 0; // empty cells always at the end
                const d = col?.type === 'number'
                    ? (toNumber(x) ?? 0) - (toNumber(y) ?? 0)
                    : x.localeCompare(y, 'es', { sensitivity: 'base', numeric: true });
                return sort.dir === 'asc' ? d : -d;
            });
        }
        return idx;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, sort, rows.length, outsideVersion.current]);

    const nRows = view.length;
    const nCols = columns.length;
    const top = Math.min(sel.r1, sel.r2);
    const bottom = Math.max(sel.r1, sel.r2);
    const left = Math.min(sel.c1, sel.c2);
    const right = Math.max(sel.c1, sel.c2);
    const filtered = Object.keys(filters).length > 0;

    useEffect(() => {
        const max = Math.max(0, nRows - 1);
        setSel((s) => (s.r1 > max || s.r2 > max ? { ...s, r1: Math.min(s.r1, max), r2: Math.min(s.r2, max) } : s));
    }, [nRows]);

    useEffect(() => {
        const up = () => { dragging.current = null; };
        window.addEventListener('mouseup', up);
        return () => window.removeEventListener('mouseup', up);
    }, []);

    // Keep the active cell visible while moving with the keyboard
    useEffect(() => {
        scrollRef.current?.querySelector(`[data-cell="${sel.r2}-${sel.c2}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [sel.r2, sel.c2]);

    const focusKeys = () => keysRef.current?.focus({ preventScroll: true });

    // ---------- changes (all go through the undo history) ----------
    const emit = (next) => { lastEmitted.current = next; onChange(next); };
    const commit = (next) => {
        history.current.past.push(rows);
        if (history.current.past.length > 100) history.current.past.shift();
        history.current.future = [];
        emit(next);
    };
    const undo = () => {
        const h = history.current;
        if (readOnly || !h.past.length) return;
        h.future.push(rows);
        emit(h.past.pop());
    };
    const redo = () => {
        const h = history.current;
        if (readOnly || !h.future.length) return;
        h.past.push(rows);
        emit(h.future.pop());
    };

    const fitValue = (col, value) => {
        const v = String(value ?? '').trim();
        if (col.type !== 'select') return v;
        if (!v) return col.options[0];
        return col.options.find((o) => o.toLowerCase() === v.toLowerCase()) || v;
    };

    // cells: [{ v: display row, c: column, value }]; display rows past the end are added as new rows
    const writeCells = (cells, addRowAtEnd = false) => {
        if (readOnly || (!cells.length && !addRowAtEnd)) return;
        const next = rows.map((row) => ({ ...row }));
        const order = [...view];
        cells.forEach(({ v, c, value }) => {
            const col = columns[c];
            if (!col) return;
            while (order.length <= v) { next.push(emptyRow()); order.push(next.length - 1); }
            next[order[v]][col.key] = fitValue(col, value);
        });
        if (addRowAtEnd) next.push(emptyRow());
        commit(next);
    };

    const rangeCells = (value) => {
        const cells = [];
        for (let v = top; v <= Math.min(bottom, nRows - 1); v++) {
            for (let c = left; c <= right; c++) cells.push({ v, c, value });
        }
        return cells;
    };
    const clearSelection = () => writeCells(rangeCells(''));

    const selectedRowIndexes = () => view.slice(top, bottom + 1);
    const deleteSelectedRows = () => {
        if (readOnly || !nRows) return;
        const drop = new Set(selectedRowIndexes());
        commit(rows.filter((_, i) => !drop.has(i)));
        setSel({ r1: top, c1: sel.c1, r2: top, c2: sel.c1 });
    };
    const insertRowAbove = () => {
        if (readOnly) return;
        const at = nRows ? view[top] : rows.length;
        const next = [...rows];
        next.splice(at, 0, emptyRow());
        commit(next);
    };

    // ---------- copy / paste ----------
    const selectionTsv = () => {
        const matrix = [];
        for (let v = top; v <= Math.min(bottom, nRows - 1); v++) {
            const row = rows[view[v]];
            matrix.push(columns.slice(left, right + 1).map((c) => row?.[c.key] ?? ''));
        }
        return toTsv(matrix);
    };

    // Puts the selection as selected text in the hidden textarea: Safari only fires copy when text is selected
    const prepareCopy = () => {
        const ta = keysRef.current;
        if (!ta) return;
        ta.value = selectionTsv();
        ta.select();
    };

    const onCopy = (e) => {
        e.preventDefault();
        e.clipboardData.setData('text/plain', selectionTsv());
        setTimeout(() => { if (keysRef.current) keysRef.current.value = ''; }, 0);
    };
    const onCut = (e) => {
        onCopy(e);
        clearSelection();
    };

    const pasteText = (text, at = null) => {
        if (readOnly || !text) return;
        const matrix = parseTsv(text);
        // One value copied and several cells selected: fills them all (like Excel)
        if (!at && matrix.length === 1 && matrix[0].length === 1) {
            writeCells(rangeCells(matrix[0][0]));
            return;
        }
        const r0 = at ? at.v : top;
        const c0 = at ? at.c : left;
        const cells = [];
        matrix.forEach((line, i) => line.forEach((value, j) => {
            if (c0 + j < nCols) cells.push({ v: r0 + i, c: c0 + j, value });
        }));
        writeCells(cells);
        const width = Math.max(...matrix.map((l) => l.length));
        setSel({ r1: r0, c1: c0, r2: r0 + matrix.length - 1, c2: Math.min(nCols - 1, c0 + width - 1) });
    };

    const onPaste = (e) => {
        e.preventDefault();
        pasteText(e.clipboardData.getData('text/plain'));
    };

    // ---------- editing ----------
    const startEdit = (v, c, typed) => {
        if (readOnly || v >= nRows || !columns[c]) return;
        const row = rows[view[v]];
        setSel({ r1: v, c1: c, r2: v, c2: c });
        setEditing({ v, c, value: typed ?? String(row?.[columns[c].key] ?? ''), typed: typed !== undefined });
    };

    // then: what to do after saving, e.g. move to the next cell; addRow: Enter on the last row adds one;
    // refocus: false when the focus left to something else on the page (don't take it back)
    const finishEdit = (save, then = null, addRow = false, refocus = true) => {
        const ed = editRef.current;
        if (!ed) return;
        setEditing(null);
        const col = columns[ed.c];
        const current = String(rows[view[ed.v]]?.[col.key] ?? '');
        if (save && (ed.value !== current || addRow)) {
            writeCells(ed.value !== current ? [{ v: ed.v, c: ed.c, value: ed.value }] : [], addRow);
        }
        if (then) then(ed);
        if (refocus) setTimeout(focusKeys, 0);
    };

    const select = (v, c) => setSel({ r1: v, c1: c, r2: v, c2: c });

    const move = (dr, dc, extend = false, jump = false) => {
        setSel((s) => {
            const max = Math.max(0, nRows - 1);
            let r = s.r2;
            let c = s.c2;
            if (jump) {
                if (dr) r = dr > 0 ? max : 0;
                if (dc) c = dc > 0 ? nCols - 1 : 0;
            } else {
                r = clamp(r + dr, 0, max);
                c = clamp(c + dc, 0, nCols - 1);
            }
            return extend ? { ...s, r2: r, c2: c } : { r1: r, c1: c, r2: r, c2: c };
        });
    };

    const onEditorKey = (e) => {
        e.stopPropagation();
        const ed = editRef.current;
        if (e.key === 'Enter') {
            e.preventDefault();
            const last = ed.v >= nRows - 1;
            if (e.shiftKey) finishEdit(true, () => move(-1, 0));
            else if (last) finishEdit(true, () => select(ed.v + 1, ed.c), true);
            else finishEdit(true, () => move(1, 0));
        } else if (e.key === 'Tab') {
            e.preventDefault();
            finishEdit(true, () => move(0, e.shiftKey ? -1 : 1));
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finishEdit(false);
        } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && ed.typed) {
            e.preventDefault();
            finishEdit(true, () => move(e.key === 'ArrowUp' ? -1 : 1, 0));
        }
    };

    // A block pasted while editing a cell goes to the grid starting at that cell
    const onEditorPaste = (e) => {
        const text = e.clipboardData.getData('text/plain');
        if (!text.includes('\t') && !text.includes('\n')) return;
        e.preventDefault();
        const ed = editRef.current;
        setEditing(null);
        pasteText(text, { v: ed.v, c: ed.c });
        setTimeout(focusKeys, 0);
    };

    // ---------- keyboard on the grid ----------
    const onKeyDown = (e) => {
        const mod = e.ctrlKey || e.metaKey;
        const key = e.key;
        const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

        if (arrows[key]) { e.preventDefault(); move(...arrows[key], e.shiftKey, mod); return; }
        if (mod) {
            const k = key.toLowerCase();
            if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
            else if (k === 'y') { e.preventDefault(); redo(); }
            else if (k === 'a') { e.preventDefault(); setSel({ r1: 0, c1: 0, r2: Math.max(0, nRows - 1), c2: nCols - 1 }); }
            else if (k === 'c' || k === 'x') prepareCopy(); // the copy / cut event does the rest
            return; // Ctrl+V arrives as a paste event
        }
        if (key === 'Tab') { e.preventDefault(); move(0, e.shiftKey ? -1 : 1); return; }
        if (key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) move(-1, 0);
            else if (sel.r2 >= nRows - 1 && !readOnly) { writeCells([], true); select(nRows, sel.c2); }
            else move(1, 0);
            return;
        }
        if (key === 'F2') { e.preventDefault(); startEdit(sel.r2, sel.c2); return; }
        if (key === 'Delete' || key === 'Backspace') { e.preventDefault(); clearSelection(); return; }
        if (key === 'Escape') { setMenu(null); return; }
        if (key.length === 1 && !e.altKey && !readOnly && nRows) {
            e.preventDefault();
            const col = columns[sel.c2];
            startEdit(sel.r2, sel.c2, col.type === 'select' ? undefined : key);
        }
    };

    // ---------- mouse ----------
    const onCellDown = (e, v, c) => {
        if (e.button !== 0) return;
        const ed = editRef.current;
        if (ed && ed.v === v && ed.c === c) return; // click inside the cell being edited
        e.preventDefault();
        if (ed) finishEdit(true);
        dragging.current = 'cell';
        setSel((s) => (e.shiftKey ? { ...s, r2: v, c2: c } : { r1: v, c1: c, r2: v, c2: c }));
        focusKeys();
    };
    const onCellEnter = (v, c) => {
        if (dragging.current === 'cell') setSel((s) => ({ ...s, r2: v, c2: c }));
        else if (dragging.current === 'row') setSel((s) => ({ ...s, r2: v }));
    };
    const onRowHeaderDown = (e, v) => {
        if (e.button !== 0) return;
        e.preventDefault();
        if (editRef.current) finishEdit(true);
        dragging.current = 'row';
        setSel((s) => (e.shiftKey ? { r1: s.r1, c1: 0, r2: v, c2: nCols - 1 } : { r1: v, c1: 0, r2: v, c2: nCols - 1 }));
        focusKeys();
    };
    const onColHeaderDown = (e, c) => {
        if (e.button !== 0) return;
        e.preventDefault();
        if (editRef.current) finishEdit(true);
        dragging.current = 'col';
        const last = Math.max(0, nRows - 1);
        setSel((s) => (e.shiftKey ? { r1: 0, c1: s.c1, r2: last, c2: c } : { r1: 0, c1: c, r2: last, c2: c }));
        focusKeys();
    };
    const onColHeaderEnter = (c) => {
        if (dragging.current === 'col') setSel((s) => ({ ...s, c2: c }));
    };
    const selectAll = (e) => {
        e.preventDefault();
        setSel({ r1: 0, c1: 0, r2: Math.max(0, nRows - 1), c2: nCols - 1 });
        focusKeys();
    };

    const openMenu = (e, c) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setMenu({ c, x: Math.min(rect.left, window.innerWidth - 270), y: rect.bottom + 4 });
    };

    // ---------- status bar ----------
    const status = useMemo(() => {
        if (!nRows) return null;
        const cells = (Math.min(bottom, nRows - 1) - top + 1) * (right - left + 1);
        if (cells < 2) return null;
        let sum = 0;
        let numbers = 0;
        for (let v = top; v <= Math.min(bottom, nRows - 1); v++) {
            for (let c = left; c <= right; c++) {
                if (columns[c].type !== 'number') continue; // like Excel: only numbers add up (not phones)
                const n = toNumber(rows[view[v]]?.[columns[c].key]);
                if (n !== null) { sum += n; numbers++; }
            }
        }
        return { cells, sum: numbers ? sum : null };
    }, [top, bottom, left, right, rows, view, nRows, columns]);

    const totalWidth = columns.reduce((a, c) => a + (c.width || 140), 48 + (readOnly ? 0 : 32));
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
    const modKey = isMac ? '⌘' : 'Ctrl';
    const btn = 'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent';

    return (
        <div className="relative space-y-1.5">
            <textarea
                ref={keysRef}
                aria-hidden="true"
                tabIndex={-1}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onCopy={onCopy}
                onCut={readOnly ? onCopy : onCut}
                className="absolute left-0 top-0 w-px h-px opacity-0 pointer-events-none resize-none"
            />

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1">
                {!readOnly && (
                    <>
                        <button type="button" onClick={undo} disabled={!history.current.past.length} className={btn} title={`Deshacer (${modKey}+Z)`}><RotateCcw className="w-3.5 h-3.5" /> Deshacer</button>
                        <button type="button" onClick={redo} disabled={!history.current.future.length} className={btn} title={`Rehacer (${modKey}+Y)`}><RotateCw className="w-3.5 h-3.5" /> Rehacer</button>
                        <span className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                        <button type="button" onClick={insertRowAbove} className={btn} title="Inserta una fila vacía arriba de la seleccionada"><Plus className="w-3.5 h-3.5" /> Insertar fila arriba</button>
                        <button type="button" onClick={deleteSelectedRows} disabled={!nRows} className={`${btn} hover:text-rose-600`}>
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar {bottom > top ? `${Math.min(bottom, nRows - 1) - top + 1} filas` : 'fila'}
                        </button>
                    </>
                )}
                {(filtered || sort) && (
                    <button type="button" onClick={() => { setFilters({}); setSort(null); }} className={`${btn} text-sky-700 dark:text-sky-300`}>
                        <Filter className="w-3.5 h-3.5" /> Quitar filtros y orden
                    </button>
                )}
                <span className="ml-auto text-[10px] text-zinc-400 hidden md:block">
                    {readOnly
                        ? `Arrastrá para seleccionar · ${modKey}+C copia`
                        : `Escribí o doble clic para editar · ${modKey}+C / ${modKey}+V con Excel · Supr borra · ${modKey}+Z deshace`}
                </span>
            </div>

            <div
                ref={scrollRef}
                className="overflow-auto border border-zinc-300 dark:border-zinc-700 rounded-xl max-h-[60vh] bg-white dark:bg-zinc-900 select-none"
                onMouseDown={(e) => { if (e.target === e.currentTarget) focusKeys(); }}
            >
                <table className="border-collapse text-xs" style={{ tableLayout: 'fixed', width: totalWidth }}>
                    <colgroup>
                        <col style={{ width: 48 }} />
                        {columns.map((c) => <col key={c.key} style={{ width: c.width || 140 }} />)}
                        {!readOnly && <col style={{ width: 32 }} />}
                    </colgroup>
                    <thead className="sticky top-0 z-20">
                        <tr>
                            <th onMouseDown={selectAll} title="Seleccionar todo" className="sticky left-0 z-30 bg-[#e8eaed] dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 cursor-pointer" />
                            {columns.map((c, ci) => {
                                const colSelected = nRows > 0 && ci >= left && ci <= right;
                                const active = filters[c.key] || sort?.key === c.key;
                                return (
                                    <th
                                        key={c.key}
                                        onMouseDown={(e) => onColHeaderDown(e, ci)}
                                        onMouseEnter={() => onColHeaderEnter(ci)}
                                        className={`border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-left cursor-pointer ${colSelected ? 'bg-[#d3e3fd] dark:bg-sky-900/60' : 'bg-[#e8eaed] dark:bg-zinc-800'}`}
                                    >
                                        <div className="flex items-center justify-between gap-1">
                                            <div className="min-w-0">
                                                <div className="text-[10px] text-zinc-400 font-mono">{String.fromCharCode(65 + ci)}</div>
                                                <div className="font-bold text-zinc-700 dark:text-zinc-200 truncate" title={c.label}>{c.label}</div>
                                            </div>
                                            <button
                                                type="button"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={(e) => openMenu(e, ci)}
                                                title="Filtrar y ordenar"
                                                className={`shrink-0 p-1 rounded ${active ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:bg-zinc-300/60 dark:hover:bg-zinc-700'}`}
                                            >
                                                {sort?.key === c.key && !filters[c.key] ? <ArrowUpDown className="w-3 h-3" /> : <Filter className="w-3 h-3" />}
                                            </button>
                                        </div>
                                    </th>
                                );
                            })}
                            {!readOnly && <th className="bg-[#e8eaed] dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700" />}
                        </tr>
                    </thead>
                    <tbody>
                        {view.map((rowIndex, v) => {
                            const row = rows[rowIndex];
                            const rowErrors = errors[rowIndex] || {};
                            const hasError = Object.keys(rowErrors).length > 0;
                            const rowSelected = v >= top && v <= bottom;
                            return (
                                <tr key={rowIndex} title={hasError ? Object.values(rowErrors).join(' · ') : ''}>
                                    <td
                                        onMouseDown={(e) => onRowHeaderDown(e, v)}
                                        onMouseEnter={() => onCellEnter(v, 0)}
                                        className={`sticky left-0 z-10 text-center font-mono text-[10px] border border-zinc-300 dark:border-zinc-700 px-1 cursor-pointer ${hasError ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60' : rowSelected ? 'bg-[#d3e3fd] text-sky-800 dark:bg-sky-900/60 dark:text-sky-200' : 'bg-[#f1f3f4] text-zinc-500 dark:bg-zinc-800'}`}
                                    >
                                        {rowLabels ? rowLabels[rowIndex] : rowIndex + 2}
                                    </td>
                                    {columns.map((c, ci) => {
                                        const bad = rowErrors[c.key];
                                        const inSel = v >= top && v <= bottom && ci >= left && ci <= right;
                                        const isActive = v === sel.r2 && ci === sel.c2;
                                        const isEditing = editing && editing.v === v && editing.c === ci;
                                        const text = String(row[c.key] ?? '');
                                        const hint = !text && !isEditing && cellHint ? cellHint(rowIndex, c.key) : null;
                                        const tint = inSel ? 'bg-sky-100 dark:bg-sky-900/40'
                                            : hint ? (hint.tone === 'ok' ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-amber-50 dark:bg-amber-950/30')
                                                : bad || rowErrors._row ? 'bg-rose-50 dark:bg-rose-950/30' : '';
                                        return (
                                            <td
                                                key={c.key}
                                                data-cell={`${v}-${ci}`}
                                                onMouseDown={(e) => onCellDown(e, v, ci)}
                                                onMouseEnter={() => onCellEnter(v, ci)}
                                                onDoubleClick={() => startEdit(v, ci)}
                                                title={hint?.text || bad || text}
                                                className={`relative px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 whitespace-nowrap overflow-hidden text-ellipsis cursor-cell ${c.type === 'number' ? 'text-right' : ''} ${tint}`}
                                            >
                                                {hint ? (
                                                    <span className={`flex items-center gap-1 text-[10px] font-bold ${hint.tone === 'ok' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                                                        <span className="truncate">↳ {hint.text}</span>
                                                        {hint.onAction && !readOnly && (
                                                            <button
                                                                type="button"
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                                onClick={(e) => { e.stopPropagation(); hint.onAction(); }}
                                                                className={`shrink-0 px-1.5 py-0.5 rounded text-white ${hint.tone === 'ok' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                                                            >
                                                                {hint.actionLabel || 'Aplicar'}
                                                            </button>
                                                        )}
                                                    </span>
                                                ) : (text || '\u00a0')}
                                                {isActive && !isEditing && <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-sky-600" />}
                                                {isEditing && (c.type === 'select' ? (
                                                    <select
                                                        autoFocus
                                                        value={editing.value || c.options[0]}
                                                        onChange={(e) => { editRef.current = { ...editRef.current, value: e.target.value }; finishEdit(true); }}
                                                        onBlur={() => finishEdit(true, null, false, false)}
                                                        onKeyDown={onEditorKey}
                                                        className="absolute inset-0 w-full h-full px-1 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none ring-2 ring-inset ring-sky-600"
                                                    >
                                                        {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                ) : (
                                                    <input
                                                        autoFocus
                                                        value={editing.value}
                                                        inputMode={c.type === 'number' ? 'numeric' : undefined}
                                                        onChange={(e) => setEditing({ ...editRef.current, value: e.target.value })}
                                                        onBlur={() => finishEdit(true, null, false, false)}
                                                        onKeyDown={onEditorKey}
                                                        onPaste={onEditorPaste}
                                                        onFocus={(e) => { const end = e.target.value.length; e.target.setSelectionRange(end, end); }}
                                                        className={`absolute inset-0 w-full h-full px-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none ring-2 ring-inset ring-sky-600 select-text ${c.type === 'number' ? 'text-right' : ''}`}
                                                    />
                                                ))}
                                            </td>
                                        );
                                    })}
                                    {!readOnly && (
                                        <td className="border border-zinc-300 dark:border-zinc-700 text-center">
                                            <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={() => commit(rows.filter((_, i) => i !== rowIndex))} title="Eliminar fila" className="p-1 text-zinc-400 hover:text-rose-600">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        {!nRows && (
                            <tr>
                                <td colSpan={nCols + (readOnly ? 1 : 2)} onMouseDown={(e) => { e.preventDefault(); select(0, 0); focusKeys(); }} className="px-3 py-6 text-center text-zinc-400 cursor-cell">
                                    {filtered ? 'Ninguna fila coincide con el filtro.' : readOnly ? 'Sin filas.' : `Hacé clic acá y pegá (${modKey}+V) lo que copiaste de Excel.`}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {!readOnly && (
                    <button type="button" onClick={() => { writeCells([], true); select(nRows, sel.c2); }} className="m-2 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/30">
                        <Plus className="w-3.5 h-3.5" /> Agregar fila
                    </button>
                )}
            </div>

            {/* Status bar, like the bottom of Excel */}
            <div className="flex flex-wrap gap-x-3 text-[10px] text-zinc-500 px-1">
                <span>{rows.length} {rows.length === 1 ? 'fila' : 'filas'}{filtered && ` · mostrando ${nRows}`}</span>
                {status && <span>{status.cells} celdas seleccionadas</span>}
                {status?.sum !== null && status?.sum !== undefined && <span className="font-bold text-zinc-700 dark:text-zinc-300">Suma: {status.sum}</span>}
                {(filtered || sort) && <span className="text-sky-600">El filtro y el orden solo cambian la vista: la lista se guarda en su orden original.</span>}
            </div>

            {menu && (
                <FilterMenu
                    column={columns[menu.c]}
                    rows={rows}
                    allowed={filters[columns[menu.c].key] || null}
                    sortDir={sort?.key === columns[menu.c].key ? sort.dir : null}
                    x={menu.x}
                    y={menu.y}
                    onSort={(dir) => { setSort(dir ? { key: columns[menu.c].key, dir } : null); setMenu(null); }}
                    onApply={(allowed) => {
                        const key = columns[menu.c].key;
                        setFilters((f) => {
                            const next = { ...f };
                            if (allowed) next[key] = allowed; else delete next[key];
                            return next;
                        });
                        setSel({ r1: 0, c1: sel.c1, r2: 0, c2: sel.c1 });
                        setMenu(null);
                    }}
                    onClose={() => setMenu(null)}
                />
            )}
        </div>
    );
}

// Excel-like filter menu: sort, search, and a checkbox per distinct value of the column
function FilterMenu({ column, rows, allowed, sortDir, x, y, onSort, onApply, onClose }) {
    const values = useMemo(() => {
        const counts = new Map();
        rows.forEach((r) => {
            const t = cellText(r[column.key]) || EMPTY;
            counts.set(t, (counts.get(t) || 0) + 1);
        });
        return [...counts.entries()].sort((a, b) => {
            if (a[0] === EMPTY) return 1;
            if (b[0] === EMPTY) return -1;
            return a[0].localeCompare(b[0], 'es', { sensitivity: 'base', numeric: true });
        });
    }, [rows, column.key]);

    const [search, setSearch] = useState('');
    const [checked, setChecked] = useState(() => new Set(allowed ? [...allowed] : values.map(([v]) => v)));
    const shown = values.filter(([v]) => v.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 300);
    const allShownChecked = shown.every(([v]) => checked.has(v));

    const toggle = (v) => setChecked((s) => {
        const next = new Set(s);
        if (next.has(v)) next.delete(v); else next.add(v);
        return next;
    });
    const toggleShown = () => setChecked((s) => {
        const next = new Set(s);
        shown.forEach(([v]) => (allShownChecked ? next.delete(v) : next.add(v)));
        return next;
    });

    const apply = () => {
        // With a search, only the matching checked values stay (like Excel)
        const result = search.trim() ? new Set(shown.map(([v]) => v).filter((v) => checked.has(v))) : checked;
        onApply(result.size === values.length ? null : result);
    };

    const item = 'w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg';

    return (
        <>
            <div className="fixed inset-0 z-[60]" onMouseDown={onClose} />
            <div className="fixed z-[61] w-64 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl space-y-1" style={{ left: Math.max(8, x), top: y }}>
                <div className="px-3 pt-1 text-[10px] font-black uppercase tracking-wider text-zinc-400 truncate">{column.label}</div>
                <button type="button" onClick={() => onSort('asc')} className={`${item} ${sortDir === 'asc' ? 'font-black text-sky-700' : ''}`}>
                    <ArrowUpDown className="w-3.5 h-3.5" /> {column.type === 'number' ? 'Ordenar de menor a mayor' : 'Ordenar A → Z'}
                </button>
                <button type="button" onClick={() => onSort('desc')} className={`${item} ${sortDir === 'desc' ? 'font-black text-sky-700' : ''}`}>
                    <ArrowUpDown className="w-3.5 h-3.5" /> {column.type === 'number' ? 'Ordenar de mayor a menor' : 'Ordenar Z → A'}
                </button>
                {sortDir && <button type="button" onClick={() => onSort(null)} className={`${item} text-zinc-500`}>Quitar orden</button>}

                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 px-1">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <Search className="w-3.5 h-3.5 text-zinc-400" />
                        <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }} placeholder="Buscar" className="flex-1 min-w-0 bg-transparent outline-none text-xs text-zinc-900 dark:text-zinc-100" />
                    </div>
                </div>
                <div className="max-h-56 overflow-y-auto px-1">
                    <label className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer">
                        <input type="checkbox" checked={allShownChecked} onChange={toggleShown} /> (Seleccionar todo)
                    </label>
                    {shown.map(([v, count]) => (
                        <label key={v} className="flex items-center gap-2 px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
                            <input type="checkbox" checked={checked.has(v)} onChange={() => toggle(v)} />
                            <span className={`flex-1 truncate ${v === EMPTY ? 'italic text-zinc-400' : ''}`}>{v}</span>
                            <span className="text-[10px] text-zinc-400">{count}</span>
                        </label>
                    ))}
                </div>
                <div className="flex justify-end gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                    <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
                    <button type="button" onClick={apply} disabled={!checked.size} className="px-3 py-1.5 rounded-lg text-xs font-black bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-40">Aceptar</button>
                </div>
            </div>
        </>
    );
}
