import React, { useState, useEffect } from 'react';
import { UserPlus, Pencil, X, User, Phone, Users, FileText } from 'lucide-react';

export default function AddGuestModal({ isOpen, onClose, eventId, guestToEdit, onGuestAdded, onGuestUpdated }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [tableNumber, setTableNumber] = useState('');
    const [category, setCategory] = useState('adult'); // 'adult', 'youth', 'child'
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (guestToEdit) {
            setName(guestToEdit.name || '');
            setPhone(guestToEdit.phone || '');
            setTableNumber(guestToEdit.table_number || '');
            setNotes(guestToEdit.notes || '');

            if ((guestToEdit.children || 0) > 0) {
                setCategory('child');
            } else if ((guestToEdit.youth || 0) > 0) {
                setCategory('youth');
            } else {
                setCategory('adult');
            }
        } else {
            setName('');
            setPhone('');
            setTableNumber('');
            setCategory('adult');
            setNotes('');
        }
        setError(null);
    }, [guestToEdit, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const isEditing = !!guestToEdit;
        const url = isEditing ? `/api/guests/${guestToEdit.id}` : `/api/events/${eventId}/guests`;
        const method = isEditing ? 'PUT' : 'POST';

        const adults = category === 'adult' ? 1 : 0;
        const youth = category === 'youth' ? 1 : 0;
        const children = category === 'child' ? 1 : 0;

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    phone,
                    table_number: tableNumber,
                    category,
                    adults,
                    youth,
                    children,
                    passes: 1,
                    notes
                })
            });

            let json;
            try {
                json = await res.json();
            } catch (parseErr) {
                json = {};
            }

            if (res.ok) {
                if (isEditing) {
                    if (onGuestUpdated) onGuestUpdated(json.guest || { ...guestToEdit, name, phone, table_number: tableNumber, adults, youth, children, notes, passes: 1 });
                } else {
                    if (onGuestAdded) onGuestAdded(json.guest);
                }
                onClose();
            } else {
                setError(json.message || `Error al ${isEditing ? 'actualizar' : 'agregar'} el invitado`);
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
                                {guestToEdit ? 'Modificá los datos del invitado.' : 'Cada invitado ingresado es un registro individual.'}
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

                    {/* Single Guest Category Selector */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2">
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-rose-500" /> Categoría del Invitado *
                        </label>

                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setCategory('adult')}
                                className={`p-3 rounded-xl text-xs font-bold transition-all border ${category === 'adult' ? 'bg-rose-500 text-white border-rose-500 shadow-md' : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'}`}
                            >
                                👤 Adulto
                            </button>
                            <button
                                type="button"
                                onClick={() => setCategory('youth')}
                                className={`p-3 rounded-xl text-xs font-bold transition-all border ${category === 'youth' ? 'bg-rose-500 text-white border-rose-500 shadow-md' : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'}`}
                            >
                                ⚡ Joven
                            </button>
                            <button
                                type="button"
                                onClick={() => setCategory('child')}
                                className={`p-3 rounded-xl text-xs font-bold transition-all border ${category === 'child' ? 'bg-rose-500 text-white border-rose-500 shadow-md' : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'}`}
                            >
                                👶 Niño
                            </button>
                        </div>
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
