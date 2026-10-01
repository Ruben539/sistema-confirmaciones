import React, { useState, useEffect } from 'react';
import { X, Music, Search, Copy, Check, ExternalLink, Disc, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { apiFetch } from '../api';

export default function EventSongSuggestionsModal({ event, onClose }) {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTab, setFilterTab] = useState('all'); // 'all', 'pending', 'played'
    const [copied, setCopied] = useState(false);

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
            }
        } catch (err) {
            console.error('Error deleting song request:', err);
        }
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
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 font-sans">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl text-white overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-zinc-950 shadow-lg">
                            <Disc className="w-5 h-5 font-black animate-spin-slow" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                                Música de la Fiesta
                            </span>
                            <h3 className="text-lg font-black text-white">
                                Lista de Canciones para el DJ ({suggestions.length})
                            </h3>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Filter & Actions Bar */}
                <div className="p-4 border-b border-zinc-800 bg-zinc-950/40 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar canción, artista o invitado..."
                                className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-white pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleCopyListForDj}
                            disabled={suggestions.length === 0}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            <span>{copied ? '¡Copiado al Portapapeles!' : 'Copiar Lista para DJ'}</span>
                        </button>
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
                        <div className="py-12 text-center text-zinc-400 text-xs font-semibold">
                            Cargando canciones sugeridas...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center text-zinc-500 text-xs space-y-2">
                            <Music className="w-10 h-10 mx-auto text-zinc-600" />
                            <p className="font-bold text-zinc-400">
                                {searchQuery ? 'No se encontraron canciones con ese criterio.' : 'Ninguna canción sugerida en esta sección.'}
                            </p>
                            <p className="text-[11px]">Los invitados pueden buscar y pedir temas con el selector de Spotify en la invitación.</p>
                        </div>
                    ) : (
                        filtered.map((item, idx) => (
                            <div
                                key={item.id || idx}
                                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                    item.is_played
                                        ? 'bg-zinc-950/60 border-zinc-800/80 opacity-60'
                                        : 'bg-zinc-800/80 border-zinc-700/70 hover:bg-zinc-800'
                                }`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {/* Artwork or fallback */}
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

                                    <div className="min-w-0">
                                        <div className="text-xs font-black text-white truncate flex items-center gap-2">
                                            <span className={item.is_played ? 'line-through text-zinc-400' : ''}>
                                                {item.song_title || item.song_suggestion}
                                            </span>
                                            {item.artist && (
                                                <span className="text-[11px] font-normal text-zinc-400 truncate">
                                                    · {item.artist}
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                                            Pedida por: <span className="text-zinc-200 font-bold">{item.name}</span>
                                            {item.created_at && (
                                                <span className="text-zinc-500 ml-1.5 font-normal">({item.created_at})</span>
                                            )}
                                        </div>

                                        {item.note && (
                                            <div className="text-[10px] text-amber-300/90 italic truncate mt-0.5">
                                                💬 "{item.note}"
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1.5 shrink-0">
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
                                        className="p-2 bg-zinc-900 hover:bg-zinc-700 rounded-xl text-zinc-300 hover:text-emerald-400 transition-colors cursor-pointer"
                                        title="Abrir en Spotify"
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
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between text-xs">
                    <span className="text-zinc-500 text-[11px]">
                        🎧 Lista sincronizada en vivo con las peticiones de los invitados.
                    </span>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl cursor-pointer"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
