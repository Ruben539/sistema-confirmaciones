import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Sparkles, Maximize2, Minimize2, Volume2, VolumeX, QrCode, Heart, 
    Camera, Film, RefreshCw, X, Play, Pause, ChevronLeft, ChevronRight, 
    PartyPopper, Sliders, Check, Wand2, Zap, Clock
} from 'lucide-react';
import { apiFetch } from '../api';

export default function LiveProjectionScreen({ eventId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMuted, setIsMuted] = useState(false); // Unmuted by default for projector sound
    const [isPaused, setIsPaused] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showControls, setShowControls] = useState(true);

    // Playback settings (configurable by operator)
    const [photoDuration, setPhotoDuration] = useState(8); // seconds
    const [videoRepeatCount, setVideoRepeatCount] = useState(1); // Repeat short videos
    const [videoHoldDuration, setVideoHoldDuration] = useState(4); // seconds to celebrate after video
    const [transitionEffect, setTransitionEffect] = useState('gala'); // 'gala', 'flash', 'zoom', 'fade'
    const [enableKenBurns, setEnableKenBurns] = useState(true);
    const [enableConfetti, setEnableConfetti] = useState(true);

    // Playback animation & loop tracking
    const [currentVideoLoop, setCurrentVideoLoop] = useState(0);
    const [isHoldingEnd, setIsHoldingEnd] = useState(false);
    const [holdRemainingSeconds, setHoldRemainingSeconds] = useState(4);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [isFlashActive, setIsFlashActive] = useState(false);
    const [progressPercent, setProgressPercent] = useState(0);
    const [newDedicationNotice, setNewDedicationNotice] = useState(null);

    const videoRef = useRef(null);
    const timerRef = useRef(null);
    const progressIntervalRef = useRef(null);
    const mouseTimerRef = useRef(null);
    const canvasRef = useRef(null);
    const prevDedicationsCountRef = useRef(0);
    const particlesRef = useRef([]);

    // 1. Fetch Feed from Backend
    const fetchFeed = async () => {
        try {
            const { ok, json } = await apiFetch(`/api/events/${eventId}/live-feed`);
            if (ok && json) {
                setData(json);

                // Detect new incoming dedications in real-time
                const newCount = json.dedications?.length || 0;
                if (prevDedicationsCountRef.current > 0 && newCount > prevDedicationsCountRef.current) {
                    const latest = json.dedications[0];
                    if (latest) {
                        setNewDedicationNotice(latest.author_name);
                        triggerCelebration();
                        // Auto-jump to the newest dedication
                        setCurrentIndex(0);
                        setCurrentVideoLoop(0);
                        setIsHoldingEnd(false);
                        setTimeout(() => setNewDedicationNotice(null), 7000);
                    }
                }
                prevDedicationsCountRef.current = newCount;
            }
        } catch (err) {
            console.error('Error fetching live projection feed:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeed();
        // Live polling every 10 seconds for instant party updates
        const pollInterval = setInterval(fetchFeed, 10000);
        return () => clearInterval(pollInterval);
    }, [eventId]);

    const dedications = data?.dedications || [];
    const event = data?.event || null;
    const currentItem = dedications.length > 0 ? dedications[currentIndex] : null;

    // 2. High-Performance Magical Canvas Particle Engine (Bokeh & Confetti)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animId;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        // Ambient floating golden and romantic orbs
        const ambientOrbs = Array.from({ length: 25 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 4 + 1.5,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.3 - 0.2,
            alpha: Math.random() * 0.6 + 0.2,
            color: Math.random() > 0.4 ? 'rgba(251, 191, 36, ' : 'rgba(244, 63, 94, '
        }));

        const loop = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw ambient drifting lights
            ambientOrbs.forEach(orb => {
                orb.x += orb.vx;
                orb.y += orb.vy;
                if (orb.x < 0) orb.x = canvas.width;
                if (orb.x > canvas.width) orb.x = 0;
                if (orb.y < 0) orb.y = canvas.height;
                if (orb.y > canvas.height) orb.y = 0;

                ctx.beginPath();
                ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
                ctx.fillStyle = orb.color + orb.alpha + ')';
                ctx.shadowBlur = 12;
                ctx.shadowColor = orb.color + '0.8)';
                ctx.fill();
            });

            // Update & draw active celebration confetti particles
            const activeParticles = [];
            for (let i = 0; i < particlesRef.current.length; i++) {
                const p = particlesRef.current[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += p.gravity;
                p.rotation += p.vRot;
                p.life -= p.decay;

                if (p.life > 0) {
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rotation);
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = Math.max(0, p.life);
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = p.color;

                    if (p.shape === 'rect') {
                        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                    } else if (p.shape === 'circle') {
                        ctx.beginPath();
                        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        // Star / sparkle shape
                        ctx.beginPath();
                        ctx.moveTo(0, -p.size);
                        ctx.lineTo(p.size / 3, -p.size / 3);
                        ctx.lineTo(p.size, 0);
                        ctx.lineTo(p.size / 3, p.size / 3);
                        ctx.lineTo(0, p.size);
                        ctx.lineTo(-p.size / 3, p.size / 3);
                        ctx.lineTo(-p.size, 0);
                        ctx.lineTo(-p.size / 3, -p.size / 3);
                        ctx.closePath();
                        ctx.fill();
                    }
                    ctx.restore();
                    activeParticles.push(p);
                }
            }
            particlesRef.current = activeParticles;

            animId = requestAnimationFrame(loop);
        };

        loop();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animId);
        };
    }, []);

    // Trigger celebration burst (Confetti & Sparkles explosion)
    const triggerCelebration = useCallback(() => {
        if (!enableConfetti) return;
        const colors = ['#F59E0B', '#FBBF24', '#EC4899', '#F43F5E', '#10B981', '#38BDF8', '#FFFFFF', '#A855F7'];
        const shapes = ['rect', 'circle', 'star'];
        const burstCount = 80;
        const width = window.innerWidth;
        const height = window.innerHeight;

        const newParticles = Array.from({ length: burstCount }, () => {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 12 + 4;
            return {
                x: width / 2 + (Math.random() - 0.5) * 200,
                y: height / 2 + (Math.random() - 0.5) * 100,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 4,
                gravity: 0.22,
                rotation: Math.random() * Math.PI * 2,
                vRot: (Math.random() - 0.5) * 0.2,
                size: Math.random() * 9 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                shape: shapes[Math.floor(Math.random() * shapes.length)],
                life: 1.0,
                decay: Math.random() * 0.015 + 0.008
            };
        });

        particlesRef.current = [...particlesRef.current, ...newParticles];
    }, [enableConfetti]);

    // 3. Navigation Controls
    const goToNextSlide = useCallback(() => {
        if (dedications.length <= 1) return;
        setIsTransitioning(true);
        if (transitionEffect === 'flash') {
            setIsFlashActive(true);
            setTimeout(() => setIsFlashActive(false), 550);
        }

        const transitionDelay = transitionEffect === 'gala' ? 450 : transitionEffect === 'zoom' ? 500 : 350;

        setTimeout(() => {
            setCurrentIndex(prev => (prev + 1) % dedications.length);
            setCurrentVideoLoop(0);
            setIsHoldingEnd(false);
            setProgressPercent(0);
            setIsTransitioning(false);
            triggerCelebration();
        }, transitionDelay);
    }, [dedications.length, transitionEffect, triggerCelebration]);

    const goToPrevSlide = useCallback(() => {
        if (dedications.length <= 1) return;
        setIsTransitioning(true);
        if (transitionEffect === 'flash') {
            setIsFlashActive(true);
            setTimeout(() => setIsFlashActive(false), 550);
        }

        const transitionDelay = transitionEffect === 'gala' ? 450 : transitionEffect === 'zoom' ? 500 : 350;

        setTimeout(() => {
            setCurrentIndex(prev => (prev - 1 + dedications.length) % dedications.length);
            setCurrentVideoLoop(0);
            setIsHoldingEnd(false);
            setProgressPercent(0);
            setIsTransitioning(false);
        }, transitionDelay);
    }, [dedications.length, transitionEffect]);

    // 4. Slide Progression & Video Repeat Handling
    useEffect(() => {
        if (!dedications || dedications.length <= 1 || isPaused) return;

        const current = dedications[currentIndex];

        // If it's a video, loop and transition are handled by video events
        if (current?.type === 'video') {
            return;
        }

        // Photo or text slide: smooth progress bar and auto-advance
        const totalDurationMs = photoDuration * 1000;
        const intervalMs = 100;
        let elapsedMs = 0;

        progressIntervalRef.current = setInterval(() => {
            elapsedMs += intervalMs;
            const pct = Math.min(100, (elapsedMs / totalDurationMs) * 100);
            setProgressPercent(pct);

            if (elapsedMs >= totalDurationMs) {
                clearInterval(progressIntervalRef.current);
                goToNextSlide();
            }
        }, intervalMs);

        return () => {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        };
    }, [currentIndex, dedications, isPaused, photoDuration, goToNextSlide]);

    // Handle Video Ended: Loop short video or hold celebratory screen
    const handleVideoEnded = () => {
        if (currentVideoLoop + 1 < videoRepeatCount) {
            // Replay short video so guests have time to appreciate it
            setCurrentVideoLoop(prev => prev + 1);
            if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(() => {});
            }
        } else {
            // Finished loops: hold on celebratory screen for videoHoldDuration seconds with confetti!
            setIsHoldingEnd(true);
            setHoldRemainingSeconds(videoHoldDuration);
            triggerCelebration();

            let remaining = videoHoldDuration;
            const interval = setInterval(() => {
                remaining -= 1;
                setHoldRemainingSeconds(Math.max(0, remaining));
                if (remaining <= 0) {
                    clearInterval(interval);
                }
            }, 1000);

            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                clearInterval(interval);
                goToNextSlide();
            }, videoHoldDuration * 1000);
        }
    };

    // 5. Keyboard Navigation (DJ & Operator Shortcuts)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                setIsPaused(prev => !prev);
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                goToNextSlide();
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                goToPrevSlide();
            } else if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                toggleFullscreen();
            } else if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                setIsMuted(prev => !prev);
            } else if (e.key === 'c' || e.key === 'C') {
                e.preventDefault();
                triggerCelebration();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToNextSlide, goToPrevSlide, triggerCelebration]);

    // 6. Auto-hide Operator Controls on mouse inactivity
    const handleMouseMove = () => {
        setShowControls(true);
        if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
        mouseTimerRef.current = setTimeout(() => {
            setShowControls(false);
        }, 3500);
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
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(uploadUrl)}`;

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white space-y-4 font-sans">
                <Sparkles className="w-14 h-14 text-amber-400 animate-spin-slow" />
                <h2 className="text-2xl font-black tracking-widest uppercase text-amber-300">
                    Iniciando Proyección de Gala...
                </h2>
                <p className="text-xs text-zinc-400">Conectando muro interactivo en vivo</p>
            </div>
        );
    }

    return (
        <div 
            onMouseMove={handleMouseMove}
            className="min-h-screen bg-black text-white relative overflow-hidden select-none font-sans flex flex-col justify-between cursor-default"
        >
            {/* CANVAS PARTICLES & BOKEH OVERLAY */}
            <canvas 
                ref={canvasRef} 
                className="absolute inset-0 pointer-events-none z-10"
            />

            {/* Ambient Animated Gradients */}
            <div className="absolute inset-0 bg-radial-gradient from-zinc-900/60 via-black to-black pointer-events-none" />
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-rose-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />

            {/* Flash Effect on Transition */}
            {isFlashActive && (
                <div className="fixed inset-0 bg-white pointer-events-none z-50 animate-flash-glow" />
            )}

            {/* LIVE BANNER FOR NEW DEDICATION */}
            {newDedicationNotice && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 animate-bounce">
                    <div className="px-6 py-3 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 text-zinc-950 font-black text-sm uppercase tracking-wider shadow-2xl flex items-center gap-2 border-2 border-white/60">
                        <Sparkles className="w-5 h-5 fill-zinc-950" />
                        <span>✨ ¡Nueva Dedicatoria en Vivo de {newDedicationNotice}! ✨</span>
                        <Sparkles className="w-5 h-5 fill-zinc-950" />
                    </div>
                </div>
            )}

            {/* TOP BAR: EVENT HEADER & LIVE INDICATOR */}
            <header className={`relative z-20 px-8 py-5 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/40 to-transparent transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-amber-400 to-rose-500 rounded-2xl shadow-lg shadow-amber-500/20">
                        <Heart className="w-6 h-6 text-zinc-950 fill-zinc-950" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <span className="text-[10px] font-black tracking-widest uppercase text-amber-400/90 block">
                                Transmisión en Vivo · Proyector de Salón
                            </span>
                        </div>
                        <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight drop-shadow-md">
                            {event?.couple_names || event?.title}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {/* Confetti Trigger */}
                    <button
                        type="button"
                        onClick={triggerCelebration}
                        className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/60 rounded-2xl text-amber-400 transition-all hover:scale-105 shadow-xl cursor-pointer"
                        title="Lanzar lluvia de confeti festivo (Tecla C)"
                    >
                        <PartyPopper className="w-5 h-5" />
                    </button>

                    {/* Audio mute toggle for videos */}
                    <button
                        type="button"
                        onClick={() => setIsMuted(!isMuted)}
                        className={`p-3 rounded-2xl border transition-all hover:scale-105 shadow-xl flex items-center gap-2 cursor-pointer ${
                            isMuted 
                                ? 'bg-zinc-900/80 border-zinc-700 text-zinc-400' 
                                : 'bg-amber-500 text-zinc-950 border-amber-400 font-bold shadow-amber-500/30'
                        }`}
                        title={isMuted ? 'Activar audio de videos (Tecla M)' : 'Silenciar audio de videos (Tecla M)'}
                    >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 animate-pulse" />}
                        <span className="text-xs font-bold hidden md:inline">
                            {isMuted ? 'Audio Silenciado' : 'Audio en Vivo'}
                        </span>
                    </button>

                    {/* Settings Modal Toggle */}
                    <button
                        type="button"
                        onClick={() => setShowSettingsModal(true)}
                        className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/60 rounded-2xl text-zinc-200 transition-all hover:scale-105 shadow-xl cursor-pointer"
                        title="Configuración de proyección y tiempos"
                    >
                        <Sliders className="w-5 h-5" />
                    </button>

                    {/* Refresh feed */}
                    <button
                        type="button"
                        onClick={fetchFeed}
                        className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/60 rounded-2xl text-zinc-200 transition-all hover:scale-105 shadow-xl cursor-pointer"
                        title="Actualizar muro"
                    >
                        <RefreshCw className="w-5 h-5 text-zinc-300" />
                    </button>

                    {/* Fullscreen toggle */}
                    <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="p-3 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-zinc-950 font-bold rounded-2xl transition-all hover:scale-105 shadow-xl flex items-center gap-2 cursor-pointer"
                        title="Pantalla Completa (F11 o Tecla F)"
                    >
                        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                        <span className="text-xs font-black uppercase hidden sm:inline">Pantalla Completa</span>
                    </button>
                </div>
            </header>

            {/* MAIN PROJECTION STAGE */}
            <main className="relative z-10 flex-1 flex items-center justify-center p-4 md:p-8">
                {dedications.length === 0 ? (
                    <div className="text-center max-w-xl p-10 rounded-3xl bg-zinc-900/80 border border-amber-500/30 backdrop-blur-2xl shadow-2xl space-y-6">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-rose-500 text-zinc-950 flex items-center justify-center mx-auto shadow-2xl animate-pulse">
                            <Camera className="w-10 h-10" />
                        </div>
                        <h2 className="text-3xl font-black text-white">¡El Muro de Recuerdos está Abierto!</h2>
                        <p className="text-sm text-zinc-300 leading-relaxed font-medium">
                            Escaneá el código QR en pantalla con la cámara de tu celular para subir tu dedicatoria, foto instantánea o video saludo en vivo.
                        </p>
                        <div className="p-4 bg-white rounded-3xl inline-block shadow-2xl border-4 border-amber-400/60">
                            <img src={qrCodeUrl} alt="QR para enviar dedicatorias" className="w-56 h-56 mx-auto rounded-xl" />
                        </div>
                        <div className="text-xs font-black tracking-widest uppercase text-amber-400 animate-bounce">
                            Subí tu foto o video ahora
                        </div>
                    </div>
                ) : (
                    <div className={`w-full max-w-5xl h-full flex flex-col items-center justify-center transition-all ${
                        transitionEffect === 'zoom'
                            ? (isTransitioning ? 'opacity-0 scale-75 blur-md duration-500' : 'opacity-100 scale-100 blur-0 duration-500')
                            : transitionEffect === 'flash'
                                ? (isTransitioning ? 'opacity-20 scale-100 duration-300' : 'opacity-100 scale-100 duration-300')
                                : (isTransitioning ? 'opacity-0 scale-95 blur-sm duration-500' : 'opacity-100 scale-100 blur-0 duration-500')
                    }`}>
                        {/* CURRENT SLIDE CONTENT WITH CELEBRATION GLOW BORDER */}
                        <div className="relative w-full max-h-[70vh] flex items-center justify-center">
                            {currentItem?.type === 'video' ? (
                                <div className="relative max-h-[68vh] rounded-3xl overflow-hidden border-2 border-amber-500/60 shadow-[0_0_60px_rgba(245,158,11,0.35)] bg-zinc-950 flex items-center justify-center group">
                                    <video
                                        ref={videoRef}
                                        key={currentItem.media_url}
                                        src={currentItem.media_url}
                                        autoPlay
                                        playsInline
                                        muted={isMuted}
                                        onEnded={handleVideoEnded}
                                        className={`max-h-[68vh] max-w-full rounded-2xl object-contain shadow-2xl transition-all duration-700 ${
                                            isHoldingEnd ? 'filter brightness-50 contrast-125' : ''
                                        }`}
                                    />

                                    {/* Video Badge with Repeat Counter */}
                                    <div className="absolute top-4 left-4 px-3.5 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-xs font-black text-amber-300 flex items-center gap-2 shadow-lg">
                                        <Film className="w-3.5 h-3.5 text-rose-400" />
                                        <span>Video Saludo</span>
                                        {videoRepeatCount > 1 && (
                                            <span className="text-[10px] text-zinc-400 font-normal">
                                                (Repetición {currentVideoLoop + 1}/{videoRepeatCount})
                                            </span>
                                        )}
                                    </div>

                                    {/* Celebratory Hold Card when Video finishes before next slide */}
                                    {isHoldingEnd && (
                                        <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center p-6 sm:p-8 text-center animate-fade-in space-y-4 border-2 border-amber-400/80 rounded-3xl shadow-[0_0_80px_rgba(245,158,11,0.5)]">
                                            <div className="p-3.5 bg-gradient-to-tr from-amber-400 via-rose-500 to-amber-300 rounded-3xl text-zinc-950 shadow-2xl animate-bounce">
                                                <PartyPopper className="w-9 h-9" />
                                            </div>
                                            <div className="space-y-2 max-w-lg">
                                                <span className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center justify-center gap-1.5">
                                                    <Sparkles className="w-4 h-4" />
                                                    <span>Recuerdo Inolvidable</span>
                                                    <Sparkles className="w-4 h-4" />
                                                </span>
                                                <h3 className="text-2xl sm:text-3xl font-black text-white">
                                                    ¡Muchas Gracias, {currentItem.author_name}!
                                                </h3>
                                                {currentItem.message && (
                                                    <p className="text-base sm:text-lg text-zinc-200 italic font-medium leading-relaxed">
                                                        "{currentItem.message}"
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 pt-2 text-xs font-bold text-amber-300/90">
                                                <Sparkles className="w-4 h-4 animate-spin-slow" />
                                                <span>Siguiente recuerdo en {holdRemainingSeconds}s...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : currentItem?.type === 'photo' ? (
                                <div className="relative max-h-[68vh] rounded-3xl overflow-hidden border-2 border-amber-400/50 shadow-[0_0_60px_rgba(251,191,36,0.3)] bg-zinc-950 flex items-center justify-center">
                                    <img
                                        src={currentItem.media_url}
                                        alt={`Foto de ${currentItem.author_name}`}
                                        className={`max-h-[68vh] max-w-full rounded-2xl object-contain shadow-2xl transition-all duration-700 ${
                                            enableKenBurns ? 'animate-kenburns' : ''
                                        }`}
                                    />
                                    <div className="absolute top-4 left-4 px-3.5 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-xs font-black text-amber-300 flex items-center gap-1.5 shadow-lg">
                                        <Camera className="w-3.5 h-3.5 text-amber-400" />
                                        <span>Foto en Vivo</span>
                                    </div>
                                </div>
                            ) : (
                                /* Text-only dedication */
                                <div className="p-12 rounded-3xl bg-zinc-900/90 border-2 border-amber-400/50 text-center max-w-2xl shadow-2xl space-y-4">
                                    <Heart className="w-12 h-12 text-rose-500 mx-auto fill-rose-500 animate-pulse" />
                                    <p className="text-2xl font-bold text-white italic leading-relaxed">
                                        "{currentItem?.message}"
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* SLIDE PROGRESS BAR (Glowing gold bar showing time remaining) */}
                        {currentItem?.type !== 'video' && (
                            <div className="w-full max-w-xl mt-4 bg-zinc-900/80 rounded-full h-1.5 overflow-hidden border border-zinc-800">
                                <div 
                                    className="h-full bg-gradient-to-r from-amber-400 via-rose-500 to-amber-400 transition-all duration-100 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.6)]"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        )}

                        {/* AUTHOR NAME & EMOTIVE MESSAGE CAPTION */}
                        <div className="mt-4 text-center max-w-2xl px-8 py-4 rounded-3xl bg-zinc-900/90 backdrop-blur-2xl border border-white/15 shadow-2xl space-y-1.5">
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                                    De parte de:
                                </span>
                                <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide">
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

            {/* BOTTOM BAR: DEDICATIONS PROGRESS, OPERATOR HUD & CORNER QR */}
            <footer className={`relative z-20 px-8 py-5 flex items-center justify-between bg-gradient-to-t from-black/95 via-black/50 to-transparent transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                {/* Dedications Counter & Index Indicator */}
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-zinc-400">
                        Recuerdo {dedications.length > 0 ? `${currentIndex + 1} de ${dedications.length}` : '0'}
                    </span>
                    <div className="hidden md:flex items-center gap-1.5 ml-2">
                        {dedications.slice(0, 15).map((_, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => { setCurrentIndex(idx); setCurrentVideoLoop(0); }}
                                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                                    idx === currentIndex ? 'w-6 bg-amber-400 shadow-md shadow-amber-400/50' : 'w-2 bg-zinc-800 hover:bg-zinc-600'
                                }`}
                            />
                        ))}
                    </div>
                </div>

                {/* OPERATOR PLAYBACK CONTROLS (Floating HUD for DJ) */}
                <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-700/80 rounded-2xl px-4 py-2 shadow-2xl backdrop-blur-xl">
                    <button
                        type="button"
                        onClick={goToPrevSlide}
                        className="p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                        title="Anterior (Flecha Izquierda)"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsPaused(!isPaused)}
                        className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                            isPaused 
                                ? 'bg-amber-500 text-zinc-950 font-bold shadow-lg shadow-amber-500/30' 
                                : 'bg-zinc-800 text-white hover:bg-zinc-700'
                        }`}
                        title={isPaused ? 'Reanudar rotación automática (Barra Espaciadora)' : 'Pausar en esta foto/video (Barra Espaciadora)'}
                    >
                        {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5" />}
                    </button>

                    <button
                        type="button"
                        onClick={goToNextSlide}
                        className="p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                        title="Siguiente (Flecha Derecha)"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Corner Interactive QR Code Pill */}
                <div 
                    onClick={() => setShowQrModal(true)}
                    className="cursor-pointer bg-zinc-900/95 hover:bg-zinc-850 border-2 border-amber-400/60 rounded-2xl p-2.5 flex items-center gap-3 transition-all hover:scale-105 shadow-2xl backdrop-blur-md"
                >
                    <div className="bg-white p-1 rounded-xl shrink-0">
                        <img src={qrCodeUrl} alt="QR Mini" className="w-10 h-10 rounded-lg" />
                    </div>
                    <div className="text-left pr-1">
                        <div className="text-[11px] font-black text-amber-300 uppercase tracking-tight flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5 text-rose-400" />
                            ¡Subí tu foto o video!
                        </div>
                        <div className="text-[10px] text-zinc-400 font-medium">
                            Escaneá este QR para salir en pantalla
                        </div>
                    </div>
                </div>
            </footer>

            {/* OPERATOR SETTINGS MODAL */}
            {showSettingsModal && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl space-y-5 relative">
                        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                            <div className="flex items-center gap-2">
                                <Sliders className="w-5 h-5 text-amber-400" />
                                <h3 className="text-base font-black text-white uppercase tracking-wider">
                                    Ajustes de Proyección
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowSettingsModal(false)}
                                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Setting 1: Transition Style */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-300 block">
                                Efecto de Transición entre Recuerdos:
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'gala', label: '✨ Gala & Destellos' },
                                    { id: 'flash', label: '📸 Flash Alfombra Roja' },
                                    { id: 'zoom', label: '🔍 Zoom Cinematográfico' },
                                    { id: 'fade', label: '🎞️ Desvanecimiento Suave' },
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setTransitionEffect(t.id)}
                                        className={`p-2.5 rounded-xl text-xs font-bold text-left transition-all ${
                                            transitionEffect === t.id
                                                ? 'bg-amber-500 text-zinc-950 font-black shadow-md shadow-amber-500/30'
                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Setting 2: Photo Slide Duration */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-300 block">
                                Tiempo de permanencia de Fotos:
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {[5, 8, 12, 15].map((sec) => (
                                    <button
                                        key={sec}
                                        type="button"
                                        onClick={() => setPhotoDuration(sec)}
                                        className={`p-2 rounded-xl text-xs font-black transition-colors ${
                                            photoDuration === sec
                                                ? 'bg-amber-500 text-zinc-950 font-black'
                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                        }`}
                                    >
                                        {sec}s
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Setting 3: Post-Video Celebration Hold */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-300 block">
                                Pausa de Agradecimiento tras Video (con dedicatoria):
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {[2, 4, 6, 8].map((sec) => (
                                    <button
                                        key={sec}
                                        type="button"
                                        onClick={() => setVideoHoldDuration(sec)}
                                        className={`p-2 rounded-xl text-xs font-black transition-colors ${
                                            videoHoldDuration === sec
                                                ? 'bg-rose-500 text-white font-black'
                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                        }`}
                                    >
                                        {sec}s
                                    </button>
                                ))}
                            </div>
                            <span className="text-[10px] text-zinc-400 block">
                                Muestra una tarjeta emotiva agradeciendo al autor del video antes de pasar a la siguiente foto.
                            </span>
                        </div>

                        {/* Setting 4: Ken Burns effect toggle */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/60 border border-zinc-700">
                            <div>
                                <span className="text-xs font-bold text-white block">Efecto Ken Burns en Fotos</span>
                                <span className="text-[10px] text-zinc-400">Zoom lento y paneo cinematográfico</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEnableKenBurns(!enableKenBurns)}
                                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${enableKenBurns ? 'bg-amber-500' : 'bg-zinc-700'}`}
                            >
                                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${enableKenBurns ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* Setting 5: Confetti celebration on transitions */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/60 border border-zinc-700">
                            <div>
                                <span className="text-xs font-bold text-white block">Lluvia de Confeti & Chispas</span>
                                <span className="text-[10px] text-zinc-400">Partículas y chispas doradas en cada cambio</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEnableConfetti(!enableConfetti)}
                                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${enableConfetti ? 'bg-amber-500' : 'bg-zinc-700'}`}
                            >
                                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${enableConfetti ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* Keyboard shortcut guide */}
                        <div className="text-[11px] text-zinc-400 p-3 bg-zinc-950 rounded-xl space-y-1">
                            <div className="font-bold text-zinc-300 text-xs mb-1">Atajos de teclado para el DJ / Operador:</div>
                            <div>• <kbd className="text-amber-400 font-mono">Espacio</kbd>: Pausar / Reanudar</div>
                            <div>• <kbd className="text-amber-400 font-mono">← / →</kbd>: Saludo Anterior / Siguiente</div>
                            <div>• <kbd className="text-amber-400 font-mono">M</kbd>: Silenciar / Activar audio</div>
                            <div>• <kbd className="text-amber-400 font-mono">C</kbd>: Lluvia de confeti</div>
                            <div>• <kbd className="text-amber-400 font-mono">F</kbd>: Pantalla completa</div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowSettingsModal(false)}
                            className="w-full py-3 bg-amber-500 text-zinc-950 font-black rounded-xl text-xs uppercase tracking-wider hover:bg-amber-400 transition-colors"
                        >
                            Listo
                        </button>
                    </div>
                </div>
            )}

            {/* EXPANDED QR MODAL */}
            {showQrModal && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl relative">
                        <button
                            onClick={() => setShowQrModal(false)}
                            className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                                Participá en la Fiesta
                            </span>
                            <h3 className="text-2xl font-black text-white">
                                Enviá tu Saludo en Vivo
                            </h3>
                            <p className="text-xs text-zinc-400">
                                Apuntá tu cámara a este código para subir una foto instantánea o video a la pantalla gigante:
                            </p>
                        </div>

                        <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl border-4 border-amber-400/80">
                            <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64 mx-auto rounded-xl" />
                        </div>

                        <div className="text-xs text-zinc-400 font-mono break-all px-3 py-1.5 bg-zinc-950 rounded-xl">
                            {uploadUrl}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
