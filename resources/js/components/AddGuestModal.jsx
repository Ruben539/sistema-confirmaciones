import React, { useState, useEffect } from 'react';
import { UserPlus, Pencil, X, User, Phone, Users, FileText, Minus, Plus, Baby } from 'lucide-react';
import { apiFetch } from '../api';

export default function AddGuestModal({ isOpen, onClose, eventId, guestToEdit, onGuestAdded, onGuestUpdated }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [tableNumber, setTableNumber] = useState('');
    // People covered by this invitation: the invited person plus companions (e.g. a mother and her daughter)
    const [counts, setCounts] = useState({ adults: 1, youth: 0, children: 0 });
    const [companions, setCompanions] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (guestToEdit) {
            setName(guestToEdit.name || '');
            setPhone(guestToEdit.phone || '');
            setTableNumber(guestToEdit.table_number || '');
            setNotes(guestToEdit.notes || '');

            setCounts({
                adults: guestToEdit.adults ?? 1,
                youth: guestToEdit.youth ?? 0,
                children: guestToEdit.children ?? 0,
            });
            setCompanions(guestToEdit.companions || '');
        } else {
            setName('');
            setPhone('');
            setTableNumber('');
            setCounts({ adults: 1, youth: 0, children: 0 });
            setCompanions('');
            setNotes('');
        }
        setError(null);
    }, [guestToEdit, isOpen]);

    if (!isOpen) return null;

    const totalPeople = counts.adults + counts.youth + counts.children;

    const changeCount = (key, delta) => {
        setCounts(prev => ({ ...prev, [key]: Math.max(0, Math.min(20, prev[key] + delta)) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const isEditing = !!guestToEdit;
        const url = isEditing ? `/api/guests/${guestToEdit.id}` : `/api/events/${eventId}/guests`;
        const method = isEditing ? 'PUT' : 'POST';

        const { adults, youth, children } = counts;
        const passes = adults + youth + children;
        if (passes < 1) {
            setError('La invitación debe incluir al menos una persona.');
            setLoading(false);
            return;
        }

        try {
            const { ok, json } = await apiFetch(url, {
                method,
                body: JSON.stringify({
                    name,
                    phone,
                    table_number: tableNumber,
                    adults,
                    youth,
                    children,
                    companions,
                    notes
                })
            });

            if (ok) {
                if (isEditing) {
                    if (onGuestUpdated) onGuestUpdated(json?.guest || { ...guestToEdit, name, phone, table_number: tableNumber, adults, youth, children, companions, notes, passes });
                } else {
                    if (onGuestAdded) onGuestAdded(json?.guest);
                }
                onClose();
            } else {
                setError(json?.message || `Error al ${isEditing ? 'actualizar' : 'agregar'} el invitado`);
            }
        } catch (err) {
            console.error(err);
            setError('Error al comunicarse con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-2xl text-blue-600 dark:text-blue-400 border border-blue-200/50">
                            {guestToEdit ? <Pencil className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                                {guestToEdit ? 'Editar Invitado' : 'Agregar Invitado Manualmente'}
                            </h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {guestToEdit ? 'Modificá los datos del invitado.' : 'Una invitación por teléfono; sumá acá a sus acompañantes.'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-blue-500" /> Nombre Completo del Invitado *
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="ej: Camila López"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-green-500" /> Celular *
                            </label>
                            <input
                                type="text"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="0981630070"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-amber-500" /> Nº de Mesa (Recepción)
                            </label>
                            <input
                                type="text"
                                value={tableNumber}
                                onChange={(e) => setTableNumber(e.target.value)}
                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="ej: Mesa 1 / Mesa Principal"
                            />
                        </div>
                    </div>

                    {/* People included in the invitation */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-rose-500" /> Personas en esta invitación *
                            </label>
                            <span className="text-[11px] font-black text-rose-600 dark:text-rose-400">
                                {totalPeople} {totalPeople === 1 ? 'pase' : 'pases'}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { key: 'adults', label: '👤 Adultos' },
                                { key: 'youth', label: '⚡ Jóvenes' },
                                { key: 'children', label: '👶 Niños / Bebés' },
                            ].map(({ key, label }) => (
                                <div key={key} className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-center space-y-1.5">
                                    <div className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300">{label}</div>
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => changeCount(key, -1)}
                                            disabled={counts[key] === 0 || totalPeople === 1}
                                            className="p-1 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 disabled:opacity-30"
                                        >
                                            <Minus className="w-3 h-3" />
                                        </button>
                                        <span className="w-5 text-sm font-black text-zinc-900 dark:text-white">{counts[key]}</span>
                                        <button
                                            type="button"
                                            onClick={() => changeCount(key, 1)}
                                            className="p-1 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
                                        >
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Incluí al invitado principal. Ej: una mamá que lleva a su hija → 1 adulto + 1 niño. Recibe un solo link y confirma por las dos.
                        </p>

                        {totalPeople > 1 && (
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                    <Baby className="w-3.5 h-3.5 text-teal-500" /> Nombres de acompañantes (Opcional)
                                </label>
                                <input
                                    type="text"
                                    value={companions}
                                    onChange={(e) => setCompanions(e.target.value)}
                                    maxLength={255}
                                    className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="ej: Sofía (hija, 4 años)"
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-zinc-400" /> Notas / Observaciones (Opcional)
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="ej: Celíaco / Familiar directo"
                        />
                    </div>

                    {/* Submit Buttons */}
                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : (guestToEdit ? 'Guardar Cambios' : 'Agregar Invitado')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
