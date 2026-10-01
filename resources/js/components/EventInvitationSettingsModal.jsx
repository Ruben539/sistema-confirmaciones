import React, { useState, useEffect, useRef } from 'react';
import { 
    X, Music, Gift, Shirt, Image, Sparkles, Check, Plus, Trash2, Upload, 
    AlertCircle, Save, ExternalLink, Volume2, Play, Disc, FileAudio,
    Palette, Wand2, Eye, Sliders, RefreshCw, Loader2, Search, Radio, Headphones
} from 'lucide-react';
import { apiFetch } from '../api';

const THEME_PRESETS = [
    {
        id: 'gold_noir',
        name: 'Gold & Noir',
        desc: 'Champán, negro carbón y elegancia clásica',
        primary_color: '#D97706',
        secondary_color: '#F59E0B',
        mode: 'dark',
        font_family: 'serif',
        background_type: 'gradient',
        background_value: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
        card_style: 'glass',
        envelope_color: '#3F2817',
        envelope_seal_color: '#D97706',
        sampleDot: 'bg-amber-500',
    },
    {
        id: 'romantic_rose',
        name: 'Romantic Rose',
        desc: 'Rosa empolvado, burdeos y caligrafía romántica',
        primary_color: '#E11D48',
        secondary_color: '#FB7185',
        mode: 'dark',
        font_family: 'script',
        background_type: 'gradient',
        background_value: 'linear-gradient(180deg, #240E17 0%, #0F050A 100%)',
        card_style: 'glass',
        envelope_color: '#831843',
        envelope_seal_color: '#F43F5E',
        sampleDot: 'bg-rose-500',
    },
    {
        id: 'botanical_sage',
        name: 'Botanical Sage',
        desc: 'Verde oliva y eucalipto para eventos al aire libre',
        primary_color: '#059669',
        secondary_color: '#34D399',
        mode: 'dark',
        font_family: 'serif',
        background_type: 'gradient',
        background_value: 'linear-gradient(180deg, #0D2818 0%, #05140C 100%)',
        card_style: 'glass',
        envelope_color: '#064E3B',
        envelope_seal_color: '#10B981',
        sampleDot: 'bg-emerald-500',
    },
    {
        id: 'minimal_luxury',
        name: 'Minimal Clean',
        desc: 'Fondo claro, vanguardista y minimalista',
        primary_color: '#0284C7',
        secondary_color: '#38BDF8',
        mode: 'light',
        font_family: 'sans',
        background_type: 'gradient',
        background_value: 'linear-gradient(180deg, #F8FAFC 0%, #E2E8F0 100%)',
        card_style: 'solid',
        envelope_color: '#334155',
        envelope_seal_color: '#0284C7',
        sampleDot: 'bg-sky-500',
    },
    {
        id: 'midnight_celestial',
        name: 'Midnight Stars',
        desc: 'Azul noche profundo con destellos celestiales',
        primary_color: '#818CF8',
        secondary_color: '#A5B4FC',
        mode: 'dark',
        font_family: 'serif',
        background_type: 'gradient',
        background_value: 'linear-gradient(180deg, #0F172A 0%, #030712 100%)',
        card_style: 'glass',
        envelope_color: '#1E1B4B',
        envelope_seal_color: '#6366F1',
        sampleDot: 'bg-indigo-500',
    },
    {
        id: 'royal_emerald',
        name: 'Royal Emerald',
        desc: 'Verde esmeralda imperial con filigrana dorada',
        primary_color: '#10B981',
        secondary_color: '#FBBF24',
        mode: 'dark',
        font_family: 'serif',
        background_type: 'gradient',
        background_value: 'linear-gradient(180deg, #064E3B 0%, #022C22 100%)',
        card_style: 'glass',
        envelope_color: '#022C22',
        envelope_seal_color: '#FBBF24',
        sampleDot: 'bg-teal-500',
    },
];

const AMBIENT_MUSIC_PRESETS = [
    {
        id: 'acoustic',
        name: 'Guitarra Acústica Romántica',
        desc: 'Melodía suave, íntima y emotiva (ideal para bodas y momentos de entrada)',
        path: '/audio/wedding-acoustic.mp3',
        icon: '🎸',
        badge: 'Recomendada',
    },
    {
        id: 'piano',
        name: 'Piano Emotivo de Gala',
        desc: 'Piano de cola delicado y conmovedor, estilo vals y ceremonia',
        path: '/audio/wedding-piano.mp3',
        icon: '🎹',
        badge: 'Clásica',
    },
];

const SPOTIFY_PLAYLIST_PRESETS = [
    {
        name: 'Vals & Entrada Imperial',
        desc: 'Clásicos y vals de ceremonia',
        url: 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO',
        icon: '👑',
    },
    {
        name: 'Romance Acústico',
        desc: 'Baladas acústicas e íntimas',
        url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
        icon: '🤍',
    },
    {
        name: 'Fiesta & Cachengue VIP',
        desc: 'Hits de fiesta, cumbia y baile',
        url: 'https://open.spotify.com/playlist/37i9dQZF1DX10zKzsJ2jva',
        icon: '🎉',
    },
    {
        name: 'Cóctel & Jazz Lounge',
        desc: 'Bossa nova, chill y jazz moderno',
        url: 'https://open.spotify.com/playlist/37i9dQZF1DXbITWG1ZJKYt',
        icon: '🍸',
    },
];

export default function EventInvitationSettingsModal({ event, onClose, onUpdated }) {
    const [activeTab, setActiveTab] = useState('styles'); // Default to styles!
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Invitation Styles & AI Theme State
    const defaultStyles = THEME_PRESETS[0];
    const [invitationStyles, setInvitationStyles] = useState({
        ...defaultStyles,
        ...(event.invitation_styles || {})
    });
    const [isGeneratingAiPalette, setIsGeneratingAiPalette] = useState(false);
    const [isGeneratingAiCopy, setIsGeneratingAiCopy] = useState(false);
    const [aiStyleVibe, setAiStyleVibe] = useState('');
    const [aiFeedback, setAiFeedback] = useState(null);

    // Form state
    const initialBgPath = event.background_music_path || '';
    const isBgSpotify = initialBgPath.includes('spotify.com');
    const [spotifyUrl, setSpotifyUrl] = useState(event.spotify_url || (isBgSpotify ? initialBgPath : ''));
    const [spotifyMeta, setSpotifyMeta] = useState(null);
    const [isResolvingSpotify, setIsResolvingSpotify] = useState(false);
    const [dressCode, setDressCode] = useState(event.dress_code || 'elegante');
    const [dressCodeNotes, setDressCodeNotes] = useState(event.dress_code_notes || '');
    const [welcomeMessage, setWelcomeMessage] = useState(event.welcome_message || '');

    // Live Spotify Search state in modal
    const searchSpotifyDebounceRef = useRef(null);
    const [spotifySearchQuery, setSpotifySearchQuery] = useState('');
    const [spotifySearchResults, setSpotifySearchResults] = useState([]);
    const [isSearchingSpotify, setIsSearchingSpotify] = useState(false);
    const [showSpotifySearchDropdown, setShowSpotifySearchDropdown] = useState(false);

    const handleSpotifySearchChange = (e) => {
        const val = e.target.value;
        setSpotifySearchQuery(val);

        if (searchSpotifyDebounceRef.current) {
            clearTimeout(searchSpotifyDebounceRef.current);
        }

        if (val.trim().length >= 2) {
            setIsSearchingSpotify(true);
            searchSpotifyDebounceRef.current = setTimeout(async () => {
                try {
                    const { ok, json } = await apiFetch(`/api/spotify/search?q=${encodeURIComponent(val.trim())}&limit=6`);
                    if (ok && Array.isArray(json?.results)) {
                        setSpotifySearchResults(json.results);
                        setShowSpotifySearchDropdown(true);
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    setIsSearchingSpotify(false);
                }
            }, 300);
        } else {
            setSpotifySearchResults([]);
            setShowSpotifySearchDropdown(false);
            setIsSearchingSpotify(false);
        }
    };

    const handleSelectSpotifySearchResult = (track) => {
        if (track.url) {
            setSpotifyUrl(track.url);
        }
        setShowSpotifySearchDropdown(false);
        setSpotifySearchQuery('');
    };

    const handleSelectAmbientPreset = (preset) => {
        setCustomAudioUrl(preset.path);
        setBackgroundMusicUrl(preset.path);
        setBackgroundMusicFile(null);
        setIsMusicRemoved(false);
    };

    // Live Spotify Resolution Effect
    useEffect(() => {
        if (!spotifyUrl || !spotifyUrl.includes('spotify')) {
            setSpotifyMeta(null);
            return;
        }

        const timeout = setTimeout(async () => {
            setIsResolvingSpotify(true);
            try {
                const { ok, json } = await apiFetch(`/api/spotify/resolve?url=${encodeURIComponent(spotifyUrl)}`);
                if (ok && json?.data) {
                    setSpotifyMeta(json.data);
                } else {
                    setSpotifyMeta(null);
                }
            } catch (e) {
                console.error(e);
                setSpotifyMeta(null);
            } finally {
                setIsResolvingSpotify(false);
            }
        }, 400);

        return () => clearTimeout(timeout);
    }, [spotifyUrl]);

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

    const handleSelectPreset = (preset) => {
        setInvitationStyles({
            ...preset,
            preset: preset.id
        });
        setAiFeedback(null);
    };

    const handleGenerateAiPalette = async () => {
        setIsGeneratingAiPalette(true);
        setError(null);
        setAiFeedback(null);
        try {
            const { ok, json } = await apiFetch(`/api/events/${event.id}/ai-style-palette`, {
                method: 'POST',
                body: JSON.stringify({ vibe: aiStyleVibe })
            });
            if (ok && json?.palette) {
                setInvitationStyles(prev => ({
                    ...prev,
                    ...json.palette,
                    preset: 'ai_custom'
                }));
                setAiFeedback(json.palette.explanation || '¡Paleta exclusiva generada por Gemini!');
            } else {
                setError(json?.message || 'No se pudo generar la paleta con IA.');
            }
        } catch (err) {
            setError('Error al conectar con Gemini AI.');
        } finally {
            setIsGeneratingAiPalette(false);
        }
    };

    const handleGenerateAiCopy = async (tone = 'romantic') => {
        setIsGeneratingAiCopy(true);
        setError(null);
        try {
            const { ok, json } = await apiFetch(`/api/events/${event.id}/ai-invitation-copy`, {
                method: 'POST',
                body: JSON.stringify({ tone })
            });
            if (ok && json?.copy) {
                if (json.copy.welcome_message) setWelcomeMessage(json.copy.welcome_message);
                if (json.copy.dress_code_notes) setDressCodeNotes(json.copy.dress_code_notes);
            }
        } catch (err) {
            setError('Error al generar textos con IA.');
        } finally {
            setIsGeneratingAiCopy(false);
        }
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
            } else if (isMusicRemoved || (!backgroundMusicUrl && !backgroundMusicFile && event.background_music_path)) {
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
                invitation_styles: invitationStyles,
            };

            // If direct audio URL was set (not uploaded file)
            if (customAudioUrl && !backgroundMusicFile && !isMusicRemoved) {
                if (customAudioUrl.includes('spotify.com')) {
                    if (!eventPayload.spotify_url) eventPayload.spotify_url = customAudioUrl;
                    eventPayload.background_music_path = null;
                } else {
                    eventPayload.background_music_path = customAudioUrl;
                }
            } else if (isMusicRemoved || (!backgroundMusicUrl && !backgroundMusicFile)) {
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
                        onClick={() => setActiveTab('styles')}
                        className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                            activeTab === 'styles' ? 'border-amber-400 text-amber-300' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        <Palette className="w-4 h-4 text-pink-400" />
                        Estilo & Diseño (IA)
                    </button>
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

                    {/* STYLES & AI THEME TAB */}
                    {activeTab === 'styles' && (
                        <div className="space-y-6">
                            {/* AI GENERATOR BANNER */}
                            <div className="p-4 rounded-3xl bg-gradient-to-r from-pink-950/40 via-purple-950/40 to-amber-950/40 border border-pink-500/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500 to-amber-500 text-zinc-950">
                                            <Wand2 className="w-4 h-4 font-black" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black uppercase text-pink-300 tracking-wider">
                                                Diseñador Inteligente con Google Gemini
                                            </h4>
                                            <p className="text-[11px] text-zinc-300">
                                                La IA analiza el evento de {event.couple_names || event.title} y crea una paleta armónica exclusiva.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40">
                                        Gemini AI
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={aiStyleVibe}
                                        onChange={(e) => setAiStyleVibe(e.target.value)}
                                        placeholder="Escribí una idea o vibra (ej: Boda nocturna de etiqueta con detalles dorados, o Quinceañera bohemia...)"
                                        className="flex-1 text-xs rounded-xl border border-zinc-700 bg-zinc-900/90 text-white p-2.5 outline-none focus:ring-2 focus:ring-pink-500"
                                    />
                                    <button
                                        type="button"
                                        disabled={isGeneratingAiPalette}
                                        onClick={handleGenerateAiPalette}
                                        className="px-4 py-2.5 bg-gradient-to-r from-pink-500 to-amber-500 hover:opacity-95 text-zinc-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md disabled:opacity-50 transition-all shrink-0 cursor-pointer"
                                    >
                                        {isGeneratingAiPalette ? (
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-3.5 h-3.5" />
                                        )}
                                        <span>{isGeneratingAiPalette ? 'Creando estilo...' : 'Generar con IA'}</span>
                                    </button>
                                </div>

                                {aiFeedback && (
                                    <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-[11px] text-pink-200 flex items-start gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
                                        <span>{aiFeedback}</span>
                                    </div>
                                )}
                            </div>

                            {/* 1-CLICK THEME PRESETS */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-black text-zinc-300 uppercase tracking-wider">
                                        Temas de Diseño Predefinidos
                                    </label>
                                    <span className="text-[11px] text-zinc-400">Elegí una estética con 1 clic</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {THEME_PRESETS.map((preset) => {
                                        const isSelected = invitationStyles.preset === preset.id;
                                        return (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => handleSelectPreset(preset)}
                                                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-zinc-800 border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                                                        : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                                                            style={{ backgroundColor: preset.primary_color }}
                                                        />
                                                        <span
                                                            className="w-4 h-4 rounded-full border border-white/20 shadow-sm -ml-2"
                                                            style={{ backgroundColor: preset.secondary_color }}
                                                        />
                                                        <span className="text-xs font-bold text-white">{preset.name}</span>
                                                    </div>
                                                    {isSelected && (
                                                        <span className="p-1 rounded-full bg-amber-400 text-zinc-950">
                                                            <Check className="w-3 h-3 stroke-[3]" />
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-zinc-400 leading-relaxed">{preset.desc}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* CUSTOMIZE COLORS & TYPOGRAPHY */}
                            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-4">
                                <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider">
                                    Ajustes Personalizados de Colores y Tipografía
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                    {/* Primary Color */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-300 mb-1">Color Principal (Acentos)</label>
                                        <div className="flex items-center gap-2 bg-zinc-900 p-2 rounded-xl border border-zinc-700">
                                            <input
                                                type="color"
                                                value={invitationStyles.primary_color || '#D97706'}
                                                onChange={(e) => setInvitationStyles({ ...invitationStyles, primary_color: e.target.value, preset: 'custom' })}
                                                className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={invitationStyles.primary_color || '#D97706'}
                                                onChange={(e) => setInvitationStyles({ ...invitationStyles, primary_color: e.target.value, preset: 'custom' })}
                                                className="w-full text-xs font-mono uppercase bg-transparent text-white outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Secondary Color */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-300 mb-1">Color Secundario</label>
                                        <div className="flex items-center gap-2 bg-zinc-900 p-2 rounded-xl border border-zinc-700">
                                            <input
                                                type="color"
                                                value={invitationStyles.secondary_color || '#F59E0B'}
                                                onChange={(e) => setInvitationStyles({ ...invitationStyles, secondary_color: e.target.value, preset: 'custom' })}
                                                className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={invitationStyles.secondary_color || '#F59E0B'}
                                                onChange={(e) => setInvitationStyles({ ...invitationStyles, secondary_color: e.target.value, preset: 'custom' })}
                                                className="w-full text-xs font-mono uppercase bg-transparent text-white outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Envelope Color */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-300 mb-1">Color Sobre Digital</label>
                                        <div className="flex items-center gap-2 bg-zinc-900 p-2 rounded-xl border border-zinc-700">
                                            <input
                                                type="color"
                                                value={invitationStyles.envelope_color || '#3F2817'}
                                                onChange={(e) => setInvitationStyles({ ...invitationStyles, envelope_color: e.target.value, preset: 'custom' })}
                                                className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={invitationStyles.envelope_color || '#3F2817'}
                                                onChange={(e) => setInvitationStyles({ ...invitationStyles, envelope_color: e.target.value, preset: 'custom' })}
                                                className="w-full text-xs font-mono uppercase bg-transparent text-white outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Wax Seal Color */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-300 mb-1">Sello de Lacre</label>
                                        <div className="flex items-center gap-2 bg-zinc-900 p-2 rounded-xl border border-zinc-700">
                                            <input
                                                type="color"
                                                value={invitationStyles.envelope_seal_color || '#D97706'}
                                                onChange={(e) => setInvitationStyles({ ...invitationStyles, envelope_seal_color: e.target.value, preset: 'custom' })}
                                                className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={invitationStyles.envelope_seal_color || '#D97706'}
                                                onChange={(e) => setInvitationStyles({ ...invitationStyles, envelope_seal_color: e.target.value, preset: 'custom' })}
                                                className="w-full text-xs font-mono uppercase bg-transparent text-white outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Typography & Card Style */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-300 mb-1">Tipografía de Títulos</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { id: 'serif', label: 'Clásica Serif', fontClass: 'font-serif-luxury', sample: 'Elegancia' },
                                                { id: 'script', label: 'Romántica Cursiva', fontClass: 'font-script-romantic', sample: 'Amor' },
                                                { id: 'sans', label: 'Moderna Sans', fontClass: 'font-sans', sample: 'Moderna' },
                                            ].map((font) => (
                                                <button
                                                    key={font.id}
                                                    type="button"
                                                    onClick={() => setInvitationStyles({ ...invitationStyles, font_family: font.id, preset: 'custom' })}
                                                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                                        invitationStyles.font_family === font.id
                                                            ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                                                            : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
                                                    }`}
                                                >
                                                    <div className={`text-base mb-0.5 ${font.fontClass}`}>{font.sample}</div>
                                                    <div className="text-[10px] text-zinc-400">{font.label}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-300 mb-1">Estilo de Tarjetas</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: 'glass', label: 'Cristal Translúcido', desc: 'Glassmorphism blur' },
                                                { id: 'solid', label: 'Opaco Sólido', desc: 'Fondo limpio uniforme' },
                                            ].map((card) => (
                                                <button
                                                    key={card.id}
                                                    type="button"
                                                    onClick={() => setInvitationStyles({ ...invitationStyles, card_style: card.id, preset: 'custom' })}
                                                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                                        invitationStyles.card_style === card.id
                                                            ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                                                            : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
                                                    }`}
                                                >
                                                    <div className="text-xs font-bold text-white">{card.label}</div>
                                                    <div className="text-[10px] text-zinc-400">{card.desc}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* LIVE MINI PREVIEW */}
                            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                                        Vista Previa en Vivo de la Invitación
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                                        {invitationStyles.name || 'Estilo Personalizado'}
                                    </span>
                                </div>

                                <div
                                    className="rounded-2xl p-6 border text-center relative overflow-hidden transition-all duration-300"
                                    style={{
                                        background: invitationStyles.background_value || 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
                                        borderColor: `${invitationStyles.primary_color || '#D97706'}40`,
                                    }}
                                >
                                    {/* Simulated Envelope Seal */}
                                    <div className="flex justify-center mb-3">
                                        <div
                                            className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-black shadow-lg"
                                            style={{
                                                backgroundColor: invitationStyles.envelope_seal_color || '#D97706',
                                                color: '#000000',
                                                boxShadow: `0 0 15px ${invitationStyles.envelope_seal_color || '#D97706'}60`,
                                            }}
                                        >
                                            💌
                                        </div>
                                    </div>

                                    <div
                                        className={`text-xl sm:text-2xl font-black mb-1 drop-shadow-md ${
                                            invitationStyles.font_family === 'serif'
                                                ? 'font-serif-luxury'
                                                : invitationStyles.font_family === 'script'
                                                ? 'font-script-romantic text-3xl'
                                                : 'font-sans'
                                        }`}
                                        style={{ color: invitationStyles.mode === 'light' ? '#0f172a' : '#ffffff' }}
                                    >
                                        {event.couple_names || event.title}
                                    </div>

                                    <p
                                        className="text-xs mb-4 max-w-sm mx-auto opacity-80"
                                        style={{ color: invitationStyles.mode === 'light' ? '#334155' : '#cbd5e1' }}
                                    >
                                        ¡Nos casamos y queremos celebrarlo contigo!
                                    </p>

                                    {/* Sample interactive button */}
                                    <button
                                        type="button"
                                        className="px-5 py-2 rounded-xl text-xs font-black shadow-lg transition-transform hover:scale-105"
                                        style={{
                                            backgroundColor: invitationStyles.primary_color || '#D97706',
                                            color: '#000000',
                                        }}
                                    >
                                        Confirmar Asistencia
                                    </button>
                                </div>
                            </div>
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
                                    {backgroundMusicUrl ? (
                                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold shrink-0">
                                            Activa 🎵
                                        </span>
                                    ) : spotifyUrl ? (
                                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold shrink-0 flex items-center gap-1">
                                            <Disc className="w-3 h-3 text-emerald-400" />
                                            <span>Spotify en Entrada 🎵</span>
                                        </span>
                                    ) : null}
                                </div>

                                {/* 1-Click Ambient Music Presets */}
                                <div>
                                    <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-2">
                                        Elegir melodía instrumental de entrada (1 clic):
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {AMBIENT_MUSIC_PRESETS.map((preset) => {
                                            const isSelected = backgroundMusicUrl.includes(preset.path) || customAudioUrl.includes(preset.path);
                                            return (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    onClick={() => handleSelectAmbientPreset(preset)}
                                                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/30 shadow-md'
                                                            : 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg">{preset.icon}</span>
                                                            <span className="text-xs font-bold text-white">{preset.name}</span>
                                                        </div>
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                            isSelected 
                                                                ? 'bg-amber-400 text-zinc-950' 
                                                                : 'bg-zinc-800 text-zinc-400'
                                                        }`}>
                                                            {isSelected ? '✓ Seleccionada' : preset.badge}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-zinc-400 leading-snug">{preset.desc}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Active Music Preview Player */}
                                {backgroundMusicUrl ? (
                                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2 font-bold text-zinc-200 truncate">
                                                <FileAudio className="w-4 h-4 text-amber-400 shrink-0" />
                                                <span className="truncate">
                                                    {backgroundMusicFile ? backgroundMusicFile.name : (
                                                        backgroundMusicUrl.includes('wedding-acoustic') 
                                                            ? 'Guitarra Acústica Romántica'
                                                            : (backgroundMusicUrl.includes('wedding-piano') ? 'Piano Emotivo de Gala' : 'Pista de audio configurada')
                                                    )}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleRemoveMusic}
                                                className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold transition-colors shrink-0 ml-2 cursor-pointer"
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
                                ) : spotifyUrl ? (
                                    <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2 font-bold text-emerald-300 truncate">
                                                <Disc className="w-4 h-4 text-emerald-400 shrink-0" />
                                                <span className="truncate">
                                                    {spotifyMeta ? `Spotify al Entrar: ${spotifyMeta.title} (${spotifyMeta.artist})` : 'Pista de Spotify configurada para Entrada'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                                                ✓ Suena al Entrar
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-zinc-400 leading-snug">
                                            Esta canción de Spotify se iniciará automáticamente cuando el invitado toque el Sobre Digital para abrir la invitación.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center py-2">
                                        <p className="text-[11px] text-zinc-500">
                                            No hay música de fondo configurada. Elegí una melodía recomendada arriba, subí tu propio MP3 o seleccioná una canción de Spotify abajo.
                                        </p>
                                    </div>
                                )}

                                {/* Upload & Link controls */}
                                <div className="pt-2 border-t border-zinc-800/80">
                                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                                        O subir tu propia canción MP3 / WAV personalizada:
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                                <span>{backgroundMusicFile ? 'Cambiar archivo MP3' : 'Subir archivo MP3 / WAV'}</span>
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
                                                        setBackgroundMusicUrl('');
                                                        setBackgroundMusicFile(null);
                                                        setIsMusicRemoved(false);
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
                            </div>

                            {/* SECTION 2: SPOTIFY PLAYLIST OR TRACK EMBED */}
                            <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                                            <Disc className="w-4 h-4" />
                                        </div>
                                        <label className="text-xs font-black text-zinc-200 uppercase tracking-wider">
                                            Playlist o Canción Oficial de Spotify
                                        </label>
                                    </div>
                                    <p className="text-[11px] text-zinc-400">
                                        Los invitados pueden explorar la lista del evento y reproducirla desde la app de Spotify o el reproductor web.
                                    </p>
                                </div>

                                {/* 1-Click Curated Spotify Presets */}
                                <div>
                                    <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-2">
                                        Playlists recomendadas listas para usar (1 clic):
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {SPOTIFY_PLAYLIST_PRESETS.map((preset, idx) => {
                                            const isSelected = spotifyUrl === preset.url;
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setSpotifyUrl(preset.url)}
                                                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-emerald-500/20 border-emerald-400 ring-2 ring-emerald-400/30'
                                                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-base">{preset.icon}</span>
                                                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                                                    </div>
                                                    <div className="font-bold text-[11px] text-white truncate">{preset.name}</div>
                                                    <div className="text-[9px] text-zinc-400 truncate">{preset.desc}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Live Spotify Search Bar */}
                                <div className="relative">
                                    <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                                        Buscar canción o playlist en Spotify:
                                    </label>
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
                                        <input
                                            type="text"
                                            value={spotifySearchQuery}
                                            onChange={handleSpotifySearchChange}
                                            placeholder="Buscar por artista o canción (ej: Perfect Ed Sheeran, Abel Pintos, Vals vienés)..."
                                            className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-900 text-white pl-9 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        {isSearchingSpotify && (
                                            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin absolute right-3 top-2.5" />
                                        )}
                                    </div>

                                    {/* Live Search Autocomplete Dropdown */}
                                    {showSpotifySearchDropdown && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-zinc-800 max-h-60 overflow-y-auto">
                                            {spotifySearchResults.length > 0 ? (
                                                spotifySearchResults.map((track) => (
                                                    <button
                                                        key={track.id}
                                                        type="button"
                                                        onClick={() => handleSelectSpotifySearchResult(track)}
                                                        className="w-full p-2.5 flex items-center gap-3 text-left hover:bg-zinc-800 transition-colors cursor-pointer"
                                                    >
                                                        {track.image ? (
                                                            <img src={track.image} alt={track.name} className="w-9 h-9 rounded object-cover shrink-0" />
                                                        ) : (
                                                            <div className="w-9 h-9 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                                                <Disc className="w-4 h-4" />
                                                            </div>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-xs font-bold text-white truncate">{track.name}</div>
                                                            <div className="text-[10px] text-zinc-400 truncate">{track.artist}</div>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 shrink-0">
                                                            Elegir
                                                        </span>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="p-3 text-center text-xs text-zinc-400">
                                                    No se encontraron resultados en Spotify.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Direct URL Input */}
                                <div>
                                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                                        O pegar link directo de Spotify:
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            value={spotifyUrl}
                                            onChange={(e) => setSpotifyUrl(e.target.value)}
                                            placeholder="https://open.spotify.com/playlist/... o https://open.spotify.com/track/..."
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

                                {/* Live Spotify Preview & Verified Metadata Card */}
                                {spotifyMeta ? (
                                    <div className="rounded-2xl border border-emerald-500/40 bg-zinc-950 p-3 space-y-3 shadow-xl">
                                        <div className="flex items-center justify-between px-1">
                                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                                                <Check className="w-3.5 h-3.5" />
                                                <span>Verificado con la API de Spotify</span>
                                            </div>
                                            {isResolvingSpotify && (
                                                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                                            {spotifyMeta.image ? (
                                                <img src={spotifyMeta.image} alt={spotifyMeta.title} className="w-12 h-12 rounded-lg object-cover shadow-sm shrink-0 border border-zinc-700" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                                    <Disc className="w-6 h-6 animate-spin-slow" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <h5 className="text-xs font-black text-white truncate">{spotifyMeta.title}</h5>
                                                <p className="text-[11px] text-zinc-400 truncate">{spotifyMeta.artist}</p>
                                                {spotifyMeta.total_tracks && (
                                                     <span className="text-[10px] text-emerald-400 font-bold">{spotifyMeta.total_tracks} canciones</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="rounded-xl overflow-hidden border border-zinc-800/80">
                                            <iframe
                                                src={spotifyMeta.embed_url || spotifyEmbedUrl}
                                                width="100%"
                                                height="152"
                                                frameBorder="0"
                                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                                loading="lazy"
                                                className="rounded-xl"
                                            />
                                        </div>
                                    </div>
                                ) : spotifyEmbedUrl ? (
                                    <div className="rounded-2xl overflow-hidden border border-zinc-800 shadow-xl bg-zinc-950 p-2">
                                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
                                            <span>Vista previa del Reproductor Spotify:</span>
                                            {isResolvingSpotify && <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />}
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
                                        <p className="text-[11px]">Pegá una URL de Spotify para verificarla con la API y activar el reproductor interactivo.</p>
                                    </div>
                                )}

                                {/* 1-Click Set Spotify as Entrance Music Button */}
                                {spotifyUrl && (
                                    <div className={`p-3.5 rounded-xl border transition-all ${
                                        (!backgroundMusicUrl && !backgroundMusicFile)
                                            ? 'bg-emerald-500/10 border-emerald-500/30'
                                            : 'bg-zinc-900 border-zinc-800'
                                    }`}>
                                        {(!backgroundMusicUrl && !backgroundMusicFile) ? (
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                                        <Sparkles className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-bold text-emerald-300 block">
                                                            Spotify configurado como música de entrada
                                                        </span>
                                                        <span className="text-[10px] text-zinc-400 block">
                                                            El reproductor interactivo de Spotify comenzará a sonar al tocar el sobre.
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-full shrink-0">
                                                    ✓ Suena al Entrar
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <span className="text-xs font-bold text-white block">
                                                        ¿Querés que esta música de Spotify suene al entrar?
                                                    </span>
                                                    <span className="text-[10px] text-zinc-400 block">
                                                        Actualmente hay una melodía/archivo configurado en la Sección 1.
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setBackgroundMusicUrl('');
                                                        setCustomAudioUrl('');
                                                        setBackgroundMusicFile(null);
                                                        setIsMusicRemoved(true);
                                                    }}
                                                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs transition-all active:scale-95 shrink-0 flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                                                >
                                                    <Play className="w-3.5 h-3.5 fill-current" />
                                                    <span>Usar como música de entrada</span>
                                                </button>
                                            </div>
                                        )}
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
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-black text-zinc-300 uppercase tracking-wider">
                                        Mensaje de Bienvenida de los Anfitriones
                                    </label>
                                    <button
                                        type="button"
                                        disabled={isGeneratingAiCopy}
                                        onClick={() => handleGenerateAiCopy('romantic')}
                                        className="text-[11px] font-bold text-pink-400 hover:text-pink-300 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>{isGeneratingAiCopy ? 'Redactando con IA...' : 'Redactar con Gemini IA'}</span>
                                    </button>
                                </div>
                                <textarea
                                    rows={3}
                                    value={welcomeMessage}
                                    onChange={(e) => setWelcomeMessage(e.target.value)}
                                    placeholder="Mensaje de bienvenida que leerán los invitados al ingresar a la invitación web..."
                                    className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-white p-3 font-medium outline-none focus:ring-2 focus:ring-pink-500 mb-3"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-zinc-300 uppercase tracking-wider mb-1">
                                    Notas y Consejos de Vestimenta (Dress Code)
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
