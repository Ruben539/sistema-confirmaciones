import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Maximize2, Minimize2, Volume2, VolumeX, QrCode, Heart, Camera, Film, RefreshCw, X } from 'lucide-react';
import { apiFetch } from '../api';

export default function LiveProjectionScreen({ eventId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [showQrModal, setShowQrModal] = useState(false);

    const videoRef = useRef(null);
    const timerRef = useRef(null);

    const fetchFeed = async () => {
        try {
            const { ok, json } = await apiFetch(`/api/events/${eventId}/live-feed`);
            if (ok && json) {
                setData(json);
            }
        } catch (err) {
            console.error('Error fetching live projection feed:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeed();
        // Poll for new dedications every 15 seconds
        const pollInterval = setInterval(fetchFeed, 15000);
        return () => clearInterval(pollInterval);
    }, [eventId]);

    const dedications = data?.dedications || [];
    const event = data?.event || null;

    // Slide rotation timer
    useEffect(() => {
        if (!dedications || dedications.length <= 1) return;

        const currentItem = dedications[currentIndex];

        // If it's a video, wait for it to end or max 20 seconds
        if (currentItem?.type === 'video') {
            // Handled by onEnded on video element
            return;
        }

        // Photos or text: rotate every 7 seconds
        timerRef.current = setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % dedications.length);
        }, 7000);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [currentIndex, dedications]);

    const handleVideoEnded = () => {
        setCurrentIndex((prev) => (prev + 1) % dedications.length);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => console.error(err));
            setIsFullscreen(true);
        } else {
            document.exitFullscreen().catch((err) => console.error(err));
            setIsFullscreen(false);
        }
    };

    const uploadUrl = `${window.location.origin}/evento/${eventId}/dedicatoria`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(uploadUrl)}`;

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white space-y-4 font-sans">
                <Sparkles className="w-12 h-12 text-amber-400 animate-spin-slow" />
                <h2 className="text-xl font-black tracking-wider uppercase">Cargando Pantalla de Proyección...</h2>
            </div>
        );
    }

    const currentItem = dedications.length > 0 ? dedications[currentIndex] : null;

    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden select-none font-sans flex flex-col justify-between">
            {/* Background Ambient Lighting & Particles */}
            <div className="absolute inset-0 bg-radial-gradient from-zinc-900/60 via-black to-black pointer-events-none" />
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

            {/* TOP BAR: EVENT HEADER & CONTROLS */}
            <header className="relative z-20 px-8 py-5 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/40 to-transparent">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-amber-400 to-rose-500 rounded-2xl shadow-lg shadow-amber-500/20">
                        <Heart className="w-6 h-6 text-zinc-950 fill-zinc-950" />
                    </div>
                    <div>
                        <span className="text-[10px] font-black tracking-widest uppercase text-amber-400/90 block">
                            En Vivo · Proyección de Salón
                        </span>
                        <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight drop-shadow-md">
                            {event?.couple_names || event?.title}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Audio mute toggle for videos */}
                    <button
                        type="button"
                        onClick={() => setIsMuted(!isMuted)}
                        className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/60 rounded-2xl text-zinc-200 transition-all hover:scale-105 shadow-xl"
                        title={isMuted ? 'Activar sonido de videos' : 'Silenciar videos'}
                    >
                        {isMuted ? <VolumeX className="w-5 h-5 text-zinc-400" /> : <Volume2 className="w-5 h-5 text-amber-400 animate-pulse" />}
                    </button>

                    {/* Refresh feed */}
                    <button
                        type="button"
                        onClick={fetchFeed}
                        className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/60 rounded-2xl text-zinc-200 transition-all hover:scale-105 shadow-xl"
                        title="Actualizar dedicatorias"
                    >
                        <RefreshCw className="w-5 h-5 text-zinc-300" />
                    </button>

                    {/* Fullscreen toggle */}
                    <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="p-3 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-zinc-950 font-bold rounded-2xl transition-all hover:scale-105 shadow-xl flex items-center gap-2"
                        title="Pantalla Completa (F11)"
                    >
                        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                        <span className="text-xs font-black uppercase hidden sm:inline">Pantalla Completa</span>
                    </button>
                </div>
            </header>

            {/* MAIN PROJECTION STAGE */}
            <main className="relative z-10 flex-1 flex items-center justify-center p-6 md:p-12">
                {dedications.length === 0 ? (
                    <div className="text-center max-w-xl p-10 rounded-3xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-xl shadow-2xl space-y-6">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-rose-500 text-zinc-950 flex items-center justify-center mx-auto shadow-2xl">
                            <Camera className="w-10 h-10" />
                        </div>
                        <h2 className="text-3xl font-black text-white">¡El Muro de Recuerdos está Abierto!</h2>
                        <p className="text-sm text-zinc-300 leading-relaxed font-medium">
                            Escaneá el código QR en pantalla con la cámara de tu celular para subir tu dedicatoria, foto o video saludo en vivo.
                        </p>
                        <div className="p-4 bg-white rounded-3xl inline-block shadow-2xl">
                            <img src={qrCodeUrl} alt="QR para enviar dedicatorias" className="w-52 h-52 mx-auto rounded-xl" />
                        </div>
                        <div className="text-xs font-black tracking-widest uppercase text-amber-400">
                            Subí tu foto o video ahora
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-5xl h-full flex flex-col items-center justify-center animate-fade-in key={currentIndex}">
                        {/* CURRENT SLIDE CONTENT */}
                        <div className="relative w-full max-h-[72vh] flex items-center justify-center">
                            {currentItem?.type === 'video' ? (
                                <div className="relative max-h-[70vh] rounded-3xl overflow-hidden border-2 border-amber-500/40 shadow-2xl bg-zinc-950 flex items-center justify-center">
                                    <video
                                        ref={videoRef}
                                        src={currentItem.media_url}
                                        autoPlay
                                        playsInline
                                        muted={isMuted}
                                        onEnded={handleVideoEnded}
                                        className="max-h-[70vh] max-w-full rounded-2xl object-contain"
                                    />
                                    <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-xs font-black text-amber-300 flex items-center gap-1.5">
                                        <Film className="w-3.5 h-3.5 text-rose-400" />
                                        Video Dedicatoria
                                    </div>
                                </div>
                            ) : currentItem?.type === 'photo' ? (
                                <div className="relative max-h-[70vh] rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl bg-zinc-950 flex items-center justify-center">
                                    <img
                                        src={currentItem.media_url}
                                        alt={`Foto de ${currentItem.author_name}`}
                                        className="max-h-[70vh] max-w-full rounded-2xl object-contain"
                                    />
                                </div>
                            ) : null}
                        </div>

                        {/* AUTHOR NAME & EMOTIVE MESSAGE CAPTION */}
                        <div className="mt-6 text-center max-w-2xl px-6 py-4 rounded-3xl bg-zinc-900/80 backdrop-blur-xl border border-white/15 shadow-2xl space-y-2">
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                                    De parte de:
                                </span>
                                <h3 className="text-xl sm:text-2xl font-black text-white">
                                    {currentItem?.author_name}
                                </h3>
                            </div>
                            {currentItem?.message && (
                                <p className="text-base sm:text-lg font-medium text-zinc-200 italic leading-relaxed">
                                    "{currentItem.message}"
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* BOTTOM BAR: DEDICATIONS PROGRESS & CORNER QR CODE */}
            <footer className="relative z-20 px-8 py-5 flex items-center justify-between bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                {/* Dedications Counter Dots */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-400">
                        Dedicatorias: {dedications.length > 0 ? `${currentIndex + 1} / ${dedications.length}` : '0'}
                    </span>
                    <div className="hidden sm:flex items-center gap-1.5 ml-2">
                        {dedications.slice(0, 15).map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-2 rounded-full transition-all duration-300 ${
                                    idx === currentIndex ? 'w-6 bg-amber-400 shadow-md shadow-amber-400/50' : 'w-2 bg-zinc-800'
                                }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Corner Interactive QR Code Pill */}
                <div 
                    onClick={() => setShowQrModal(true)}
                    className="cursor-pointer bg-zinc-900/90 hover:bg-zinc-800 border-2 border-amber-400/50 rounded-2xl p-2.5 flex items-center gap-3 transition-all hover:scale-105 shadow-2xl backdrop-blur-md"
                >
                    <div className="bg-white p-1 rounded-xl shrink-0">
                        <img src={qrCodeUrl} alt="QR Mini" className="w-10 h-10 rounded-lg" />
                    </div>
                    <div className="text-left pr-2">
                        <div className="text-[11px] font-black text-amber-300 uppercase tracking-tight flex items-center gap-1">
                            <Camera className="w-3 h-3 text-rose-400" />
                            ¡Subí tu foto o video!
                        </div>
                        <div className="text-[10px] text-zinc-400 font-medium">
                            Escaneá este QR con tu celular
                        </div>
                    </div>
                </div>
            </footer>

            {/* EXPANDED QR MODAL */}
            {showQrModal && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl relative">
                        <button
                            onClick={() => setShowQrModal(false)}
                            className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                                Participá en la Fiesta
                            </span>
                            <h3 className="text-xl font-black text-white">
                                Enviá tu Saludo en Vivo
                            </h3>
                            <p className="text-xs text-zinc-400">
                                Apuntá tu cámara a este código para subir una foto o video a la pantalla gigante:
                            </p>
                        </div>

                        <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl">
                            <img src={qrCodeUrl} alt="QR Code" className="w-60 h-60 mx-auto rounded-xl" />
                        </div>

                        <div className="text-xs text-zinc-400 font-mono break-all px-2 py-1 bg-zinc-950 rounded-xl">
                            {uploadUrl}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
