import React, { useState, useEffect, useRef } from 'react';
import { Camera, Film, Send, Sparkles, CheckCircle2, Heart, Upload, AlertCircle, RefreshCw } from 'lucide-react';
import { apiFetch } from '../api';

export default function PublicDedicationPage({ eventId }) {
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authorName, setAuthorName] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState('photo'); // 'photo', 'video', 'text'
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchEvent();
    }, [eventId]);

    const fetchEvent = async () => {
        try {
            const { ok, json } = await apiFetch(`/api/events/${eventId}/public-invitation`);
            if (ok && json?.event) {
                setEvent(json.event);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        if (selected.size > 40 * 1024 * 1024) {
            setError('El archivo no debe superar los 40 MB.');
            return;
        }

        setError(null);
        setFile(selected);

        const isVideo = selected.type.startsWith('video');
        setType(isVideo ? 'video' : 'photo');
        setPreviewUrl(URL.createObjectURL(selected));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!authorName.trim()) {
            setError('Por favor ingresá tu nombre.');
            return;
        }

        if (!file && !message.trim()) {
            setError('Por favor seleccioná una foto/video o escribí un mensaje.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('author_name', authorName.trim());
            formData.append('type', file ? type : 'text');
            if (message.trim()) formData.append('message', message.trim());
            if (file) formData.append('media', file);

            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/events/${eventId}/public-dedication`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: formData
            });

            const json = await res.json();

            if (res.ok) {
                setSubmitted(true);
            } else {
                setError(json?.message || 'Error al enviar tu saludo. Verificá el tamaño del archivo.');
            }
        } catch (err) {
            console.error(err);
            setError('Error de conexión al subir tu dedicatoria.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-white font-sans">
                <Sparkles className="w-10 h-10 text-amber-400 animate-spin-slow" />
                <span className="text-sm font-bold text-zinc-400 mt-3">Cargando...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-white p-4 sm:p-6 flex items-center justify-center font-sans">
            <div className="w-full max-w-lg bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-6">
                {/* Decorative glow */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black tracking-widest uppercase">
                        <Sparkles className="w-3.5 h-3.5" /> Muro de la Fiesta en Vivo
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        {event?.couple_names || event?.title || 'Envía tu Saludo'}
                    </h1>
                    <p className="text-xs text-zinc-400 font-medium">
                        Tu foto, video o dedicatoria saldrá en vivo en la pantalla gigante del salón.
                    </p>
                </div>

                {submitted ? (
                    <div className="text-center py-8 space-y-5 animate-fade-in">
                        <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 text-zinc-950 rounded-3xl flex items-center justify-center mx-auto shadow-2xl">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-black text-white">¡Dedicatoria Enviada!</h2>
                        <p className="text-xs text-zinc-300 max-w-sm mx-auto leading-relaxed">
                            ¡Muchas gracias, <strong>{authorName}</strong>! Tu dedicatoria ha sido enviada para proyectarse en la pantalla gigante.
                        </p>
                        <button
                            onClick={() => {
                                setSubmitted(false);
                                setFile(null);
                                setPreviewUrl(null);
                                setMessage('');
                            }}
                            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black rounded-2xl transition-all shadow-md"
                        >
                            Enviar otra foto o video
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Author Name */}
                        <div>
                            <label className="block text-xs font-black text-zinc-300 uppercase tracking-wider mb-1.5">
                                Tu Nombre y Apellido *
                            </label>
                            <input
                                type="text"
                                required
                                value={authorName}
                                onChange={(e) => setAuthorName(e.target.value)}
                                placeholder="Ej: Sofía Martínez, Familia González"
                                className="w-full text-xs rounded-2xl border border-zinc-700 bg-zinc-800/80 text-white p-3 font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>

                        {/* Photo / Video Selector or Camera Recording */}
                        <div>
                            <label className="block text-xs font-black text-zinc-300 uppercase tracking-wider mb-1.5">
                                Subir Foto o Video Corto (Opcional)
                            </label>
                            
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,video/*"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {previewUrl ? (
                                <div className="relative rounded-2xl overflow-hidden border border-zinc-700 bg-zinc-950 p-2 text-center">
                                    {type === 'video' ? (
                                        <video src={previewUrl} controls className="max-h-56 mx-auto rounded-xl" />
                                    ) : (
                                        <img src={previewUrl} alt="Preview" className="max-h-56 mx-auto rounded-xl object-contain" />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => { setFile(null); setPreviewUrl(null); }}
                                        className="mt-2 text-xs font-bold text-rose-400 hover:text-rose-300 hover:underline"
                                    >
                                        Cambiar archivo
                                    </button>
                                </div>
                            ) : (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="cursor-pointer border-2 border-dashed border-zinc-700 hover:border-amber-400 rounded-2xl p-6 text-center space-y-2 bg-zinc-800/40 hover:bg-zinc-800/70 transition-all"
                                >
                                    <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
                                        <Camera className="w-6 h-6" />
                                    </div>
                                    <div className="text-xs font-black text-white">
                                        Tocá aquí para tomar una foto o grabar un video
                                    </div>
                                    <div className="text-[11px] text-zinc-400">
                                        O seleccioná un archivo de tu galería (Foto o Video hasta 30s)
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Emotive Message */}
                        <div>
                            <label className="block text-xs font-black text-zinc-300 uppercase tracking-wider mb-1.5">
                                Tu Mensaje o Dedicatoria
                            </label>
                            <textarea
                                rows={3}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="¡Muchas felicidades en esta noche mágica! Los queremos un montón..."
                                className="w-full text-xs rounded-2xl border border-zinc-700 bg-zinc-800/80 text-white p-3 font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 hover:opacity-95 text-zinc-950 font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-amber-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Send className="w-4 h-4 text-zinc-950" />
                            <span>{submitting ? 'Subiendo dedicatoria...' : 'Enviar a la Pantalla Gigante'}</span>
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
