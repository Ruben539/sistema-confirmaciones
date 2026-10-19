import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Image as ImageIcon, Upload, Trash2, X, Check } from 'lucide-react';
import { apiFetch } from '../../api';
import { clearImageCache } from './casitaUtils';
import { btnGhost } from './CasitaUi';

const SLOTS = [
    { slot: 'casita', title: 'Logo de presupuestos', hint: 'Sale en el presupuesto, el recibo y el borrador en PDF.' },
    { slot: 'real', title: 'Logo de pérdidas', hint: 'Sale en la liquidación de pérdidas y bebidas.' },
];

/** "Logos" button for the page header. `focus` highlights one slot (e.g. 'real' from Pérdidas). */
export function LogosButton({ showToast, focus }) {
    const [open, setOpen] = useState(false);
    return (<>
        <button onClick={() => setOpen(true)} className={btnGhost} title="Subir o cambiar los logos de los documentos">
            <ImageIcon className="w-4 h-4" /> Logos
        </button>
        {open && <LogosModal showToast={showToast} focus={focus} onClose={() => setOpen(false)} />}
    </>);
}

function LogosModal({ showToast, focus, onClose }) {
    const [logos, setLogos] = useState({});

    useEffect(() => {
        apiFetch('/api/casita/logos').then(({ ok, json }) => {
            if (ok) setLogos(Object.fromEntries(json.map(l => [l.slot, l])));
        });
    }, []);

    const onChanged = (logo) => {
        clearImageCache();
        setLogos(l => ({ ...l, [logo.slot]: logo }));
    };

    return createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-950/50" onMouseDown={onClose}>
            <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-6 space-y-4" onMouseDown={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black">Logos de los documentos</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
                </div>
                {SLOTS.map(s => (
                    <LogoSlot key={s.slot} {...s} logo={logos[s.slot]} highlight={focus === s.slot} onChanged={onChanged} showToast={showToast} />
                ))}
                <p className="text-[11px] text-zinc-500">PNG, JPG o WebP de hasta 15 MB. Conviene una imagen horizontal (más ancha que alta).</p>
            </div>
        </div>,
        document.body,
    );
}

function LogoSlot({ slot, title, hint, logo, highlight, onChanged, showToast }) {
    const inputRef = useRef(null);
    const [busy, setBusy] = useState(false);

    const upload = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { showToast('Elegí una imagen PNG, JPG o WebP.'); return; }
        if (file.size > 15 * 1024 * 1024) { showToast('La imagen supera los 15 MB.'); return; }

        setBusy(true);
        const body = new FormData();
        body.append('image', file);
        const { ok, json } = await apiFetch(`/api/casita/logos/${slot}`, { method: 'POST', body });
        setBusy(false);
        if (!ok) { showToast(json?.errors?.image?.[0] || json?.message || 'No se pudo subir el logo.'); return; }
        showToast(json.message);
        onChanged(json.logo);
    };

    const remove = async () => {
        setBusy(true);
        const { ok, json } = await apiFetch(`/api/casita/logos/${slot}`, { method: 'DELETE' });
        setBusy(false);
        if (!ok) { showToast(json?.message || 'No se pudo quitar el logo.'); return; }
        showToast(json.message);
        onChanged(json.logo);
    };

    return (
        <div className={`rounded-2xl border p-4 space-y-3 ${highlight ? 'border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20' : 'border-zinc-200 dark:border-zinc-700'}`}>
            <div className="flex items-center justify-between gap-2">
                <div>
                    <div className="text-xs font-black text-zinc-900 dark:text-white">{title}</div>
                    <div className="text-[11px] text-zinc-500">{hint}</div>
                </div>
                {logo?.exists && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3" /> Cargado
                    </span>
                )}
            </div>

            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={upload} />

            {logo?.exists ? (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <img src={logo.url} alt={title} className="h-20 max-w-[220px] object-contain rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white p-1" />
                    <div className="flex gap-2 flex-wrap">
                        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-all disabled:opacity-50">
                            <Upload className="w-3.5 h-3.5" /> {busy ? 'Subiendo…' : 'Cambiar imagen'}
                        </button>
                        <button type="button" disabled={busy} onClick={remove} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all disabled:opacity-50">
                            <Trash2 className="w-3.5 h-3.5" /> Quitar
                        </button>
                    </div>
                </div>
            ) : (
                <button type="button" disabled={busy || !logo} onClick={() => inputRef.current?.click()} className="w-full flex flex-col items-center gap-1.5 py-5 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-rose-400 hover:text-rose-500 transition-all disabled:opacity-50">
                    <Upload className="w-5 h-5" />
                    <span className="text-xs font-bold">{busy ? 'Subiendo…' : logo ? 'Subir logo' : 'Cargando…'}</span>
                </button>
            )}
        </div>
    );
}
