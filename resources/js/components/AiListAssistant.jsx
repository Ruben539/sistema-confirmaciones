import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Sparkles, Upload, Send, Download, Users, AlertCircle, CheckCircle2, X, FileSpreadsheet } from 'lucide-react';
import { apiFetch } from '../api';
import { normalizePhone, cleanGuestName } from './ExcelUploadModal';
import SpreadsheetGrid from './SpreadsheetGrid';
import { SHEET_COLUMNS as COLUMNS, splitList, toInt, validateSheet, sheetRowToImport, isFilledRow, sheetPeople, downloadSheet, emptySheetRow, sheetRowsFromFile, autoFixSheet, companionCellHint } from '../guestSheet';

// AI proposal <-> spreadsheet rows
const fromInvitation = (g) => ({
    name: g.name || '',
    phone: g.phone || '',
    other_phones: (g.other_phones || []).join(', '),
    table: g.table || '',
    category: 'Adulto',
    total: String(Math.max(1, g.total_people || 1)),
    children: String(g.children || 0),
    companions: (g.companions || []).map((c) => c.name).join(', '),
    dietary: g.dietary || '',
    notes: g.notes || '',
});
const toInvitation = (row) => ({
    name: cleanGuestName(row.name),
    phone: row.phone,
    other_phones: splitList(row.other_phones),
    total_people: Math.max(1, toInt(row.total, 1)),
    children: toInt(row.children, 0),
    companions: splitList(row.companions).map((name) => ({ name, category: 'adult' })),
    table: row.table || '',
    dietary: row.dietary || '',
    notes: row.notes || '',
    source_rows: [],
});

/**
 * "Asistente de listas (IA)": the list as the system expects it, in a spreadsheet in the browser. It can be
 * filled by the AI from any Excel, pasted from Excel, or typed. Each problem is marked on its row; the AI
 * also corrects it from a written instruction ("Nicole va con Oso"). Imports when nothing is wrong.
 */
export default function AiListAssistant({ event, showToast, onImported }) {
    const [file, setFile] = useState(null);
    const [sheet, setSheet] = useState(null); // the uploaded Excel as it came: { headers, rows }
    const [grid, setGrid] = useState(null); // the list as the system expects it
    const [observations, setObservations] = useState([]);
    const [reviewed, setReviewed] = useState(false);
    const [chat, setChat] = useState([]);
    const [instruction, setInstruction] = useState('');
    const [working, setWorking] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);
    // "Subir Excel" from the spreadsheet itself: the file goes straight into it
    const gridInputRef = useRef(null);

    // Problems of each row, checked live while editing
    const rowErrors = useMemo(() => (grid ? validateSheet(grid) : {}), [grid]);
    // What the automatic corrections would do right now (suggested on top of the spreadsheet)
    const suggestion = useMemo(() => (grid ? autoFixSheet(grid) : null), [grid]);
    const [fixReport, setFixReport] = useState(null);
    const applyAutoFix = () => {
        const result = autoFixSheet(grid);
        setGrid(result.rows);
        setFixReport({ changes: result.changes, pending: result.pending });
    };

    if (!event) {
        return <div className="p-12 text-center text-xs text-zinc-500">Seleccioná un evento para usar el asistente.</div>;
    }

    const filledRows = (grid || []).filter(isFilledRow);
    const people = sheetPeople(grid);
    const errorCount = Object.keys(rowErrors).length;
    const pendingObservations = reviewed ? 0 : observations.length;
    const canImport = filledRows.length > 0 && errorCount === 0 && pendingObservations === 0;

    // Read the Excel as it came (Windows / UTF-8 CSV, title rows above the headers)
    const readFile = (uploaded, intoGrid = false) => {
        setError(null);
        setFile(uploaded);
        if (!intoGrid) setGrid(null);
        setObservations([]);
        setChat([]);
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
                setSheet({ headers, rows });
                if (intoGrid) {
                    const fromFile = sheetRowsFromFile(headers, rows);
                    const kept = (grid || []).filter(isFilledRow);
                    // Something already typed: replace it, or add the file's rows after it
                    const replace = !kept.length || window.confirm(`¿Reemplazar las ${kept.length} filas de la planilla por las del Excel?\n\nAceptar = reemplazar · Cancelar = agregar las filas del Excel al final`);
                    setGrid(replace ? fromFile : [...kept, ...fromFile]);
                }
            } catch (err) {
                console.error(err);
                setError('No se pudo leer el archivo. Subí un .xlsx, .xls o .csv.');
            }
        };
        reader.readAsArrayBuffer(uploaded);
    };

    // The AI reads the original Excel (and, for a correction, the current spreadsheet)
    const ask = async (text = null) => {
        if (working) return;
        const source = sheet || { headers: COLUMNS.map((c) => c.label), rows: filledRows.map((row, i) => ({ row: i + 2, cells: COLUMNS.map((c) => row[c.key] || '') })) };
        if (!source.rows.length) return;
        setWorking(true);
        setError(null);
        if (text) setChat((prev) => [...prev, { from: 'user', text }]);
        const current = grid ? { invitations: filledRows.map(toInvitation), observations, summary: '' } : null;
        const { ok, json } = await apiFetch(`/api/events/${event.id}/ai-list/analyze`, {
            method: 'POST',
            body: JSON.stringify({
                headers: source.headers,
                rows: source.rows,
                ...(text && current ? { instruction: text, proposal: current } : {}),
            }),
        });
        setWorking(false);
        if (ok && json?.invitations) {
            setGrid(json.invitations.map(fromInvitation));
            setObservations(json.observations || []);
            setReviewed(false);
            setChat((prev) => [...prev, { from: 'ai', text: json.summary || 'Listo.' }]);
            setInstruction('');
        } else {
            const message = json?.message || 'El asistente no pudo procesar la lista.';
            setError(message);
            if (text) setChat((prev) => [...prev, { from: 'ai', text: `⚠️ ${message}` }]);
        }
    };

    const startBlank = () => {
        setFile(null);
        setSheet(null);
        setObservations([]);
        setChat([]);
        setError(null);
        setGrid(Array.from({ length: 10 }, emptySheetRow));
    };

    // Same payload as the usual Excel import (counts, named companions, other numbers)
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
        setFile(null);
        setSheet(null);
        setGrid(null);
        setObservations([]);
        setChat([]);
        setError(null);
    };

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-violet-500" /> Asistente de listas (IA)
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        La lista de <strong>{event.couple_names || event.title}</strong> tal como la espera el sistema: subí el Excel en cualquier formato y la IA la arma, o pegala desde Excel. Corregís en la planilla o escribiéndole al asistente, y recién ahí importás.
                    </p>
                </div>
                {(file || grid) && (
                    <button onClick={reset} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                        <X className="w-4 h-4" /> Empezar de nuevo
                    </button>
                )}
            </div>

            {error && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
            )}

            {/* 1. Start: an Excel for the AI, or the blank spreadsheet */}
            {!sheet && !grid && (
                <div className="grid md:grid-cols-2 gap-4">
                    <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) readFile(f); }}
                        onClick={() => inputRef.current?.click()}
                        className="cursor-pointer p-10 rounded-3xl border-2 border-dashed border-violet-300 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/10 text-center space-y-2 hover:bg-violet-50 dark:hover:bg-violet-950/20"
                    >
                        <Upload className="w-10 h-10 mx-auto text-violet-500" />
                        <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Subir un Excel y que la IA lo arme</div>
                        <div className="text-xs text-zinc-500">.xlsx, .xls o .csv · cualquier formato · hasta 600 filas</div>
                        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
                    </div>
                    <button
                        onClick={startBlank}
                        className="p-10 rounded-3xl border-2 border-dashed border-sky-300 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/10 text-center space-y-2 hover:bg-sky-50 dark:hover:bg-sky-950/20"
                    >
                        <FileSpreadsheet className="w-10 h-10 mx-auto text-sky-500" />
                        <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Completar la planilla (o pegar desde Excel)</div>
                        <div className="text-xs text-zinc-500">Ves exactamente las columnas que espera el sistema. Copiá las filas en Excel y pegalas en la primera celda.</div>
                    </button>
                </div>
            )}

            {/* 2. Analyze the uploaded Excel */}
            {sheet && !grid && (
                <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center space-y-3">
                    <FileSpreadsheet className="w-9 h-9 mx-auto text-emerald-600" />
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">{file?.name}</div>
                    <div className="text-xs text-zinc-500">{sheet.rows.length} filas · columnas: {sheet.headers.filter(Boolean).join(', ')}</div>
                    <div className="flex flex-col sm:flex-row justify-center gap-3">
                        <button
                            onClick={() => { setGrid(sheetRowsFromFile(sheet.headers, sheet.rows)); setObservations([]); }}
                            disabled={working}
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-black shadow-lg disabled:opacity-60"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Abrir en la planilla para editar
                        </button>
                        <button
                            onClick={() => ask()}
                            disabled={working}
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white text-sm font-black shadow-lg disabled:opacity-60"
                        >
                            <Sparkles className="w-4 h-4" /> {working ? 'Analizando la lista… (puede tardar hasta un minuto)' : 'Armar la lista con IA'}
                        </button>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                        <strong>Planilla:</strong> cada fila del Excel pasa a las columnas del sistema y la corregís a mano (sin costo). <strong>IA:</strong> además une acompañantes, parejas y teléfonos repetidos y te marca lo que no cuadra.
                    </p>
                </div>
            )}

            {/* 3. The spreadsheet as the system expects it + the assistant */}
            {grid && (
                <div className="grid grid-cols-1 2xl:grid-cols-4 gap-4">
                    <div className="2xl:col-span-3 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-2 text-xs font-bold">
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">{filledRows.length} invitaciones</span>
                                <span className="px-2.5 py-1 rounded-lg bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300">{people} personas</span>
                                {errorCount > 0 && <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300">{errorCount} filas con errores (en rojo)</span>}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => gridInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold"
                                    title="Cargar un Excel en esta planilla (cualquier formato)"
                                >
                                    <Upload className="w-3.5 h-3.5" /> Subir Excel
                                </button>
                                <input
                                    ref={gridInputRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={(e) => { if (e.target.files?.[0]) readFile(e.target.files[0], true); e.target.value = ''; }}
                                />
                                {sheet && (
                                    <button
                                        onClick={() => ask('Revisá esta planilla: uní acompañantes, parejas con dos teléfonos y teléfonos repetidos, y marcá lo que no cuadra.')}
                                        disabled={working || !filledRows.length}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-[11px] font-bold disabled:opacity-50"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" /> {working ? 'Revisando…' : 'Revisar con IA'}
                                    </button>
                                )}
                                <button onClick={download} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold">
                                    <Download className="w-3.5 h-3.5" /> Descargar en este formato
                                </button>
                            </div>
                        </div>

                        {/* Companions in their own rows, same phone twice, couples with two phones: suggested fix */}
                        {suggestion?.changes.length > 0 && (
                            <div className="p-4 rounded-2xl border border-sky-200 dark:border-sky-900/50 bg-sky-50/70 dark:bg-sky-950/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="text-xs text-sky-900 dark:text-sky-200 space-y-0.5">
                                    <div className="font-black">Detectamos {suggestion.changes.length} {suggestion.changes.length === 1 ? 'corrección' : 'correcciones'} que se pueden aplicar solas:</div>
                                    {suggestion.changes.slice(0, 4).map((c, i) => <div key={i}>• {c}</div>)}
                                    {suggestion.changes.length > 4 && <div className="text-sky-700/80">… y {suggestion.changes.length - 4} más</div>}
                                </div>
                                <button onClick={applyAutoFix} className="shrink-0 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black">
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
                            rowLabels={grid.map((r, i) => r._row ?? (sheet ? `+${i + 1}` : i + 2))}
                            cellHint={companionCellHint(grid, setGrid)}
                        />

                        <p className="text-[11px] text-zinc-500">
                            <strong>Total Personas</strong> incluye al titular (un 2 = el invitado + 1 acompañante). <strong>Acompañantes Niños</strong> son los niños dentro de ese total. Los nombres de acompañantes y los otros teléfonos van separados por coma. Pasá el mouse sobre una fila en rojo para ver qué tiene mal.
                        </p>

                        {observations.length > 0 && (
                            <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 space-y-2">
                                <div className="text-xs font-black text-amber-800 dark:text-amber-300">Observaciones del asistente ({observations.length})</div>
                                {observations.map((o, i) => (
                                    <div key={i} className="text-xs text-zinc-700 dark:text-zinc-300">
                                        <span className="font-mono text-zinc-400 mr-2">Fila {(o.rows || []).join(', ') || '—'}</span>{o.message}
                                    </div>
                                ))}
                                <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 pt-1 cursor-pointer">
                                    <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
                                    Ya las revisé y corregí en la planilla
                                </label>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                            <span className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                                {canImport
                                    ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> La lista cuadra. Revisala y tocá Importar.</>
                                    : errorCount > 0
                                        ? `Corregí las ${errorCount} filas en rojo para poder importar.`
                                        : pendingObservations > 0 ? 'Revisá las observaciones del asistente para poder importar.' : 'Completá al menos una invitación.'}
                            </span>
                            <button
                                onClick={importList}
                                disabled={!canImport || importing}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-50"
                            >
                                <Users className="w-4 h-4" /> {importing ? 'Importando...' : `Importar ${filledRows.length} invitaciones`}
                            </button>
                        </div>
                    </div>

                    {/* Correct with the assistant */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl flex flex-col min-h-[360px]">
                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-violet-500" /> Corregir con el asistente
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[55vh]">
                            {chat.map((m, i) => (
                                <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap ${m.from === 'user' ? 'bg-violet-600 text-white rounded-tr-sm' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-sm'}`}>
                                        {m.text}
                                    </div>
                                </div>
                            ))}
                            {working && <div className="text-xs text-zinc-500 italic">El asistente está revisando la lista…</div>}
                            {!chat.length && (
                                <p className="text-xs text-zinc-500">Ejemplos: «Nicole Gallardo va con Oso, son 2», «Ariana Coronel está repetida», «separá los nombres de acompañantes de la columna Notas».</p>
                            )}
                        </div>
                        <form
                            onSubmit={(e) => { e.preventDefault(); if (instruction.trim()) ask(instruction.trim()); }}
                            className="p-3 border-t border-zinc-100 dark:border-zinc-800 flex items-end gap-2"
                        >
                            <textarea
                                rows={2}
                                value={instruction}
                                onChange={(e) => setInstruction(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (instruction.trim()) ask(instruction.trim()); } }}
                                maxLength={1000}
                                placeholder="Decile qué corregir…"
                                className="flex-1 resize-none text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 outline-none"
                            />
                            <button disabled={working || !instruction.trim() || !filledRows.length} className="h-10 w-10 rounded-xl bg-violet-600 text-white flex items-center justify-center disabled:opacity-50">
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
