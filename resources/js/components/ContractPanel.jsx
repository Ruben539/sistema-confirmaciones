import React, { useEffect, useRef, useState } from 'react';
import { FileSignature, Upload, Eye, Send, Ban, Undo2, Trash2, AlertTriangle, ChevronDown, RefreshCw } from 'lucide-react';
import { apiFetch } from '../api';

/**
 * Signed contract of an event. type: "event" (confirmaciones) or "casita" (La Casita).
 * Every change fires "contracts:changed" so the sidebar counters refresh.
 */

export const CONTRACT_OPEN = ['pending', 'sent'];

const notifyChanged = () => window.dispatchEvent(new Event('contracts:changed'));

const STYLES = {
    pending: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
    sent: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
    signed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    not_required: 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700/60',
};

const LABELS = {
    pending: 'Sin contrato',
    sent: 'Contrato enviado, falta firma',
    signed: 'Contrato firmado',
    not_required: 'No requiere contrato',
};

export function ContractBadge({ contract, className = '' }) {
    const status = contract?.status || 'pending';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black whitespace-nowrap ${STYLES[status] || STYLES.pending} ${className}`}>
            <FileSignature className="w-3 h-3" />
            {LABELS[status] || status}
        </span>
    );
}

const actionBtn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all disabled:opacity-50';

/** Status + actions: upload the signed file, view it, mark as sent / not required, undo. */
export function ContractPanel({ type, id, contract, onChanged, showToast, compact = false }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const fileRef = useRef(null);
    const status = contract?.status || 'pending';

    const done = (ok, json, fallback) => {
        setBusy(false);
        if (!ok) { setError(json?.errors?.file?.[0] || json?.message || fallback); return; }
        setError(null);
        onChanged?.(json.contract);
        showToast?.(json.message);
        notifyChanged();
    };

    const setStatus = async (next) => {
        setBusy(true);
        const { ok, json } = await apiFetch(`/api/contracts/${type}/${id}`, { method: 'PUT', body: JSON.stringify({ status: next }) });
        done(ok, json, 'No se pudo cambiar el estado del contrato.');
    };

    const upload = async (file) => {
        if (!file) return;
        setBusy(true);
        const body = new FormData();
        body.append('file', file);
        const { ok, json } = await apiFetch(`/api/contracts/${type}/${id}/file`, { method: 'POST', body });
        if (fileRef.current) fileRef.current.value = '';
        done(ok, json, 'No se pudo subir el contrato.');
    };

    const removeFile = async () => {
        setBusy(true);
        const { ok, json } = await apiFetch(`/api/contracts/${type}/${id}/file`, { method: 'DELETE' });
        done(ok, json, 'No se pudo quitar el contrato.');
    };

    const isOpen = CONTRACT_OPEN.includes(status);
    const signedOn = contract?.signed_at ? new Date(contract.signed_at).toLocaleDateString('es-PY') : null;

    return (
        <div className={`rounded-2xl border p-3.5 space-y-2.5 ${isOpen ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20' : 'border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/60 dark:bg-zinc-800/30'}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <ContractBadge contract={contract} />
                    {status === 'signed' && signedOn && <span className="text-[10px] text-zinc-500">el {signedOn}</span>}
                </div>
                {busy && <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />}
            </div>

            {!compact && isOpen && (
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    Hasta que subas el contrato firmado, el sistema te lo va a recordar por WhatsApp.
                </p>
            )}

            <div className="flex flex-wrap gap-1.5">
                <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
                <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={`${actionBtn} ${isOpen ? '!border-rose-300 !text-rose-700 dark:!text-rose-300' : ''}`}>
                    <Upload className="w-3.5 h-3.5" /> {contract?.download_url ? 'Reemplazar' : 'Subir firmado'}
                </button>
                {contract?.download_url && (
                    <a href={contract.download_url} target="_blank" rel="noreferrer" className={actionBtn} title={contract.file_name || 'Ver contrato'}>
                        <Eye className="w-3.5 h-3.5" /> Ver
                    </a>
                )}
                {status === 'pending' && (
                    <button type="button" disabled={busy} onClick={() => setStatus('sent')} className={actionBtn} title="Ya se lo mandaste al cliente y falta que lo firme">
                        <Send className="w-3.5 h-3.5" /> Enviado al cliente
                    </button>
                )}
                {isOpen && (
                    <button type="button" disabled={busy} onClick={() => setStatus('not_required')} className={actionBtn} title="Este evento no lleva contrato: deja de avisar">
                        <Ban className="w-3.5 h-3.5" /> No requiere
                    </button>
                )}
                {contract?.download_url ? (
                    <button type="button" disabled={busy} onClick={removeFile} className={`${actionBtn} hover:!text-rose-600`} title="Quitar el archivo y volver a pendiente">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                ) : !isOpen && (
                    <button type="button" disabled={busy} onClick={() => setStatus('pending')} className={actionBtn} title="Volver a pendiente">
                        <Undo2 className="w-3.5 h-3.5" /> Volver a pendiente
                    </button>
                )}
            </div>

            {error && <div className="text-[11px] font-bold text-rose-600">{error}</div>}
        </div>
    );
}

/** Upcoming events (both modules) still without a signed contract. Refreshes on "contracts:changed". */
export function usePendingContracts(enabled = true) {
    const [data, setData] = useState({ count: 0, items: [] });

    useEffect(() => {
        if (!enabled) return undefined;
        let alive = true;
        const load = () => apiFetch('/api/contracts/pending').then(({ ok, json }) => {
            if (alive && ok && json) setData(json);
        });
        load();
        window.addEventListener('contracts:changed', load);
        return () => { alive = false; window.removeEventListener('contracts:changed', load); };
    }, [enabled]);

    return data;
}

const whenText = (item) => {
    if (item.days_left === null || item.days_left === undefined) return 'sin fecha';
    if (item.days_left === 0) return 'es hoy';
    if (item.days_left === 1) return 'mañana';
    return `en ${item.days_left} días`;
};

/** Reminder banner with the events of one module ("event" or "casita") missing their contract. */
export function PendingContractsBanner({ type, onOpen }) {
    const { items } = usePendingContracts();
    const [open, setOpen] = useState(false);
    const mine = items.filter(i => i.type === type);
    if (mine.length === 0) return null;

    const urgent = mine.filter(i => i.days_left !== null && i.days_left <= 7).length;

    return (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 shadow-sm">
            <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 p-4 text-left">
                <span className="flex items-center gap-2.5 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>
                        {mine.length === 1 ? '1 evento todavía no tiene el contrato firmado' : `${mine.length} eventos todavía no tienen el contrato firmado`}
                        {urgent > 0 && <b className="ml-1">({urgent} en los próximos 7 días)</b>}
                    </span>
                </span>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <ul className="px-4 pb-4 space-y-1.5">
                    {mine.map(item => (
                        <li key={`${item.type}-${item.id}`}>
                            <button type="button" onClick={() => onOpen?.(item)} className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/70 dark:bg-zinc-900/60 hover:bg-white dark:hover:bg-zinc-900 text-left text-xs">
                                <span className="font-black truncate">{item.label}</span>
                                <span className="flex items-center gap-2 shrink-0">
                                    <span className={item.days_left !== null && item.days_left <= 7 ? 'font-black text-rose-600' : 'text-zinc-500'}>{whenText(item)}</span>
                                    <ContractBadge contract={item.contract} />
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
