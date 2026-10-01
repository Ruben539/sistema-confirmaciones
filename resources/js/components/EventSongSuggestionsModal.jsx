import React, { useState, useEffect, useRef } from 'react';
import { 
    X, Music, Search, Copy, Check, ExternalLink, Disc, Trash2, CheckCircle2, 
    Clock, Play, Plus, Download, FileText, Loader2, Sparkles, Headphones, 
    ChevronDown, ChevronUp, Share2
} from 'lucide-react';
import { apiFetch } from '../api';

export default function EventSongSuggestionsModal({ event, onClose }) {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTab, setFilterTab] = useState('all'); // 'all', 'pending', 'played'
    const [copied, setCopied] = useState(false);

    // Audio / Spotify In-Modal Preview Player
    const [previewTrack, setPreviewTrack] = useState(null);

    // Manual DJ / Host Song Search & Add
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [djSearchQuery, setDjSearchQuery] = useState('');
    const [djSearchResults, setDjSearchResults] = useState([]);
    const [isSearchingDj, setIsSearchingDj] = useState(false);
    const [isAddingTrack, setIsAddingTrack] = useState(false);
    const djSearchDebounceRef = useRef(null);

    // Export Dropdown
    const [showExportMenu, setShowExportMenu] = useState(false);

    useEffect(() => {
        fetchSuggestions();
    }, [event.id]);

    const fetchSuggestions = async () => {
        try {
            const { ok, json } = await apiFetch(`/api/events/${event.id}/song-suggestions`);
            if (ok && json?.suggestions) {
                setSuggestions(json.suggestions);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePlayed = async (item) => {
        if (!item.is_rich) return;
        try {
            const { ok, json } = await apiFetch(`/api/events/${event.id}/song-requests/${item.id}/toggle-played`, {
                method: 'POST',
            });
            if (ok) {
                setSuggestions(prev => prev.map(s => s.id === item.id ? { ...s, is_played: json.is_played } : s));
            }
        } catch (err) {
            console.error('Error toggling played state:', err);
        }
    };

    const handleDelete = async (item) => {
        if (!item.is_rich) return;
        if (!confirm(`¿Eliminar la sugerencia "${item.song_title || item.song_suggestion}"?`)) return;
        try {
            const { ok } = await apiFetch(`/api/events/${event.id}/song-requests/${item.id}`, {
                method: 'DELETE',
            });
            if (ok) {
                setSuggestions(prev => prev.filter(s => s.id !== item.id));
                if (previewTrack?.id === item.id) {
                    setPreviewTrack(null);
                }
            }
        } catch (err) {
            console.error('Error deleting song request:', err);
        }
    };

    // Live Spotify Search for DJ to Add Tracks
    const handleDjSearchChange = (e) => {
        const val = e.target.value;
        setDjSearchQuery(val);

        if (djSearchDebounceRef.current) {
            clearTimeout(djSearchDebounceRef.current);
        }

        if (val.trim().length >= 2) {
            setIsSearchingDj(true);
            djSearchDebounceRef.current = setTimeout(async () => {
                try {
                    const { ok, json } = await apiFetch(`/api/spotify/search?q=${encodeURIComponent(val.trim())}&limit=6`);
                    if (ok && Array.isArray(json?.results)) {
                        setDjSearchResults(json.results);
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    setIsSearchingDj(false);
                }
            }, 300);
        } else {
            setDjSearchResults([]);
            setIsSearchingDj(false);
        }
    };

    const handleAddTrackDirectly = async (track) => {
        setIsAddingTrack(true);
        try {
            const payload = {
                song_title: track.name,
                artist: track.artist || '',
                requester_name: 'DJ / Anfitrión ⭐',
                spotify_id: track.id,
                spotify_uri: track.uri,
                image_url: track.image || '',
                external_url: track.external_url || `https://open.spotify.com/track/${track.id}`,
                note: 'Agregada desde el panel del DJ',
            };

            const { ok, json } = await apiFetch(`/api/events/${event.id}/song-requests`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (ok && json?.suggestion) {
                setSuggestions(prev => [json.suggestion, ...prev]);
                setDjSearchQuery('');
                setDjSearchResults([]);
                setShowAddPanel(false);
            }
        } catch (err) {
            console.error('Error adding track:', err);
        } finally {
            setIsAddingTrack(false);
        }
    };

    // Copy formatted text for DJ
    const handleCopyListForDj = () => {
        if (suggestions.length === 0) return;
        const text = `🎧 PLAYLIST DE CANCIONES SUGERIDAS POR INVITADOS - ${event.couple_names || event.title}\n\n` +
            suggestions.map((s, idx) => {
                const title = s.artist ? `"${s.song_title}" - ${s.artist}` : `"${s.song_suggestion || s.song_title}"`;
                const note = s.note ? ` [Nota: ${s.note}]` : '';
                const status = s.is_played ? ' (✓ Reproducida)' : '';
                return `${idx + 1}. ${title} (Pedida por: ${s.name})${note}${status}`;
            }).join('\n');

        navigator.clipboard.writeText(text);
        setCopied(true);
        setShowExportMenu(false);
        setTimeout(() => setCopied(false), 2500);
    };

    // Download formatted .TXT file
    const handleDownloadTxt = () => {
        if (suggestions.length === 0) return;
        const text = `🎧 PLAYLIST DE CANCIONES SUGERIDAS - ${event.couple_names || event.title}\n` +
            `Fecha de exportación: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n` +
            `Total de sugerencias: ${suggestions.length}\n` +
            `------------------------------------------------------------------------\n\n` +
            suggestions.map((s, idx) => {
                const title = s.artist ? `${s.song_title} - ${s.artist}` : `${s.song_suggestion || s.song_title}`;
                const note = s.note ? ` | Nota: ${s.note}` : '';
                const status = s.is_played ? ' | [REPRODUCIDA]' : ' | [PENDIENTE]';
                const link = s.external_url ? ` | Spotify: ${s.external_url}` : '';
                return `${idx + 1}. ${title} (Por: ${s.name})${note}${status}${link}`;
            }).join('\n\n');

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `playlist-dj-${(event.couple_names || event.title || 'evento').toLowerCase().replace(/[^a-z0-9]/g, '-')}.txt`;
        link.click();
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };

    // Download structured .CSV file for DJ software / Excel
    const handleDownloadCsv = () => {
        if (suggestions.length === 0) return;
        const headers = ['Nro', 'Cancion', 'Artista', 'Pedida Por', 'Estado', 'Nota', 'Enlace Spotify'];
        const rows = suggestions.map((s, idx) => [
            idx + 1,
            `"${(s.song_title || s.song_suggestion || '').replace(/"/g, '""')}"`,
            `"${(s.artist || '').replace(/"/g, '""')}"`,
            `"${(s.name || '').replace(/"/g, '""')}"`,
            s.is_played ? 'Reproducida' : 'Pendiente',
            `"${(s.note || '').replace(/"/g, '""')}"`,
            s.external_url || ''
        ]);
        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `playlist-dj-${(event.couple_names || event.title || 'evento').toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };

    // Embed URL helper for active preview track
    const getPreviewEmbedUrl = (track) => {
        if (!track) return null;
        if (track.spotify_id) {
            return `https://open.spotify.com/embed/track/${track.spotify_id}`;
        }
        if (track.external_url) {
            const match = track.external_url.match(/(track|playlist|album)\/([a-zA-Z0-9]+)/);
            if (match) {
                return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
            }
        }
        return null;
    };

    const filtered = suggestions.filter(s => {
        const text = `${s.song_suggestion || s.song_title || ''} ${s.artist || ''} ${s.name || ''}`.toLowerCase();
        const matchesQuery = text.includes(searchQuery.toLowerCase());
        if (!matchesQuery) return false;

        if (filterTab === 'pending') return !s.is_played;
        if (filterTab === 'played') return s.is_played;
        return true;
    });

    const pendingCount = suggestions.filter(s => !s.is_played).length;
    const playedCount = suggestions.filter(s => s.is_played).length;
    const previewEmbedUrl = getPreviewEmbedUrl(previewTrack);

    return (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 font-sans">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/70">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-zinc-950 shadow-lg">
                            <Disc className="w-5 h-5 font-black animate-spin-slow" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                                    Panel de Música y DJ
                                </span>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-black text-white">
                                Canciones para la Fiesta ({suggestions.length})
                            </h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowAddPanel(!showAddPanel)}
                            className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                                showAddPanel 
                                    ? 'bg-zinc-700 text-white' 
                                    : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
                            }`}
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">Agregar Canción</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* INLINE DJ ADD TRACK PANEL */}
                {showAddPanel && (
                    <div className="p-4 bg-zinc-950/90 border-b border-zinc-800 space-y-3 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                                <Sparkles className="w-4 h-4" />
                                <span>Buscar y agregar canción a la lista con Spotify</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setShowAddPanel(false); setDjSearchQuery(''); setDjSearchResults([]); }}
                                className="text-zinc-500 hover:text-zinc-300 text-xs"
                            >
                                Cancelar
                            </button>
                        </div>

                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                value={djSearchQuery}
                                onChange={handleDjSearchChange}
                                placeholder="Buscar por canción, artista o hit (ej: Cold Heart Dua Lipa, Bizarrap, La Morocha)..."
                                className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-900 text-white pl-9 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                                autoFocus
                            />
                            {isSearchingDj && (
                                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                            )}
                        </div>

                        {/* Search Results Dropdown/List */}
                        {djSearchResults.length > 0 && (
                            <div className="max-h-56 overflow-y-auto divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
                                {djSearchResults.map((track) => (
                                    <div
                                        key={track.id}
                                        className="p-2.5 flex items-center justify-between gap-3 hover:bg-zinc-800/70 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {track.image ? (
                                                <img src={track.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-zinc-700" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                                    <Music className="w-5 h-5" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-white truncate">{track.name}</div>
                                                <div className="text-[11px] text-zinc-400 truncate">{track.artist}</div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleAddTrackDirectly(track)}
                                            disabled={isAddingTrack}
                                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs transition-all active:scale-95 shrink-0 flex items-center gap-1 cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Agregar</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Filter & Actions Bar */}
                <div className="p-4 border-b border-zinc-800 bg-zinc-950/40 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar en las sugerencias (canción, artista, invitado)..."
                                className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-white pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                            />
                        </div>

                        {/* Export & Actions Group */}
                        <div className="relative flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleCopyListForDj}
                                disabled={suggestions.length === 0}
                                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                <span>{copied ? '¡Copiado!' : 'Copiar Lista'}</span>
                            </button>

                            {/* Dropdown for TXT / CSV Export */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    disabled={suggestions.length === 0}
                                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all flex items-center gap-1 text-xs font-bold cursor-pointer disabled:opacity-50 border border-zinc-700"
                                    title="Opciones de descarga"
                                >
                                    <Download className="w-4 h-4 text-emerald-400" />
                                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                                </button>

                                {showExportMenu && (
                                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-zinc-800 animate-fade-in">
                                        <button
                                            type="button"
                                            onClick={handleDownloadTxt}
                                            className="w-full p-2.5 text-left text-xs font-medium text-zinc-200 hover:bg-zinc-800 flex items-center gap-2 cursor-pointer transition-colors"
                                        >
                                            <FileText className="w-4 h-4 text-amber-400" />
                                            <span>Descargar lista (.TXT)</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDownloadCsv}
                                            className="w-full p-2.5 text-left text-xs font-medium text-zinc-200 hover:bg-zinc-800 flex items-center gap-2 cursor-pointer transition-colors"
                                        >
                                            <Download className="w-4 h-4 text-emerald-400" />
                                            <span>Exportar tabla (.CSV)</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/60 select-none text-xs">
                        <button
                            type="button"
                            onClick={() => setFilterTab('all')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                                filterTab === 'all'
                                    ? 'bg-zinc-700 text-white'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }`}
                        >
                            Todas ({suggestions.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterTab('pending')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                filterTab === 'pending'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }`}
                        >
                            <Clock className="w-3.5 h-3.5" />
                            Pendientes ({pendingCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterTab('played')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                filterTab === 'played'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }`}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Reproducidas ({playedCount})
                        </button>
                    </div>
                </div>

                {/* Song List */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-2.5">
                    {loading ? (
                        <div className="py-16 text-center text-zinc-400 text-xs font-semibold flex flex-col items-center gap-3">
                            <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
                            <span>Cargando canciones sugeridas...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center text-zinc-500 text-xs space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 flex items-center justify-center mx-auto text-zinc-400">
                                <Music className="w-6 h-6" />
                            </div>
                            <p className="font-bold text-zinc-300 text-sm">
                                {searchQuery ? 'No se encontraron canciones con ese criterio.' : 'Ninguna canción sugerida en esta sección.'}
                            </p>
                            <p className="text-[11px] max-w-sm mx-auto text-zinc-400">
                                Los invitados pueden pedir temas con el selector de Spotify en la invitación, o podés agregar temas con el botón "+ Agregar Canción" arriba.
                            </p>
                        </div>
                    ) : (
                        filtered.map((item, idx) => {
                            const isCurrentlyPreviewing = previewTrack?.id === item.id;

                            return (
                                <div
                                    key={item.id || idx}
                                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                        isCurrentlyPreviewing
                                            ? 'bg-emerald-950/30 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20'
                                            : item.is_played
                                                ? 'bg-zinc-950/60 border-zinc-800/80 opacity-60'
                                                : 'bg-zinc-800/70 border-zinc-700/60 hover:bg-zinc-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {/* Artwork or fallback */}
                                        <div className="relative group shrink-0">
                                            {item.image_url ? (
                                                <img
                                                    src={item.image_url}
                                                    alt=""
                                                    className="w-12 h-12 rounded-xl object-cover shadow-sm shrink-0 border border-zinc-700"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-xl bg-zinc-700/80 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                                                    <Music className="w-5 h-5 text-emerald-400" />
                                                </div>
                                            )}

                                            {/* Preview Overlay Button */}
                                            {(item.spotify_id || item.external_url) && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewTrack(isCurrentlyPreviewing ? null : item)}
                                                    className={`absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center transition-opacity cursor-pointer ${
                                                        isCurrentlyPreviewing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                                    }`}
                                                    title={isCurrentlyPreviewing ? "Detener pre-escucha" : "Escuchar con Spotify"}
                                                >
                                                    {isCurrentlyPreviewing ? (
                                                        <Volume2 className="w-5 h-5 text-emerald-400 animate-pulse" />
                                                    ) : (
                                                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                                    )}
                                                </button>
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="text-xs sm:text-sm font-black text-white truncate flex items-center gap-2">
                                                <span className={item.is_played ? 'line-through text-zinc-400' : ''}>
                                                    {item.song_title || item.song_suggestion}
                                                </span>
                                                {item.artist && (
                                                    <span className="text-[11px] font-normal text-zinc-400 truncate">
                                                        · {item.artist}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-[11px] text-zinc-400 truncate mt-0.5 flex items-center gap-1.5">
                                                <span>Pedida por:</span>
                                                <span className="text-zinc-200 font-bold">{item.name}</span>
                                                {item.created_at && (
                                                    <span className="text-zinc-500 font-normal">({item.created_at})</span>
                                                )}
                                            </div>

                                            {item.note && (
                                                <div className="text-[10px] text-amber-300/90 italic truncate mt-0.5">
                                                    💬 "{item.note}"
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {/* Play / Preview Trigger for Mobile/Desktop */}
                                        {(item.spotify_id || item.external_url) && (
                                            <button
                                                type="button"
                                                onClick={() => setPreviewTrack(isCurrentlyPreviewing ? null : item)}
                                                className={`p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                                                    isCurrentlyPreviewing
                                                        ? 'bg-emerald-500 text-zinc-950 font-black'
                                                        : 'bg-zinc-900 hover:bg-zinc-700 text-zinc-300 hover:text-emerald-400'
                                                }`}
                                                title={isCurrentlyPreviewing ? "Cerrar reproductor" : "Escuchar pre-escucha"}
                                            >
                                                {isCurrentlyPreviewing ? (
                                                    <Volume2 className="w-4 h-4 animate-pulse" />
                                                ) : (
                                                    <Play className="w-4 h-4 fill-current" />
                                                )}
                                                <span className="hidden md:inline text-[10px]">
                                                    {isCurrentlyPreviewing ? 'Sonando' : 'Escuchar'}
                                                </span>
                                            </button>
                                        )}

                                        {/* Mark as Played Toggle */}
                                        {item.is_rich && (
                                            <button
                                                type="button"
                                                onClick={() => handleTogglePlayed(item)}
                                                className={`p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                                                    item.is_played
                                                        ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                                        : 'bg-zinc-700/80 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                                                }`}
                                                title={item.is_played ? "Marcar como pendiente" : "Marcar como reproducida en la fiesta"}
                                            >
                                                <CheckCircle2 className={`w-4 h-4 ${item.is_played ? 'text-emerald-400' : 'text-zinc-400'}`} />
                                                <span className="hidden sm:inline text-[10px]">
                                                    {item.is_played ? 'Sonó' : 'Marcar'}
                                                </span>
                                            </button>
                                        )}

                                        {/* Open in Spotify */}
                                        <a
                                            href={item.external_url || `https://open.spotify.com/search/${encodeURIComponent(item.song_suggestion || item.song_title)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 bg-zinc-900 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer"
                                            title="Abrir en App de Spotify"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>

                                        {/* Delete option for rich requests */}
                                        {item.is_rich && (
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(item)}
                                                className="p-2 bg-zinc-900 hover:bg-rose-950/60 text-zinc-500 hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
                                                title="Eliminar de la lista"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* IN-MODAL SPOTIFY PREVIEW DRAWER */}
                {previewTrack && previewEmbedUrl && (
                    <div className="p-3 bg-zinc-950 border-t border-zinc-800 space-y-2 animate-fade-in shadow-2xl">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2 text-xs min-w-0">
                                <Headphones className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
                                <span className="font-bold text-white truncate">
                                    Pre-escucha: {previewTrack.song_title || previewTrack.song_suggestion}
                                </span>
                                {previewTrack.artist && (
                                    <span className="text-[11px] text-zinc-400 truncate">· {previewTrack.artist}</span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewTrack(null)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                                title="Cerrar reproductor"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <iframe
                            src={previewEmbedUrl}
                            width="100%"
                            height="80"
                            frameBorder="0"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                            className="rounded-xl shadow-inner border border-zinc-800"
                        />
                    </div>
                )}

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
                        <Disc className="w-4 h-4 text-emerald-400" />
                        <span>Sincronizado en tiempo real con las invitaciones de los invitados.</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl cursor-pointer transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
