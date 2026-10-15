import React, { useEffect, useMemo, useState } from 'react';
import { Send, X, Search } from 'lucide-react';

/**
 * Review before a bulk WhatsApp send: who gets it, what each one gets and how the message looks.
 * Everyone starts checked; unchecking leaves a guest out of this send.
 * items: [{ id, name, phone, detail, tag, tagClass, preview }]
 */
export default function SendReviewModal({ open, title, description, items, confirmLabel, onConfirm, onClose }) {
    const [selected, setSelected] = useState([]);
    const [search, setSearch] = useState('');
    const [previewId, setPreviewId] = useState(null);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (open) {
            setSelected(items.map((i) => i.id));
            setPreviewId(items[0]?.id ?? null);
            setSearch('');
        }
    }, [open, items]);

    const visible = useMemo(
        () => items.filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase())),
        [items, search]
    );

    if (!open) return null;

    const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    const allChecked = selected.length === items.length;
    const preview = items.find((i) => i.id === previewId) || items[0];

    const confirm = async () => {
        setSending(true);
        await onConfirm(selected);
        setSending(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{title}</h2>
                        {description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{description}</p>}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="w-5 h-5" /></button>
                </div>

                <div className="grid md:grid-cols-5 flex-1 min-h-0">
                    {/* Who */}
                    <div className="md:col-span-3 flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-zinc-100 dark:border-zinc-800">
                        <div className="p-3 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800">
                            <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer shrink-0">
                                <input type="checkbox" checked={allChecked} onChange={() => setSelected(allChecked ? [] : items.map((i) => i.id))} />
                                {selected.length} de {items.length}
                            </label>
                            <div className="relative flex-1">
                                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white pl-8 pr-2 py-1.5 outline-none" />
                            </div>
                        </div>
                        <div className="overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[50vh]">
                            {visible.map((i) => (
                                <div
                                    key={i.id}
                                    onClick={() => setPreviewId(i.id)}
                                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer text-xs ${previewId === i.id ? 'bg-rose-50/60 dark:bg-rose-950/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                                >
                                    <input type="checkbox" checked={selected.includes(i.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(i.id)} />
                                    <div className="min-w-0 flex-1">
                                        <div className={`font-bold truncate ${selected.includes(i.id) ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 line-through'}`}>{i.name}</div>
                                        <div className="text-[11px] text-zinc-500 truncate">{i.phone}{i.detail ? ` · ${i.detail}` : ''}</div>
                                    </div>
                                    {i.tag && <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${i.tagClass || 'bg-zinc-100 text-zinc-600'}`}>{i.tag}</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* What */}
                    <div className="md:col-span-2 p-4 flex flex-col min-h-0">
                        <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-2">Mensaje que recibe {preview ? preview.name.split(' ')[0] : ''}</div>
                        <div className="flex-1 overflow-y-auto rounded-2xl bg-[#e7ddd3] dark:bg-zinc-800 p-3">
                            <div className="max-w-[95%] bg-[#d9fdd3] dark:bg-emerald-900/60 text-zinc-900 dark:text-white rounded-xl rounded-tr-sm p-3 text-xs whitespace-pre-line shadow-sm ml-auto">
                                {preview?.preview || '—'}
                            </div>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-2">Tocá un invitado de la lista para ver su mensaje.</p>
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300">Cancelar</button>
                    <button onClick={confirm} disabled={sending || selected.length === 0} className="px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
                        <Send className="w-4 h-4" /> {sending ? 'Programando...' : `${confirmLabel} (${selected.length})`}
                    </button>
                </div>
            </div>
        </div>
    );
}
