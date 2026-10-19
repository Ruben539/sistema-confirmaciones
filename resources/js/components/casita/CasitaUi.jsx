import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Plus, X } from 'lucide-react';
import { apiFetch } from '../../api';
import { catalogKey, gs, CATALOG_CATEGORIES } from './casitaUtils';

// Small building blocks shared by the La Casita screens (same look as the rest of the panel)

export const inputCls = 'w-full text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-rose-500 transition-all';

export const btnPrimary = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-black shadow-lg shadow-rose-500/20 active:scale-95 transition-all disabled:opacity-50';

export const btnGhost = 'inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all disabled:opacity-50';

export const btnDanger = 'inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-rose-600 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all';

export function PageHeader({ icon: Icon, title, subtitle, children }) {
    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-400 text-white shadow-lg shadow-rose-500/20">
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">{title}</h2>
                    {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
        </div>
    );
}

export function Card({ title, actions, children, className = '' }) {
    return (
        <section className={`bg-white dark:bg-zinc-900 rounded-3xl border border-rose-100 dark:border-zinc-800 shadow-sm ${className}`}>
            {(title || actions) && (
                <div className="flex items-center justify-between gap-3 px-5 pt-5">
                    {title && <h3 className="text-sm font-black text-zinc-900 dark:text-white">{title}</h3>}
                    {actions}
                </div>
            )}
            <div className="p-5">{children}</div>
        </section>
    );
}

/** delta: change vs. the previous period in % (shown as a small ▲/▼ badge when it's a number). */
export function Kpi({ label, value, hint, tone = 'zinc', delta, deltaHint }) {
    const tones = {
        zinc: 'text-zinc-900 dark:text-white',
        rose: 'text-rose-600 dark:text-rose-400',
        emerald: 'text-emerald-600 dark:text-emerald-400',
        amber: 'text-amber-600 dark:text-amber-400',
    };
    const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-rose-100 dark:border-zinc-800 p-5 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
            <div className={`text-xl font-black mt-1 tabular-nums ${tones[tone]}`}>{value}</div>
            {hasDelta && (
                <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                    <span className={`font-black ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%</span>
                    {deltaHint && <span className="text-zinc-500">{deltaHint}</span>}
                </div>
            )}
            {hint && <div className="text-[11px] text-zinc-500 mt-1">{hint}</div>}
        </div>
    );
}

export function Empty({ children }) {
    return <div className="py-10 text-center text-xs text-zinc-500">{children}</div>;
}

export function Field({ label, children, className = '' }) {
    return (
        <label className={`block ${className}`}>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">{label}</span>
            {children}
        </label>
    );
}

export function BalanceBadge({ balance }) {
    if (balance > 0) return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Saldo pendiente</span>;
    if (balance < 0) return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">Saldo a favor</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Pagado</span>;
}

// Number input that shows thousands separators (1.000.000) and hands back an integer
export function MoneyInput({ value, onChange, className = '', ...rest }) {
    const shown = value === '' || value == null ? '' : Number(value).toLocaleString('es-PY');
    return (
        <input
            {...rest}
            inputMode="numeric"
            value={shown}
            onChange={e => {
                const digits = e.target.value.replace(/\D/g, '');
                onChange(digits === '' ? '' : parseInt(digits, 10));
            }}
            className={`${inputCls} text-right tabular-nums ${className}`}
        />
    );
}

/**
 * Text input with a price-list dropdown: name on the left, price on the right.
 * Replaces <datalist>, which in Safari shows only the option label (the price) and hides the name.
 * items: [{ id?, name, price }] (price may be null for plain suggestions). Typing any text is allowed.
 * onEdit(item): pencil on price-list items. onCreate(text): "add to the price list" when nothing matches.
 */
export function CatalogInput({ value, onChange, items, placeholder, onEdit, onCreate }) {
    const inputRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [rect, setRect] = useState(null);

    const matches = useMemo(() => {
        const q = catalogKey(value);
        const list = q ? items.filter(i => catalogKey(i.name).includes(q)) : items;
        // Names starting with what was typed go first
        return [...list].sort((a, b) => Number(catalogKey(b.name).startsWith(q)) - Number(catalogKey(a.name).startsWith(q))).slice(0, 60);
    }, [value, items]);

    // Fixed position: the budget table scrolls horizontally and would cut an absolute dropdown
    const place = () => inputRef.current && setRect(inputRef.current.getBoundingClientRect());
    useEffect(() => {
        if (!open) return undefined;
        place();
        window.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);
        return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
    }, [open]);

    const pick = (item) => { onChange(item.name); setOpen(false); };

    const onKeyDown = (e) => {
        if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); return; }
        if (!open) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, matches.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
        else if (e.key === 'Enter' && matches[highlight]) { e.preventDefault(); pick(matches[highlight]); }
        else if (e.key === 'Escape') setOpen(false);
    };

    // Exact match already chosen: no need to keep the list open
    const exact = matches.length === 1 && catalogKey(matches[0].name) === catalogKey(value);
    const canCreate = onCreate && value.trim() && !items.some(i => catalogKey(i.name) === catalogKey(value));
    const showList = matches.length > 0 && !exact;

    return (
        <>
            <input
                ref={inputRef}
                value={value}
                placeholder={placeholder}
                onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
                onFocus={() => { setOpen(true); setHighlight(0); }}
                onBlur={() => setOpen(false)}
                onKeyDown={onKeyDown}
                autoComplete="off"
                className={inputCls}
            />
            {open && rect && (showList || canCreate) && createPortal(
                <ul
                    style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 320), zIndex: 60 }}
                    className="max-h-64 overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl py-1"
                >
                    {matches.map((item, i) => (
                        <li
                            key={`${item.name}-${i}`}
                            onMouseDown={e => { e.preventDefault(); pick(item); }}
                            onMouseEnter={() => setHighlight(i)}
                            className={`flex items-center justify-between gap-3 px-3 py-2 text-xs cursor-pointer ${i === highlight ? 'bg-rose-50 dark:bg-zinc-800' : ''}`}
                        >
                            <span className="font-semibold text-zinc-900 dark:text-white">{item.name}</span>
                            <span className="shrink-0 flex items-center gap-1">
                                {item.price != null && <span className="tabular-nums text-zinc-500">{gs(item.price)}</span>}
                                {onEdit && item.id && (
                                    <button
                                        type="button"
                                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); onEdit(item); }}
                                        className="p-1 rounded-md text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                        title="Editar en la lista de precios"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </span>
                        </li>
                    ))}
                    {canCreate && (
                        <li
                            onMouseDown={e => { e.preventDefault(); setOpen(false); onCreate(value.trim()); }}
                            className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer text-rose-600 font-bold border-t border-zinc-100 dark:border-zinc-800 hover:bg-rose-50 dark:hover:bg-zinc-800"
                        >
                            <Plus className="w-3.5 h-3.5" /> Agregar «{value.trim()}» a la lista de precios
                        </li>
                    )}
                </ul>,
                document.body
            )}
        </>
    );
}

/**
 * Small window to edit (item given) or add (item null, initialName) a price-list item.
 * onSaved(savedItem, previousItem) after saving.
 */
export function CatalogItemModal({ item, initialName = '', onClose, onSaved, showToast }) {
    const [form, setForm] = useState({
        name: item?.name ?? initialName, price: item?.price ?? '', category: item?.category ?? 'otro',
    });
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setError(null);
        if (!form.name.trim()) { setError('Escribí el detalle.'); return; }
        setSaving(true);
        const body = JSON.stringify({ ...(item || {}), ...form, name: form.name.trim(), price: Number(form.price) || 0 });
        const { ok, json } = await apiFetch(item ? `/api/casita/catalog/${item.id}` : '/api/casita/catalog', { method: item ? 'PUT' : 'POST', body });
        setSaving(false);
        if (!ok) { setError(json?.message || 'No se pudo guardar.'); return; }
        showToast(json.message);
        onSaved(json.item, item);
    };

    return createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-950/50" onMouseDown={onClose}>
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-6 space-y-4" onMouseDown={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black">{item ? 'Editar ítem de la lista de precios' : 'Agregar a la lista de precios'}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
                </div>
                <Field label="Detalle"><input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} /></Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Precio"><MoneyInput value={form.price} onChange={v => setForm(f => ({ ...f, price: v }))} /></Field>
                    <Field label="Grupo">
                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                            {Object.entries(CATALOG_CATEGORIES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                        </select>
                    </Field>
                </div>
                <p className="text-[11px] text-zinc-500">Cambia el precio para los presupuestos nuevos. Los ya guardados no se tocan; en este presupuesto se actualizan las líneas de este ítem que tenían el precio anterior.</p>
                {error && <div className="text-xs font-bold text-rose-600">{error}</div>}
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className={btnGhost}>Cancelar</button>
                    <button onClick={save} disabled={saving} className={btnPrimary}>{saving ? 'Guardando…' : 'Guardar'}</button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ---------------------------------------------------------------------------
// Date range filter (Desde / Hasta) with quick presets
// ---------------------------------------------------------------------------

const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const RANGE_PRESETS = [
    ['Este mes', (t) => [new Date(t.getFullYear(), t.getMonth(), 1), new Date(t.getFullYear(), t.getMonth() + 1, 0)]],
    ['Mes pasado', (t) => [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)]],
    ['Últimos 3 meses', (t) => [new Date(t.getFullYear(), t.getMonth() - 2, 1), new Date(t.getFullYear(), t.getMonth() + 1, 0)]],
    ['Este año', (t) => [new Date(t.getFullYear(), 0, 1), new Date(t.getFullYear(), 11, 31)]],
];

/** value: { from: 'yyyy-mm-dd' | '', to: 'yyyy-mm-dd' | '' } */
export function DateRange({ value, onChange, presets = true }) {
    const { from = '', to = '' } = value || {};
    const active = from || to;
    const dateCls = 'text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-2.5 py-2 outline-none focus:ring-2 focus:ring-rose-500';
    return (
        <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500">
                Desde <input type="date" value={from} max={to || undefined} onChange={e => onChange({ from: e.target.value, to })} className={dateCls} />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500">
                Hasta <input type="date" value={to} min={from || undefined} onChange={e => onChange({ from, to: e.target.value })} className={dateCls} />
            </label>
            {presets && RANGE_PRESETS.map(([label, make]) => {
                const [f, t] = make(new Date()).map(isoOf);
                const on = from === f && to === t;
                return (
                    <button key={label} type="button" onClick={() => onChange({ from: f, to: t })}
                        className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all ${on ? 'bg-rose-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-rose-100 dark:hover:bg-zinc-700'}`}>
                        {label}
                    </button>
                );
            })}
            {active && (
                <button type="button" onClick={() => onChange({ from: '', to: '' })} className="flex items-center gap-1 px-2 py-1.5 rounded-full text-[11px] font-bold text-zinc-500 hover:text-rose-600" title="Quitar fechas">
                    <X className="w-3.5 h-3.5" /> Quitar fechas
                </button>
            )}
        </div>
    );
}

/** Adds from/to to URLSearchParams when set. */
export const appendRange = (params, range) => {
    if (range?.from) params.set('from', range.from);
    if (range?.to) params.set('to', range.to);
    return params;
};
