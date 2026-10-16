import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, Users, AlertCircle, CheckCircle2, X, FileSpreadsheet, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { apiFetch } from '../api';
import { normalizePhone, cleanGuestName } from './ExcelUploadModal';
import SpreadsheetGrid from './SpreadsheetGrid';
import { SHEET_COLUMNS as COLUMNS, validateSheet, sheetRowToImport, isFilledRow, sheetPeople, downloadSheet, emptySheetRow, sheetRowsFromFile, autoFixSheet, companionCellHint } from '../guestSheet';

export default function AiListAssistant({ event, showToast, onImported }) {
    const [file, setFile] = useState(null);
    const [grid, setGrid] = useState(() => Array.from({ length: 12 }, emptySheetRow));
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState(null);
    const [fixReport, setFixReport] = useState(null);
    const [showAllSuggestions, setShowAllSuggestions] = useState(false);
    const gridInputRef = useRef(null);

    // Problems of each row, checked live while editing
    const rowErrors = useMemo(() => (grid ? validateSheet(grid) : {}), [grid]);
    // What the automatic corrections would do right now (suggested on top of the spreadsheet)
    const suggestion = useMemo(() => (grid ? autoFixSheet(grid) : null), [grid]);

    const applyAutoFix = () => {
        const result = autoFixSheet(grid);
        setGrid(result.rows);
        setFixReport({ changes: result.changes, pending: result.pending });
        setShowAllSuggestions(false);
    };

    if (!event) {
        return <div className="p-12 text-center text-xs text-zinc-500">Seleccioná un evento para usar la planilla de invitados.</div>;
    }

    const filledRows = (grid || []).filter(isFilledRow);
    const people = sheetPeople(grid);
    const errorCount = Object.keys(rowErrors).length;
    const canImport = filledRows.length > 0 && errorCount === 0;

    // Read an uploaded Excel directly into the spreadsheet
    const readFile = (uploaded) => {
        setError(null);
        setFile(uploaded);
        setFixReport(null);
        setShowAllSuggestions(false);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const buffer = e.target.result;
                let wb;
                if (/\.(csv|txt)$/i.test(uploaded.name)) {
                    let text;
                    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { text = new TextDecoder('windows-1252').decode(buffer); }
                    wb = XLSX.read(text.replace(/^﻿/, ''), { type: 'string' });
                } else {
                    wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
                }
                const ws = wb.Sheets[wb.SheetNames[0]];
                const all = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true, raw: false });
                const start = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).s.r : 0;
                const score = (r) => (r || []).filter((c) => /nombre|invitad|tel[eé]f|celular|whatsapp|mesa|acompa|cantidad|total|personas/i.test(String(c))).length;
                let headerIdx = 0;
                all.slice(0, 10).forEach((r, i) => { if (score(r) > score(all[headerIdx])) headerIdx = i; });
                const headers = (all[headerIdx] || []).map((h) => String(h || '').trim());
                const rows = all.slice(headerIdx + 1)
                    .map((cells, i) => ({ row: start + headerIdx + i + 2, cells: cells.map((c) => String(c ?? '').trim()) }))
                    .filter((r) => r.cells.some((c) => c !== ''));
                if (!rows.length) {
                    setError('El archivo no tiene filas con datos.');
                    return;
                }
                const fromFile = sheetRowsFromFile(headers, rows);
                const kept = (grid || []).filter(isFilledRow);
                // Something already typed: replace it, or add the file's rows after it
                const replace = !kept.length || window.confirm(`¿Reemplazar las ${kept.length} filas de la planilla por las del Excel?\n\nAceptar = reemplazar · Cancelar = agregar las filas del Excel al final`);
                setGrid(replace ? fromFile : [...kept, ...fromFile]);
            } catch (err) {
                console.error(err);
                setError('No se pudo leer el archivo. Subí un .xlsx, .xls o .csv.');
            }
        };
        reader.readAsArrayBuffer(uploaded);
    };

    const importList = async () => {
        if (!canImport || importing) return;
        if (!window.confirm(`¿Importar ${filledRows.length} invitaciones (${people} personas) a ${event.couple_names || event.title}?`)) return;
        setImporting(true);
        const { ok, json } = await apiFetch(`/api/events/${event.id}/guests/import`, {
            method: 'POST',
            body: JSON.stringify({
                guests: filledRows.map((row) => sheetRowToImport(row, cleanGuestName)),
            }),
        });
        setImporting(false);
        showToast && showToast(json?.message || (ok ? 'Lista importada.' : 'No se pudo importar la lista.'));
        if (ok) onImported && onImported();
    };

    const download = () => {
        downloadSheet(grid, `${(file?.name || 'Lista de invitados').replace(/\.[^.]+$/, '')} - formato del sistema.xlsx`, normalizePhone);
    };

    const reset = () => {
        if (filledRows.length > 0 && !window.confirm('¿Limpiar la planilla para empezar de nuevo? Se perderán las filas que no hayas importado.')) {
            return;
        }
        setFile(null);
        setGrid(Array.from({ length: 12 }, emptySheetRow));
        setError(null);
        setFixReport(null);
        setShowAllSuggestions(false);
    };

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Planilla de invitados
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        La lista de <strong>{event.couple_names || event.title}</strong> en el formato del sistema: pegá filas desde Excel (Ctrl+V) o subí un archivo. Corregí directamente en la planilla y luego importá.
                    </p>
                </div>
                {filledRows.length > 0 && (
                    <button onClick={reset} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" /> Limpiar planilla
                    </button>
                )}
            </div>

            {error && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
            )}

            {/* The spreadsheet: full width */}
            <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">{filledRows.length} invitaciones</span>
                        <span className="px-2.5 py-1 rounded-lg bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300">{people} personas</span>
                        {errorCount > 0 && <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300">{errorCount} filas con errores (en rojo)</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => gridInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold shadow-sm transition-colors"
                            title="Cargar un Excel en esta planilla (.xlsx, .xls, .csv)"
                        >
                            <Upload className="w-3.5 h-3.5" /> Subir Excel
                        </button>
                        <input
                            ref={gridInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={(e) => { if (e.target.files?.[0]) readFile(e.target.files[0]); e.target.value = ''; }}
                        />
                        <button onClick={download} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm transition-colors">
                            <Download className="w-3.5 h-3.5" /> Descargar en este formato
                        </button>
                    </div>
                </div>

                {/* Companions in their own rows, same phone twice: suggested fix */}
                {suggestion?.changes.length > 0 && (
                    <div className="p-4 rounded-2xl border border-sky-200 dark:border-sky-900/50 bg-sky-50/70 dark:bg-sky-950/20 flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="text-xs text-sky-900 dark:text-sky-200 space-y-1 flex-1 min-w-0">
                            <div className="font-black">Detectamos {suggestion.changes.length} {suggestion.changes.length === 1 ? 'corrección' : 'correcciones'} que se pueden aplicar solas:</div>
                            <div className={showAllSuggestions ? "max-h-48 overflow-y-auto space-y-0.5 pr-2" : "space-y-0.5"}>
                                {(showAllSuggestions ? suggestion.changes : suggestion.changes.slice(0, 4)).map((c, i) => <div key={i}>• {c}</div>)}
                            </div>
                            {suggestion.changes.length > 4 && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllSuggestions((v) => !v)}
                                    className="text-sky-700 dark:text-sky-300 font-bold hover:underline cursor-pointer inline-flex items-center gap-1 pt-0.5 text-xs"
                                >
                                    {showAllSuggestions ? (
                                        <>
                                            <ChevronUp className="w-3.5 h-3.5" /> Ver menos
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="w-3.5 h-3.5" /> … y {suggestion.changes.length - 4} más (ver todas)
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                        <button onClick={applyAutoFix} className="shrink-0 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black shadow-sm transition-colors">
                            Unir acompañantes y duplicados
                        </button>
                    </div>
                )}

                {fixReport && (
                    <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 text-xs space-y-1 relative">
                        <button onClick={() => setFixReport(null)} className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
                        <div className="font-black text-emerald-800 dark:text-emerald-300">✅ {fixReport.changes.length} {fixReport.changes.length === 1 ? 'corrección aplicada' : 'correcciones aplicadas'}</div>
                        <div className="max-h-28 overflow-y-auto text-emerald-900 dark:text-emerald-200">
                            {fixReport.changes.map((c, i) => <div key={i}>• {c}</div>)}
                        </div>
                        {fixReport.pending.length > 0 && (
                            <div className="pt-2 text-amber-800 dark:text-amber-300">
                                <div className="font-black">Para decidir vos ({fixReport.pending.length}):</div>
                                {fixReport.pending.map((c, i) => <div key={i}>• {c}</div>)}
                            </div>
                        )}
                    </div>
                )}

                <SpreadsheetGrid
                    columns={COLUMNS}
                    rows={grid}
                    onChange={setGrid}
                    errors={rowErrors}
                    rowLabels={grid.map((r, i) => r._row ?? (i + 1))}
                    cellHint={companionCellHint(grid, setGrid)}
                />

                <p className="text-[11px] text-zinc-500">
                    <strong>Total Personas</strong> incluye al titular (un 2 = el invitado + 1 acompañante). <strong>Acompañantes Niños</strong> son los niños dentro de ese total. Los nombres de acompañantes y los otros teléfonos van separados por coma. Pasá el mouse sobre una fila en rojo para ver qué tiene mal. Podés arrastrar el borde derecho de cualquier columna para cambiar su ancho.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                        {canImport
                            ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> La lista cuadra. Revisala y tocá Importar.</>
                            : errorCount > 0
                                ? `Corregí las ${errorCount} filas en rojo para poder importar.`
                                : 'Completá al menos una invitación.'}
                    </span>
                    <button
                        onClick={importList}
                        disabled={!canImport || importing}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-50 transition-colors shadow-sm"
                    >
                        <Users className="w-4 h-4" /> {importing ? 'Importando...' : `Importar ${filledRows.length} invitaciones`}
                    </button>
                </div>
            </div>
        </div>
    );
}
