import React, { useState, useEffect } from 'react';
import { X, Music, Search, Copy, Check, ExternalLink, Disc, Sparkles } from 'lucide-react';
import { apiFetch } from '../api';

export default function EventSongSuggestionsModal({ event, onClose }) {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
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

    const filtered = suggestions.filter(s =>
        s.song_suggestion.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCopyListForDj = () => {
        if (suggestions.length === 0) return;
        const text = `🎧 PLAYLIST DE CANCIONES SUGERIDAS POR INVITADOS - ${event.couple_names || event.title}\n\n` +
            suggestions.map((s, idx) => `${idx + 1}. "${s.song_suggestion}" (Pedida por: ${s.name})`).join('\n');

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 font-sans">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl text-white overflow-hidden animate-fade-in">
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
                                Sugerencias de Canciones para el DJ ({suggestions.length})
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

                {/* Search & Actions Bar */}
                <div className="p-4 border-b border-zinc-800 bg-zinc-950/40 flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar canción o invitado..."
                            className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-white pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleCopyListForDj}
                        disabled={suggestions.length === 0}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copied ? '¡Copiado para el DJ!' : 'Copiar Lista para el DJ'}</span>
                    </button>
                </div>

                {/* Song List */}
                <div className="p-6 overflow-y-auto flex-1 space-y-2">
                    {loading ? (
                        <div className="py-12 text-center text-zinc-400 text-xs font-semibold">
                            Cargando canciones sugeridas...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center text-zinc-500 text-xs space-y-2">
                            <Music className="w-10 h-10 mx-auto text-zinc-600" />
                            <p className="font-bold text-zinc-400">
                                {searchQuery ? 'No se encontraron canciones con ese criterio.' : 'Ningún invitado ha sugerido canciones todavía.'}
                            </p>
                            <p className="text-[11px]">Las canciones que pidan los invitados al confirmar su asistencia aparecerán aquí.</p>
                        </div>
                    ) : (
                        filtered.map((item, idx) => (
                            <div
                                key={item.id || idx}
                                className="p-3.5 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-between gap-3 hover:bg-zinc-800 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-xl bg-zinc-700/80 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                                        {idx + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-black text-white truncate flex items-center gap-1.5">
                                            <span>"{item.song_suggestion}"</span>
                                        </div>
                                        <div className="text-[11px] text-zinc-400 truncate">
                                            Pedida por: <span className="text-zinc-200 font-bold">{item.name}</span>
                                        </div>
                                    </div>
                                </div>

                                <a
                                    href={`https://open.spotify.com/search/${encodeURIComponent(item.song_suggestion)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 bg-zinc-900 hover:bg-zinc-700 rounded-xl text-zinc-300 hover:text-emerald-400 transition-colors shrink-0"
                                    title="Buscar en Spotify"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 text-right">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
