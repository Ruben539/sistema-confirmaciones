import React, { useState } from 'react';
import { 
    X, Music, Gift, Shirt, Image, Sparkles, Check, Plus, Trash2, Upload, 
    AlertCircle, Save, ExternalLink, Volume2, Play, Disc, FileAudio
} from 'lucide-react';
import { apiFetch } from '../api';

export default function EventInvitationSettingsModal({ event, onClose, onUpdated }) {
    const [activeTab, setActiveTab] = useState('spotify'); // 'spotify', 'gifts', 'dress_code', 'cover', 'features'
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Form state
    const initialBgPath = event.background_music_path || '';
    const isBgSpotify = initialBgPath.includes('spotify.com');
    const [spotifyUrl, setSpotifyUrl] = useState(event.spotify_url || (isBgSpotify ? initialBgPath : ''));
    const [dressCode, setDressCode] = useState(event.dress_code || 'elegante');
    const [dressCodeNotes, setDressCodeNotes] = useState(event.dress_code_notes || '');
    const [welcomeMessage, setWelcomeMessage] = useState(event.welcome_message || '');

    // Background music state (only actual audio files / MP3, not Spotify embeds)
    const [backgroundMusicUrl, setBackgroundMusicUrl] = useState(
        (!isBgSpotify && event.background_music_url) ? event.background_music_url : ''
    );
    const [backgroundMusicFile, setBackgroundMusicFile] = useState(null);
    const [isMusicRemoved, setIsMusicRemoved] = useState(false);
    const [customAudioUrl, setCustomAudioUrl] = useState(
        (!isBgSpotify && initialBgPath.startsWith('http')) ? initialBgPath : ''
    );

    // Bank & Gift settings
    const initialGifts = event.gift_settings || {};
    const [bankName, setBankName] = useState(initialGifts.bank_name || '');
    const [accountHolder, setAccountHolder] = useState(initialGifts.account_holder || '');
    const [cbu, setCbu] = useState(initialGifts.cbu || '');
    const [cvu, setCvu] = useState(initialGifts.cvu || '');
    const [alias, setAlias] = useState(initialGifts.alias || '');
    const [giftNotes, setGiftNotes] = useState(initialGifts.notes || 'El mejor regalo es tu compañía, pero si deseás hacernos un presente...');
    const [externalRegistryUrl, setExternalRegistryUrl] = useState(initialGifts.external_registry_url || '');
    const [customGifts, setCustomGifts] = useState(initialGifts.custom_gifts || [
        { id: 1, title: 'Brindis en la Luna de Miel', description: 'Para celebrar nuestro primer atardecer juntos', amount: 15000, icon: '🥂' },
        { id: 2, title: 'Cena Romántica', description: 'Una cena especial para dos', amount: 30000, icon: '🍽️' },
        { id: 3, title: 'Excursión Aventura', description: 'Un paseo inolvidable en nuestro viaje', amount: 50000, icon: '🌴' },
    ]);

    // Cover photo state
    const [coverPhotoFile, setCoverPhotoFile] = useState(null);
    const [coverPreview, setCoverPreview] = useState(event.cover_photo_url || null);

    // Features Enabled switches
    const initialFeatures = event.features_enabled || {
        spotify: true,
        gifts: true,
        music_suggestions: true,
        countdown: true,
        guest_dedications: true,
        dress_code: true,
        background_music: true,
    };
    const [features, setFeatures] = useState(initialFeatures);

    const handleAddCustomGift = () => {
        setCustomGifts(prev => [
            ...prev,
            { id: Date.now(), title: 'Nuevo Regalo', description: '', amount: 10000, icon: '🎁' }
        ]);
    };

    const handleUpdateCustomGift = (index, field, value) => {
        setCustomGifts(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleRemoveCustomGift = (index) => {
        setCustomGifts(prev => prev.filter((_, i) => i !== index));
    };

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

    const handleCoverFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverPreview(URL.createObjectURL(file));
            try {
                const optimized = await compressImage(file);
                setCoverPhotoFile(optimized);
            } catch (err) {
                setCoverPhotoFile(file);
            }
        }
    };

    const handleMusicFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 30 * 1024 * 1024) {
                setError('El archivo de música no debe superar los 30MB');
                return;
            }
            setBackgroundMusicFile(file);
            setBackgroundMusicUrl(URL.createObjectURL(file));
            setIsMusicRemoved(false);
            setError(null);
        }
    };

    const handleRemoveMusic = () => {
        setBackgroundMusicFile(null);
        setBackgroundMusicUrl('');
        setCustomAudioUrl('');
        setIsMusicRemoved(true);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const token = localStorage.getItem('auth_token');

            // 1. If cover photo file changed, upload it first
            if (coverPhotoFile) {
                const formData = new FormData();
                formData.append('photo', coverPhotoFile);
                await fetch(`/api/events/${event.id}/cover-photo`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: formData
                });
            }

            // 2. If background music file was selected, upload it
            if (backgroundMusicFile) {
                const musicData = new FormData();
                musicData.append('music', backgroundMusicFile);
                const musicRes = await fetch(`/api/events/${event.id}/background-music`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: musicData
                });
                if (!musicRes.ok) {
                    const errData = await musicRes.json().catch(() => ({}));
                    throw new Error(errData.message || 'Error al subir la pista de música de fondo.');
                }
            } else if (isMusicRemoved) {
                await fetch(`/api/events/${event.id}/background-music`, {
                    method: 'DELETE',
                    headers: {
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                });
            }

            // 3. Save event settings
            const eventPayload = {
                spotify_url: spotifyUrl,
                dress_code: dressCode,
                dress_code_notes: dressCodeNotes,
                welcome_message: welcomeMessage,
                gift_settings: {
                    bank_name: bankName,
                    account_holder: accountHolder,
                    cbu: cbu,
                    cvu: cvu,
                    alias: alias,
                    notes: giftNotes,
                    external_registry_url: externalRegistryUrl,
                    custom_gifts: customGifts,
                },
                features_enabled: features,
            };

            // If direct audio URL was set (not uploaded file)
            if (customAudioUrl && !backgroundMusicFile && !isMusicRemoved) {
                if (customAudioUrl.includes('spotify.com')) {
                    if (!eventPayload.spotify_url) eventPayload.spotify_url = customAudioUrl;
                    eventPayload.background_music_path = null;
                } else {
                    eventPayload.background_music_path = customAudioUrl;
                }
            } else if (isMusicRemoved) {
                eventPayload.background_music_path = null;
            }

            const { ok, json } = await apiFetch(`/api/event/${event.id}`, {
                method: 'PUT',
                body: JSON.stringify(eventPayload)
            });

            if (ok) {
                setSuccessMessage('¡Configuración de Invitación Digital guardada con éxito!');
                if (onUpdated) onUpdated(json.event);
                setTimeout(() => {
                    onClose();
                }, 1200);
            } else {
                setError(json?.message || 'Error al guardar la configuración.');
            }
        } catch (err) {
            console.error(err);
            setError(err.message || 'Error de conexión al guardar.');
        } finally {
            setSaving(false);
        }
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

    const spotifyEmbedUrl = getSpotifyEmbedUrl(spotifyUrl);

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 font-sans">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 via-rose-500 to-amber-600 text-zinc-950 shadow-lg">
                            <Sparkles className="w-5 h-5 font-black" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                                Configuración Interactiva
                            </span>
                            <h3 className="text-lg font-black text-white">
                                Invitación Digital, Spotify y Regalos
                            </h3>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-zinc-800 bg-zinc-950/40 px-6 gap-2 overflow-x-auto select-none">
                    <button
                        type="button"
                        onClick={() => setActiveTab('spotify')}
                        className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                            activeTab === 'spotify' ? 'border-amber-400 text-amber-300' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        <Music className="w-4 h-4 text-emerald-400" />
                        Música & Entrada
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('gifts')}
                        className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                            activeTab === 'gifts' ? 'border-amber-400 text-amber-300' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        <Gift className="w-4 h-4 text-rose-400" />
                        Regalos & CBU
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('dress_code')}
                        className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                            activeTab === 'dress_code' ? 'border-amber-400 text-amber-300' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        <Shirt className="w-4 h-4 text-indigo-400" />
                        Dress Code
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('cover')}
                        className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                            activeTab === 'cover' ? 'border-amber-400 text-amber-300' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        <Image className="w-4 h-4 text-amber-400" />
                        Foto de Portada
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('features')}
                        className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                            activeTab === 'features' ? 'border-amber-400 text-amber-300' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                        Módulos Activos
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-5">
                    {error && (
                        <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                            <Check className="w-4 h-4 shrink-0" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {/* MUSIC & ENTRANCE TAB */}
                    {activeTab === 'spotify' && (
                        <div className="space-y-6">
                            {/* SECTION 1: AUTOPLAY BACKGROUND MUSIC */}
                            <div className="p-4 rounded-2xl bg-zinc-950/70 border border-amber-500/30 space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                                            <Volume2 className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black uppercase text-amber-300 tracking-wider">
                                                Música de Entrada (Autoplay con Sobre Digital)
                                            </h4>
                                            <p className="text-[11px] text-zinc-400 mt-0.5">
                                                Suena automáticamente en celulares y computadoras cuando el invitado toca para abrir la invitación.
                                            </p>
                                        </div>
                                    </div>
                                    {backgroundMusicUrl && (
                                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold shrink-0">
                                            Activa 🎵
                                        </span>
                                    )}
                                </div>

                                {/* Active Music Preview Player */}
                                {backgroundMusicUrl ? (
                                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2 font-bold text-zinc-200 truncate">
                                                <FileAudio className="w-4 h-4 text-amber-400 shrink-0" />
                                                <span className="truncate">
                                                    {backgroundMusicFile ? backgroundMusicFile.name : 'Pista de audio configurada'}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleRemoveMusic}
                                                className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold transition-colors shrink-0 ml-2"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Quitar
                                            </button>
                                        </div>
                                        <audio 
                                            controls 
                                            src={backgroundMusicUrl} 
                                            className="w-full h-9 rounded-lg"
                                        />
                                    </div>
                                ) : (
                                    <div className="text-center py-2">
                                        <p className="text-[11px] text-zinc-500">
                                            No hay música de fondo configurada. Podés subir un archivo MP3 de tu canción favorita.
                                        </p>
                                    </div>
                                )}

                                {/* Upload & Link controls */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    {/* Upload MP3 button */}
                                    <div>
                                        <input
                                            type="file"
                                            id="bg-music-input"
                                            accept="audio/mp3,audio/wav,audio/ogg,audio/m4a,audio/aac,audio/*"
                                            onChange={handleMusicFileChange}
                                            className="hidden"
                                        />
                                        <label
                                            htmlFor="bg-music-input"
                                            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300 text-xs font-bold cursor-pointer transition-all active:scale-95"
                                        >
                                            <Upload className="w-4 h-4" />
                                            <span>{backgroundMusicUrl ? 'Cambiar archivo MP3' : 'Subir canción MP3 / WAV'}</span>
                                        </label>
                                        <span className="block text-[10px] text-zinc-500 text-center mt-1">
                                            Hasta 30MB (MP3, WAV, M4A)
                                        </span>
                                    </div>

                                    {/* Direct MP3 URL */}
                                    <div>
                                        <input
                                            type="url"
                                            value={customAudioUrl}
                                            onChange={(e) => {
                                                const url = e.target.value.trim();
                                                if (url.includes('spotify.com')) {
                                                    setSpotifyUrl(url);
                                                    setCustomAudioUrl('');
                                                    setError('Detectamos un enlace de Spotify. Lo colocamos automáticamente en "Playlist de Spotify" (abajo). Para la música con sobre digital, por favor subí un archivo de audio MP3.');
                                                    return;
                                                }
                                                setCustomAudioUrl(url);
                                                if (url) {
                                                    setBackgroundMusicUrl(url);
                                                    setBackgroundMusicFile(null);
                                                    setIsMusicRemoved(false);
                                                } else {
                                                    setBackgroundMusicUrl('');
                                                }
                                            }}
                                            placeholder="O pegá un link directo a un archivo .mp3"
                                            className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-white p-3 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                        <span className="block text-[10px] text-zinc-500 text-center mt-1">
                                            Ej: https://miservidor.com/vals.mp3
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: SPOTIFY PLAYLIST OR TRACK EMBED */}
                            <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                                            <Disc className="w-4 h-4" />
                                        </div>
                                        <label className="text-xs font-black text-zinc-200 uppercase tracking-wider">
                                            Playlist o Tema de Spotify
                                        </label>
                                    </div>
                                    <p className="text-[11px] text-zinc-400 mb-2">
                                        Pegá el link de Spotify de la playlist del evento para que los invitados puedan explorarla y abrirla en su app.
                                    </p>
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            value={spotifyUrl}
                                            onChange={(e) => setSpotifyUrl(e.target.value)}
                                            placeholder="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
                                            className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-white p-3 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        {spotifyUrl && (
                                            <a
                                                href={spotifyUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center shrink-0"
                                                title="Abrir en Spotify"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Live Spotify Preview */}
                                {spotifyEmbedUrl ? (
                                    <div className="rounded-2xl overflow-hidden border border-zinc-800 shadow-xl bg-zinc-950 p-2">
                                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">
                                            Vista previa del Reproductor Spotify:
                                        </div>
                                        <iframe
                                            src={spotifyEmbedUrl}
                                            width="100%"
                                            height="152"
                                            frameBorder="0"
                                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                            loading="lazy"
                                            className="rounded-xl"
                                        />
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 text-center text-xs text-zinc-500">
                                        <p className="text-[11px]">Pegá una URL de Spotify para mostrar el reproductor en la tarjeta de música.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* GIFTS TAB */}
                    {activeTab === 'gifts' && (
                        <div className="space-y-5">
                            {/* Message / Header */}
                            <div>
                                <label className="block text-xs font-black text-zinc-300 uppercase tracking-wider mb-1">
                                    Frase de Agradecimiento / Mensaje para Invitados
                                </label>
                                <textarea
                                    rows={2}
                                    value={giftNotes}
                                    onChange={(e) => setGiftNotes(e.target.value)}
                                    placeholder="El mejor regalo es tu presencia, pero si deseás hacernos un presente..."
                                    className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-white p-3 font-medium outline-none focus:ring-2 focus:ring-rose-500"
                                />
                            </div>

                            {/* Bank Details (CBU / CVU / Alias) */}
                            <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-2xl p-4 space-y-3">
                                <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider">
                                    Datos Bancarios para Transferencia Directa
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-400 mb-1">Banco / Billetera Virtual</label>
                                        <input
                                            type="text"
                                            value={bankName}
                                            onChange={(e) => setBankName(e.target.value)}
                                            placeholder="Ej: Banco Galicia / Mercado Pago"
                                            className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-white p-2.5 font-medium outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-400 mb-1">Titular de la Cuenta</label>
                                        <input
                                            type="text"
                                            value={accountHolder}
                                            onChange={(e) => setAccountHolder(e.target.value)}
                                            placeholder="Ej: Juan Pérez y Sofía Gómez"
                                            className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-white p-2.5 font-medium outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-400 mb-1">Alias</label>
                                        <input
                                            type="text"
                                            value={alias}
                                            onChange={(e) => setAlias(e.target.value)}
                                            placeholder="Ej: boda.juan.sofi"
                                            className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-white p-2.5 font-bold text-amber-300 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-400 mb-1">CBU / CVU</label>
                                        <input
                                            type="text"
                                            value={cbu}
                                            onChange={(e) => setCbu(e.target.value)}
                                            placeholder="22 dígitos"
                                            className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-white p-2.5 font-mono text-zinc-200 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* External Registry Link */}
                            <div>
                                <label className="block text-xs font-black text-zinc-300 uppercase tracking-wider mb-1">
                                    Enlace a Lista Externa (Opcional)
                                </label>
                                <input
                                    type="url"
                                    value={externalRegistryUrl}
                                    onChange={(e) => setExternalRegistryUrl(e.target.value)}
                                    placeholder="https://www.tiendaderesgalos.com/novios/juan-y-sofi"
                                    className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-white p-3 font-medium outline-none"
                                />
                            </div>

                            {/* Custom Fictitious Gifts */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider">
                                            Catálogo de Regalos Simbólicos
                                        </h4>
                                        <p className="text-[11px] text-zinc-400">
                                            Ideas simpáticas para que los invitados elijan qué regalarles.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddCustomGift}
                                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Agregar Regalo
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {customGifts.map((gift, idx) => (
                                        <div key={gift.id || idx} className="p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={gift.icon || '🎁'}
                                                onChange={(e) => handleUpdateCustomGift(idx, 'icon', e.target.value)}
                                                className="w-10 text-center text-lg bg-zinc-900 border border-zinc-700 rounded-lg p-1"
                                                title="Emoji del regalo"
                                            />
                                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                <input
                                                    type="text"
                                                    value={gift.title}
                                                    onChange={(e) => handleUpdateCustomGift(idx, 'title', e.target.value)}
                                                    placeholder="Título del regalo"
                                                    className="sm:col-span-2 text-xs rounded-lg border border-zinc-700 bg-zinc-900 text-white p-2 font-bold outline-none"
                                                />
                                                <input
                                                    type="number"
                                                    value={gift.amount}
                                                    onChange={(e) => handleUpdateCustomGift(idx, 'amount', Number(e.target.value))}
                                                    placeholder="Monto sugerido $"
                                                    className="text-xs rounded-lg border border-zinc-700 bg-zinc-900 text-emerald-400 font-bold p-2 outline-none"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCustomGift(idx)}
                                                className="p-2 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-zinc-900"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DRESS CODE TAB */}
                    {activeTab === 'dress_code' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-black text-zinc-300 uppercase tracking-wider mb-2">
                                    Estilo de Vestimenta / Etiqueta
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { id: 'elegante', label: 'Elegante', icon: '👔' },
                                        { id: 'black_tie', label: 'Black Tie / Gala', icon: '🎩' },
                                        { id: 'elegante_sport', label: 'Elegante Sport', icon: '✨' },
                                        { id: 'casual', label: 'Casual / Fiesta', icon: '🎉' },
                                        { id: 'playa', label: 'Playa / Al Aire Libre', icon: '🌴' },
                                        { id: 'total_white', label: 'Total White', icon: '🤍' },
                                        { id: 'tematico', label: 'Temático / Libre', icon: '🎭' },
                                        { id: 'formal', label: 'Formal', icon: '👗' },
                                    ].map(item => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setDressCode(item.id)}
                                            className={`p-3 rounded-2xl border text-center transition-all ${
                                                dressCode === item.id
                                                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md font-black'
                                                    : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-white'
                                            }`}
                                        >
                                            <div className="text-xl mb-1">{item.icon}</div>
                                            <div className="text-xs">{item.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-zinc-300 uppercase tracking-wider mb-1">
                                    Notas y Consejos de Vestimenta
                                </label>
                                <textarea
                                    rows={3}
                                    value={dressCodeNotes}
                                    onChange={(e) => setDressCodeNotes(e.target.value)}
                                    placeholder="Ej: Agradecemos reservar el color blanco exclusivamente para la novia. Sugerimos calzado cómodo para el jardín."
                                    className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-white p-3 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* COVER PHOTO TAB */}
                    {activeTab === 'cover' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-black text-zinc-300 uppercase tracking-wider mb-1">
                                    Foto de Portada de la Invitación
                                </label>
                                <p className="text-[11px] text-zinc-400 mb-3">
                                    Esta foto se mostrará como fondo de bienvenida en la invitación digital de los invitados.
                                </p>

                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleCoverFileChange}
                                    className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-amber-500 file:text-zinc-950 hover:file:bg-amber-600 cursor-pointer"
                                />
                            </div>

                            {coverPreview ? (
                                <div className="rounded-2xl overflow-hidden border border-zinc-700 max-h-72 bg-zinc-950 flex items-center justify-center relative">
                                    <img src={coverPreview} alt="Cover Preview" className="max-h-72 w-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
                                    <div className="absolute bottom-4 left-4 text-white">
                                        <div className="text-xs font-black drop-shadow">{event.couple_names || event.title}</div>
                                        <div className="text-[10px] text-zinc-300 drop-shadow">Vista previa de portada</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 text-center text-xs text-zinc-500">
                                    <Image className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
                                    No hay foto de portada subida aún. Subí una para personalizar la bienvenida.
                                </div>
                            )}

                            {event?.google_drive_folder_url && (
                                <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-700/70 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 text-zinc-300">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                                        <span>Carpeta en Drive de este evento vinculada</span>
                                    </div>
                                    <a
                                        href={event.google_drive_folder_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-bold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 underline underline-offset-2"
                                    >
                                        Ver carpeta en Drive ↗
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {/* FEATURES TAB */}
                    {activeTab === 'features' && (
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider mb-1">
                                    Activar / Desactivar Secciones de la Invitación
                                </h4>
                                <p className="text-[11px] text-zinc-400">
                                    Elegí qué módulos estarán visibles para los invitados en la web:
                                </p>
                            </div>

                            <div className="space-y-2">
                                {[
                                    { key: 'background_music', label: 'Sobre Digital & Música de Entrada (Autoplay)', desc: 'Sobre interactivo con apertura animada y música automática.' },
                                    { key: 'spotify', label: 'Reproductor de Música Spotify', desc: 'Muestra la playlist y botón para escuchar en Spotify.' },
                                    { key: 'countdown', label: 'Cuenta Regresiva en Vivo', desc: 'Días, horas y minutos restantes hasta el evento.' },
                                    { key: 'gifts', label: 'Lista de Regalos & CBU', desc: 'Datos bancarios con botón para copiar Alias y catálogo de regalos.' },
                                    { key: 'music_suggestions', label: 'Sugerencias de Canciones para el DJ', desc: 'Permite a los invitados pedir su tema favorito en el RSVP.' },
                                    { key: 'guest_dedications', label: 'Muro de Recuerdos & Dedicatorias', desc: 'Fotos y videos cortos de invitados con modo proyección.' },
                                    { key: 'dress_code', label: 'Código de Vestimenta (Dress Code)', desc: 'Consejos de etiqueta y colores recomendados.' },
                                ].map(feat => (
                                    <label
                                        key={feat.key}
                                        className="p-3.5 rounded-2xl bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-between cursor-pointer hover:bg-zinc-800 transition-colors"
                                    >
                                        <div>
                                            <div className="text-xs font-bold text-white">{feat.label}</div>
                                            <div className="text-[11px] text-zinc-400">{feat.desc}</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={features[feat.key] ?? true}
                                            onChange={(e) => setFeatures({ ...features, [feat.key]: e.target.checked })}
                                            className="w-5 h-5 rounded-lg text-amber-500 bg-zinc-900 border-zinc-700 focus:ring-amber-500 cursor-pointer"
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-5 border-t border-zinc-800 flex items-center justify-end gap-3 bg-zinc-950/60">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={saving}
                        onClick={handleSave}
                        className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 hover:opacity-95 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Save className="w-4 h-4 text-zinc-950" />
                        <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
