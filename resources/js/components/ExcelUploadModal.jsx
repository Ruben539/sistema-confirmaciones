import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Download, Check, AlertCircle, X, Sparkles, Users, ShieldCheck, Bot } from 'lucide-react';
import { apiFetch } from '../api';

export default function ExcelUploadModal({ isOpen, onClose, event, eventId, currentGuestsCount = 0, onImportSuccess, onOpenUpgradeBot }) {
    const [file, setFile] = useState(null);
    const [parsedData, setParsedData] = useState([]);
    const [rawRows, setRawRows] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [mapping, setMapping] = useState({ name: '', phone: '', passes: '', notes: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const activeEventId = event?.id || eventId;
    const maxGuests = event?.max_guests || 100;
    const planType = event?.plan_type || 'initial';
    const planName = planType === 'medium' ? 'Plan Medio (150)' : planType === 'premium' ? 'Plan Premium (+150)' : 'Plan Inicial (100)';
    const availableSlots = Math.max(0, maxGuests - currentGuestsCount);
    const capacityPercent = Math.min(100, Math.round((currentGuestsCount / maxGuests) * 100));

    if (!isOpen) return null;

    // Handle File Drop or Upload
    const handleFileChange = (e) => {
        const uploadedFile = e.target.files?.[0];
        if (uploadedFile) processFile(uploadedFile);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) processFile(droppedFile);
    };

    const processFile = (uploadedFile) => {
        setError(null);
        setFile(uploadedFile);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                // Convert sheet to json array of objects
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                if (data.length < 2) {
                    setError('El archivo Excel está vacío o no contiene suficientes filas.');
                    return;
                }

                const fileHeaders = data[0].map(h => String(h || '').trim());
                const fileRows = data.slice(1).filter(row => row.some(cell => cell !== null && cell !== ''));

                setHeaders(fileHeaders);
                setRawRows(fileRows);                // Auto-detect column mapping
                const autoMapping = { name: '', phone: '', table_number: '', category: '', notes: '' };

                fileHeaders.forEach((h, index) => {
                    const lower = h.toLowerCase();
                    if (!autoMapping.name && (lower.includes('nombre') || lower.includes('name') || lower.includes('invitado'))) {
                        autoMapping.name = h;
                    } else if (!autoMapping.phone && (lower.includes('telefono') || lower.includes('teléfono') || lower.includes('celular') || lower.includes('phone') || lower.includes('whatsapp') || lower.includes('movil') || lower.includes('móvil'))) {
                        autoMapping.phone = h;
                    } else if (!autoMapping.table_number && (lower.includes('mesa') || lower.includes('table') || lower.includes('asiento') || lower.includes('ubicacion') || lower.includes('ubicación') || lower.includes('lugar') || lower.includes('seating') || lower.includes('nro') || lower.includes('num'))) {
                        autoMapping.table_number = h;
                    } else if (!autoMapping.category && (lower.includes('tipo') || lower.includes('categoria') || lower.includes('categoría') || lower.includes('edad') || lower.includes('rango') || lower.includes('clasificacion') || lower.includes('clasificación') || lower.includes('joven') || lower.includes('adulto') || lower.includes('niño'))) {
                        autoMapping.category = h;
                    } else if (!autoMapping.notes && (lower.includes('nota') || lower.includes('observacion') || lower.includes('grupo') || lower.includes('familia') || lower.includes('notes'))) {
                        autoMapping.notes = h;
                    }
                });

                // Fallback to first 2 columns if not auto-detected
                if (!autoMapping.name && fileHeaders.length > 0) autoMapping.name = fileHeaders[0];
                if (!autoMapping.phone && fileHeaders.length > 1) autoMapping.phone = fileHeaders[1];

                setMapping(autoMapping);
                buildParsedList(fileHeaders, fileRows, autoMapping);
            } catch (err) {
                console.error(err);
                setError('Error al procesar el archivo Excel. Asegúrate de que sea un archivo .xlsx, .xls o .csv válido.');
            }
        };

        reader.readAsBinaryString(uploadedFile);
    };

    const buildParsedList = (currentHeaders, currentRows, currentMap) => {
        const nameIdx = currentHeaders.indexOf(currentMap.name);
        const phoneIdx = currentHeaders.indexOf(currentMap.phone);
        const tableIdx = currentHeaders.indexOf(currentMap.table_number);
        const categoryIdx = currentHeaders.indexOf(currentMap.category);
        const notesIdx = currentHeaders.indexOf(currentMap.notes);

        const list = currentRows.map((row, index) => {
            const rawName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
            let rawPhone = phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '';
            
            // Clean phone number (remove spaces, hyphens)
            rawPhone = rawPhone.replace(/[\s\-\(\)]/g, '');

            let tableVal = tableIdx !== -1 ? String(row[tableIdx] || '').trim() : '';
            if (tableVal && /^\d+$/.test(tableVal)) {
                tableVal = `Mesa ${tableVal}`;
            } else if (tableVal && /^mesa\s*(\d+)$/i.test(tableVal)) {
                const match = tableVal.match(/^mesa\s*(\d+)$/i);
                tableVal = `Mesa ${match[1]}`;
            }
            const categoryVal = categoryIdx !== -1 ? String(row[categoryIdx] || '').trim() : '';
            const notesVal = notesIdx !== -1 ? String(row[notesIdx] || '').trim() : '';

            let safeYouth = 0;
            let safeAdults = 0;
            let safeChildren = 0;
            let categoryLabel = 'Adulto';

            const catLower = categoryVal.toLowerCase();
            if (catLower.includes('joven') || catLower.includes('jóven') || catLower.includes('teen') || catLower.includes('adolescente')) {
                safeYouth = 1;
                categoryLabel = 'Joven';
            } else if (catLower.includes('niño') || catLower.includes('niña') || catLower.includes('nino') || catLower.includes('child') || catLower.includes('kid') || catLower.includes('infantil')) {
                safeChildren = 1;
                categoryLabel = 'Niño';
            } else {
                safeAdults = 1;
                categoryLabel = 'Adulto';
            }

            const isValid = rawName.length > 0 && rawPhone.length >= 6;

            return {
                id: index,
                name: rawName,
                phone: rawPhone,
                table_number: tableVal,
                adults: safeAdults,
                youth: safeYouth,
                children: safeChildren,
                categoryLabel,
                passes: 1,
                notes: notesVal,
                isValid
            };
        });

        setParsedData(list);
    };

    const maxPasses = (a, y, c) => {
        const sum = a + y + c;
        return sum > 0 ? sum : 1;
    };

    const handleMappingChange = (field, selectedHeader) => {
        const updated = { ...mapping, [field]: selectedHeader };
        setMapping(updated);
        buildParsedList(headers, rawRows, updated);
    };

    const handleDownloadTemplate = () => {
        const templateData = [
            { "Nombre Completo": "María García", "Teléfono (WhatsApp)": "595981123456", "Número de Mesa": "Mesa 1", "Tipo de Invitado": "Adulto", "Familia / Notas": "Familia de la Novia" },
            { "Nombre Completo": "Carlos Rodríguez", "Teléfono (WhatsApp)": "595981654321", "Número de Mesa": "Mesa 5", "Tipo de Invitado": "Joven", "Familia / Notas": "Amigo del Novio" },
            { "Nombre Completo": "Lucas Martínez", "Teléfono (WhatsApp)": "595981999888", "Número de Mesa": "Mesa Principal", "Tipo de Invitado": "Niño", "Familia / Notas": "Hijo de Padrinos" }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Invitados");
        XLSX.writeFile(workbook, "Plantilla_Invitados_Evento.xlsx");
    };

    const handleSubmitImport = async () => {
        const validGuests = parsedData.filter(g => g.isValid);
        if (validGuests.length === 0) {
            setError('No hay invitados válidos para importar. Revisa el mapeo de columnas.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { ok, json } = await apiFetch(`/api/events/${activeEventId}/guests/import`, {
                method: 'POST',
                body: JSON.stringify({
                    guests: validGuests.map(g => ({
                        name: g.name,
                        phone: g.phone,
                        table_number: g.table_number,
                        adults: g.adults,
                        youth: g.youth,
                        children: g.children,
                        passes: g.passes,
                        notes: g.notes
                    }))
                })
            });

            if (ok) {
                onImportSuccess(json?.message || 'Invitados importados con éxito');
                onClose();
            } else {
                setError(json?.message || 'Error al guardar la lista de invitados');
            }
        } catch (err) {
            console.error(err);
            setError('Error de conexión al servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Modal Header */}
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">
                            <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Importar Lista desde Excel</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Subí un archivo .xlsx, .xls o .csv con los invitados y sus teléfonos.</p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {/* Event Plan & Capacity Header */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-zinc-900 dark:text-white">
                                    {event?.couple_names || event?.title || 'Evento Seleccionado'}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/50">
                                    {planName}
                                </span>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Cupo actual: <strong>{currentGuestsCount}</strong> de <strong>{maxGuests}</strong> invitados registrados.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-left sm:text-right">
                                <div className={`text-sm font-black ${availableSlots > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {availableSlots > 0 ? `${availableSlots} cupos libres` : 'Sin cupos libres'}
                                </div>
                                <div className="text-[10px] text-zinc-400">Capacidad ocupada: {capacityPercent}%</div>
                            </div>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 ${availableSlots > 0 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'}`}>
                                {capacityPercent}%
                            </div>
                        </div>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Plan Limit Reached Alert */}
                    {availableSlots <= 0 && (
                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                                <div>
                                    <strong>Límite del plan alcanzado:</strong> Este evento ya cuenta con {currentGuestsCount} de los {maxGuests} invitados permitidos por su {planName}.
                                </div>
                            </div>
                            {onOpenUpgradeBot && (
                                <button
                                    type="button"
                                    onClick={onOpenUpgradeBot}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all whitespace-nowrap shrink-0"
                                >
                                    <Bot className="w-4 h-4" />
                                    <span>Solicitar Plan con Bot</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Anti-duplicate banner */}
                    <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300 text-xs font-medium flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span><strong>Protección anti-duplicados activa:</strong> Si subís un archivo con números de teléfono ya registrados, el sistema actualizará sus datos o los omitirá automáticamente sin duplicar registros ni restar cupos a tu plan.</span>
                    </div>

                    {/* Step 1: Upload or Dropzone */}
                    {!file ? (
                        <div
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-rose-200 dark:border-zinc-700 hover:border-rose-400 dark:hover:border-rose-500 rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer bg-rose-50/30 dark:bg-zinc-800/30 transition-all hover:scale-[0.99] group"
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800 shadow-md text-rose-500 group-hover:scale-110 transition-transform mb-4">
                                <Upload className="w-8 h-8" />
                            </div>
                            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                                Arrastrá y soltá tu archivo Excel aquí
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
                                Admites formatos <span className="font-semibold text-zinc-700 dark:text-zinc-300">.xlsx, .xls, .csv</span> con nombre, celular, mesa y tipo de invitado.
                            </p>

                            <div className="mt-6 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDownloadTemplate(); }}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                                >
                                    <Download className="w-4 h-4 text-emerald-500" />
                                    Descargar Excel de Ejemplo
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Step 2: Mapping & Preview */
                        <div className="space-y-6">
                            {/* File Info Bar */}
                            <div className="flex flex-wrap items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 gap-3">
                                <div className="flex items-center gap-3">
                                    <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                                    <div>
                                        <div className="text-sm font-bold text-zinc-900 dark:text-white">{file.name}</div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {parsedData.filter(g => g.isValid).length} invitados válidos detectados
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => { setFile(null); setParsedData([]); }}
                                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                                >
                                    Cambiar archivo
                                </button>
                            </div>

                            {/* Capacity Warning if file exceeds available slots */}
                            {parsedData.filter(g => g.isValid).length > availableSlots && (
                                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-300 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                                        <div>
                                            <strong>Atención de Capacidad:</strong> El archivo contiene {parsedData.filter(g => g.isValid).length} invitados, pero quedan solo <strong>{availableSlots} {availableSlots === 1 ? 'cupo libre' : 'cupos libres'}</strong> en el {planName} ({maxGuests} máx).
                                        </div>
                                    </div>
                                    {onOpenUpgradeBot && (
                                        <button
                                            type="button"
                                            onClick={onOpenUpgradeBot}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all whitespace-nowrap shrink-0"
                                        >
                                            <Bot className="w-4 h-4" />
                                            <span>Ampliar con Bot</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Column Mapping Selector */}
                            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                                <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-amber-500" /> Mapeo de Columnas
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Nombre Completo *</label>
                                        <select
                                            value={mapping.name}
                                            onChange={(e) => handleMappingChange('name', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">-- Seleccionar columna --</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Teléfono / WhatsApp *</label>
                                        <select
                                            value={mapping.phone}
                                            onChange={(e) => handleMappingChange('phone', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">-- Seleccionar columna --</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Nº de Mesa (Recepción)</label>
                                        <select
                                            value={mapping.table_number}
                                            onChange={(e) => handleMappingChange('table_number', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">-- Sin asignación --</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Tipo de Invitado</label>
                                        <select
                                            value={mapping.category}
                                            onChange={(e) => handleMappingChange('category', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">Por defecto (Adulto)</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Notas / Grupo</label>
                                        <select
                                            value={mapping.notes}
                                            onChange={(e) => handleMappingChange('notes', e.target.value)}
                                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium"
                                        >
                                            <option value="">Ninguna</option>
                                            {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Data Preview Table */}
                            <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                                <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/80 font-bold text-xs text-zinc-700 dark:text-zinc-300 flex justify-between items-center">
                                    <span>Vista previa de datos ({parsedData.length} filas)</span>
                                    <span className="text-[11px] text-zinc-500 font-normal">Verificá que el nombre, teléfono, mesa y tipo de invitado estén correctos</span>
                                </div>

                                <div className="max-h-60 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-zinc-100/70 dark:bg-zinc-800 text-zinc-500 uppercase tracking-wider sticky top-0">
                                            <tr>
                                                <th className="p-3">Estado</th>
                                                <th className="p-3">Nombre</th>
                                                <th className="p-3">Teléfono</th>
                                                <th className="p-3">Nº Mesa</th>
                                                <th className="p-3">Tipo Invitado</th>
                                                <th className="p-3">Notas</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {parsedData.map((row) => (
                                                <tr key={row.id} className={row.isValid ? 'bg-white dark:bg-zinc-900' : 'bg-rose-50/40 dark:bg-rose-950/20'}>
                                                    <td className="p-3 font-semibold">
                                                        {row.isValid ? (
                                                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                                <Check className="w-4 h-4" /> Listo
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                                                                <AlertCircle className="w-4 h-4" /> Incompleto
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 font-medium text-zinc-900 dark:text-white">{row.name || '(Sin nombre)'}</td>
                                                    <td className="p-3 text-zinc-600 dark:text-zinc-400 font-mono">{row.phone || '(Sin teléfono)'}</td>
                                                    <td className="p-3 text-amber-600 dark:text-amber-400 font-bold">{row.table_number || '-'}</td>
                                                    <td className="p-3">
                                                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                                                            {row.categoryLabel}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-zinc-500">{row.notes || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        Cancelar
                    </button>

                    {file && (
                        <button
                            type="button"
                            disabled={loading || parsedData.filter(g => g.isValid).length === 0}
                            onClick={handleSubmitImport}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 active:scale-95"
                        >
                            {loading ? (
                                <span>Importando...</span>
                            ) : (
                                <>
                                    <Users className="w-4 h-4" />
                                    <span>Importar {parsedData.filter(g => g.isValid).length} Invitados</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
