import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api';
import { fmtDate, todayIso } from './casitaUtils';
import { inputCls } from './CasitaUi';

/** Select of La Casita events: upcoming first (closest date), then past ones (most recent first). */
export default function CasitaEventPicker({ value, onChange, placeholder = 'Elegí un evento…' }) {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        apiFetch('/api/casita/events').then(({ ok, json }) => ok && setEvents(json.events));
    }, []);

    const { upcoming, past } = useMemo(() => {
        const today = todayIso();
        const up = events.filter(e => e.event_date && e.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date));
        const pa = events.filter(e => !e.event_date || e.event_date < today);
        return { upcoming: up, past: pa };
    }, [events]);

    const label = (e) => `${fmtDate(e.event_date)} · ${e.client_name}`;

    return (
        <select value={value || ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)} className={inputCls}>
            <option value="">{placeholder}</option>
            {upcoming.length > 0 && <optgroup label="Próximos">{upcoming.map(e => <option key={e.id} value={e.id}>{label(e)}</option>)}</optgroup>}
            {past.length > 0 && <optgroup label="Realizados">{past.map(e => <option key={e.id} value={e.id}>{label(e)}</option>)}</optgroup>}
        </select>
    );
}
