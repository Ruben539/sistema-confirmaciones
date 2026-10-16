import React, { useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';

/**
 * Spreadsheet-like grid in the browser: one input per cell, row numbers, add / delete rows and pasting a
 * block copied from Excel (tab separated) starting at the focused cell. Rows with a problem show it on hover
 * and their wrong cells in red.
 *
 * columns: [{ key, label, width, type?: 'text'|'number'|'select', options? }]
 * rows:    [{ [key]: string }]
 * errors:  { [rowIndex]: { [key]: message } }  (a '_row' key marks the whole row)
 * readOnly: shows the cells as text (a preview of what will be saved)
 * rowLabels: optional label per row instead of the row number (e.g. the Excel rows it comes from)
 */
export default function SpreadsheetGrid({ columns, rows, onChange, errors = {}, readOnly = false, rowLabels = null }) {
    const tableRef = useRef(null);

    const emptyRow = () => Object.fromEntries(columns.map((c) => [c.key, c.type === 'select' ? c.options[0] : '']));

    const setCell = (r, key, value) => {
        const next = rows.map((row) => ({ ...row }));
        next[r][key] = value;
        onChange(next);
    };

    const focusCell = (r, c) => {
        const el = tableRef.current?.querySelector(`[data-cell="${r}-${c}"]`);
        if (el) el.focus();
    };

    // A block copied from Excel: rows by line, cells by tab, filling from the focused cell (adds rows if needed)
    const handlePaste = (e, r, c) => {
        const text = e.clipboardData.getData('text/plain');
        if (!text.includes('\t') && !text.includes('\n')) return;
        e.preventDefault();
        const lines = text.replace(/\r/g, '').split('\n').filter((l, i, all) => l !== '' || i < all.length - 1);
        const next = rows.map((row) => ({ ...row }));
        lines.forEach((line, i) => {
            const target = r + i;
            while (next.length <= target) next.push(emptyRow());
            line.split('\t').forEach((value, j) => {
                const col = columns[c + j];
                if (col) next[target][col.key] = value.trim();
            });
        });
        onChange(next);
    };

    const handleKey = (e, r, c) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (r === rows.length - 1) onChange([...rows, emptyRow()]);
            setTimeout(() => focusCell(r + 1, c), 0);
        } else if (e.key === 'ArrowDown' && e.target.tagName !== 'SELECT') {
            e.preventDefault();
            focusCell(Math.min(rows.length - 1, r + 1), c);
        } else if (e.key === 'ArrowUp' && e.target.tagName !== 'SELECT') {
            e.preventDefault();
            focusCell(Math.max(0, r - 1), c);
        }
    };

    return (
        <div className="overflow-auto border border-zinc-300 dark:border-zinc-700 rounded-xl max-h-[60vh] bg-white dark:bg-zinc-900">
            <table ref={tableRef} className="border-collapse text-xs" style={{ minWidth: columns.reduce((a, c) => a + (c.width || 140), 90) }}>
                <thead className="sticky top-0 z-10">
                    <tr>
                        <th className="w-10 bg-[#e8eaed] dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700" />
                        {columns.map((c, i) => (
                            <th key={c.key} style={{ width: c.width || 140 }} className="bg-[#e8eaed] dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-left">
                                <div className="text-[10px] text-zinc-400 font-mono">{String.fromCharCode(65 + i)}</div>
                                <div className="font-bold text-zinc-700 dark:text-zinc-200 whitespace-nowrap">{c.label}</div>
                            </th>
                        ))}
                        {!readOnly && <th className="w-8 bg-[#e8eaed] dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700" />}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, r) => {
                        const rowErrors = errors[r] || {};
                        const hasError = Object.keys(rowErrors).length > 0;
                        return (
                            <tr key={r} title={hasError ? Object.values(rowErrors).join(' · ') : ''}>
                                <td className={`text-center font-mono text-[10px] border border-zinc-300 dark:border-zinc-700 px-1 ${hasError ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50' : 'bg-[#f1f3f4] text-zinc-500 dark:bg-zinc-800'}`}>{rowLabels ? rowLabels[r] : r + 2}</td>
                                {columns.map((c, ci) => {
                                    const bad = rowErrors[c.key];
                                    if (readOnly) {
                                        return (
                                            <td key={c.key} title={bad || String(row[c.key] ?? '')} className={`px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 whitespace-nowrap overflow-hidden text-ellipsis ${c.type === 'number' ? 'text-right' : ''} ${bad || rowErrors._row ? 'bg-rose-50 dark:bg-rose-950/30' : ''}`} style={{ maxWidth: c.width || 140 }}>
                                                {row[c.key] ?? ''}
                                            </td>
                                        );
                                    }
                                    const cls = `w-full h-full px-2 py-1.5 bg-transparent outline-none focus:bg-sky-50 dark:focus:bg-sky-950/40 focus:ring-2 focus:ring-inset focus:ring-sky-500 text-zinc-900 dark:text-zinc-100 ${c.type === 'number' ? 'text-right' : ''}`;
                                    return (
                                        <td key={c.key} className={`p-0 border border-zinc-300 dark:border-zinc-700 ${bad ? 'bg-rose-50 dark:bg-rose-950/30' : ''}`} title={bad || ''}>
                                            {c.type === 'select' ? (
                                                <select data-cell={`${r}-${ci}`} value={row[c.key] || c.options[0]} onChange={(e) => setCell(r, c.key, e.target.value)} onKeyDown={(e) => handleKey(e, r, ci)} className={cls}>
                                                    {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            ) : (
                                                <input
                                                    data-cell={`${r}-${ci}`}
                                                    value={row[c.key] ?? ''}
                                                    inputMode={c.type === 'number' ? 'numeric' : undefined}
                                                    onChange={(e) => setCell(r, c.key, e.target.value)}
                                                    onPaste={(e) => handlePaste(e, r, ci)}
                                                    onKeyDown={(e) => handleKey(e, r, ci)}
                                                    className={cls}
                                                />
                                            )}
                                        </td>
                                    );
                                })}
                                {!readOnly && (
                                    <td className="border border-zinc-300 dark:border-zinc-700 text-center">
                                        <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== r))} title="Eliminar fila" className="p-1 text-zinc-400 hover:text-rose-600">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {!readOnly && <button type="button" onClick={() => onChange([...rows, emptyRow()])} className="m-2 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/30">
                <Plus className="w-3.5 h-3.5" /> Agregar fila
            </button>}
        </div>
    );
}
