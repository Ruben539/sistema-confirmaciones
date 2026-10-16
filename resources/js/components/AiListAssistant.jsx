import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Sparkles, Upload, Send, Download, Users, AlertCircle, CheckCircle2, X, FileSpreadsheet } from 'lucide-react';
import { apiFetch } from '../api';
import { normalizePhone } from './ExcelUploadModal';

/**
 * "Asistente de listas (IA)": upload the guest list in any format, Claude proposes how it ends up (one
 * invitation per phone, total people, named companions, other numbers) and what doesn't add up. The planner
 * corrects it by writing ("Nicole va con Oso", "Ariana está repetida") and imports when nothing is pending.
 */
export default function AiListAssistant({ event, showToast, onImported }) {
    const [file, setFile] = useState(null);
    const [sheet, setSheet] = useState(null); // { headers, rows: [{ row, cells }] }
    const [proposal, setProposal] = useState(null);
    const [chat, setChat] = useState([]); // [{ from: 'user'|'ai', text }]
    const [instruction, setInstruction] = useState('');
    const [working, setWorking] = useState(false);
    const [importing, setImporting] = useState(false);
    const [tab, setTab] = useState('result');
    const [error, setError] = useState(null);
    const inputRef = useRef(null);

    if (!event) {
        return <div className="p-12 text-center text-xs text-zinc-500">Seleccioná un evento para usar el asistente.</div>;
    }

    // Read the file as it came: Windows / UTF-8 CSV, header row after a title, empty rows skipped
    const readFile = (uploaded) => {
        setError(null);
        setFile(uploaded);
        setProposal(null);
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
            } catch (err) {
                console.error(err);
                setError('No se pudo leer el archivo. Subí un .xlsx, .xls o .csv.');
            }
        };
        reader.readAsArrayBuffer(uploaded);
    };

    const ask = async (text = null) => {
        if (!sheet || working) return;
        setWorking(true);
        setError(null);
        if (text) setChat((prev) => [...prev, { from: 'user', text }]);
        const { ok, json } = await apiFetch(`/api/events/${event.id}/ai-list/analyze`, {
            method: 'POST',
            body: JSON.stringify({
                headers: sheet.headers,
                rows: sheet.rows,
                ...(text && proposal ? { instruction: text, proposal } : {}),
            }),
        });
        setWorking(false);
        if (ok && json?.invitations) {
            setProposal(json);
            setChat((prev) => [...prev, { from: 'ai', text: json.summary || 'Listo.' }]);
            setInstruction('');
            setTab(json.observations?.length ? 'issues' : 'result');
        } else {
            const message = json?.message || 'El asistente no pudo procesar la lista.';
            setError(message);
            if (text) setChat((prev) => [...prev, { from: 'ai', text: `⚠️ ${message}` }]);
        }
    };

    const invitations = proposal?.invitations || [];
    const observations = proposal?.observations || [];
    const people = invitations.reduce((acc, g) => acc + Math.max(1, g.total_people || 1), 0);
    const missingPhone = invitations.filter((g) => String(g.phone || '').replace(/[^\d]/g, '').length < 6);
    const blockers = observations.length + missingPhone.length;

    // Same payload as the usual Excel import (counts, named companions, other numbers)
    const importList = async () => {
        if (blockers > 0 || importing) return;
        if (!window.confirm(`¿Importar ${invitations.length} invitaciones (${people} personas) a ${event.couple_names || event.title}?`)) return;
        setImporting(true);
        const { ok, json } = await apiFetch(`/api/events/${event.id}/guests/import`, {
            method: 'POST',
            body: JSON.stringify({
                guests: invitations.map((g) => {
                    const total = Math.max(1, g.total_people || 1);
                    const children = Math.max(0, Math.min(total - 1, g.children || 0));
                    return {
                        name: g.name,
                        phone: g.phone,
                        table_number: g.table || '',
                        category: null,
                        companion_adults: Math.max(0, total - 1 - children),
                        companion_children: children,
                        companions: (g.companions || []).map((c) => c.name).join(', ').slice(0, 255),
                        members: (g.companions || []).slice(0, total - 1),
                        alt_phones: (g.other_phones || []).filter(Boolean),
                        dietary_restrictions: g.dietary || '',
                        notes: g.notes || '',
                    };
                }),
            }),
        });
        setImporting(false);
        showToast && showToast(json?.message || (ok ? 'Lista importada.' : 'No se pudo importar la lista.'));
        if (ok) onImported && onImported();
    };

    const downloadCorrected = () => {
        const rows = invitations.map((g) => ({
            'Nombre Completo': g.name,
            'Teléfono (WhatsApp)': normalizePhone(g.phone),
            'Otros Teléfonos': (g.other_phones || []).map(normalizePhone).join(', '),
            'Número de Mesa': g.table || '',
            'Tipo de Invitado': 'Adulto',
            'Total Personas': Math.max(1, g.total_people || 1),
            'Acompañantes Niños': g.children || 0,
            'Nombres Acompañantes': (g.companions || []).map((c) => c.name).join(', '),
            'Restricción Alimentaria': g.dietary || '',
            'Familia / Notas': g.notes || '',
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [30, 18, 18, 16, 14, 14, 18, 40, 24, 24].map((wch) => ({ wch }));
        XLSX.utils.book_append_sheet(wb, ws, 'Invitados');
        if (observations.length) {
            const rev = XLSX.utils.json_to_sheet(observations.map((o) => ({ Filas: (o.rows || []).join(', '), Observación: o.message })));
            rev['!cols'] = [{ wch: 14 }, { wch: 90 }];
            XLSX.utils.book_append_sheet(wb, rev, 'Para revisar');
        }
        XLSX.writeFile(wb, `${(file?.name || 'Lista').replace(/\.[^.]+$/, '')} - revisada con IA.xlsx`);
    };

    const reset = () => {
        setFile(null);
        setSheet(null);
        setProposal(null);
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
                        Subí la lista de <strong>{event.couple_names || event.title}</strong> en cualquier formato: la IA arma las invitaciones (titular, total de personas, acompañantes, otros números) y te marca lo que no cuadra. Corregís escribiéndole y recién ahí importás.
                    </p>
                </div>
                {file && (
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

            {/* 1. Upload */}
            {!sheet && (
                <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) readFile(f); }}
                    onClick={() => inputRef.current?.click()}
                    className="cursor-pointer p-12 rounded-3xl border-2 border-dashed border-violet-300 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/10 text-center space-y-2 hover:bg-violet-50 dark:hover:bg-violet-950/20"
                >
                    <Upload className="w-10 h-10 mx-auto text-violet-500" />
                    <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Arrastrá la lista acá o tocá para elegirla</div>
                    <div className="text-xs text-zinc-500">.xlsx, .xls o .csv · cualquier orden de columnas · hasta 600 filas</div>
                    <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
                </div>
            )}

            {/* 2. Analyze */}
            {sheet && !proposal && (
                <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center space-y-3">
                    <FileSpreadsheet className="w-9 h-9 mx-auto text-emerald-600" />
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">{file?.name}</div>
                    <div className="text-xs text-zinc-500">{sheet.rows.length} filas · columnas: {sheet.headers.filter(Boolean).join(', ')}</div>
                    <button
                        onClick={() => ask()}
                        disabled={working}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white text-sm font-black shadow-lg disabled:opacity-60"
                    >
                        <Sparkles className="w-4 h-4" /> {working ? 'Analizando la lista… (puede tardar hasta un minuto)' : 'Analizar con IA'}
                    </button>
                </div>
            )}

            {/* 3. Review + correct by chatting */}
            {proposal && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="xl:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden">
                        <div className="p-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                                <button onClick={() => setTab('result')} className={`px-3 py-1.5 rounded-xl ${tab === 'result' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-600 dark:text-zinc-300'}`}>
                                    Cómo queda ({invitations.length} · {people} personas)
                                </button>
                                <button onClick={() => setTab('issues')} className={`px-3 py-1.5 rounded-xl ${tab === 'issues' ? (blockers ? 'bg-rose-600 text-white' : 'bg-zinc-900 text-white') : (blockers ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/30' : 'text-zinc-600 dark:text-zinc-300')}`}>
                                    Observaciones ({blockers})
                                </button>
                            </div>
                            <button onClick={downloadCorrected} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold">
                                <Download className="w-3.5 h-3.5" /> Excel revisado
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto">
                            {tab === 'result' ? (
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 uppercase tracking-wider sticky top-0">
                                        <tr>
                                            <th className="p-3">#</th>
                                            <th className="p-3">Invitación</th>
                                            <th className="p-3">Teléfono</th>
                                            <th className="p-3 text-center">Personas</th>
                                            <th className="p-3">Acompañantes</th>
                                            <th className="p-3">Mesa / Dieta / Notas</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {invitations.map((g, i) => (
                                            <tr key={i} className="bg-white dark:bg-zinc-900">
                                                <td className="p-3 text-zinc-400">{i + 1}</td>
                                                <td className="p-3">
                                                    <div className="font-bold text-zinc-900 dark:text-white">{g.name}</div>
                                                    <div className="text-[10px] text-zinc-500">filas {(g.source_rows || []).join(', ')}</div>
                                                </td>
                                                <td className="p-3 font-mono text-zinc-600 dark:text-zinc-400">
                                                    {normalizePhone(g.phone) || <span className="text-rose-600">sin teléfono</span>}
                                                    {(g.other_phones || []).map((p) => <div key={p} className="text-[10px] text-zinc-400">+ {normalizePhone(p)}</div>)}
                                                </td>
                                                <td className="p-3 text-center text-base font-black text-zinc-900 dark:text-white">
                                                    {Math.max(1, g.total_people || 1)}
                                                    {g.children > 0 && <div className="text-[10px] font-semibold text-teal-600">{g.children} niño{g.children > 1 ? 's' : ''}</div>}
                                                </td>
                                                <td className="p-3 text-zinc-600 dark:text-zinc-300">
                                                    {(g.companions || []).length
                                                        ? g.companions.map((c) => c.name).join(', ')
                                                        : (g.total_people > 1 ? <span className="italic text-zinc-400">{g.total_people - 1} sin nombre</span> : '—')}
                                                </td>
                                                <td className="p-3 text-zinc-500">{[g.table, g.dietary, g.notes].filter(Boolean).join(' · ') || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : blockers === 0 ? (
                                <div className="p-8 text-center text-xs text-emerald-700 dark:text-emerald-400 font-bold">✅ Sin observaciones: la lista cuadra.</div>
                            ) : (
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {observations.map((o, i) => (
                                        <div key={i} className="p-3 text-xs flex gap-3">
                                            <span className="shrink-0 font-mono text-zinc-400">Fila {(o.rows || []).join(', ') || '—'}</span>
                                            <span className="text-rose-600 dark:text-rose-400">{o.message}</span>
                                        </div>
                                    ))}
                                    {missingPhone.map((g, i) => (
                                        <div key={`p${i}`} className="p-3 text-xs flex gap-3">
                                            <span className="shrink-0 font-mono text-zinc-400">Fila {(g.source_rows || []).join(', ')}</span>
                                            <span className="text-rose-600 dark:text-rose-400">{g.name}: falta el teléfono (o está incompleto).</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <span className="text-[11px] text-zinc-500">
                                {blockers ? `Resolvé las ${blockers} observaciones (escribiéndole al asistente) para poder importar.` : 'Revisá que cada invitación sea correcta antes de importar.'}
                            </span>
                            <button
                                onClick={importList}
                                disabled={blockers > 0 || importing || !invitations.length}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-50"
                            >
                                <Users className="w-4 h-4" /> {importing ? 'Importando...' : `Importar ${invitations.length} invitaciones`}
                            </button>
                        </div>
                    </div>

                    {/* Chat with the assistant */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl flex flex-col min-h-[420px]">
                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-violet-500" /> Corregir con el asistente
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[50vh]">
                            {chat.map((m, i) => (
                                <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap ${m.from === 'user' ? 'bg-violet-600 text-white rounded-tr-sm' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-sm'}`}>
                                        {m.text}
                                    </div>
                                </div>
                            ))}
                            {working && <div className="text-xs text-zinc-500 italic">El asistente está revisando la lista…</div>}
                            {!chat.length && (
                                <p className="text-xs text-zinc-500">Ejemplos: «Nicole Gallardo va con Oso, son 2», «Ariana Coronel está repetida, es una sola invitación de 2», «Marcos Pereira son 6».</p>
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
                            <button disabled={working || !instruction.trim()} className="h-10 w-10 rounded-xl bg-violet-600 text-white flex items-center justify-center disabled:opacity-50">
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {proposal && blockers === 0 && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> La lista cuadra. Revisá «Cómo queda» y tocá Importar.
                </div>
            )}
        </div>
    );
}
