import React, { useState, useEffect } from 'react';
import { X, Film, Camera, MessageSquare, Trash2, CheckCircle, EyeOff, Tv, ExternalLink, AlertCircle } from 'lucide-react';
import { apiFetch } from '../api';

export default function EventDedicationsManagerModal({ event, onClose }) {
    const [dedications, setDedications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    useEffect(() => {
        fetchDedications();
    }, [event.id]);

    const fetchDedications = async () => {
        try {
            const { ok, json } = await apiFetch(`/api/events/${event.id}/dedications`);
            if (ok && json) {
                setDedications(json);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleApprove = async (dedicationId) => {
        setActionLoadingId(dedicationId);
        try {
            const { ok, json } = await apiFetch(`/api/events/${event.id}/dedications/${dedicationId}/toggle`, {
                method: 'POST'
            });
            if (ok && json?.dedication) {
                setDedications(prev => prev.map(d => d.id === dedicationId ? json.dedication : d));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleDelete = async (dedicationId) => {
        if (!confirm('¿Estás seguro de eliminar esta dedicatoria?')) return;
        setActionLoadingId(dedicationId);
        try {
            const { ok } = await apiFetch(`/api/events/${event.id}/dedications/${dedicationId}`, {
                method: 'DELETE'
            });
            if (ok) {
                setDedications(prev => prev.filter(d => d.id !== dedicationId));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoadingId(null);
        }
    };

    const liveProjectionUrl = `/evento/${event.id}/proyeccion`;

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 font-sans">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl text-white overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 text-zinc-950 shadow-lg">
                            <Tv className="w-5 h-5 font-black" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                                Moderación & Pantalla Gigante
                            </span>
                            <h3 className="text-lg font-black text-white">
                                Dedicatorias y Fotos del Salón ({dedications.length})
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Open Big Screen / Projector */}
                        <a
                            href={liveProjectionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-zinc-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all hover:scale-105"
                        >
                            <Tv className="w-4 h-4" />
                            <span>Abrir Pantalla Gigante (F11)</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Info Note */}
                <div className="px-6 py-3 bg-zinc-950/40 border-b border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
                    <span>
                        Podés moderar los saludos antes o durante la fiesta. Solo los marcados como <strong>'Aprobados'</strong> saldrán en el proyector.
                    </span>
                    <span className="text-[11px] font-bold text-amber-400">
                        {dedications.filter(d => d.is_approved).length} aprobados para emitir
                    </span>
                </div>

                {/* Dedications Grid */}
                <div className="p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="py-12 text-center text-zinc-400 text-xs font-semibold">
                            Cargando dedicatorias...
                        </div>
                    ) : dedications.length === 0 ? (
                        <div className="py-16 text-center text-zinc-500 text-xs space-y-3">
                            <Camera className="w-12 h-12 mx-auto text-zinc-600" />
                            <h4 className="text-base font-black text-white">No hay dedicatorias todavía</h4>
                            <p className="text-zinc-400 max-w-sm mx-auto">
                                Cuando los invitados suban fotos o videos desde su invitación o escaneando el QR de la pantalla, aparecerán aquí.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {dedications.map(item => (
                                <div
                                    key={item.id}
                                    className={`rounded-2xl border p-3.5 flex flex-col justify-between transition-all ${
                                        item.is_approved
                                            ? 'bg-zinc-800/80 border-zinc-700/80 shadow-md'
                                            : 'bg-zinc-900/60 border-zinc-800 opacity-60'
                                    }`}
                                >
                                    <div className="space-y-2.5">
                                        {/* Media Preview */}
                                        {item.type === 'video' ? (
                                            <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                                                <video src={item.media_url} controls className="w-full h-full object-cover" />
                                                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-[9px] font-black uppercase text-amber-300 flex items-center gap-1">
                                                    <Film className="w-3 h-3" /> Video
                                                </span>
                                            </div>
                                        ) : item.type === 'photo' ? (
                                            <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                                                <img src={item.media_url} alt="Dedication" className="w-full h-full object-cover" />
                                                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-[9px] font-black uppercase text-rose-300 flex items-center gap-1">
                                                    <Camera className="w-3 h-3" /> Foto
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl p-3 bg-zinc-900/90 border border-zinc-800 flex items-center gap-2 text-zinc-400 text-xs">
                                                <MessageSquare className="w-4 h-4 text-amber-400" />
                                                <span>Mensaje de texto</span>
                                            </div>
                                        )}

                                        {/* Author & Message */}
                                        <div>
                                            <div className="text-xs font-black text-white">{item.author_name}</div>
                                            {item.message && (
                                                <p className="text-[11px] text-zinc-300 italic mt-1 line-clamp-3">
                                                    "{item.message}"
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="pt-3 mt-3 border-t border-zinc-700/60 flex items-center justify-between">
                                        <button
                                            type="button"
                                            disabled={actionLoadingId === item.id}
                                            onClick={() => handleToggleApprove(item.id)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                                                item.is_approved
                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                                    : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700'
                                            }`}
                                        >
                                            {item.is_approved ? (
                                                <>
                                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                                    <span>En Proyector</span>
                                                </>
                                            ) : (
                                                <>
                                                    <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
                                                    <span>Oculto</span>
                                                </>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            disabled={actionLoadingId === item.id}
                                            onClick={() => handleDelete(item.id)}
                                            className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition-colors"
                                            title="Eliminar dedicatoria"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
