import React, { useMemo, useState } from 'react';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../api';
import { gs, fmtDate, parseRegistroFile } from './casitaUtils';
import { PageHeader, Card, Kpi, Empty, btnPrimary, btnGhost } from './CasitaUi';

/**
 * Carga el historial desde la planilla vieja (.xlsm/.xlsx con hoja "Registro", o el .csv exportado).
 * El servidor junta los bloques repetidos y salta los eventos que ya están cargados,
 * así que se puede importar varias veces sin duplicar.
 */
export default function CasitaImport({ showToast, onDone }) {
    const [fileName, setFileName] = useState('');
    const [rows, setRows] = useState([]);
    const [warnings, setWarnings] = useState([]);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    // The Excel has no payment history; without this every past event would show as owing money
    const [settlePast, setSettlePast] = useState(true);

    const pick = async (file) => {
        if (!file) return;
        setError(null); setResult(null); setRows([]); setWarnings([]);
        setFileName(file.name);
        setBusy(true);
        try {
            const parsed = await parseRegistroFile(file);
            setRows(parsed.rows);
            setWarnings(parsed.warnings);
            if (!parsed.rows.length) setError('No encontré filas con cliente y detalle.');
        } catch (e) {
            setError(e.message || 'No se pudo leer el archivo.');
        }
        setBusy(false);
    };

    // Preview: one line per date + client (before merging repeated blocks on the server)
    const preview = useMemo(() => {
        const map = new Map();
        rows.forEach(r => {
            const k = `${r.date}|${r.client.toLowerCase()}`;
            const e = map.get(k) || { date: r.date, client: r.client, menu: r.menu, lines: 0, total: 0 };
            e.lines++; e.total += r.price * r.quantity;
            map.set(k, e);
        });
        return [...map.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }, [rows]);

    const runImport = async () => {
        setBusy(true);
        const { ok, json } = await apiFetch('/api/casita/events/import', { method: 'POST', body: JSON.stringify({ rows, settle_past: settlePast }) });
        setBusy(false);
        if (!ok) { setError(json?.message || 'No se pudo importar.'); return; }
        setResult(json);
        showToast(json.message);
    };

    return (
        <div className="space-y-6">
            <PageHeader icon={Upload} title="Importar Excel" subtitle="Cargá el historial desde la planilla de registros (hoja Registro)" />

            <Card>
                <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-rose-200 dark:border-zinc-700 rounded-3xl py-10 cursor-pointer hover:bg-rose-50/40 dark:hover:bg-zinc-800/40 transition-colors">
                    <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
                    <span className="text-sm font-black">{fileName || 'Elegí el archivo .xlsm, .xlsx o .csv'}</span>
                    <span className="text-xs text-zinc-500">Columnas: Fecha · Lugar · Cliente · Menú · Detalle · Precio · Cantidad · Total · Observación</span>
                    <input type="file" accept=".xlsm,.xlsx,.xls,.csv" className="hidden" onChange={e => pick(e.target.files?.[0])} />
                </label>
            </Card>

            {error && <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold">{error}</div>}

            {result && (
                <Card>
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                        <div className="text-xs space-y-1">
                            <p className="text-sm font-black">{result.message}</p>
                            <p>{result.created_clients} clientes nuevos y {result.created_items} líneas de presupuesto cargadas.</p>
                            {result.settled_past > 0 && <p>{result.settled_past} eventos ya realizados quedaron como pagados.</p>}
                            {result.skipped_existing > 0 &&<p>{result.skipped_existing} eventos ya estaban cargados y se saltaron.</p>}
                            {result.warnings.map(w => <p key={w} className="text-amber-600">{w}</p>)}
                            <button onClick={onDone} className={`${btnGhost} mt-2`}>Ver los clientes</button>
                        </div>
                    </div>
                </Card>
            )}

            {rows.length > 0 && !result && (<>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <Kpi label="Filas leídas" value={rows.length.toLocaleString('es-PY')} />
                    <Kpi label="Eventos (fecha + cliente)" value={preview.length} />
                    <Kpi label="Avisos" value={warnings.length} tone={warnings.length ? 'amber' : 'zinc'} />
                </div>

                {warnings.length > 0 && (
                    <Card title="Revisar después de importar">
                        <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-300 max-h-48 overflow-y-auto">
                            {warnings.map((w, i) => <li key={i} className="flex gap-2"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{w}</li>)}
                        </ul>
                    </Card>
                )}

                <Card title="Vista previa" actions={<button onClick={runImport} disabled={busy} className={btnPrimary}><Upload className="w-4 h-4" /> {busy ? 'Importando…' : `Importar ${preview.length} eventos`}</button>}>
                    <p className="text-[11px] text-zinc-500 mb-3">Si un evento aparece copiado varias veces en la planilla, se carga una sola vez. Los eventos que ya existen (misma fecha y cliente) no se vuelven a cargar.</p>
                    <label className="flex items-start gap-2 mb-4 p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 text-xs cursor-pointer">
                        <input type="checkbox" checked={settlePast} onChange={e => setSettlePast(e.target.checked)} className="mt-0.5 accent-rose-500" />
                        <span>
                            <b>Marcar como pagados los eventos que ya se realizaron.</b>
                            <span className="block text-zinc-500">La planilla no tiene el historial de pagos. Se registra un pago por el total con la nota "Saldado al importar". Si lo desmarcás, todos los eventos pasados quedan con saldo pendiente.</span>
                        </span>
                    </label>
                    {preview.length === 0 ? <Empty>Sin eventos.</Empty> : (
                        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-white dark:bg-zinc-900">
                                    <tr className="text-[10px] uppercase tracking-wider text-zinc-500 text-left">
                                        <th className="pb-2">Fecha</th><th className="pb-2">Cliente</th><th className="pb-2">Menú</th><th className="pb-2 text-right">Líneas</th><th className="pb-2 text-right">Total en planilla</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {preview.map(e => (
                                        <tr key={`${e.date}|${e.client}`} className="tabular-nums">
                                            <td className="py-1.5">{fmtDate(e.date)}</td>
                                            <td className="py-1.5 font-bold">{e.client}</td>
                                            <td className="py-1.5 text-zinc-500">{e.menu || '—'}</td>
                                            <td className="py-1.5 text-right">{e.lines}</td>
                                            <td className="py-1.5 text-right">{gs(e.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </>)}
        </div>
    );
}
