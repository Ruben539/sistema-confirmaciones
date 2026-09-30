import React, { useState, useEffect } from 'react';
import { 
    Sparkles, Music, Disc, Gift, Film, Camera, Tv, ExternalLink, Copy, Check, 
    Share2, Eye, QrCode, Settings, Calendar, Heart, ShieldCheck 
} from 'lucide-react';
import EventInvitationSettingsModal from './EventInvitationSettingsModal';
import EventSongSuggestionsModal from './EventSongSuggestionsModal';
import EventDedicationsManagerModal from './EventDedicationsManagerModal';
import { apiFetch } from '../api';

export default function EventInteractivePanel({ event, onUpdateEvent, showToast }) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSongsOpen, setIsSongsOpen] = useState(false);
    const [isDedicationsOpen, setIsDedicationsOpen] = useState(false);

    const [songsCount, setSongsCount] = useState(0);
    const [dedicationsCount, setDedicationsCount] = useState(0);
    const [copiedUrl, setCopiedUrl] = useState(null);

    useEffect(() => {
        if (!event?.id) return;
        fetchCounts();
    }, [event?.id]);

    const fetchCounts = async () => {
        try {
            const [songsRes, dedRes] = await Promise.all([
                apiFetch(`/api/events/${event.id}/song-suggestions`),
                apiFetch(`/api/events/${event.id}/dedications`),
            ]);

            if (songsRes.ok && songsRes.json?.total !== undefined) {
                setSongsCount(songsRes.json.total);
            }
            if (dedRes.ok && Array.isArray(dedRes.json)) {
                setDedicationsCount(dedRes.json.length);
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (!event) {
        return (
            <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4 max-w-lg mx-auto my-12 animate-fade-in font-sans">
                <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto border border-rose-100 dark:border-rose-900/40">
                    <Heart className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-white">Sin Evento Seleccionado</h3>
                <p className="text-xs text-zinc-500">Seleccioná un evento para configurar su Invitación Digital y funciones interactivas.</p>
            </div>
        );
    }

    const publicInvitationUrl = `${window.location.origin}/evento/${event.id}/invitacion`;
    const projectionUrl = `${window.location.origin}/evento/${event.id}/proyeccion`;
    const dedicationUploadUrl = `${window.location.origin}/evento/${event.id}/dedicatoria`;

    const handleCopy = (url, key) => {
        navigator.clipboard.writeText(url);
        setCopiedUrl(key);
        if (showToast) showToast('¡Enlace copiado al portapapeles!');
        setTimeout(() => setCopiedUrl(null), 2500);
    };

    const hasSpotify = !!event.spotify_url;
    const hasGifts = !!(event.gift_settings?.cbu || event.gift_settings?.alias);

    return (
        <div className="space-y-6 font-sans animate-fade-in">
            {/* Header Banner */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 text-white border border-zinc-800 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2 relative z-10">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black tracking-widest uppercase">
                        <Sparkles className="w-3.5 h-3.5" /> Suite de Invitación Digital & Fiesta Interactiva
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                        {event.couple_names || event.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
                        Personalizá el reproductor de Spotify, datos de regalos con copia rápida de CBU/Alias, canciones pedidas para el DJ y la pantalla gigante de dedicatorias.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2.5 relative z-10 shrink-0">
                    <button
                        type="button"
                        onClick={() => setIsSettingsOpen(true)}
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-zinc-950 font-black text-xs rounded-xl shadow-lg transition-all hover:scale-105 flex items-center gap-2"
                    >
                        <Settings className="w-4 h-4" />
                        <span>Configurar Invitación</span>
                    </button>

                    <a
                        href={publicInvitationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl border border-zinc-700 transition-all flex items-center gap-2"
                    >
                        <Eye className="w-4 h-4 text-rose-400" />
                        <span>Ver Invitación Web</span>
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                    </a>
                </div>
            </div>

            {/* 3 CORE INTERACTIVE MODULE CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* 1. SPOTIFY & MUSIC SUGGESTIONS */}
                <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black">
                                <Disc className="w-6 h-6 animate-spin-slow" />
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                hasSpotify 
                                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                            }`}>
                                {hasSpotify ? '🟢 Spotify Activo' : 'Sin vincular'}
                            </span>
                        </div>

                        <div>
                            <h3 className="text-base font-black text-zinc-900 dark:text-white">
                                Música & Playlist del DJ
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                {songsCount} {songsCount === 1 ? 'canción sugerida' : 'canciones sugeridas'} por los invitados para sonar en la fiesta.
                            </p>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsSongsOpen(true)}
                            className="w-full py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5"
                        >
                            <Music className="w-4 h-4 text-emerald-500" />
                            <span>Ver Lista para el DJ ({songsCount})</span>
                        </button>
                    </div>
                </div>

                {/* 2. GIFTS & CBU/ALIAS */}
                <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-black">
                                <Gift className="w-6 h-6" />
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                hasGifts 
                                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30' 
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                            }`}>
                                {hasGifts ? '🎁 CBU/Alias Configurado' : 'Pendiente'}
                            </span>
                        </div>

                        <div>
                            <h3 className="text-base font-black text-zinc-900 dark:text-white">
                                Regalos & Transferencias
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                {event.gift_settings?.alias ? `Alias activo: "${event.gift_settings.alias}"` : 'Configurá tus datos para que los invitados transfieran sin comisiones.'}
                            </p>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsSettingsOpen(true)}
                            className="w-full py-2.5 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold text-xs rounded-xl border border-rose-500/30 transition-all flex items-center justify-center gap-1.5"
                        >
                            <Gift className="w-4 h-4 text-rose-500" />
                            <span>Editar Datos Bancarios</span>
                        </button>
                    </div>
                </div>

                {/* 3. LIVE PROJECTION & DEDICATIONS */}
                <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black">
                                <Tv className="w-6 h-6" />
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                📽️ Modo Proyector
                            </span>
                        </div>

                        <div>
                            <h3 className="text-base font-black text-zinc-900 dark:text-white">
                                Pantalla Gigante & Dedicatorias
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                {dedicationsCount} {dedicationsCount === 1 ? 'dedicatoria recibida' : 'dedicatorias recibidas'} (fotos y videos cortos en vivo).
                            </p>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsDedicationsOpen(true)}
                            className="flex-1 py-2.5 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-xs rounded-xl transition-all"
                        >
                            Moderar ({dedicationsCount})
                        </button>

                        <a
                            href={projectionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-1 shrink-0"
                            title="Abrir en pantalla completa en el salón"
                        >
                            <Tv className="w-4 h-4" />
                            <span>Proyector F11</span>
                        </a>
                    </div>
                </div>
            </div>

            {/* DIRECT LINKS & ACCESS MANAGER */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                            Enlaces Directos del Evento
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Copiá o compartí los enlaces directos para los invitados o el equipo del salón.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Public Invitation Link */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 flex flex-col justify-between gap-3">
                        <div>
                            <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider">Invitación Web</span>
                            <div className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5 truncate">
                                {publicInvitationUrl}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleCopy(publicInvitationUrl, 'invitation')}
                                className="flex-1 py-1.5 px-3 bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-xl text-xs font-bold text-zinc-700 dark:text-white flex items-center justify-center gap-1 shadow-sm hover:bg-zinc-100"
                            >
                                {copiedUrl === 'invitation' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copiedUrl === 'invitation' ? 'Copiado' : 'Copiar Link'}</span>
                            </button>
                            <a
                                href={publicInvitationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-xl text-zinc-700 dark:text-white hover:bg-zinc-300"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    {/* Live Projection Screen Link */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 flex flex-col justify-between gap-3">
                        <div>
                            <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Pantalla Proyector (Salón)</span>
                            <div className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5 truncate">
                                {projectionUrl}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleCopy(projectionUrl, 'projection')}
                                className="flex-1 py-1.5 px-3 bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-xl text-xs font-bold text-zinc-700 dark:text-white flex items-center justify-center gap-1 shadow-sm hover:bg-zinc-100"
                            >
                                {copiedUrl === 'projection' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copiedUrl === 'projection' ? 'Copiado' : 'Copiar Link'}</span>
                            </button>
                            <a
                                href={projectionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-xl text-zinc-700 dark:text-white hover:bg-zinc-300"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    {/* Guest Dedication Upload Link */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 flex flex-col justify-between gap-3">
                        <div>
                            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">Subir Dedicatorias (QR)</span>
                            <div className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5 truncate">
                                {dedicationUploadUrl}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleCopy(dedicationUploadUrl, 'dedication')}
                                className="flex-1 py-1.5 px-3 bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-xl text-xs font-bold text-zinc-700 dark:text-white flex items-center justify-center gap-1 shadow-sm hover:bg-zinc-100"
                            >
                                {copiedUrl === 'dedication' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copiedUrl === 'dedication' ? 'Copiado' : 'Copiar Link'}</span>
                            </button>
                            <a
                                href={dedicationUploadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-xl text-zinc-700 dark:text-white hover:bg-zinc-300"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isSettingsOpen && (
                <EventInvitationSettingsModal
                    event={event}
                    onClose={() => setIsSettingsOpen(false)}
                    onUpdated={(updated) => {
                        if (onUpdateEvent) onUpdateEvent(updated);
                        fetchCounts();
                    }}
                />
            )}

            {isSongsOpen && (
                <EventSongSuggestionsModal
                    event={event}
                    onClose={() => setIsSongsOpen(false)}
                />
            )}

            {isDedicationsOpen && (
                <EventDedicationsManagerModal
                    event={event}
                    onClose={() => {
                        setIsDedicationsOpen(false);
                        fetchCounts();
                    }}
                />
            )}
        </div>
    );
}
