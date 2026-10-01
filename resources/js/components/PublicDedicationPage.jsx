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
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [error, setError] = useState(null);

    const photoCameraInputRef = useRef(null);
    const videoCameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    useEffect(() => {
        fetchEvent();
    }, [eventId]);

    // Client-side image optimization for mobile camera photos (which are usually 5MB-15MB)
    const compressImage = (file, maxWidth = 1920, maxHeight = 1080, quality = 0.85) => {
        if (!file.type.startsWith('image/') || file.size < 800 * 1024) {
            return Promise.resolve(file);
        }
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new window.Image();
                img.src = event.target.result;
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            resolve(compressedFile);
                        } else {
                            resolve(file);
                        }
                    }, 'image/jpeg', quality);
                };
                img.onerror = () => resolve(file);
            };
            reader.onerror = () => resolve(file);
        });
    };

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

    const handleFileChange = async (e) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        if (selected.size > 50 * 1024 * 1024) {
            setError('El archivo no debe superar los 50 MB.');
            return;
        }

        setError(null);

        const isVideo = selected.type.startsWith('video') || selected.name?.match(/\.(mp4|mov|webm|3gp|m4v)$/i);
        setType(isVideo ? 'video' : 'photo');
        setPreviewUrl(URL.createObjectURL(selected));

        if (!isVideo) {
            setIsOptimizing(true);
            try {
                const optimized = await compressImage(selected);
                setFile(optimized);
            } catch (err) {
                setFile(selected);
            } finally {
                setIsOptimizing(false);
            }
        } else {
            setFile(selected);
        }
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
            let fileToSend = file;
            if (file && type === 'photo' && file.size > 800 * 1024) {
                try {
                    fileToSend = await compressImage(file);
                } catch (e) {
                    console.warn('Compression fallback', e);
                }
            }

            const formData = new FormData();
            formData.append('author_name', authorName.trim());
            formData.append('type', fileToSend ? type : 'text');
            if (message.trim()) formData.append('message', message.trim());
            if (fileToSend) formData.append('media', fileToSend);

            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/events/${eventId}/public-dedication`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: formData
            });

            let json = null;
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                try {
                    json = await res.json();
                } catch (e) {}
            }

            if (res.ok) {
                setSubmitted(true);
            } else {
                if (res.status === 413) {
                    setError('La foto o video supera el tamaño máximo permitido por el servidor. Probá con un archivo más liviano.');
                } else {
                    setError(json?.message || 'Error al enviar tu saludo. Verificá el tamaño del archivo.');
                }
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
                            
                            {/* Native Direct Photo Camera Input */}
                            <input
                                ref={photoCameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {/* Native Direct Video Camera Input (Short Video like WhatsApp) */}
                            <input
                                ref={videoCameraInputRef}
                                type="file"
                                accept="video/mp4,video/quicktime,video/webm,video/*"
                                capture="environment"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {/* Gallery Input for Photos or Videos */}
                            <input
                                ref={galleryInputRef}
                                type="file"
                                accept="image/*,video/mp4,video/quicktime,video/webm,video/*"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {previewUrl ? (
                                <div className="relative rounded-2xl overflow-hidden border border-zinc-700 bg-zinc-950 p-3 text-center space-y-2">
                                    {type === 'video' ? (
                                        <div className="space-y-1">
                                            <video src={previewUrl} controls className="max-h-60 mx-auto rounded-xl w-full object-contain shadow-lg" />
                                            <div className="text-[11px] font-bold text-rose-400 flex items-center justify-center gap-1">
                                                <Film className="w-3.5 h-3.5" /> Video listo para proyectar
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <img src={previewUrl} alt="Preview" className="max-h-60 mx-auto rounded-xl object-contain shadow-lg" />
                                            <div className="text-[11px] font-bold text-amber-400 flex items-center justify-center gap-1">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Foto lista para proyectar {isOptimizing ? '(Optimizando...)' : ''}
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-center gap-3 pt-2 border-t border-zinc-800">
                                        <button
                                            type="button"
                                            onClick={() => photoCameraInputRef.current?.click()}
                                            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                                        >
                                            <Camera className="w-3.5 h-3.5" /> Sacar otra foto
                                        </button>
                                        <span className="text-zinc-600">|</span>
                                        <button
                                            type="button"
                                            onClick={() => videoCameraInputRef.current?.click()}
                                            className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                                        >
                                            <Film className="w-3.5 h-3.5" /> Grabar otro video
                                        </button>
                                        <span className="text-zinc-600">|</span>
                                        <button
                                            type="button"
                                            onClick={() => { setFile(null); setPreviewUrl(null); }}
                                            className="text-xs font-bold text-zinc-400 hover:text-white cursor-pointer"
                                        >
                                            Quitar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    <div className="grid grid-cols-2 gap-2.5">
                                        {/* Action 1: Instant Photo Camera */}
                                        <button
                                            type="button"
                                            onClick={() => photoCameraInputRef.current?.click()}
                                            className="p-4 rounded-2xl border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-500/10 hover:bg-amber-500/15 text-center flex flex-col items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer group"
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-amber-500/20">
                                                <Camera className="w-6 h-6 stroke-[2.5]" />
                                            </div>
                                            <div>
                                                <span className="block text-xs font-black text-amber-300 uppercase tracking-wide">
                                                    Sacar Foto Ya
                                                </span>
                                                <span className="block text-[10px] text-zinc-400 mt-0.5">
                                                    Abre la cámara del celular
                                                </span>
                                            </div>
                                        </button>

                                        {/* Action 2: Short Video (WhatsApp-style) */}
                                        <button
                                            type="button"
                                            onClick={() => videoCameraInputRef.current?.click()}
                                            className="p-4 rounded-2xl border-2 border-dashed border-rose-500/40 hover:border-rose-400 bg-rose-500/10 hover:bg-rose-500/15 text-center flex flex-col items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer group"
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-rose-500 text-zinc-950 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-rose-500/20">
                                                <Film className="w-6 h-6 stroke-[2.5]" />
                                            </div>
                                            <div>
                                                <span className="block text-xs font-black text-rose-300 uppercase tracking-wide">
                                                    Grabar Video
                                                </span>
                                                <span className="block text-[10px] text-zinc-400 mt-0.5">
                                                    Video corto en vivo (hasta 30s)
                                                </span>
                                            </div>
                                        </button>
                                    </div>

                                    {/* Action 3: Choose from Gallery (Photos or Videos) */}
                                    <button
                                        type="button"
                                        onClick={() => galleryInputRef.current?.click()}
                                        className="w-full p-3 rounded-xl border border-zinc-700 hover:border-zinc-500 bg-zinc-800/60 hover:bg-zinc-800 flex items-center justify-center gap-2 text-xs font-bold text-zinc-300 transition-colors cursor-pointer"
                                    >
                                        <Upload className="w-4 h-4 text-zinc-400" />
                                        <span>O elegir una foto o video desde tu Galería</span>
                                    </button>
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
                            disabled={submitting || isOptimizing}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 hover:opacity-95 text-zinc-950 font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-amber-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {submitting ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                                    <span>Subiendo a la pantalla gigante...</span>
                                </>
                            ) : isOptimizing ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                                    <span>Optimizando foto para pantalla gigante...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4 text-zinc-950" />
                                    <span>Enviar a la Pantalla Gigante</span>
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
