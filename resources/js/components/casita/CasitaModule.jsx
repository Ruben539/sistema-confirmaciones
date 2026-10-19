import React, { useEffect, useState } from 'react';
import CasitaDashboard from './CasitaDashboard';
import CasitaEvents from './CasitaEvents';
import CasitaEventEditor from './CasitaEventEditor';
import CasitaPayments from './CasitaPayments';
import CasitaLosses from './CasitaLosses';
import CasitaCatalog from './CasitaCatalog';
import CasitaImport from './CasitaImport';

/**
 * "La Casita" menu: one screen per sheet of the old Excel.
 * view is the sidebar tab id (casita_dashboard, casita_events, …).
 */
export default function CasitaModule({ view, setView, systemEvents, showToast }) {
    const [openEventId, setOpenEventId] = useState(null); // null = list, 'new', or an id
    const [lossesEventId, setLossesEventId] = useState(null);

    // Coming back to "Registro de eventos" from another screen shows the list, not the last opened event
    useEffect(() => {
        if (view !== 'casita_events') setOpenEventId(null);
    }, [view]);

    const openEvent = (id) => { setOpenEventId(id); setView('casita_events'); };
    const newEvent = () => openEvent('new');
    const goLosses = (id) => { setLossesEventId(id); setView('casita_losses'); };

    switch (view) {
        case 'casita_events':
            return openEventId ? (
                <CasitaEventEditor
                    key={openEventId}
                    eventId={openEventId}
                    systemEvents={systemEvents}
                    showToast={showToast}
                    onBack={() => setOpenEventId(null)}
                    onSaved={(id) => setOpenEventId(id)}
                    onGoLosses={goLosses}
                />
            ) : (
                <CasitaEvents onOpenEvent={openEvent} onNewEvent={newEvent} />
            );
        case 'casita_payments':
            return <CasitaPayments key="payments" mode="payments" showToast={showToast} onOpenEvent={openEvent} />;
        case 'casita_guarantees':
            return <CasitaPayments key="guarantees" mode="guarantees" showToast={showToast} onOpenEvent={openEvent} />;
        case 'casita_losses':
            return <CasitaLosses eventId={lossesEventId} onChangeEvent={setLossesEventId} showToast={showToast} />;
        case 'casita_catalog':
            return <CasitaCatalog showToast={showToast} />;
        case 'casita_import':
            return <CasitaImport showToast={showToast} onDone={() => { setOpenEventId(null); setView('casita_events'); }} />;
        default:
            return <CasitaDashboard onOpenEvent={openEvent} onNewEvent={newEvent} onGoImport={() => setView('casita_import')} />;
    }
}
