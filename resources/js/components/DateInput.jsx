import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

// La API trabaja con aaaa-mm-dd; el usuario ve y escribe dd/mm/aaaa
const toDisplay = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

const toIso = (display) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
    if (!m) return null;
    const [, d, mo, y] = m;
    const date = new Date(Number(y), Number(mo) - 1, Number(d));
    const isRealDate = date.getFullYear() === Number(y) && date.getMonth() === Number(mo) - 1 && date.getDate() === Number(d);
    return isRealDate ? `${y}-${mo}-${d}` : null;
};

// Inserta las barras mientras se escribe: "16102026" -> "16/10/2026"
const applyMask = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
};

const isoOnly = (value) => (/^\d{4}-\d{2}-\d{2}/.exec(value || '') || [''])[0];

/**
 * Input de fecha que siempre muestra dd/mm/aaaa (el input nativo usa el idioma del navegador).
 * value / onChange usan aaaa-mm-dd, igual que <input type="date">.
 */
export default function DateInput({ value, onChange, min, max, className = '', required = false }) {
    const [text, setText] = useState(toDisplay(value));
    const pickerRef = useRef(null);

    useEffect(() => {
        setText(toDisplay(value));
    }, [value]);

    const inRange = (iso) => (!min || iso >= isoOnly(min)) && (!max || iso <= isoOnly(max));

    const handleType = (e) => {
        const masked = applyMask(e.target.value);
        setText(masked);
        if (masked === '') {
            onChange('');
            return;
        }
        const iso = toIso(masked);
        if (iso && inRange(iso)) onChange(iso);
    };

    // Si quedó una fecha incompleta o inválida, volver al último valor válido
    const handleBlur = () => {
        const iso = toIso(text);
        if (text !== '' && !(iso && inRange(iso))) setText(toDisplay(value));
    };

    const openPicker = () => {
        const picker = pickerRef.current;
        if (!picker) return;
        try {
            picker.showPicker();
        } catch {
            picker.focus();
            picker.click();
        }
    };

    const iso = toIso(text);
    const isInvalid = text.length === 10 && !(iso && inRange(iso));

    return (
        <div className="relative">
            <input
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                value={text}
                onChange={handleType}
                onBlur={handleBlur}
                required={required}
                aria-invalid={isInvalid}
                className={`${className} pr-10 ${isInvalid ? 'border-red-500 focus:ring-red-500' : ''}`}
            />
            <button
                type="button"
                onClick={openPicker}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-700/60 transition-colors"
                title="Elegir fecha en el calendario"
                aria-label="Elegir fecha en el calendario"
            >
                <Calendar className="w-4 h-4" />
            </button>
            {/* Input nativo oculto: solo se usa para abrir el calendario del navegador */}
            <input
                ref={pickerRef}
                type="date"
                tabIndex={-1}
                aria-hidden="true"
                value={isoOnly(value)}
                min={min ? isoOnly(min) : undefined}
                max={max ? isoOnly(max) : undefined}
                onChange={(e) => onChange(e.target.value)}
                className="absolute right-2 bottom-0 w-0 h-0 opacity-0 pointer-events-none"
            />
        </div>
    );
}
