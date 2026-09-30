import React, { useState, useEffect, useRef } from 'react';
import { 
    Heart, Calendar, MapPin, CheckCircle2, XCircle, Utensils, Send, Sparkles, AlertCircle, 
    Sun, Moon, Music, Disc, Gift, Copy, Check, ExternalLink, Camera, Film, Navigation, 
    Share2, Compass, Clock, Shirt, MessageSquare, Play, Pause, Volume2, VolumeX, Upload, 
    ChevronRight, Mail, MailOpen
} from 'lucide-react';
import { apiFetch } from '../api';

export default function GuestRsvp({ token, eventId, isPublic = false }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);

    // RSVP form states
    const [status, setStatus] = useState('confirmed');
    const [confirmedAdults, setConfirmedAdults] = useState(1);
    const [confirmedYouth, setConfirmedYouth] = useState(0);
    const [confirmedChildren, setConfirmedChildren] = useState(0);
    const [dietary, setDietary] = useState('');
    const [notes, setNotes] = useState('');
    const [songSuggestion, setSongSuggestion] = useState('');

    // Bank copy state
    const [copiedField, setCopiedField] = useState(null);

    // Dedication modal states
    const [showDedicationModal, setShowDedicationModal] = useState(false);
    const [dedicationAuthor, setDedicationAuthor] = useState('');
    const [dedicationMsg, setDedicationMsg] = useState('');
    const [dedicationFile, setDedicationFile] = useState(null);
    const [dedicationPreview, setDedicationPreview] = useState(null);
    const [dedicationType, setDedicationType] = useState('photo');
    const [dedicationUploading, setDedicationUploading] = useState(false);
    const [dedicationSuccess, setDedicationSuccess] = useState(false);

    // Countdown state
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false, isToday: false });

    // Audio / Spotify play state
    const [showMusicPlayer, setShowMusicPlayer] = useState(false);

    // Interactive Digital Envelope & Background Music states
    const [isEnvelopeOpen, setIsEnvelopeOpen] = useState(false);
    const [isOpeningEnvelope, setIsOpeningEnvelope] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const audioRef = useRef(null);

    const dedicationInputRef = useRef(null);

    const toggleTheme = () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    };

    useEffect(() => {
        fetchRsvp();
    }, [token, eventId]);

    const fetchRsvp = async () => {
        try {
            const url = token ? `/api/rsvp/${token}` : `/api/events/${eventId}/public-invitation`;
            const { ok, json } = await apiFetch(url);

            if (ok && json) {
                setData(json);
                if (json.guest) {
                    setStatus(json.guest.status === 'declined' ? 'declined' : 'confirmed');
                    setConfirmedAdults(json.guest.confirmed_adults > 0 ? json.guest.confirmed_adults : (json.guest.adults || 1));
                    setConfirmedYouth(json.guest.confirmed_youth > 0 ? json.guest.confirmed_youth : (json.guest.youth || 0));
                    setConfirmedChildren(json.guest.confirmed_children > 0 ? json.guest.confirmed_children : (json.guest.children || 0));
                    setDietary(json.guest.dietary_restrictions || '');
                    setNotes(json.guest.notes || '');
                    setSongSuggestion(json.guest.song_suggestion || '');
                    setDedicationAuthor(json.guest.name || '');
                }
            } else {
                setError('Enlace de invitación no encontrado o expirado.');
            }
        } catch (err) {
            console.error(err);
            setError('Error al cargar la invitación.');
        } finally {
            setLoading(false);
        }
    };

    const event = data?.event || null;
    const guest = data?.guest || null;
    const dedications = data?.dedications || [];
    const features = event?.features_enabled || {
        spotify: true,
        gifts: true,
        music_suggestions: true,
        countdown: true,
        guest_dedications: true,
        dress_code: true,
        background_music: true,
    };
    const giftSettings = event?.gift_settings || {};
    const hasBackgroundMusic = Boolean(event?.background_music_url);
    const isEnvelopeEnabled = (features?.background_music !== false) && hasBackgroundMusic;

    // Live Countdown
    useEffect(() => {
        if (!event?.event_date) return;
        const target = new Date(event.event_date + 'T00:00:00');

        const updateCountdown = () => {
            const now = new Date();
            const diff = target.getTime() - now.getTime();

            if (diff <= 0) {
                const isToday = now.toDateString() === target.toDateString();
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: !isToday, isToday });
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((diff / (1000 * 60)) % 60);
            const seconds = Math.floor((diff / 1000) % 60);

            setTimeLeft({ days, hours, minutes, seconds, isPast: false, isToday: false });
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [event?.event_date]);

    // Handle RSVP Submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!token) return;

        setSubmitting(true);
        setError(null);

        try {
            const { ok, json } = await apiFetch(`/api/rsvp/${token}`, {
                method: 'POST',
                body: JSON.stringify({
                    status,
                    confirmed_adults: status === 'confirmed' ? confirmedAdults : 0,
                    confirmed_youth: status === 'confirmed' ? confirmedYouth : 0,
                    confirmed_children: status === 'confirmed' ? confirmedChildren : 0,
                    confirmed_passes: status === 'confirmed' ? (confirmedAdults + confirmedYouth + confirmedChildren) : 0,
                    dietary_restrictions: dietary,
                    notes,
                    song_suggestion: songSuggestion,
                })
            });

            if (ok) {
                setSubmitted(true);
            } else {
                setError(json?.message || 'Error al guardar la respuesta.');
            }
        } catch (err) {
            console.error(err);
            setError('Error de conexión.');
        } finally {
            setSubmitting(false);
        }
    };

    // Copy CBU / Alias
    const handleCopy = (text, fieldName) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2500);
    };

    // Spotify Embed Helper
    const getSpotifyEmbedUrl = (url) => {
        if (!url) return null;
        try {
            // Support spotify:track:xxx or spotify:playlist:xxx format
            if (url.startsWith('spotify:')) {
                const parts = url.split(':');
                if (parts.length >= 3) {
                    return `https://open.spotify.com/embed/${parts[1]}/${parts[2]}`;
                }
            }

            const parsed = new URL(url);
            if (!parsed.hostname.includes('spotify.com')) return null;

            // Strip localization prefixes (e.g. /intl-es/, /intl-en/, /intl-pt/)
            let pathname = parsed.pathname.replace(/^\/intl-[a-zA-Z-]+/, '');

            // Don't duplicate /embed if already present
            if (pathname.startsWith('/embed/')) {
                return `https://open.spotify.com${pathname}`;
            }

            return `https://open.spotify.com/embed${pathname}`;
        } catch (e) {
            return null;
        }
    };
    const spotifyEmbedUrl = getSpotifyEmbedUrl(event?.spotify_url);

    // Client-side image optimization to bypass server PHP upload limits (e.g. 2MB)
    const compressImage = (file, maxWidth = 1920, maxHeight = 1080, quality = 0.85) => {
        if (!file.type.startsWith('image/') || file.size < 1.2 * 1024 * 1024) {
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

    // Dedication file handler
    const handleDedicationFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isVideo = file.type.startsWith('video');
        setDedicationType(isVideo ? 'video' : 'photo');
        setDedicationPreview(URL.createObjectURL(file));

        if (!isVideo) {
            try {
                const optimized = await compressImage(file);
                setDedicationFile(optimized);
            } catch (err) {
                setDedicationFile(file);
            }
        } else {
            setDedicationFile(file);
        }
    };

    // Dedication submit
    const handleDedicationSubmit = async (e) => {
        e.preventDefault();
        setDedicationUploading(true);

        try {
            const formData = new FormData();
            formData.append('type', dedicationFile ? dedicationType : 'text');
            if (dedicationMsg.trim()) formData.append('message', dedicationMsg.trim());
            if (dedicationFile) formData.append('media', dedicationFile);

            let endpoint = token ? `/api/rsvp/${token}/dedication` : `/api/events/${event.id}/public-dedication`;
            if (!token) {
                formData.append('author_name', dedicationAuthor.trim() || 'Invitado Especial');
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                },
                body: formData
            });

            if (res.ok) {
                setDedicationSuccess(true);
                setTimeout(() => {
                    setShowDedicationModal(false);
                    setDedicationSuccess(false);
                    setDedicationFile(null);
                    setDedicationPreview(null);
                    setDedicationMsg('');
                    fetchRsvp();
                }, 2000);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setDedicationUploading(false);
        }
    };

    // Google Calendar URL Generator
    const getCalendarUrl = () => {
        if (!event?.event_date) return '#';
        const dateStr = event.event_date.replace(/-/g, '');
        const title = encodeURIComponent(event.couple_names || event.title);
        const details = encodeURIComponent(`¡Gran celebración de ${event.couple_names || event.title}!`);
        const location = encodeURIComponent(event.location || '');
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}T180000Z/${dateStr}T235900Z&details=${details}&location=${location}`;
    };

    // Background Audio & Envelope Handlers
    const toggleAudioPlay = () => {
        if (!audioRef.current) return;
        if (isPlayingAudio) {
            audioRef.current.pause();
            setIsPlayingAudio(false);
        } else {
            audioRef.current.play()
                .then(() => setIsPlayingAudio(true))
                .catch(err => console.log('Audio playback error:', err));
        }
    };

    const toggleAudioMute = () => {
        if (!audioRef.current) return;
        audioRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const handleOpenEnvelope = () => {
        setIsOpeningEnvelope(true);

        if (audioRef.current) {
            audioRef.current.volume = 0;
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    setIsPlayingAudio(true);
                    // Fade in volume to 0.7 over 1.5 seconds
                    let vol = 0;
                    const fade = setInterval(() => {
                        if (vol < 0.7) {
                            vol = Math.min(0.7, vol + 0.05);
                            if (audioRef.current) audioRef.current.volume = vol;
                        } else {
                            clearInterval(fade);
                        }
                    }, 100);
                }).catch(err => {
                    console.log('Autoplay prevented on open:', err);
                });
            }
        }

        setTimeout(() => {
            setIsEnvelopeOpen(true);
        }, 750);
    };

    // First user gesture fallback: if the envelope was skipped or already open, any click/tap attempts playback gracefully
    useEffect(() => {
        if (!event?.background_music_url) return;
        const handleInteraction = () => {
            if (audioRef.current && audioRef.current.paused && (isEnvelopeOpen || !isEnvelopeEnabled)) {
                audioRef.current.play()
                    .then(() => setIsPlayingAudio(true))
                    .catch(() => {});
            }
        };

        window.addEventListener('click', handleInteraction, { once: true });
        window.addEventListener('touchstart', handleInteraction, { once: true });

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };
    }, [event?.background_music_url, isEnvelopeOpen, isEnvelopeEnabled]);

    if (loading) {
        return (
            <div className="min-h-screen bg-rose-50/40 dark:bg-zinc-950 flex items-center justify-center p-4 font-sans">
                <div className="flex flex-col items-center gap-3">
                    <Heart className="w-12 h-12 text-rose-500 animate-bounce" />
                    <span className="text-sm font-black tracking-wide text-zinc-600 dark:text-zinc-300">
                        Cargando invitación interactiva...
                    </span>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-rose-50/40 dark:bg-zinc-950 flex items-center justify-center p-4 font-sans">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-md text-center shadow-xl">
                    <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Invitación No Encontrada</h2>
                    <p className="text-xs text-zinc-500 mt-2">{error || 'El enlace que abriste no existe o ha expirado.'}</p>
                </div>
            </div>
        );
    }

    const confirmedPasses = confirmedAdults + confirmedYouth + confirmedChildren;

    return (
        <div className="min-h-screen bg-gradient-to-b from-rose-50/60 via-stone-50 to-amber-50/40 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 text-zinc-900 dark:text-white font-sans transition-colors pb-16">
            
            {/* HIDDEN BACKGROUND AUDIO ELEMENT */}
            {hasBackgroundMusic && (
                <audio
                    ref={audioRef}
                    src={event.background_music_url}
                    loop
                    preload="auto"
                    onPlay={() => setIsPlayingAudio(true)}
                    onPause={() => setIsPlayingAudio(false)}
                />
            )}

            {/* INTERACTIVE DIGITAL ENVELOPE / WELCOME POPUP (FOR COMPLIANT AUTOPLAY) */}
            {isEnvelopeEnabled && !isEnvelopeOpen && (
                <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/95 backdrop-blur-2xl transition-all duration-700 select-none ${
                    isOpeningEnvelope ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
                }`}>
                    {/* Background Cover Photo Blur */}
                    {event.cover_photo_url && (
                        <div 
                            className="absolute inset-0 bg-cover bg-center opacity-30 filter blur-2xl pointer-events-none"
                            style={{ backgroundImage: `url(${event.cover_photo_url})` }}
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-zinc-950/90 to-black pointer-events-none" />

                    <div className="relative z-10 w-full max-w-md mx-auto text-center space-y-6">
                        {/* Header Tag */}
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-300 text-xs font-black uppercase tracking-widest shadow-lg">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Invitación Especial</span>
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        </div>

                        {/* Event Title / Names */}
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 tracking-tight leading-tight drop-shadow-lg">
                                {event.couple_names || event.title}
                            </h1>
                            {event.event_date && (
                                <p className="text-xs text-zinc-400 font-bold tracking-widest uppercase mt-2">
                                    {new Date(event.event_date + 'T00:00:00').toLocaleDateString('es-AR', {
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric'
                                    })}
                                </p>
                            )}
                        </div>

                        {/* Envelope Graphic Container with Wax Seal */}
                        <div 
                            onClick={handleOpenEnvelope}
                            className="relative mx-auto w-72 sm:w-80 h-48 sm:h-52 rounded-2xl bg-gradient-to-b from-stone-900 via-zinc-900 to-zinc-950 border-2 border-amber-500/40 shadow-2xl shadow-amber-500/10 flex flex-col items-center justify-center cursor-pointer group hover:border-amber-400 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {/* Envelope Flap Highlight */}
                            <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-amber-500/10 to-transparent rounded-t-2xl border-b border-amber-500/20" />
                            
                            {/* Wax Seal Centerpiece */}
                            <div className="relative z-10 flex flex-col items-center gap-2">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-amber-600 to-amber-900 flex items-center justify-center shadow-2xl border-2 border-amber-300 text-zinc-950 animate-seal-pulse group-hover:scale-110 transition-transform">
                                    <Heart className="w-7 h-7 text-amber-100 fill-amber-100" />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-wider text-amber-300/90 group-hover:text-amber-200 transition-colors">
                                    Tocar para abrir
                                </span>
                            </div>

                            {/* Corner Golden Flourishes */}
                            <div className="absolute top-2 left-2 text-[10px] text-amber-500/40 font-serif">✦</div>
                            <div className="absolute top-2 right-2 text-[10px] text-amber-500/40 font-serif">✦</div>
                            <div className="absolute bottom-2 left-2 text-[10px] text-amber-500/40 font-serif">✦</div>
                            <div className="absolute bottom-2 right-2 text-[10px] text-amber-500/40 font-serif">✦</div>
                        </div>

                        {/* CTA Button */}
                        <div className="space-y-3 pt-2">
                            <button
                                type="button"
                                onClick={handleOpenEnvelope}
                                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-zinc-950 font-black text-xs uppercase tracking-widest shadow-xl shadow-amber-500/30 transition-all hover:scale-105 active:scale-95 inline-flex items-center justify-center gap-2.5"
                            >
                                <Mail className="w-4 h-4 text-zinc-950" />
                                <span>Abrir Invitación</span>
                                <Music className="w-4 h-4 text-zinc-950 animate-bounce" />
                            </button>
                            <p className="text-[11px] text-zinc-400 flex items-center justify-center gap-1.5">
                                <span>🎵</span>
                                <span>Música de ambientación incluida</span>
                            </p>
                            <button
                                type="button"
                                onClick={() => setIsEnvelopeOpen(true)}
                                className="text-[10px] text-zinc-500 hover:text-zinc-400 underline transition-colors"
                            >
                                Entrar sin sonido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FLOATING TOP CONTROLS (THEME, BACKGROUND MUSIC & SPOTIFY BUTTON) */}
            <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
                {/* Floating Background Music Widget */}
                {hasBackgroundMusic && isEnvelopeOpen && (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-zinc-900/90 dark:bg-zinc-800/90 backdrop-blur-md border border-amber-500/30 shadow-xl text-white">
                        <button
                            type="button"
                            onClick={toggleAudioPlay}
                            className="flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-200 transition-colors"
                            title={isPlayingAudio ? 'Pausar música' : 'Reproducir música'}
                        >
                            {isPlayingAudio ? (
                                <>
                                    <Pause className="w-3.5 h-3.5 text-amber-400" />
                                    <div className="flex items-end gap-0.5 h-3.5 px-0.5">
                                        <span className="w-0.5 bg-amber-400 rounded-full animate-soundwave-1" />
                                        <span className="w-0.5 bg-amber-400 rounded-full animate-soundwave-2" />
                                        <span className="w-0.5 bg-amber-400 rounded-full animate-soundwave-3" />
                                        <span className="w-0.5 bg-amber-400 rounded-full animate-soundwave-4" />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Play className="w-3.5 h-3.5 text-zinc-400" />
                                    <span className="text-[11px] text-zinc-400">Play</span>
                                </>
                            )}
                        </button>

                        <div className="w-px h-3.5 bg-zinc-700 mx-0.5" />

                        <button
                            type="button"
                            onClick={toggleAudioMute}
                            className="text-zinc-400 hover:text-white transition-colors"
                            title={isMuted ? 'Activar sonido' : 'Silenciar'}
                        >
                            {isMuted ? (
                                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                            ) : (
                                <Volume2 className="w-3.5 h-3.5 text-zinc-300" />
                            )}
                        </button>
                    </div>
                )}

                {features.spotify && (event.spotify_url || spotifyEmbedUrl) && (
                    <button
                        type="button"
                        onClick={() => setShowMusicPlayer(!showMusicPlayer)}
                        className="p-3 rounded-full bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-xl transition-all hover:scale-110 flex items-center gap-2 font-black text-xs"
                        title="Música Spotify"
                    >
                        <Disc className="w-5 h-5 animate-spin-slow" />
                        <span className="hidden sm:inline">Spotify</span>
                    </button>
                )}

                <button
                    onClick={toggleTheme}
                    className="p-3 rounded-full bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:scale-105 transition-all shadow-xl"
                    title="Modo Claro / Oscuro"
                >
                    <Sun className="w-4 h-4 hidden dark:block text-amber-400" />
                    <Moon className="w-4 h-4 block dark:hidden text-indigo-600" />
                </button>
            </div>

            {/* FLOATING SPOTIFY PLAYER DRAWER */}
            {showMusicPlayer && spotifyEmbedUrl && (
                <div className="fixed bottom-4 right-4 z-40 w-80 sm:w-96 rounded-3xl overflow-hidden shadow-2xl border border-zinc-700/80 bg-zinc-950 p-3 animate-fade-in">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 px-1">
                        <div className="flex items-center gap-2 text-xs font-black text-emerald-400 uppercase tracking-wider">
                            <Music className="w-4 h-4 animate-bounce" />
                            <span>Música del Evento</span>
                        </div>
                        <button onClick={() => setShowMusicPlayer(false)} className="text-zinc-400 hover:text-white p-1">
                            ✕
                        </button>
                    </div>
                    <iframe
                        src={spotifyEmbedUrl}
                        width="100%"
                        height="152"
                        frameBorder="0"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        className="rounded-2xl"
                    />
                </div>
            )}

            {/* HERO COVER BANNER */}
            <div className="relative w-full min-h-[500px] sm:min-h-[580px] flex items-center justify-center text-center overflow-hidden">
                {/* Background Image / Cover */}
                {event.cover_photo_url ? (
                    <div className="absolute inset-0">
                        <img 
                            src={event.cover_photo_url} 
                            alt={event.couple_names || event.title}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/90 dark:to-zinc-950" />
                    </div>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-b from-rose-900 via-zinc-950 to-zinc-950">
                        <div className="absolute -top-40 -right-40 w-96 h-96 bg-rose-500/20 rounded-full blur-3xl" />
                        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
                    </div>
                )}

                {/* Hero Content */}
                <div className="relative z-10 p-6 max-w-2xl mx-auto space-y-4 text-white">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 dark:bg-zinc-800/60 backdrop-blur-md border border-white/30 text-xs font-black tracking-widest uppercase">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                        Invitación Especial
                        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    </div>

                    <h1 className="text-4xl sm:text-6xl font-black tracking-tight drop-shadow-lg font-serif">
                        {event?.couple_names || event?.title}
                    </h1>

                    {guest && (
                        <p className="text-base sm:text-lg font-medium text-zinc-200 drop-shadow">
                            ¡Hola <span className="font-extrabold text-amber-300">{guest.name}</span>! Nos llena de felicidad invitarte a compartir este momento tan soñado con nosotros.
                        </p>
                    )}

                    {event.welcome_message && (
                        <p className="text-xs sm:text-sm text-zinc-300 italic max-w-md mx-auto leading-relaxed">
                            "{event.welcome_message}"
                        </p>
                    )}

                    {/* Spotify Direct Button in Hero */}
                    {event.spotify_url && (
                        <div className="pt-2">
                            <a
                                href={event.spotify_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs transition-all shadow-xl hover:scale-105"
                            >
                                <Disc className="w-4 h-4 animate-spin-slow" />
                                <span>Escuchar nuestra Playlist en Spotify</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN CONTENT WRAPPER */}
            <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-16 relative z-20 space-y-8">

                {/* COUNTDOWN TIMER CARD */}
                {features.countdown && event.event_date && (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-4">
                        <span className="text-[11px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {timeLeft.isToday ? '¡Es Hoy!' : timeLeft.isPast ? 'Evento Finalizado' : 'Cuenta Regresiva'}
                        </span>

                        {timeLeft.isToday ? (
                            <h2 className="text-3xl font-black text-rose-500 animate-pulse font-serif">
                                ¡Hoy es el gran día! 🎉
                            </h2>
                        ) : timeLeft.isPast ? (
                            <h2 className="text-xl font-black text-zinc-400">
                                ¡Gracias por haber formado parte de este día inolvidable!
                            </h2>
                        ) : (
                            <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-lg mx-auto">
                                {[
                                    { label: 'Días', value: timeLeft.days },
                                    { label: 'Horas', value: timeLeft.hours },
                                    { label: 'Minutos', value: timeLeft.minutes },
                                    { label: 'Segundos', value: timeLeft.seconds },
                                ].map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        className="bg-zinc-50 dark:bg-zinc-800/80 rounded-2xl p-3 sm:p-4 border border-zinc-200/80 dark:border-zinc-700/60 shadow-sm"
                                    >
                                        <div className="text-2xl sm:text-4xl font-black text-zinc-900 dark:text-white font-mono">
                                            {String(item.value).padStart(2, '0')}
                                        </div>
                                        <div className="text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">
                                            {item.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* LOCATION & CALENDAR CARD */}
                <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                    <div className="text-center space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">
                            Coordenadas & Fecha
                        </span>
                        <h3 className="text-2xl font-black text-zinc-900 dark:text-white">
                            ¿Cuándo y Dónde?
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Date */}
                        <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-zinc-800/50 border border-rose-100 dark:border-zinc-700 flex items-start gap-3">
                            <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-md">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase">Fecha</div>
                                <div className="text-sm font-bold text-zinc-900 dark:text-white capitalize">
                                    {event.event_date ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'A confirmar'}
                                </div>
                                <a
                                    href={getCalendarUrl()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline mt-1 inline-block"
                                >
                                    + Agendar en Google Calendar
                                </a>
                            </div>
                        </div>

                        {/* Location */}
                        <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-zinc-800/50 border border-amber-100 dark:border-zinc-700 flex items-start gap-3">
                            <div className="p-2.5 bg-amber-500 text-zinc-950 rounded-xl shadow-md">
                                <MapPin className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase">Lugar</div>
                                <div className="text-sm font-bold text-zinc-900 dark:text-white">
                                    {event.location || 'Salón Principal'}
                                </div>
                                <div className="pt-2 flex flex-wrap gap-2">
                                    {event.location && (
                                        <>
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1 bg-white dark:bg-zinc-900 rounded-lg text-[10px] font-black border border-zinc-300 dark:border-zinc-600 hover:border-amber-500 text-zinc-800 dark:text-zinc-200 flex items-center gap-1 shadow-sm"
                                            >
                                                <Navigation className="w-3 h-3 text-amber-500" />
                                                Google Maps
                                            </a>
                                            <a
                                                href={`https://waze.com/ul?q=${encodeURIComponent(event.location)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1 bg-white dark:bg-zinc-900 rounded-lg text-[10px] font-black border border-zinc-300 dark:border-zinc-600 hover:border-blue-500 text-zinc-800 dark:text-zinc-200 flex items-center gap-1 shadow-sm"
                                            >
                                                <Navigation className="w-3 h-3 text-blue-500" />
                                                Waze
                                            </a>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* DRESS CODE CARD */}
                {features.dress_code && event.dress_code && (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20 text-2xl">
                            👗
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                                Código de Vestimenta
                            </span>
                            <h4 className="text-lg font-black text-zinc-900 dark:text-white capitalize">
                                {event.dress_code.replace('_', ' ')}
                            </h4>
                            {event.dress_code_notes && (
                                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                                    {event.dress_code_notes}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* ITINERARY / SCHEDULE */}
                {event.timing && event.timing.length > 0 && (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
                        <div className="text-center space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                                Itinerario
                            </span>
                            <h3 className="text-2xl font-black text-zinc-900 dark:text-white">
                                Cronograma del Evento
                            </h3>
                        </div>

                        <div className="space-y-3 pt-2">
                            {event.timing.map((item, idx) => (
                                <div key={item.id || idx} className="flex items-start gap-4 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60">
                                    <span className="bg-zinc-900 dark:bg-zinc-700 text-white px-3 py-1.5 rounded-xl text-xs font-black tracking-wider text-center shrink-0 min-w-[75px]">
                                        {item.time}
                                    </span>
                                    <div>
                                        <h4 className="text-xs font-black text-zinc-900 dark:text-white">
                                            {item.title}
                                        </h4>
                                        {item.description && (
                                            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 font-medium">
                                                {item.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* RSVP CONFIRMATION FORM */}
                {guest && (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-2 border-rose-200/80 dark:border-zinc-700 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
                        <div className="text-center space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">
                                Tu Asistencia
                            </span>
                            <h3 className="text-2xl font-black text-zinc-900 dark:text-white">
                                Confirmar Asistencia (RSVP)
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {data.deadline_date && `Fecha límite para confirmar: ${data.deadline_date}`}
                            </p>
                        </div>

                        {data.is_expired ? (
                            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl p-6 text-center space-y-2">
                                <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                                <h4 className="text-base font-black text-rose-800 dark:text-rose-200">Plazo de Confirmación Finalizado</h4>
                                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                    El plazo máximo para confirmar fue el {data.deadline_date}. Por favor contactá directamente a los organizadores.
                                </p>
                            </div>
                        ) : submitted ? (
                            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 animate-fade-in">
                                <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg">
                                    <CheckCircle2 className="w-10 h-10" />
                                </div>
                                <h3 className="text-2xl font-black text-zinc-900 dark:text-white">
                                    ¡Respuesta Registrada con Éxito!
                                </h3>
                                <p className="text-xs text-zinc-600 dark:text-zinc-300 max-w-sm mx-auto">
                                    {status === 'confirmed'
                                        ? `¡Muchas gracias ${guest.name}! Te esperamos con mucha alegría.`
                                        : `Agradecemos mucho que nos hayas avisado, ${guest.name}.`}
                                </p>

                                {/* Entrance Pass QR Code */}
                                {status === 'confirmed' && (
                                    <div className="bg-white dark:bg-zinc-900 border border-emerald-500/30 rounded-2xl p-6 max-w-xs mx-auto shadow-lg space-y-3">
                                        <div className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">
                                            🎫 PASE DE ACCESO AL EVENTO
                                        </div>
                                        <div className="text-base font-black text-zinc-900 dark:text-white">{guest.name}</div>
                                        <div className="text-xs text-zinc-500 font-bold">
                                            {confirmedPasses} {confirmedPasses === 1 ? 'Persona' : 'Personas'} {guest.table_number ? `· Mesa ${guest.table_number}` : ''}
                                        </div>
                                        <div className="bg-white p-2 rounded-xl inline-block border shadow-inner">
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/confirmar/${guest.token}`)}`}
                                                alt="QR Entrada"
                                                className="w-36 h-36 mx-auto rounded-lg"
                                            />
                                        </div>
                                        <p className="text-[10px] text-zinc-400">Presentá este código al ingresar al salón.</p>
                                    </div>
                                )}

                                <div className="pt-2 flex flex-wrap justify-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setSubmitted(false)}
                                        className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-white underline"
                                    >
                                        Modificar mi respuesta
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* Option Attending */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label
                                        onClick={() => setStatus('confirmed')}
                                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                                            status === 'confirmed'
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-white shadow-md'
                                                : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-500'
                                        }`}
                                    >
                                        <CheckCircle2 className={`w-5 h-5 shrink-0 ${status === 'confirmed' ? 'text-emerald-500' : 'text-zinc-400'}`} />
                                        <span className="text-xs font-bold">¡Sí, asistiré! 🎉</span>
                                    </label>

                                    <label
                                        onClick={() => setStatus('declined')}
                                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                                            status === 'declined'
                                                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-white shadow-md'
                                                : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-500'
                                        }`}
                                    >
                                        <XCircle className={`w-5 h-5 shrink-0 ${status === 'declined' ? 'text-rose-500' : 'text-zinc-400'}`} />
                                        <span className="text-xs font-bold">No podré asistir 😔</span>
                                    </label>
                                </div>

                                {status === 'confirmed' && (
                                    <div className="space-y-4 bg-zinc-50 dark:bg-zinc-800/40 p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60">
                                        {/* Passes Selection */}
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                                                Confirmación de Asistentes ({confirmedPasses} de {guest.passes} pases asignados)
                                            </label>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Adultos</label>
                                                    <select
                                                        value={confirmedAdults}
                                                        onChange={(e) => setConfirmedAdults(parseInt(e.target.value, 10))}
                                                        className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-bold outline-none"
                                                    >
                                                        {Array.from({ length: (guest.adults || 1) + 1 }, (_, i) => i).map(num => (
                                                            <option key={num} value={num}>{num} {num === 1 ? 'Adulto' : 'Adultos'}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Jóvenes</label>
                                                    <select
                                                        value={confirmedYouth}
                                                        onChange={(e) => setConfirmedYouth(parseInt(e.target.value, 10))}
                                                        className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-bold outline-none"
                                                    >
                                                        {Array.from({ length: (guest.youth || 0) + 1 }, (_, i) => i).map(num => (
                                                            <option key={num} value={num}>{num} {num === 1 ? 'Joven' : 'Jóvenes'}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Niños</label>
                                                    <select
                                                        value={confirmedChildren}
                                                        onChange={(e) => setConfirmedChildren(parseInt(e.target.value, 10))}
                                                        className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-bold outline-none"
                                                    >
                                                        {Array.from({ length: (guest.children || 0) + 1 }, (_, i) => i).map(num => (
                                                            <option key={num} value={num}>{num} {num === 1 ? 'Niño' : 'Niños'}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Dietary Restrictions */}
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                                                <Utensils className="w-3.5 h-3.5 text-amber-500" />
                                                Menú Especial / Restricciones Alimentarias
                                            </label>
                                            <input
                                                type="text"
                                                value={dietary}
                                                onChange={(e) => setDietary(e.target.value)}
                                                placeholder="Ej: Celíaco, Vegetariano, Vegano, Alergia al maní..."
                                                className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none"
                                            />
                                        </div>

                                        {/* DJ Song Suggestion Feature */}
                                        {features.music_suggestions && (
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                                                    <Disc className="w-3.5 h-3.5 text-emerald-500" />
                                                    ¿Qué canción no puede faltar en la fiesta? (Para el DJ)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={songSuggestion}
                                                    onChange={(e) => setSongSuggestion(e.target.value)}
                                                    placeholder="Ej: Dua Lipa - Levitating / Rodrigo - Ocho Cuarenta"
                                                    className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Emotive Note */}
                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                                        Mensaje o Deseo para los Anfitriones
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="¡Les deseamos lo mejor en este gran día!"
                                        className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 hover:opacity-95 text-white font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-rose-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <Send className="w-4 h-4" />
                                    <span>{submitting ? 'Enviando confirmación...' : 'Confirmar Asistencia'}</span>
                                </button>
                            </form>
                        )}
                    </div>
                )}

                {/* GIFTS & BANK ACCOUNT DETAILS (LLUVIA DE SOBRES) */}
                {features.gifts && (giftSettings.cbu || giftSettings.alias || giftSettings.external_registry_url || (giftSettings.custom_gifts && giftSettings.custom_gifts.length > 0)) && (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                        <div className="text-center space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                                Muestra de Cariño
                            </span>
                            <h3 className="text-2xl font-black text-zinc-900 dark:text-white">
                                Lista de Regalos
                            </h3>
                            {giftSettings.notes && (
                                <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto italic">
                                    "{giftSettings.notes}"
                                </p>
                            )}
                        </div>

                        {/* Bank Transfer Details with 1-Click Copy */}
                        {(giftSettings.cbu || giftSettings.alias) && (
                            <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-zinc-800/50 border border-amber-200/80 dark:border-zinc-700 space-y-4">
                                <div className="text-xs font-black uppercase text-amber-700 dark:text-amber-400 tracking-wider">
                                    Datos Bancarios para Transferencia Directa
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    {giftSettings.bank_name && (
                                        <div>
                                            <span className="text-zinc-500 block text-[10px] font-bold">Banco / Billetera</span>
                                            <span className="font-bold text-zinc-900 dark:text-white">{giftSettings.bank_name}</span>
                                        </div>
                                    )}

                                    {giftSettings.account_holder && (
                                        <div>
                                            <span className="text-zinc-500 block text-[10px] font-bold">Titular</span>
                                            <span className="font-bold text-zinc-900 dark:text-white">{giftSettings.account_holder}</span>
                                        </div>
                                    )}

                                    {/* ALIAS WITH 1-CLICK COPY BUTTON */}
                                    {giftSettings.alias && (
                                        <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900 border border-amber-300 dark:border-zinc-700">
                                            <div>
                                                <span className="text-zinc-500 block text-[10px] font-bold">Alias</span>
                                                <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                                                    {giftSettings.alias}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(giftSettings.alias, 'alias')}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                                                    copiedField === 'alias'
                                                        ? 'bg-emerald-500 text-white'
                                                        : 'bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-md'
                                                }`}
                                            >
                                                {copiedField === 'alias' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                <span>{copiedField === 'alias' ? '¡Copiado!' : 'Copiar Alias'}</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* CBU WITH 1-CLICK COPY BUTTON */}
                                    {giftSettings.cbu && (
                                        <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                                            <div className="min-w-0 pr-2">
                                                <span className="text-zinc-500 block text-[10px] font-bold">CBU / CVU</span>
                                                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-xs truncate block">
                                                    {giftSettings.cbu}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(giftSettings.cbu, 'cbu')}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 ${
                                                    copiedField === 'cbu'
                                                        ? 'bg-emerald-500 text-white'
                                                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 shadow-sm'
                                                }`}
                                            >
                                                {copiedField === 'cbu' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                <span>{copiedField === 'cbu' ? '¡Copiado!' : 'Copiar CBU'}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Custom Fictitious Gifts */}
                        {giftSettings.custom_gifts && giftSettings.custom_gifts.length > 0 && (
                            <div className="space-y-3">
                                <div className="text-xs font-black uppercase text-zinc-400 tracking-wider">
                                    Opciones de Regalos Simbólicos:
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {giftSettings.custom_gifts.map((gift, idx) => (
                                        <div
                                            key={gift.id || idx}
                                            onClick={() => {
                                                if (giftSettings.alias) handleCopy(giftSettings.alias, 'alias');
                                            }}
                                            className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 text-center space-y-2 cursor-pointer hover:border-amber-400 transition-all hover:scale-102 group shadow-sm"
                                        >
                                            <div className="text-3xl">{gift.icon || '🎁'}</div>
                                            <div className="text-xs font-black text-zinc-900 dark:text-white">{gift.title}</div>
                                            {gift.amount && (
                                                <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                                    ${Number(gift.amount).toLocaleString('es-ES')}
                                                </div>
                                            )}
                                            <div className="text-[10px] text-zinc-400 group-hover:text-amber-500 font-bold">
                                                Tocá para copiar Alias y regalar
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* External Registry */}
                        {giftSettings.external_registry_url && (
                            <div className="text-center pt-2">
                                <a
                                    href={giftSettings.external_registry_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-zinc-900 dark:bg-zinc-800 text-white text-xs font-black transition-all hover:scale-105 shadow-md"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    <span>Ver nuestra Lista de Regalos en Tienda</span>
                                </a>
                            </div>
                        )}
                    </div>
                )}

                {/* GUEST DEDICATIONS / STORIES CAROUSEL */}
                {features.guest_dedications && (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">
                                    Muro en Vivo
                                </span>
                                <h3 className="text-2xl font-black text-zinc-900 dark:text-white">
                                    Recuerdos & Dedicatorias ({dedications.length})
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    Fotos y videos cortos que se proyectan durante la fiesta.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowDedicationModal(true)}
                                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-black text-xs shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                            >
                                <Camera className="w-4 h-4" />
                                <span>Subir Foto o Video 📹</span>
                            </button>
                        </div>

                        {/* Dedications Feed / Carousel */}
                        {dedications.length === 0 ? (
                            <div className="p-8 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                                <MessageSquare className="w-8 h-8 text-rose-400 mx-auto" />
                                <div className="text-xs font-bold text-zinc-600 dark:text-zinc-300">¡Sé el primero en dejar una dedicatoria!</div>
                                <div className="text-[11px] text-zinc-400">Podés subir una foto o grabar un video corto saludando a los agasajados.</div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {dedications.slice(0, 9).map((item) => (
                                    <div
                                        key={item.id}
                                        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-800/40 space-y-2 shadow-sm"
                                    >
                                        {item.type === 'video' ? (
                                            <div className="rounded-xl overflow-hidden aspect-video bg-black flex items-center justify-center">
                                                <video src={item.media_url} controls className="w-full h-full object-cover" />
                                            </div>
                                        ) : item.type === 'photo' ? (
                                            <div className="rounded-xl overflow-hidden aspect-video bg-black flex items-center justify-center">
                                                <img src={item.media_url} alt="Dedicatoria" className="w-full h-full object-cover" />
                                            </div>
                                        ) : null}

                                        <div>
                                            <div className="text-xs font-black text-zinc-900 dark:text-white">{item.author_name}</div>
                                            {item.message && (
                                                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 italic line-clamp-2">
                                                    "{item.message}"
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* DEDICATION UPLOAD MODAL */}
            {showDedicationModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-fade-in relative">
                        <button
                            type="button"
                            onClick={() => setShowDedicationModal(false)}
                            className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
                        >
                            ✕
                        </button>

                        <div className="text-center space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">
                                Saludo en Vivo
                            </span>
                            <h3 className="text-xl font-black text-zinc-900 dark:text-white">
                                Subir Foto o Video Dedicatoria
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Tu saludo se mostrará en la pantalla gigante durante el evento.
                            </p>
                        </div>

                        {dedicationSuccess ? (
                            <div className="text-center py-6 space-y-3">
                                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
                                <h4 className="text-base font-black text-zinc-900 dark:text-white">¡Dedicatoria Enviada!</h4>
                                <p className="text-xs text-zinc-500">Gracias por tu mensaje cariñoso.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleDedicationSubmit} className="space-y-4">
                                {!token && (
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                                            Tu Nombre
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={dedicationAuthor}
                                            onChange={(e) => setDedicationAuthor(e.target.value)}
                                            placeholder="Tu nombre y apellido"
                                            className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5 font-bold outline-none"
                                        />
                                    </div>
                                )}

                                {/* File selector */}
                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                                        Foto o Video Corto (hasta 30s)
                                    </label>
                                    <input
                                        ref={dedicationInputRef}
                                        type="file"
                                        accept="image/*,video/*"
                                        onChange={handleDedicationFile}
                                        className="hidden"
                                    />

                                    {dedicationPreview ? (
                                        <div className="relative rounded-2xl overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-black p-1 text-center">
                                            {dedicationType === 'video' ? (
                                                <video src={dedicationPreview} controls className="max-h-48 mx-auto rounded-xl" />
                                            ) : (
                                                <img src={dedicationPreview} alt="Preview" className="max-h-48 mx-auto rounded-xl object-contain" />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => { setDedicationFile(null); setDedicationPreview(null); }}
                                                className="mt-1 text-[11px] text-rose-500 font-bold hover:underline"
                                            >
                                                Cambiar archivo
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => dedicationInputRef.current?.click()}
                                            className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-rose-500 rounded-2xl p-5 text-center cursor-pointer space-y-1 bg-zinc-50 dark:bg-zinc-800/40"
                                        >
                                            <Camera className="w-8 h-8 text-rose-500 mx-auto" />
                                            <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                                Tocar para tomar foto o grabar video
                                            </div>
                                            <div className="text-[10px] text-zinc-400">O elegir desde tu galería</div>
                                        </div>
                                    )}
                                </div>

                                {/* Message */}
                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                                        Dedicatoria / Deseo
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={dedicationMsg}
                                        onChange={(e) => setDedicationMsg(e.target.value)}
                                        placeholder="¡Felicidades en esta noche tan especial!"
                                        className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5 font-medium outline-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={dedicationUploading || (!dedicationFile && !dedicationMsg.trim())}
                                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-lg disabled:opacity-50"
                                >
                                    {dedicationUploading ? 'Subiendo dedicatoria...' : 'Enviar Dedicatoria'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
