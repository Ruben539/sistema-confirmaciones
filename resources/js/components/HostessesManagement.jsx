import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus, Users, KeyRound, Power, Trash2, CalendarCheck, X, Save, Smartphone } from 'lucide-react';
import { apiFetch } from '../api';

const inputClass = 'w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-rose-500';

/**
 * Anfitrionas: users the planner creates to work the door of her events. They log in to the app and
 * the web, and only see the guest list of the events assigned here.
 */
export default function HostessesManagement({ user, events = [], showToast }) {
    const isAdmin = user?.role === 'admin';
    const [hostesses, setHostesses] = useState([]);
    const [planners, setPlanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', username: '', phone: '', password: '', planner_id: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [assigning, setAssigning] = useState(null); // hostess whose events are being edited
    const [selectedEventIds, setSelectedEventIds] = useState([]);

    const toast = (msg) => showToast && showToast(msg);

    const load = async () => {
        setLoading(true);
        const { ok, json } = await apiFetch('/api/hostesses');
        if (ok && json?.hostesses) setHostesses(json.hostesses);
        setLoading(false);
    };

    useEffect(() => {
        load();
        if (isAdmin) {
            apiFetch('/api/planners').then(({ ok, json }) => {
                if (ok && Array.isArray(json)) setPlanners(json);
            });
        }
    }, [isAdmin]);

    const replaceHostess = (updated) => setHostesses((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));

    const handleCreate = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        const { ok, json } = await apiFetch('/api/hostesses', {
            method: 'POST',
            body: JSON.stringify({ ...form, planner_id: isAdmin ? form.planner_id : undefined }),
        });
        setSaving(false);
        if (ok && json?.hostess) {
            setHostesses((prev) => [...prev, json.hostess].sort((a, b) => a.name.localeCompare(b.name)));
            setForm({ name: '', username: '', phone: '', password: '', planner_id: '' });
            setShowCreate(false);
            toast(json.message);
        } else {
            setError(json?.errors ? Object.values(json.errors).flat()[0] : json?.message || 'No se pudo crear la anfitriona.');
        }
    };

    const toggleActive = async (h) => {
        const { ok, json } = await apiFetch(`/api/hostesses/${h.id}`, {
            method: 'PUT',
            body: JSON.stringify({ is_active: !h.is_active }),
        });
        if (ok && json?.hostess) {
            replaceHostess(json.hostess);
            toast(json.hostess.is_active ? `${h.name} puede volver a ingresar.` : `${h.name} quedó desactivada: ya no puede ingresar.`);
        }
    };

    const resetPassword = async (h) => {
        const password = window.prompt(`Nueva contraseña para ${h.name} (mínimo 6 caracteres):`);
        if (!password) return;
        const { ok, json } = await apiFetch(`/api/hostesses/${h.id}`, {
            method: 'PUT',
            body: JSON.stringify({ password }),
        });
        toast(ok ? `Contraseña de ${h.name} actualizada. Su sesión en la app se cerró.` : json?.message || 'No se pudo cambiar la contraseña.');
    };

    const removeHostess = async (h) => {
        if (!window.confirm(`¿Eliminar a ${h.name}? Si solo querés quitarle el acceso, usá "Desactivar": así su nombre se conserva en el historial de los invitados.`)) return;
        const { ok, json } = await apiFetch(`/api/hostesses/${h.id}`, { method: 'DELETE' });
        if (ok) {
            setHostesses((prev) => prev.filter((x) => x.id !== h.id));
            toast(json?.message || 'Anfitriona eliminada.');
        }
    };

    const openAssign = (h) => {
        setAssigning(h);
        setSelectedEventIds(h.event_ids || []);
    };

    // Only events of the hostess's own planner can be assigned
    const assignableEvents = useMemo(() => {
        if (!assigning) return [];
        return events.filter((ev) => Number(ev.user_id) === Number(assigning.planner_id));
    }, [assigning, events]);

    const saveAssignments = async () => {
        const { ok, json } = await apiFetch(`/api/hostesses/${assigning.id}/events`, {
            method: 'PUT',
            body: JSON.stringify({ event_ids: selectedEventIds }),
        });
        if (ok && json?.hostess) {
            replaceHostess(json.hostess);
            setAssigning(null);
            toast(json.message);
        } else {
            toast(json?.message || 'No se pudieron guardar los eventos.');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xl">
                <div className="space-y-1">
                    <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                        <Users className="w-5 h-5 text-rose-500" /> Anfitrionas
                    </h2>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 max-w-2xl">
                        Personas que trabajan en la puerta de tus eventos. Cada una ingresa con su usuario a la app y a la web,
                        y solo ve la lista de invitados de los eventos que le asignes: acredita ingresos, cambia mesas y da altas en puerta.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate((v) => !v)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-black shadow-md shrink-0"
                >
                    <UserPlus className="w-4 h-4" /> Nueva anfitriona
                </button>
            </div>

            {showCreate && (
                <form onSubmit={handleCreate} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4 shadow-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Nombre</label>
                            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="María González" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Usuario (para ingresar)</label>
                            <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })} className={inputClass} placeholder="maria.puerta" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Contraseña</label>
                            <input required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} placeholder="Mínimo 6 caracteres" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Teléfono (opcional)</label>
                            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} placeholder="0981 123456" />
                        </div>
                        {isAdmin && (
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Trabaja para (planner)</label>
                                <select required value={form.planner_id} onChange={(e) => setForm({ ...form, planner_id: e.target.value })} className={inputClass}>
                                    <option value="">-- Elegir planner --</option>
                                    {planners.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300">Cancelar</button>
                        <button disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black disabled:opacity-60">
                            <Save className="w-4 h-4" /> {saving ? 'Creando...' : 'Crear anfitriona'}
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="p-12 text-center text-xs text-zinc-500">Cargando anfitrionas...</div>
            ) : hostesses.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 space-y-2">
                    <Smartphone className="w-8 h-8 mx-auto text-zinc-400" />
                    <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">Todavía no hay anfitrionas</p>
                    <p>Creá una y asignale tus eventos para que pueda acreditar invitados desde su celular.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hostesses.map((h) => (
                        <div key={h.id} className={`bg-white dark:bg-zinc-900 border rounded-3xl p-5 space-y-3 shadow-sm ${h.is_active ? 'border-zinc-200 dark:border-zinc-800' : 'border-zinc-200 dark:border-zinc-800 opacity-60'}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-black text-zinc-900 dark:text-white">{h.name}</div>
                                    <div className="text-xs text-zinc-500">@{h.username}{h.phone ? ` · ${h.phone}` : ''}</div>
                                    {isAdmin && h.planner_name && <div className="text-[11px] text-amber-600 font-bold mt-0.5">Planner: {h.planner_name}</div>}
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${h.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>
                                    {h.is_active ? 'ACTIVA' : 'DESACTIVADA'}
                                </span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {h.events.length === 0 ? (
                                    <span className="text-xs text-zinc-400 italic">Sin eventos asignados</span>
                                ) : (
                                    h.events.map((ev) => (
                                        <span key={ev.id} className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px] font-bold">
                                            {ev.title}
                                        </span>
                                    ))
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2 pt-1">
                                <button onClick={() => openAssign(h)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold">
                                    <CalendarCheck className="w-3.5 h-3.5" /> Asignar eventos
                                </button>
                                <button onClick={() => toggleActive(h)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                    <Power className="w-3.5 h-3.5" /> {h.is_active ? 'Desactivar' : 'Activar'}
                                </button>
                                <button onClick={() => resetPassword(h)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                    <KeyRound className="w-3.5 h-3.5" /> Contraseña
                                </button>
                                <button onClick={() => removeHostess(h)} title="Eliminar" className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {assigning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                            <div>
                                <div className="text-[11px] font-bold text-zinc-400 uppercase">Eventos de</div>
                                <div className="text-base font-black text-zinc-900 dark:text-white">{assigning.name}</div>
                            </div>
                            <button onClick={() => setAssigning(null)} className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-2">
                            {assignableEvents.length === 0 ? (
                                <p className="text-xs text-zinc-500">No hay eventos de esta planner para asignar.</p>
                            ) : (
                                assignableEvents.map((ev) => (
                                    <label key={ev.id} className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                                        <input
                                            type="checkbox"
                                            checked={selectedEventIds.includes(ev.id)}
                                            onChange={(e) =>
                                                setSelectedEventIds((prev) => (e.target.checked ? [...prev, ev.id] : prev.filter((id) => id !== ev.id)))
                                            }
                                            className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500"
                                        />
                                        <div>
                                            <div className="text-xs font-bold text-zinc-900 dark:text-white">{ev.couple_names || ev.title}</div>
                                            {ev.event_date && <div className="text-[11px] text-zinc-500">{String(ev.event_date).slice(0, 10).split('-').reverse().join('/')}</div>}
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
                            <button onClick={() => setAssigning(null)} className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300">Cancelar</button>
                            <button onClick={saveAssignments} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black">
                                <Save className="w-4 h-4" /> Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
