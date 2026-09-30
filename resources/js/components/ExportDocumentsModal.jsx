import React, { useState } from 'react';
import { X, Printer, Map as MapIcon, ListOrdered, ChefHat, ClipboardCheck, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../api';
import { printHtml, buildPlanDocument, buildPlacementDocument, buildCateringDocument, buildReceptionDocument, exportGuestsExcel } from '../eventDocuments';

const DOCUMENTS = [
    {
        id: 'plan',
        icon: MapIcon,
        title: 'Plano del salón + mesas',
        audience: 'Salón y decoración',
        description: 'Plano desde arriba con pista, escenario y entrada, y una ficha por mesa con sus invitados. Hoja horizontal.',
        build: buildPlanDocument,
    },
    {
        id: 'placement',
        icon: ListOrdered,
        title: 'Lista de ubicación',
        audience: 'Cartel de la entrada',
        description: 'Invitados en orden alfabético con su mesa, en letra grande, para que cada uno encuentre su lugar.',
        build: buildPlacementDocument,
    },
    {
        id: 'catering',
        icon: ChefHat,
        title: 'Reporte de catering',
        audience: 'Cocina y mozos',
        description: 'Menús de adultos, jóvenes y niños por mesa, y cada menú especial con nombre y mesa.',
        build: buildCateringDocument,
    },
    {
        id: 'reception',
        icon: ClipboardCheck,
        title: 'Lista de recepción',
        audience: 'Recepción (respaldo en papel)',
        description: 'Todos los invitados de la A a la Z con casilla para marcar la llegada, pases, mesa y estado.',
        build: buildReceptionDocument,
    },
];

export default function ExportDocumentsModal({ isOpen, onClose, event, tables = [], unassigned = [], venueLayout = null, showToast }) {
    const [exportingExcel, setExportingExcel] = useState(false);

    if (!isOpen) return null;

    const unseatedPeople = unassigned.reduce((acc, g) => acc + (g.seats ?? g.passes ?? 1), 0);
    const data = { event, tables, unassigned, venueLayout };

    const handlePrint = (doc) => {
        printHtml(doc.build(data));
    };

    const handleExcel = async () => {
        setExportingExcel(true);
        try {
            // The seating data leaves out guests who declined; the Excel lists everyone
            const { ok, json } = await apiFetch(`/api/events/${event.id}/guests`);
            if (!ok) {
                if (showToast) showToast(json?.message || 'No se pudo obtener la lista de invitados.');
                return;
            }
            exportGuestsExcel({ event, allGuests: json?.guests || [], tables, unassigned });
        } catch (err) {
            console.error(err);
            if (showToast) showToast('Error de conexión al exportar a Excel.');
        } finally {
            setExportingExcel(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-2xl text-rose-600 dark:text-rose-400 border border-rose-200/50">
                            <Printer className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Exportar e Imprimir</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Elegí el documento según para quién es. En la ventana de impresión podés elegir "Guardar como PDF".</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-3">
                    {unassigned.length > 0 && (
                        <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>Hay {unseatedPeople} {unseatedPeople === 1 ? 'persona' : 'personas'} sin mesa. No aparecen en la lista de ubicación y figuran como "Sin mesa" en el resto.</span>
                        </div>
                    )}

                    {DOCUMENTS.map(doc => {
                        const Icon = doc.icon;
                        return (
                            <div key={doc.id} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center gap-4">
                                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-rose-500 shrink-0">
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-zinc-900 dark:text-white">{doc.title}</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200/70 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">{doc.audience}</span>
                                    </div>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{doc.description}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handlePrint(doc)}
                                    disabled={tables.length === 0}
                                    className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                                >
                                    <Printer className="w-3.5 h-3.5" /> Imprimir
                                </button>
                            </div>
                        );
                    })}

                    <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 text-emerald-600 shrink-0">
                            <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-zinc-900 dark:text-white">Excel completo</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">Para editar o compartir</span>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Todos los invitados (incluso los que no asisten) con estado, pases, mesa y dieta, más hojas de Mesas y Catering.</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleExcel}
                            disabled={exportingExcel}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" /> {exportingExcel ? 'Generando...' : 'Descargar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
