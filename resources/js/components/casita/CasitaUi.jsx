import React from 'react';

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

export function Kpi({ label, value, hint, tone = 'zinc' }) {
    const tones = {
        zinc: 'text-zinc-900 dark:text-white',
        rose: 'text-rose-600 dark:text-rose-400',
        emerald: 'text-emerald-600 dark:text-emerald-400',
        amber: 'text-amber-600 dark:text-amber-400',
    };
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-rose-100 dark:border-zinc-800 p-5 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
            <div className={`text-xl font-black mt-1 tabular-nums ${tones[tone]}`}>{value}</div>
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
