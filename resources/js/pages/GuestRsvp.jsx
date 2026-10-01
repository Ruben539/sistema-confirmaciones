import React, { useState, useEffect, useRef } from 'react';
import { 
    Heart, Calendar, MapPin, CheckCircle2, XCircle, Utensils, Send, Sparkles, AlertCircle, 
    Sun, Moon, Music, Disc, Gift, Copy, Check, ExternalLink, Camera, Film, Navigation, 
    Share2, Compass, Clock, Shirt, MessageSquare, Play, Pause, Volume2, VolumeX, Upload, 
    ChevronRight, Mail, MailOpen, Search, Loader2, Maximize2, Minimize2, ChevronDown,
    Download, Car, Trophy, Award, HelpCircle, Layout
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
    const [isGeneratingDedication, setIsGeneratingDedication] = useState(false);

    // VIP Features States: Photobooth Frame, Seating Modal, Trivia Mini-game
    const [applyPhotoboothFrame, setApplyPhotoboothFrame] = useState(true);
    const [rawDedicationPhoto, setRawDedicationPhoto] = useState(null);
    const [showSeatingModal, setShowSeatingModal] = useState(false);
    const [triviaAnswers, setTriviaAnswers] = useState({});
    const [triviaSubmitted, setTriviaSubmitted] = useState(false);
    const [triviaScore, setTriviaScore] = useState(0);

    // Countdown state
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false, isToday: false });

    // Audio / Spotify play state
    const [showMusicPlayer, setShowMusicPlayer] = useState(false);
    const [spotifyMeta, setSpotifyMeta] = useState(null);
    const [isSpotifyPlaying, setIsSpotifyPlaying] = useState(false);
    const [isSpotifyReady, setIsSpotifyReady] = useState(false);
    const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
    const spotifyControllerRef = useRef(null);

    // DJ Song Live Spotify Search (in RSVP form)
    const [songSearchResults, setSongSearchResults] = useState([]);
    const [isSearchingSong, setIsSearchingSong] = useState(false);
    const [showSongDropdown, setShowSongDropdown] = useState(false);
    const [selectedSongMeta, setSelectedSongMeta] = useState(null);
    const searchDebounceRef = useRef(null);

    // Standalone DJ Spotify Song Request Card & List
    const [songRequests, setSongRequests] = useState([]);
    const [djRequesterName, setDjRequesterName] = useState('');
    const [djSongQuery, setDjSongQuery] = useState('');
    const [djSearchResults, setDjSearchResults] = useState([]);
    const [isSearchingDjSong, setIsSearchingDjSong] = useState(false);
    const [showDjDropdown, setShowDjDropdown] = useState(false);
    const [selectedDjTrack, setSelectedDjTrack] = useState(null);
    const [djSongNote, setDjSongNote] = useState('');
    const [isSubmittingDjSong, setIsSubmittingDjSong] = useState(false);
    const [djSongSuccess, setDjSongSuccess] = useState(false);
    const djSearchDebounceRef = useRef(null);

    // Interactive Digital Envelope & Background Music states
    const [isEnvelopeOpen, setIsEnvelopeOpen] = useState(false);
    const [isOpeningEnvelope, setIsOpeningEnvelope] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const audioRef = useRef(null);

    const dedicationPhotoCameraRef = useRef(null);
    const dedicationVideoCameraRef = useRef(null);
    const dedicationGalleryRef = useRef(null);

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
                if (Array.isArray(json.song_requests)) {
                    setSongRequests(json.song_requests);
                }
                if (json.guest) {
                    setStatus(json.guest.status === 'declined' ? 'declined' : 'confirmed');
                    setConfirmedAdults(json.guest.confirmed_adults > 0 ? json.guest.confirmed_adults : (json.guest.adults || 1));
                    setConfirmedYouth(json.guest.confirmed_youth > 0 ? json.guest.confirmed_youth : (json.guest.youth || 0));
                    setConfirmedChildren(json.guest.confirmed_children > 0 ? json.guest.confirmed_children : (json.guest.children || 0));
                    setDietary(json.guest.dietary_restrictions || '');
                    setNotes(json.guest.notes || '');
                    setSongSuggestion(json.guest.song_suggestion || '');
                    setDedicationAuthor(json.guest.name || '');
                    setDjRequesterName(json.guest.name || '');
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
    const hasAudioMusic = Boolean(event?.background_music_url);
    const hasSpotifyMusic = Boolean(event?.spotify_url);
    const hasAnyMusic = hasAudioMusic || hasSpotifyMusic;
    const isEnvelopeEnabled = ((features?.background_music !== false) || (features?.spotify !== false)) && hasAnyMusic;

    // Music Selector State for Guests & Dynamic Background Audio
    const [currentAudioUrl, setCurrentAudioUrl] = useState('');
    const [currentAudioTitle, setCurrentAudioTitle] = useState('Guitarra Acústica Romántica');
    const [showMusicChooser, setShowMusicChooser] = useState(false);

    useEffect(() => {
        if (event?.background_music_url) {
            setCurrentAudioUrl(event.background_music_url);
            if (event.background_music_url.includes('piano')) {
                setCurrentAudioTitle('Piano Emotivo de Boda');
            } else if (event.background_music_url.includes('acoustic')) {
                setCurrentAudioTitle('Guitarra Acústica Romántica');
            } else {
                setCurrentAudioTitle('Música de los Novios');
            }
        } else if (event?.spotify_url) {
            // Default to acoustic background track so sound is immediate, while Spotify is ready
            setCurrentAudioUrl('/audio/wedding-acoustic.mp3');
            setCurrentAudioTitle('Guitarra Acústica Romántica');
        }
    }, [event?.background_music_url, event?.spotify_url]);

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
            if (url.startsWith('spotify:')) {
                const parts = url.split(':');
                if (parts.length >= 3) {
                    return `https://open.spotify.com/embed/${parts[1]}/${parts[2]}`;
                }
            }

            const parsed = new URL(url);
            if (!parsed.hostname.includes('spotify.com')) return null;

            let pathname = parsed.pathname.replace(/^\/intl-[a-zA-Z-]+/, '');

            if (pathname.startsWith('/embed/')) {
                return `https://open.spotify.com${pathname}`;
            }

            return `https://open.spotify.com/embed${pathname}`;
        } catch (e) {
            return null;
        }
    };
    const spotifyEmbedUrl = getSpotifyEmbedUrl(event?.spotify_url);

    // Fetch Spotify Metadata (Title, Artist, Artwork, etc.) via backend API
    useEffect(() => {
        if (!event?.spotify_url) return;

        let isMounted = true;
        apiFetch(`/api/spotify/resolve?url=${encodeURIComponent(event.spotify_url)}`)
            .then(({ ok, json }) => {
                if (isMounted && ok && json?.data) {
                    setSpotifyMeta(json.data);
                }
            })
            .catch(console.error);

        return () => { isMounted = false; };
    }, [event?.spotify_url]);

    // Initialize Spotify IFrame API Controller
    useEffect(() => {
        if (!event?.spotify_url || !features.spotify) return;

        let isMounted = true;

        const mountController = (IFrameAPI) => {
            const container = document.getElementById('spotify-embed-controller');
            if (!container || !isMounted) return;

            const targetUri = spotifyMeta?.uri || (event.spotify_url.startsWith('spotify:') ? event.spotify_url : null);
            if (!targetUri) return;

            container.innerHTML = '';

            const options = {
                uri: targetUri,
                width: '100%',
                height: '152',
            };

            IFrameAPI.createController(container, options, (controller) => {
                if (!isMounted) return;
                spotifyControllerRef.current = controller;
                setIsSpotifyReady(true);

                controller.addListener('playback_update', (e) => {
                    if (e && e.data) {
                        setIsSpotifyPlaying(!e.data.isPaused);
                    }
                });
            });
        };

        if (window.SpotifyIframeApi) {
            mountController(window.SpotifyIframeApi);
        } else {
            if (!document.getElementById('spotify-iframe-api-script')) {
                const script = document.createElement('script');
                script.id = 'spotify-iframe-api-script';
                script.src = 'https://open.spotify.com/embed/iframe-api/v1';
                script.async = true;
                document.body.appendChild(script);
            }

            const prevReady = window.onSpotifyIframeApiReady;
            window.onSpotifyIframeApiReady = (IFrameAPI) => {
                if (prevReady) prevReady(IFrameAPI);
                window.SpotifyIframeApi = IFrameAPI;
                mountController(IFrameAPI);
            };
        }

        return () => { isMounted = false; };
    }, [event?.spotify_url, spotifyMeta?.uri, features.spotify]);

    // Handle Song Search on Spotify (Debounced)
    const handleSongInputChange = (e) => {
        const val = e.target.value;
        setSongSuggestion(val);
        setSelectedSongMeta(null);

        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }

        if (val.trim().length >= 2) {
            setIsSearchingSong(true);
            searchDebounceRef.current = setTimeout(async () => {
                try {
                    const { ok, json } = await apiFetch(`/api/spotify/search?q=${encodeURIComponent(val.trim())}&limit=5`);
                    if (ok && Array.isArray(json?.results)) {
                        setSongSearchResults(json.results);
                        setShowSongDropdown(true);
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    setIsSearchingSong(false);
                }
            }, 300);
        } else {
            setSongSearchResults([]);
            setShowSongDropdown(false);
            setIsSearchingSong(false);
        }
    };

    const handleSelectSpotifySong = (track) => {
        setSongSuggestion(`${track.name} - ${track.artist}`);
        setSelectedSongMeta(track);
        setShowSongDropdown(false);
    };

    const handleDjSongInputChange = (e) => {
        const val = e.target.value;
        setDjSongQuery(val);
        setSelectedDjTrack(null);

        if (djSearchDebounceRef.current) {
            clearTimeout(djSearchDebounceRef.current);
        }

        if (val.trim().length >= 2) {
            setIsSearchingDjSong(true);
            djSearchDebounceRef.current = setTimeout(async () => {
                try {
                    const { ok, json } = await apiFetch(`/api/spotify/search?q=${encodeURIComponent(val.trim())}&limit=6`);
                    if (ok && Array.isArray(json?.results)) {
                        setDjSearchResults(json.results);
                        setShowDjDropdown(true);
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    setIsSearchingDjSong(false);
                }
            }, 300);
        } else {
            setDjSearchResults([]);
            setShowDjDropdown(false);
            setIsSearchingDjSong(false);
        }
    };

    const handleSelectDjTrack = (track) => {
        setSelectedDjTrack(track);
        setDjSongQuery(`${track.name} - ${track.artist}`);
        setShowDjDropdown(false);
    };

    const handleSubmitDjSong = async (e) => {
        e.preventDefault();
        if (!selectedDjTrack) return;

        setIsSubmittingDjSong(true);
        try {
            const endpoint = token ? `/api/rsvp/${token}/song-request` : `/api/events/${event.id}/public-song-request`;
            const { ok, json } = await apiFetch(endpoint, {
                method: 'POST',
                body: JSON.stringify({
                    requester_name: (djRequesterName || guest?.name || 'Invitado Especial').trim(),
                    song_title: selectedDjTrack.name,
                    artist: selectedDjTrack.artist,
                    spotify_id: selectedDjTrack.id,
                    spotify_uri: selectedDjTrack.uri,
                    image_url: selectedDjTrack.image,
                    external_url: selectedDjTrack.external_url,
                    note: djSongNote.trim() || null,
                }),
            });

            if (ok) {
                setDjSongSuccess(true);
                if (json?.song_request) {
                    setSongRequests(prev => [json.song_request, ...prev]);
                }
                setSelectedDjTrack(null);
                setDjSongQuery('');
                setDjSongNote('');
                setTimeout(() => setDjSongSuccess(false), 5000);
            }
        } catch (err) {
            console.error('Error submitting DJ song:', err);
        } finally {
            setIsSubmittingDjSong(false);
        }
    };

    const toggleSpotifyPlay = () => {
        if (spotifyControllerRef.current) {
            if (audioRef.current && isPlayingAudio) {
                audioRef.current.pause();
                setIsPlayingAudio(false);
            }
            spotifyControllerRef.current.togglePlay();
        } else {
            setShowMusicPlayer(true);
        }
    };

    // Client-side image optimization with Photobooth VIP frame option
    const compressAndFrameImage = (file, withFrame = true, maxWidth = 1920, maxHeight = 1080, quality = 0.85) => {
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

                    if (withFrame) {
                        const border = Math.max(16, Math.round(Math.min(width, height) * 0.035));
                        const bottomBar = Math.max(70, Math.round(border * 3.6));
                        canvas.width = width + border * 2;
                        canvas.height = height + border * 2 + bottomBar;
                        const ctx = canvas.getContext('2d');

                        // Luxury dark background
                        ctx.fillStyle = '#0f172a';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // Gold gradient frame
                        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                        grad.addColorStop(0, '#f59e0b');
                        grad.addColorStop(0.5, '#d97706');
                        grad.addColorStop(1, '#f59e0b');
                        ctx.strokeStyle = grad;
                        ctx.lineWidth = Math.max(2, Math.round(border * 0.2));
                        ctx.strokeRect(border * 0.4, border * 0.4, canvas.width - border * 0.8, canvas.height - border * 0.8);

                        // Main photo
                        ctx.drawImage(img, border, border, width, height);

                        // Inner border
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(border, border, width, height);

                        // Event title
                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'center';
                        const titleSize = Math.max(18, Math.round(bottomBar * 0.28));
                        ctx.font = `bold ${titleSize}px Georgia, serif`;
                        const textY = height + border + (bottomBar * 0.46);
                        const displayTitle = event?.couple_names || event?.title || 'Recuerdo del Evento';
                        ctx.fillText(displayTitle, canvas.width / 2, textY);

                        // Date & Sparkle
                        ctx.fillStyle = '#fbbf24';
                        const subSize = Math.max(12, Math.round(bottomBar * 0.18));
                        ctx.font = `600 ${subSize}px system-ui, sans-serif`;
                        const formattedDate = event?.event_date 
                            ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) 
                            : 'Noche Inolvidable';
                        ctx.fillText(`✨ ${formattedDate} · Photobooth VIP ✨`, canvas.width / 2, textY + (bottomBar * 0.34));
                    } else {
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                    }

                    canvas.toBlob((blob) => {
                        if (blob) {
                            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            resolve({
                                file: compressedFile,
                                previewUrl: URL.createObjectURL(blob)
                            });
                        } else {
                            resolve({
                                file: file,
                                previewUrl: URL.createObjectURL(file)
                            });
                        }
                    }, 'image/jpeg', quality);
                };
                img.onerror = () => resolve({ file, previewUrl: URL.createObjectURL(file) });
            };
            reader.onerror = () => resolve({ file, previewUrl: URL.createObjectURL(file) });
        });
    };

    const processAndSetPhoto = async (file, withFrame) => {
        try {
            const processed = await compressAndFrameImage(file, withFrame);
            setDedicationFile(processed.file);
            setDedicationPreview(processed.previewUrl);
        } catch (err) {
            console.error('Error framing image:', err);
            setDedicationFile(file);
            setDedicationPreview(URL.createObjectURL(file));
        }
    };

    const togglePhotoboothFrame = async (enable) => {
        setApplyPhotoboothFrame(enable);
        if (rawDedicationPhoto && dedicationType === 'photo') {
            await processAndSetPhoto(rawDedicationPhoto, enable);
        }
    };

    // Dedication file handler
    const handleDedicationFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isVideo = file.type.startsWith('video') || file.name?.match(/\.(mp4|mov|webm|3gp|m4v)$/i);
        setDedicationType(isVideo ? 'video' : 'photo');

        if (isVideo) {
            setDedicationFile(file);
            setDedicationPreview(URL.createObjectURL(file));
            setRawDedicationPhoto(null);
        } else {
            setRawDedicationPhoto(file);
            await processAndSetPhoto(file, applyPhotoboothFrame);
        }
    };

    // AI Dedication Suggestion Handler
    const handleSuggestDedication = async () => {
        setIsGeneratingDedication(true);
        try {
            const { ok, json } = await apiFetch('/api/rsvp/suggest-dedication', {
                method: 'POST',
                body: JSON.stringify({
                    guest_name: dedicationAuthor || guest?.name || 'Un amigo',
                    couple_names: event?.couple_names || event?.title,
                    event_type: event?.event_type || 'boda',
                    tone: 'cariñoso'
                })
            });
            if (ok && json?.suggestion) {
                setDedicationMsg(json.suggestion);
            }
        } catch (err) {
            console.error('AI dedication error:', err);
        } finally {
            setIsGeneratingDedication(false);
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

    // Apple Calendar & Outlook (.ics) Direct File Generator
    const downloadIcsCalendar = () => {
        if (!event?.event_date) return;
        const dateFormatted = event.event_date.replace(/-/g, '');
        const startTime = `${dateFormatted}T180000Z`;
        const endTime = `${dateFormatted}T235900Z`;
        const title = event.couple_names || event.title || 'Evento Especial';
        const description = `Gran celebración de ${title}. Lugar: ${event.location || 'Salón Principal'}`;
        const location = event.location || '';

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Invitaciones VIP//ES',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${Date.now()}@invitacionesvip.com`,
            `DTSTAMP:${dateFormatted}T000000Z`,
            `DTSTART:${startTime}`,
            `DTEND:${endTime}`,
            `SUMMARY:${title}`,
            `DESCRIPTION:${description}`,
            `LOCATION:${location}`,
            'STATUS:CONFIRMED',
            'SEQUENCE:0',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', `${(event.couple_names || event.title || 'evento').toLowerCase().replace(/\s+/g, '_')}.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Direct Uber Ride Deep Link
    const getUberUrl = () => {
        if (!event?.location) return 'https://m.uber.com/';
        return `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(event.location)}`;
    };

    // Visual Palette Swatches based on Dress Code
    const getDressCodeColors = (code) => {
        const normalized = (code || '').toLowerCase();
        if (normalized.includes('black') || normalized.includes('gala')) {
            return [
                { name: 'Negro Azabache', hex: '#09090b' },
                { name: 'Azul Noche', hex: '#0f172a' },
                { name: 'Dorado Champagne', hex: '#d4af37' },
                { name: 'Plata Satinado', hex: '#94a3b8' }
            ];
        }
        if (normalized.includes('formal') || normalized.includes('elegante')) {
            return [
                { name: 'Azul Marino', hex: '#1e3a8a' },
                { name: 'Verde Esmeralda', hex: '#064e3b' },
                { name: 'Vino Borgoña', hex: '#881337' },
                { name: 'Champagne', hex: '#e2b77a' },
                { name: 'Gris Grafito', hex: '#334155' }
            ];
        }
        if (normalized.includes('cocktail') || normalized.includes('coctel') || normalized.includes('fiesta')) {
            return [
                { name: 'Rosa Palo', hex: '#f43f5e' },
                { name: 'Terracota', hex: '#c2410c' },
                { name: 'Lavanda', hex: '#a855f7' },
                { name: 'Champagne Gold', hex: '#d4af37' },
                { name: 'Azul Petróleo', hex: '#0e7490' }
            ];
        }
        return [
            { name: 'Tonos Tierra', hex: '#78350f' },
            { name: 'Terracota Cálido', hex: '#ea580c' },
            { name: 'Verde Salvia', hex: '#65a30d' },
            { name: 'Arena Nude', hex: '#d97706' },
            { name: 'Azul Cielo', hex: '#38bdf8' }
        ];
    };

    // Trivia Questions Generator (Dynamic based on event type)
    const getTriviaQuestions = (ev) => {
        const isWedding = (ev?.event_type === 'boda') || Boolean(ev?.couple_names);
        if (isWedding) {
            return [
                {
                    id: 1,
                    question: '¿Dónde se conocieron los novios por primera vez?',
                    options: [
                        'En la universidad / trabajo durante un proyecto',
                        'Por amigos en común en una reunión o salida',
                        'En una fiesta espontánea donde cruzaron miradas'
                    ],
                    correct: 1
                },
                {
                    id: 2,
                    question: '¿Quién es más probable que cope el centro de la pista de baile?',
                    options: [
                        'Ella, ¡no se pierde ni un solo tema!',
                        'Él, mostrando sus pasos prohibidos',
                        '¡Ambos juntos hasta que apaguen las luces!'
                    ],
                    correct: 2
                },
                {
                    id: 3,
                    question: '¿Cuál es el plan o viaje soñado para celebrar?',
                    options: [
                        'Playa paradisíaca con atardeceres y relax',
                        'Aventura en la montaña y noches bajo las estrellas',
                        'Recorrido por ciudades llenas de historia y gastronomía'
                    ],
                    correct: 0
                }
            ];
        }
        return [
            {
                id: 1,
                question: '¿Qué género musical jamás puede faltar en sus noches de festejo?',
                options: [
                    'Cumbia y Reggaetón clásico para bailar sin parar',
                    'Rock nacional y Pop nostálgico',
                    '¡Un remix de todo hasta el amanecer!'
                ],
                correct: 2
            },
            {
                id: 2,
                question: '¿Qué frase resume mejor el espíritu de los anfitriones?',
                options: [
                    'La vida se celebra con amigos y buena música',
                    'Donde hay risas y brindis, ahí es el lugar',
                    'Coleccionando recuerdos inolvidables siempre'
                ],
                correct: 1
            },
            {
                id: 3,
                question: '¿Cuál es el momento que más esperan de esta gran noche?',
                options: [
                    'El brindis y las palabras emotivas',
                    'La tanda de baile con cotillón y DJ a pleno',
                    'Abrazar y compartir con cada uno de los invitados'
                ],
                correct: 2
            }
        ];
    };

    const handleTriviaAnswer = (qId, optionIdx) => {
        setTriviaAnswers(prev => ({ ...prev, [qId]: optionIdx }));
    };

    const handleTriviaSubmit = (questions) => {
        let score = 0;
        questions.forEach(q => {
            if (triviaAnswers[q.id] === q.correct) {
                score++;
            }
        });
        setTriviaScore(score);
        setTriviaSubmitted(true);
    };

    const handleTriviaReset = () => {
        setTriviaAnswers({});
        setTriviaSubmitted(false);
        setTriviaScore(0);
    };

    // Background Audio & Envelope Handlers
    const toggleAudioPlay = () => {
        if (!audioRef.current) return;
        if (isPlayingAudio) {
            audioRef.current.pause();
            setIsPlayingAudio(false);
        } else {
            if (spotifyControllerRef.current && isSpotifyPlaying) {
                spotifyControllerRef.current.pause();
                setIsSpotifyPlaying(false);
            }
            audioRef.current.play()
                .then(() => setIsPlayingAudio(true))
                .catch(() => {});
        }
    };

    const toggleAudioMute = () => {
        if (!audioRef.current) return;
        audioRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const handleSelectMusicOption = (option) => {
        if (option.type === 'ambient') {
            if (spotifyControllerRef.current && isSpotifyPlaying) {
                spotifyControllerRef.current.pause();
                setIsSpotifyPlaying(false);
            }
            setCurrentAudioUrl(option.url);
            setCurrentAudioTitle(option.title);
            setShowMusicChooser(false);
            setTimeout(() => {
                if (audioRef.current) {
                    audioRef.current.load();
                    audioRef.current.play()
                        .then(() => setIsPlayingAudio(true))
                        .catch(() => {});
                }
            }, 100);
        } else if (option.type === 'spotify') {
            if (audioRef.current && isPlayingAudio) {
                audioRef.current.pause();
                setIsPlayingAudio(false);
            }
            setShowMusicChooser(false);
            setShowMusicPlayer(true);
            if (spotifyControllerRef.current) {
                spotifyControllerRef.current.play();
                setIsSpotifyPlaying(true);
            }
        } else if (option.type === 'mute') {
            if (audioRef.current) {
                audioRef.current.pause();
                setIsPlayingAudio(false);
            }
            if (spotifyControllerRef.current) {
                spotifyControllerRef.current.pause();
                setIsSpotifyPlaying(false);
            }
            setShowMusicChooser(false);
        }
    };

    const handleOpenEnvelope = () => {
        setIsOpeningEnvelope(true);

        // 1. Try starting HTML5 background audio
        if (audioRef.current && currentAudioUrl) {
            audioRef.current.volume = 0;
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    setIsPlayingAudio(true);
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
        } else if (spotifyControllerRef.current) {
            // 2. Try starting Spotify controller if no MP3
            try {
                spotifyControllerRef.current.play();
                setIsSpotifyPlaying(true);
                setShowMusicPlayer(true);
            } catch (err) {
                console.log('Spotify autoplay on envelope open:', err);
            }
        }

        setTimeout(() => {
            setIsEnvelopeOpen(true);
        }, 750);
    };

    // First user gesture fallback: starts playback on very first tap/click/scroll anywhere
    useEffect(() => {
        if (!hasAnyMusic) return;

        const handleInteraction = () => {
            if (audioRef.current && currentAudioUrl && audioRef.current.paused && (isEnvelopeOpen || !isEnvelopeEnabled)) {
                audioRef.current.play()
                    .then(() => setIsPlayingAudio(true))
                    .catch(() => {});
            } else if (spotifyControllerRef.current && !isSpotifyPlaying && (isEnvelopeOpen || !isEnvelopeEnabled)) {
                try {
                    spotifyControllerRef.current.play();
                    setIsSpotifyPlaying(true);
                } catch (e) {}
            }
        };

        window.addEventListener('click', handleInteraction, { once: true });
        window.addEventListener('touchstart', handleInteraction, { once: true });
        window.addEventListener('scroll', handleInteraction, { once: true });

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
            window.removeEventListener('scroll', handleInteraction);
        };
    }, [hasAnyMusic, currentAudioUrl, isEnvelopeOpen, isEnvelopeEnabled, isSpotifyPlaying]);

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

    // Invitation Visual Theme & Styles
    const invitationStyles = event?.invitation_styles || {};
    const primaryColor = invitationStyles.primary_color || '#F43F5E';
    const secondaryColor = invitationStyles.secondary_color || '#FB7185';
    const fontFam = invitationStyles.font_family || 'sans';
    const envelopeColor = invitationStyles.envelope_color || '#3F2817';
    const envelopeSealColor = invitationStyles.envelope_seal_color || '#D97706';
    const fontHeadingClass = fontFam === 'serif' ? 'font-serif-luxury' : fontFam === 'script' ? 'font-script-romantic' : 'font-sans';
    const customBg = invitationStyles.background_value;

    return (
        <div 
            className="min-h-screen text-zinc-900 dark:text-white font-sans transition-colors pb-16 relative"
            style={{
                background: customBg || 'linear-gradient(180deg, rgba(255, 241, 242, 0.6) 0%, rgb(250, 250, 249) 50%, rgba(254, 243, 199, 0.4) 100%)',
            }}
        >
            
            {/* HIDDEN BACKGROUND AUDIO ELEMENT */}
            {currentAudioUrl && (
                <audio
                    ref={audioRef}
                    src={currentAudioUrl}
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
                            <h1 className={`text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 tracking-tight leading-tight drop-shadow-lg ${fontHeadingClass}`}>
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
                            className="relative mx-auto w-72 sm:w-80 h-48 sm:h-52 rounded-2xl border-2 shadow-2xl flex flex-col items-center justify-center cursor-pointer group transition-all hover:scale-[1.02] active:scale-[0.98]"
                            style={{
                                backgroundColor: envelopeColor,
                                borderColor: `${envelopeSealColor}70`,
                                boxShadow: `0 20px 50px ${envelopeColor}90`
                            }}
                        >
                            {/* Envelope Flap Highlight */}
                            <div 
                                className="absolute top-0 inset-x-0 h-20 rounded-t-2xl border-b"
                                style={{
                                    background: `linear-gradient(to bottom, ${envelopeSealColor}20, transparent)`,
                                    borderColor: `${envelopeSealColor}35`
                                }}
                            />
                            
                            {/* Wax Seal Centerpiece */}
                            <div className="relative z-10 flex flex-col items-center gap-2">
                                <div 
                                    className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl border-2 text-white animate-seal-pulse group-hover:scale-110 transition-transform"
                                    style={{
                                        backgroundColor: envelopeSealColor,
                                        borderColor: '#ffffff66',
                                        boxShadow: `0 10px 25px ${envelopeSealColor}80`
                                    }}
                                >
                                    <Heart className="w-7 h-7 text-white fill-white" />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-wider text-amber-200/90 group-hover:text-amber-100 transition-colors drop-shadow">
                                    Tocar para abrir
                                </span>
                            </div>

                            {/* Corner Flourishes */}
                            <div className="absolute top-2 left-2 text-[10px] font-serif" style={{ color: `${envelopeSealColor}90` }}>✦</div>
                            <div className="absolute top-2 right-2 text-[10px] font-serif" style={{ color: `${envelopeSealColor}90` }}>✦</div>
                            <div className="absolute bottom-2 left-2 text-[10px] font-serif" style={{ color: `${envelopeSealColor}90` }}>✦</div>
                            <div className="absolute bottom-2 right-2 text-[10px] font-serif" style={{ color: `${envelopeSealColor}90` }}>✦</div>
                        </div>

                        {/* CTA Button */}
                        <div className="space-y-3 pt-2">
                            <button
                                type="button"
                                onClick={handleOpenEnvelope}
                                className="w-full sm:w-auto px-8 py-3.5 rounded-full text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95 inline-flex items-center justify-center gap-2.5"
                                style={{
                                    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                                    boxShadow: `0 10px 25px ${primaryColor}55`
                                }}
                            >
                                <Mail className="w-4 h-4 text-white" />
                                <span>Abrir Invitación</span>
                                <Music className="w-4 h-4 text-white animate-bounce" />
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
                {/* Floating Interactive Music Player with Chooser */}
                {hasAnyMusic && isEnvelopeOpen && (
                    <div className="relative">
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-zinc-900/90 dark:bg-zinc-800/90 backdrop-blur-md border border-amber-500/40 shadow-xl text-white">
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

                            {/* Music Chooser Popover Trigger */}
                            <button
                                type="button"
                                onClick={() => setShowMusicChooser(!showMusicChooser)}
                                className="flex items-center gap-1 text-[11px] font-bold text-zinc-300 hover:text-amber-300 transition-colors max-w-[120px] sm:max-w-[160px] truncate"
                                title="Cambiar canción o estilo musical"
                            >
                                <span className="truncate">
                                    {isPlayingAudio ? currentAudioTitle : (isSpotifyPlaying ? (spotifyMeta?.title || 'Spotify') : 'Música')}
                                </span>
                                <ChevronDown className="w-3 h-3 shrink-0 text-amber-400" />
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

                        {/* Dropdown / Popover to choose music */}
                        {showMusicChooser && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-950/95 backdrop-blur-xl border border-amber-500/40 rounded-2xl shadow-2xl p-3 z-50 animate-fade-in space-y-2 text-white">
                                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800 text-[10px] font-black uppercase tracking-wider text-amber-400">
                                    <span className="flex items-center gap-1.5">
                                        <Music className="w-3 h-3" /> Opciones de Música
                                    </span>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowMusicChooser(false)}
                                        className="text-zinc-400 hover:text-white"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    {/* Option 1: Acoustic Guitar */}
                                    <button
                                        type="button"
                                        onClick={() => handleSelectMusicOption({
                                            type: 'ambient',
                                            url: '/audio/wedding-acoustic.mp3',
                                            title: 'Guitarra Acústica Romántica'
                                        })}
                                        className={`w-full p-2 rounded-xl flex items-center justify-between text-left text-xs transition-colors ${
                                            currentAudioUrl === '/audio/wedding-acoustic.mp3' && isPlayingAudio
                                                ? 'bg-amber-500/20 text-amber-300 font-bold'
                                                : 'hover:bg-zinc-900 text-zinc-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>🎸</span>
                                            <div>
                                                <div className="font-bold">Guitarra Acústica</div>
                                                <div className="text-[10px] text-zinc-400">Romántica y cálida</div>
                                            </div>
                                        </div>
                                        {currentAudioUrl === '/audio/wedding-acoustic.mp3' && isPlayingAudio && (
                                            <Check className="w-3.5 h-3.5 text-amber-400" />
                                        )}
                                    </button>

                                    {/* Option 2: Emotional Piano */}
                                    <button
                                        type="button"
                                        onClick={() => handleSelectMusicOption({
                                            type: 'ambient',
                                            url: '/audio/wedding-piano.mp3',
                                            title: 'Piano Emotivo de Boda'
                                        })}
                                        className={`w-full p-2 rounded-xl flex items-center justify-between text-left text-xs transition-colors ${
                                            currentAudioUrl === '/audio/wedding-piano.mp3' && isPlayingAudio
                                                ? 'bg-amber-500/20 text-amber-300 font-bold'
                                                : 'hover:bg-zinc-900 text-zinc-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>🎹</span>
                                            <div>
                                                <div className="font-bold">Piano Emotivo</div>
                                                <div className="text-[10px] text-zinc-400">Delicado y elegante</div>
                                            </div>
                                        </div>
                                        {currentAudioUrl === '/audio/wedding-piano.mp3' && isPlayingAudio && (
                                            <Check className="w-3.5 h-3.5 text-amber-400" />
                                        )}
                                    </button>

                                    {/* Option 3: Custom Upload from Host (if different from presets) */}
                                    {event?.background_music_url && !event.background_music_url.includes('wedding-') && (
                                        <button
                                            type="button"
                                            onClick={() => handleSelectMusicOption({
                                                type: 'ambient',
                                                url: event.background_music_url,
                                                title: 'Canción de los Novios'
                                            })}
                                            className={`w-full p-2 rounded-xl flex items-center justify-between text-left text-xs transition-colors ${
                                                currentAudioUrl === event.background_music_url && isPlayingAudio
                                                    ? 'bg-amber-500/20 text-amber-300 font-bold'
                                                    : 'hover:bg-zinc-900 text-zinc-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span>🎵</span>
                                                <div>
                                                    <div className="font-bold">Canción de los Novios</div>
                                                    <div className="text-[10px] text-zinc-400">Subida para el evento</div>
                                                </div>
                                            </div>
                                            {currentAudioUrl === event.background_music_url && isPlayingAudio && (
                                                <Check className="w-3.5 h-3.5 text-amber-400" />
                                            )}
                                        </button>
                                    )}

                                    {/* Option 4: Spotify Official Playlist */}
                                    {features.spotify && (event.spotify_url || spotifyEmbedUrl) && (
                                        <button
                                            type="button"
                                            onClick={() => handleSelectMusicOption({ type: 'spotify' })}
                                            className={`w-full p-2 rounded-xl flex items-center justify-between text-left text-xs transition-colors ${
                                                isSpotifyPlaying
                                                    ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                                                    : 'hover:bg-zinc-900 text-zinc-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Disc className="w-4 h-4 text-emerald-400 shrink-0" />
                                                <div className="truncate">
                                                    <div className="font-bold truncate">{spotifyMeta?.title || 'Playlist de Spotify'}</div>
                                                    <div className="text-[10px] text-zinc-400 truncate">Lista oficial de la fiesta</div>
                                                </div>
                                            </div>
                                            {isSpotifyPlaying && (
                                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                            )}
                                        </button>
                                    )}

                                    {/* Option 5: Pause / Silence */}
                                    <button
                                        type="button"
                                        onClick={() => handleSelectMusicOption({ type: 'mute' })}
                                        className="w-full p-2 rounded-xl flex items-center gap-2 text-left text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors pt-2 border-t border-zinc-800"
                                    >
                                        <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                                        <span>Pausar música / Silencio</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {features.spotify && (event.spotify_url || spotifyEmbedUrl) && (
                    <button
                        type="button"
                        onClick={() => {
                            setShowMusicPlayer(prev => !prev);
                        }}
                        className={`p-2.5 sm:p-3 rounded-full shadow-xl transition-all hover:scale-105 flex items-center gap-2 font-black text-xs cursor-pointer ${
                            showMusicPlayer 
                                ? 'bg-emerald-500 text-zinc-950 ring-4 ring-emerald-500/30 shadow-emerald-500/40' 
                                : 'bg-zinc-900/90 dark:bg-zinc-800/90 text-white border border-emerald-500/40 hover:bg-zinc-800'
                        }`}
                        title={showMusicPlayer ? "Ocultar reproductor Spotify" : "Abrir reproductor Spotify"}
                    >
                        <Disc className={`w-4 h-4 sm:w-5 sm:h-5 ${isSpotifyPlaying ? 'text-zinc-950 animate-spin-slow' : 'text-emerald-400'}`} />
                        <span className="hidden sm:inline">
                            {isSpotifyPlaying ? 'Sonando' : 'Spotify'}
                        </span>
                        {isSpotifyPlaying && (
                            <div className="flex items-end gap-0.5 h-3 ml-0.5">
                                <span className="w-1 bg-zinc-950 rounded-full h-full animate-pulse" />
                                <span className="w-1 bg-zinc-950 rounded-full h-2 animate-pulse delay-75" />
                                <span className="w-1 bg-zinc-950 rounded-full h-2.5 animate-pulse delay-150" />
                            </div>
                        )}
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

            {/* FLOATING SPOTIFY ADVANCED PLAYER DRAWER */}
            {showMusicPlayer && (event.spotify_url || spotifyEmbedUrl) && (
                <div className="fixed bottom-4 right-4 z-40 w-[92vw] max-w-sm sm:max-w-md rounded-3xl overflow-hidden shadow-2xl border border-emerald-500/40 bg-zinc-950/95 backdrop-blur-xl p-3 sm:p-4 text-white animate-fade-in space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 px-1">
                        <div className="flex items-center gap-2 text-xs font-black text-emerald-400 uppercase tracking-wider">
                            <Disc className={`w-4 h-4 ${isSpotifyPlaying ? 'animate-spin-slow text-emerald-400' : 'text-zinc-400'}`} />
                            <span className="truncate max-w-[170px] sm:max-w-[220px]">
                                {spotifyMeta?.title || 'Música de la Fiesta'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setIsPlayerExpanded(!isPlayerExpanded)}
                                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                                title={isPlayerExpanded ? "Modo compacto" : "Modo expandido"}
                            >
                                {isPlayerExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </button>
                            <button 
                                onClick={() => setShowMusicPlayer(false)} 
                                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Official Spotify Interactive Embed Player */}
                    {(spotifyMeta?.embed_url || spotifyEmbedUrl) && (
                        <div className="rounded-2xl overflow-hidden border border-zinc-800/80 bg-black/60 shadow-inner">
                            <iframe
                                src={spotifyMeta?.embed_url || spotifyEmbedUrl}
                                width="100%"
                                height={isPlayerExpanded ? ((spotifyMeta?.type === 'playlist' || spotifyEmbedUrl?.includes('/playlist/')) ? "352" : "152") : ((spotifyMeta?.type === 'track' || spotifyEmbedUrl?.includes('/track/')) ? "80" : "152")}
                                frameBorder="0"
                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                loading="lazy"
                                className="rounded-2xl block"
                            />
                        </div>
                    )}

                    {/* Quick App Link and Direct Open */}
                    <div className="pt-0.5 flex items-center justify-between text-[11px] px-1 text-zinc-400">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Reproductor Oficial Spotify</span>
                        </span>
                        <a
                            href={spotifyMeta?.external_url || event.spotify_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors"
                        >
                            <span>Abrir en Spotify App</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </div>
            )}

            {/* MODO FIESTA EN VIVO (STICKY TOP BAR WHEN TODAY) */}
            {timeLeft.isToday && (
                <div className="sticky top-0 z-40 bg-gradient-to-r from-amber-600 via-rose-600 to-purple-700 text-white px-4 py-2.5 shadow-2xl backdrop-blur-md border-b border-white/20 animate-fade-in">
                    <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-400"></span>
                            </span>
                            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider whitespace-nowrap">
                                ¡HOY ES LA FIESTA! · EN VIVO
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                            {event.location && (
                                <a
                                    href={getUberUrl()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1 bg-black/40 hover:bg-black/60 rounded-lg text-[10px] font-black tracking-wide flex items-center gap-1 transition-all whitespace-nowrap border border-white/20"
                                >
                                    <Car className="w-3 h-3 text-white" />
                                    <span>Pedir Uber</span>
                                </a>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowDedicationModal(true)}
                                className="px-2.5 py-1 bg-white text-zinc-950 hover:bg-zinc-100 rounded-lg text-[10px] font-black tracking-wide flex items-center gap-1 shadow transition-all whitespace-nowrap"
                            >
                                <Camera className="w-3 h-3 text-rose-500" />
                                <span>Muro en Vivo</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const djEl = document.getElementById('dj-song-request-section');
                                    if (djEl) djEl.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-[10px] font-black tracking-wide flex items-center gap-1 shadow transition-all whitespace-nowrap"
                            >
                                <Music className="w-3 h-3" />
                                <span>DJ</span>
                            </button>
                            {guest?.table_number && (
                                <button
                                    type="button"
                                    onClick={() => setShowSeatingModal(true)}
                                    className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-zinc-950 rounded-lg text-[10px] font-black tracking-wide flex items-center gap-1 shadow transition-all whitespace-nowrap"
                                >
                                    <MapPin className="w-3 h-3" />
                                    <span>Mesa {guest.table_number}</span>
                                </button>
                            )}
                        </div>
                    </div>
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

                    <h1 className={`text-4xl sm:text-6xl font-black tracking-tight drop-shadow-lg ${fontHeadingClass}`}>
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
                            <div className="flex-1">
                                <div className="text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase">Fecha</div>
                                <div className="text-sm font-bold text-zinc-900 dark:text-white capitalize">
                                    {event.event_date ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'A confirmar'}
                                </div>
                                <div className="pt-2 flex flex-wrap gap-2">
                                    <a
                                        href={getCalendarUrl()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-black inline-flex items-center gap-1 transition-all"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Google Calendar
                                    </a>
                                    <button
                                        type="button"
                                        onClick={downloadIcsCalendar}
                                        className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-[10px] font-black inline-flex items-center gap-1 transition-all cursor-pointer"
                                    >
                                        <Download className="w-3 h-3" />
                                        Apple / Outlook (.ics)
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Location */}
                        <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-zinc-800/50 border border-amber-100 dark:border-zinc-700 flex items-start gap-3">
                            <div className="p-2.5 bg-amber-500 text-zinc-950 rounded-xl shadow-md">
                                <MapPin className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
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
                                                className="px-2.5 py-1 bg-white dark:bg-zinc-900 rounded-lg text-[10px] font-black border border-zinc-300 dark:border-zinc-600 hover:border-amber-500 text-zinc-800 dark:text-zinc-200 flex items-center gap-1 shadow-sm"
                                            >
                                                <Navigation className="w-3 h-3 text-amber-500" />
                                                Google Maps
                                            </a>
                                            <a
                                                href={`https://waze.com/ul?q=${encodeURIComponent(event.location)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-2.5 py-1 bg-white dark:bg-zinc-900 rounded-lg text-[10px] font-black border border-zinc-300 dark:border-zinc-600 hover:border-blue-500 text-zinc-800 dark:text-zinc-200 flex items-center gap-1 shadow-sm"
                                            >
                                                <Navigation className="w-3 h-3 text-blue-500" />
                                                Waze
                                            </a>
                                            <a
                                                href={getUberUrl()}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-2.5 py-1 bg-zinc-950 text-white hover:bg-zinc-800 rounded-lg text-[10px] font-black border border-zinc-800 flex items-center gap-1 shadow-sm"
                                            >
                                                <Car className="w-3 h-3 text-white" />
                                                Pedir Uber
                                            </a>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* DRESS CODE CARD WITH VISUAL PALETTE */}
                {features.dress_code && event.dress_code && (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20 text-2xl">
                                👗
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                                    Código de Vestimenta
                                </span>
                                <h4 className="text-lg font-black text-zinc-900 dark:text-white capitalize">
                                    {event.dress_code.replace(/_/g, ' ')}
                                </h4>
                                {event.dress_code_notes && (
                                    <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                                        {event.dress_code_notes}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Visual Palette Guide */}
                        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                    Paleta sugerida para invitados
                                </span>
                                <span className="text-[10px] font-bold text-zinc-400">
                                    Guía de estilo
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                {getDressCodeColors(event.dress_code).map((color, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
                                        <span 
                                            className="w-3.5 h-3.5 rounded-full shadow-sm shrink-0 border border-black/10 dark:border-white/20" 
                                            style={{ backgroundColor: color.hex }}
                                        />
                                        <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                                            {color.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200/50 flex items-center gap-2">
                                <span className="text-sm">✨</span>
                                <span>Recordatorio especial: Rogamos reservar los tonos blancos y marfil exclusivamente para los protagonistas de la celebración.</span>
                            </div>
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

                                        {/* Button to view Seating Table Map */}
                                        <button
                                            type="button"
                                            onClick={() => setShowSeatingModal(true)}
                                            className="w-full py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            <MapPin className="w-3.5 h-3.5" />
                                            <span>{guest.table_number ? `Ver mi Mesa ${guest.table_number} en el Plano` : 'Ver Plano del Salón'}</span>
                                        </button>
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

                                        {/* DJ Song Suggestion Feature with Live Spotify Search */}
                                        {features.music_suggestions && (
                                            <div className="relative">
                                                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                                                    <Disc className="w-3.5 h-3.5 text-emerald-500" />
                                                    ¿Qué canción no puede faltar en la fiesta? (Para el DJ)
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={songSuggestion}
                                                        onChange={handleSongInputChange}
                                                        onFocus={() => songSearchResults.length > 0 && setShowSongDropdown(true)}
                                                        placeholder="Buscá canción o artista en Spotify..."
                                                        className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white pl-9 pr-8 py-3 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                                                    />
                                                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                    {isSearchingSong && (
                                                        <Loader2 className="w-4 h-4 text-emerald-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                                                    )}
                                                </div>

                                                {/* Spotify Search Dropdown Results */}
                                                {showSongDropdown && songSearchResults.length > 0 && (
                                                    <div className="absolute z-30 left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto animate-fade-in">
                                                        <div className="p-2 text-[10px] font-bold text-emerald-400 uppercase tracking-wider border-b border-zinc-800 flex items-center justify-between">
                                                            <span className="flex items-center gap-1.5">
                                                                <Disc className="w-3 h-3" /> Resultados de Spotify
                                                            </span>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setShowSongDropdown(false)} 
                                                                className="text-zinc-400 hover:text-white px-1"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                        {songSearchResults.map((track) => (
                                                            <button
                                                                key={track.id}
                                                                type="button"
                                                                onClick={() => handleSelectSpotifySong(track)}
                                                                className="w-full p-2.5 flex items-center gap-3 hover:bg-zinc-800 transition-colors text-left border-b border-zinc-800/50 last:border-b-0"
                                                            >
                                                                {track.image ? (
                                                                    <img src={track.image} alt={track.name} className="w-10 h-10 rounded-lg object-cover shadow-sm shrink-0 border border-zinc-700" />
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                                                                        <Music className="w-5 h-5 text-emerald-400" />
                                                                    </div>
                                                                )}
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-xs font-bold text-white truncate">{track.name}</div>
                                                                    <div className="text-[11px] text-zinc-400 truncate">{track.artist} · <span className="text-zinc-500">{track.album}</span></div>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {selectedSongMeta && (
                                                    <div className="mt-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            {selectedSongMeta.image && (
                                                                <img src={selectedSongMeta.image} alt="" className="w-6 h-6 rounded object-cover" />
                                                            )}
                                                            <span className="text-[11px] font-bold text-emerald-400 truncate">
                                                                ✓ Seleccionada de Spotify: {selectedSongMeta.name} ({selectedSongMeta.artist})
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setSelectedSongMeta(null); setSongSuggestion(''); }}
                                                            className="text-zinc-400 hover:text-white text-xs px-1"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                )}
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
                                    className="w-full py-4 rounded-2xl hover:opacity-95 text-white font-black text-sm uppercase tracking-wider transition-all shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                    style={{
                                        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                                        boxShadow: `0 10px 25px ${primaryColor}40`
                                    }}
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

                {/* TRIVIA INTERACTIVA SOBRE LOS ANFITRIONES */}
                <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                                Desafío Divertido
                            </span>
                            <h3 className="text-2xl font-black text-zinc-900 dark:text-white">
                                ¿Cuánto conoces a los anfitriones? 🧠✨
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {event.couple_names || event.title}: ¡Pon a prueba cuánto recuerdas de su historia!
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20 text-2xl shadow-inner">
                            🏆
                        </div>
                    </div>

                    {triviaSubmitted ? (
                        <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 via-rose-500/10 to-indigo-500/10 border border-amber-500/30 text-center space-y-4 animate-fade-in">
                            <div className="w-16 h-16 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center mx-auto text-3xl shadow-lg">
                                {triviaScore === 3 ? '🏆' : triviaScore === 2 ? '⭐' : '🎉'}
                            </div>
                            <div>
                                <div className="text-2xl font-black text-zinc-900 dark:text-white">
                                    ¡Puntaje: {triviaScore} de 3 Aciertos!
                                </div>
                                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1 max-w-sm mx-auto">
                                    {triviaScore === 3 
                                        ? '¡Increíble! Eres un invitado de honor y conoces cada detalle de esta historia ❤️'
                                        : triviaScore === 2
                                        ? '¡Casi perfecto! Se nota el gran cariño que tienes por los protagonistas 🥂'
                                        : '¡Excelente intento! Lo más importante es celebrar juntos esta gran noche 🥳'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleTriviaReset}
                                className="px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black transition-all hover:scale-105 shadow cursor-pointer"
                            >
                                Jugar de nuevo
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {getTriviaQuestions(event).map((q, qIdx) => (
                                <div key={q.id} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-700/60 space-y-2.5">
                                    <div className="text-xs font-black text-zinc-900 dark:text-white flex items-start gap-2">
                                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] flex items-center justify-center shrink-0 font-bold">
                                            {qIdx + 1}
                                        </span>
                                        <span>{q.question}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 pt-1">
                                        {q.options.map((opt, oIdx) => {
                                            const isSelected = triviaAnswers[q.id] === oIdx;
                                            return (
                                                <button
                                                    key={oIdx}
                                                    type="button"
                                                    onClick={() => handleTriviaAnswer(q.id, oIdx)}
                                                    className={`p-2.5 rounded-xl text-left text-xs font-medium transition-all flex items-center gap-2.5 border cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-amber-500 text-zinc-950 font-bold border-amber-400 shadow-sm'
                                                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-amber-400'
                                                    }`}
                                                >
                                                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] shrink-0 ${
                                                        isSelected ? 'border-zinc-950 bg-zinc-950 text-amber-400 font-bold' : 'border-zinc-400'
                                                    }`}>
                                                        {['A', 'B', 'C'][oIdx]}
                                                    </span>
                                                    <span>{opt}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={() => handleTriviaSubmit(getTriviaQuestions(event))}
                                disabled={Object.keys(triviaAnswers).length < 3}
                                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Sparkles className="w-4 h-4" />
                                <span>Ver Mi Puntaje en la Trivia</span>
                            </button>
                        </div>
                    )}
                </div>

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

                {/* SPOTIFY DJ SONG REQUEST SELECTOR CARD */}
                {features.music_suggestions !== false && (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
                                    <Disc className="w-3.5 h-3.5 animate-spin-slow" />
                                    Música en Vivo
                                </span>
                                <h3 className="text-2xl font-black text-zinc-900 dark:text-white">
                                    Pedí tu Canción para el DJ 🎧
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    Buscá en Spotify el tema que no puede faltar para bailar y festejar juntos.
                                </p>
                            </div>
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                                {songRequests.length} {songRequests.length === 1 ? 'canción pedida' : 'canciones pedidas'}
                            </span>
                        </div>

                        {/* Song Request Form */}
                        <form onSubmit={handleSubmitDjSong} className="space-y-4 bg-zinc-50 dark:bg-zinc-850/60 p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                            {/* Guest Name (if not authenticated) */}
                            {!guest && (
                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                                        Tu Nombre o Apodo:
                                    </label>
                                    <input
                                        type="text"
                                        value={djRequesterName}
                                        onChange={(e) => setDjRequesterName(e.target.value)}
                                        placeholder="Ej: Sofía, Primo Martín, Los de la facu..."
                                        required
                                        className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            )}

                            {/* Spotify Live Search Input */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <Disc className="w-3.5 h-3.5 text-emerald-500" />
                                        Buscar Canción en el Catálogo de Spotify:
                                    </span>
                                    {selectedDjTrack && (
                                        <span className="text-[10px] text-emerald-500 font-bold">✓ Pista lista</span>
                                    )}
                                </label>

                                <div className="relative">
                                    <input
                                        type="text"
                                        value={djSongQuery}
                                        onChange={handleDjSongInputChange}
                                        onFocus={() => djSearchResults.length > 0 && setShowDjDropdown(true)}
                                        placeholder="Escribí el nombre del tema o artista (ej: Pepas, Don Omar, Queen, La Mosca)..."
                                        className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white pl-9 pr-9 py-3 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    {isSearchingDjSong && (
                                        <Loader2 className="w-4 h-4 text-emerald-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                                    )}
                                </div>

                                {/* Autocomplete Search Dropdown */}
                                {showDjDropdown && djSearchResults.length > 0 && (
                                    <div className="absolute z-30 left-0 right-0 mt-1.5 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto animate-fade-in divide-y divide-zinc-800">
                                        <div className="p-2 text-[10px] font-black text-emerald-400 uppercase tracking-wider bg-zinc-950 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <Disc className="w-3 h-3" /> Resultados de Spotify
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setShowDjDropdown(false)}
                                                className="text-zinc-400 hover:text-white text-xs px-1 cursor-pointer"
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        {djSearchResults.map((track) => (
                                            <button
                                                key={track.id}
                                                type="button"
                                                onClick={() => handleSelectDjTrack(track)}
                                                className="w-full p-2.5 flex items-center gap-3 hover:bg-zinc-800 text-left transition-colors cursor-pointer group"
                                            >
                                                {track.image ? (
                                                    <img src={track.image} alt="" className="w-10 h-10 rounded-lg object-cover shadow-sm shrink-0 border border-zinc-700" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-zinc-800 text-emerald-400 flex items-center justify-center shrink-0">
                                                        <Music className="w-5 h-5" />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                                                        {track.name}
                                                    </div>
                                                    <div className="text-[11px] text-zinc-400 truncate">
                                                        {track.artist} {track.album ? `· ${track.album}` : ''}
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-colors shrink-0">
                                                    Elegir
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected Track Preview Badge */}
                            {selectedDjTrack && (
                                <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between gap-3 animate-fade-in">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {selectedDjTrack.image ? (
                                            <img src={selectedDjTrack.image} alt="" className="w-11 h-11 rounded-xl object-cover shadow-md border border-emerald-500/40 shrink-0" />
                                        ) : (
                                            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                                <Music className="w-5 h-5" />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="text-xs font-black text-zinc-900 dark:text-white truncate">
                                                {selectedDjTrack.name}
                                            </div>
                                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                                                {selectedDjTrack.artist}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedDjTrack(null); setDjSongQuery(''); }}
                                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded-lg text-xs cursor-pointer"
                                        title="Quitar selección"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {/* Optional Note for the DJ */}
                            <div>
                                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                                    Nota para el DJ (opcional):
                                </label>
                                <input
                                    type="text"
                                    value={djSongNote}
                                    onChange={(e) => setDjSongNote(e.target.value)}
                                    placeholder="Ej: Para bailar cuando empiece la tanda de cumbia o carnaval carioca..."
                                    className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-medium outline-none"
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={!selectedDjTrack || isSubmittingDjSong}
                                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-zinc-950 font-black text-xs rounded-xl transition-all shadow-lg hover:scale-[1.01] active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {isSubmittingDjSong ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Enviando al DJ...</span>
                                    </>
                                ) : (
                                    <>
                                        <Disc className="w-4 h-4" />
                                        <span>Enviar Canción a la Lista del DJ 🎧</span>
                                    </>
                                )}
                            </button>

                            {/* Success Notification */}
                            {djSongSuccess && (
                                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-center text-xs font-bold text-emerald-400 animate-fade-in flex items-center justify-center gap-2">
                                    <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                                    <span>¡Excelente! Tu tema fue agregado a la lista del DJ de la fiesta.</span>
                                </div>
                            )}
                        </form>

                        {/* Recent DJ Requests Preview */}
                        {songRequests.length > 0 && (
                            <div className="space-y-3 pt-2">
                                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                                    <span>Temas pedidos recientemente por invitados</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {songRequests.slice(0, 6).map((req, idx) => (
                                        <div
                                            key={req.id || idx}
                                            className="p-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40 flex items-center gap-3"
                                        >
                                            {req.image_url ? (
                                                <img src={req.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shadow-sm shrink-0 border border-zinc-700/50" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                                    <Music className="w-4 h-4" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                                                    {req.song_title}
                                                </div>
                                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                                    {req.artist || 'Spotify'} · <span className="text-emerald-500 font-semibold">{req.requester_name}</span>
                                                </div>
                                                {req.note && (
                                                    <div className="text-[10px] text-amber-500/90 italic truncate">
                                                        "{req.note}"
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
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
                                    
                                    {/* Native Direct Photo Camera Input */}
                                    <input
                                        ref={dedicationPhotoCameraRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleDedicationFile}
                                        className="hidden"
                                    />

                                    {/* Native Direct Video Camera Input */}
                                    <input
                                        ref={dedicationVideoCameraRef}
                                        type="file"
                                        accept="video/mp4,video/quicktime,video/webm,video/*"
                                        capture="environment"
                                        onChange={handleDedicationFile}
                                        className="hidden"
                                    />

                                    {/* Gallery Input */}
                                    <input
                                        ref={dedicationGalleryRef}
                                        type="file"
                                        accept="image/*,video/mp4,video/quicktime,video/webm,video/*"
                                        onChange={handleDedicationFile}
                                        className="hidden"
                                    />

                                    {dedicationPreview ? (
                                        <div className="relative rounded-2xl overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-black p-2 text-center space-y-1">
                                            {dedicationType === 'video' ? (
                                                <>
                                                    <video src={dedicationPreview} controls className="max-h-48 mx-auto rounded-xl w-full object-contain" />
                                                    {dedicationFile && (
                                                        <div className="text-[10px] text-zinc-400 font-bold">
                                                            Video: {(dedicationFile.size / (1024 * 1024)).toFixed(1)} MB
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <img src={dedicationPreview} alt="Preview" className="max-h-48 mx-auto rounded-xl object-contain" />
                                                    {dedicationFile && (
                                                        <div className="text-[10px] text-emerald-400 font-bold">
                                                            Foto: {(dedicationFile.size / 1024).toFixed(0)} KB (Optimizada ✓)
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            {dedicationType === 'photo' && (
                                                <div className="pt-2 px-1 flex items-center justify-between border-t border-zinc-800 text-[11px]">
                                                    <label className="flex items-center gap-2 cursor-pointer text-amber-400 font-bold select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={applyPhotoboothFrame}
                                                            onChange={(e) => togglePhotoboothFrame(e.target.checked)}
                                                            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-zinc-800 border-zinc-700 cursor-pointer"
                                                        />
                                                        <span>Marco Photobooth VIP ({event?.couple_names || event?.title || 'Evento'})</span>
                                                    </label>
                                                    <span className="text-[10px] text-zinc-400">
                                                        {applyPhotoboothFrame ? '✨ Con Marco' : 'Original'}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-center gap-2 pt-1 border-t border-zinc-800 text-[11px] font-bold">
                                                <button
                                                    type="button"
                                                    onClick={() => dedicationPhotoCameraRef.current?.click()}
                                                    className="text-amber-500 hover:underline cursor-pointer"
                                                >
                                                    Sacar otra foto
                                                </button>
                                                <span className="text-zinc-500">|</span>
                                                <button
                                                    type="button"
                                                    onClick={() => dedicationVideoCameraRef.current?.click()}
                                                    className="text-rose-500 hover:underline cursor-pointer"
                                                >
                                                    Grabar otro video
                                                </button>
                                                <span className="text-zinc-500">|</span>
                                                <button
                                                    type="button"
                                                    onClick={() => { setDedicationFile(null); setDedicationPreview(null); setRawDedicationPhoto(null); }}
                                                    className="text-zinc-400 hover:underline cursor-pointer"
                                                >
                                                    Quitar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => dedicationPhotoCameraRef.current?.click()}
                                                    className="p-3.5 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15 text-center flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                                >
                                                    <div className="w-9 h-9 rounded-lg bg-amber-500 text-zinc-950 flex items-center justify-center shadow">
                                                        <Camera className="w-5 h-5" />
                                                    </div>
                                                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                                        Sacar Foto
                                                    </span>
                                                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400">
                                                        Abre la cámara
                                                    </span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => dedicationVideoCameraRef.current?.click()}
                                                    className="p-3.5 rounded-xl border border-dashed border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/15 text-center flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                                >
                                                    <div className="w-9 h-9 rounded-lg bg-rose-500 text-white flex items-center justify-center shadow">
                                                        <Film className="w-5 h-5" />
                                                    </div>
                                                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                                                        Grabar Video
                                                    </span>
                                                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400">
                                                        Hasta 30s
                                                    </span>
                                                </button>
                                            </div>

                                            <button
                                                 type="button"
                                                 onClick={() => dedicationGalleryRef.current?.click()}
                                                 className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-center text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                                             >
                                                 <Upload className="w-3.5 h-3.5 text-zinc-500" />
                                                 <span>O elegir de tu Galería (Foto o Video)</span>
                                             </button>
                                        </div>
                                    )}
                                </div>

                                {/* Message */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                            Dedicatoria / Deseo
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleSuggestDedication}
                                            disabled={isGeneratingDedication}
                                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-500 hover:text-amber-400 disabled:opacity-50 transition-colors"
                                            title="Generar dedicatoria emotiva con Inteligencia Artificial"
                                        >
                                            <Sparkles className={`w-3 h-3 ${isGeneratingDedication ? 'animate-spin' : ''}`} />
                                            <span>{isGeneratingDedication ? 'Creando...' : '✨ Inspirarme con IA'}</span>
                                        </button>
                                    </div>
                                    <textarea
                                        rows={3}
                                        value={dedicationMsg}
                                        onChange={(e) => setDedicationMsg(e.target.value)}
                                        placeholder="¡Felicidades en esta noche tan especial!"
                                        className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5 font-medium outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={dedicationUploading || (!dedicationFile && !dedicationMsg.trim())}
                                    className="w-full py-3.5 rounded-2xl text-white font-black text-xs uppercase tracking-wider shadow-lg disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                    style={{
                                        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                                        boxShadow: `0 10px 20px ${primaryColor}40`
                                    }}
                                >
                                    {dedicationUploading ? 'Subiendo dedicatoria...' : 'Enviar Dedicatoria'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* SALON SEATING PLAN MODAL */}
            {showSeatingModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 max-w-lg w-full shadow-2xl space-y-4 animate-fade-in relative max-h-[92vh] overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => setShowSeatingModal(false)}
                            className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
                        >
                            ✕
                        </button>

                        <div className="text-center space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                                Distribución del Salón
                            </span>
                            <h3 className="text-xl font-black text-zinc-900 dark:text-white">
                                Plano de Mesas & Áreas
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {guest?.table_number 
                                    ? `Tu mesa reservada es la Mesa #${guest.table_number}`
                                    : 'Ubicación de mesas, pista de baile y áreas principales'}
                            </p>
                        </div>

                        {/* Guest Table Alert if assigned */}
                        {guest?.table_number && (
                            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">👑</span>
                                    <div>
                                        <div className="text-xs font-black text-amber-600 dark:text-amber-400">
                                            Tu Asignación: Mesa {guest.table_number}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                            Asignada para {guest.name} ({confirmedPasses} {confirmedPasses === 1 ? 'pase' : 'pases'})
                                        </div>
                                    </div>
                                </div>
                                <span className="px-2 py-1 rounded-lg bg-amber-500 text-zinc-950 font-black text-[10px] uppercase shadow">
                                    VIP
                                </span>
                            </div>
                        )}

                        {/* Visual Floor Plan */}
                        <div className="bg-zinc-950 rounded-2xl p-4 sm:p-5 border border-zinc-800 text-white space-y-4">
                            {/* Stage / Honor Table at Top */}
                            <div className="w-52 mx-auto py-2 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 text-zinc-950 font-black text-center text-xs shadow-md uppercase tracking-wider flex items-center justify-center gap-1.5">
                                <span>👑</span>
                                <span>Escenario & Mesa de Honor</span>
                                <span>👑</span>
                            </div>

                            {/* Main Hall: Left DJ, Center Dancefloor, Right Bar */}
                            <div className="grid grid-cols-4 gap-2 items-center text-center">
                                {/* DJ Booth */}
                                <div className="p-2.5 rounded-xl bg-purple-950/70 border border-purple-500/40 text-purple-300">
                                    <Disc className="w-4 h-4 mx-auto mb-1 text-purple-400 animate-spin" style={{ animationDuration: '6s' }} />
                                    <div className="text-[9px] font-black uppercase">DJ & Sonido</div>
                                    <div className="text-[8px] text-zinc-400">Pantalla</div>
                                </div>

                                {/* Dance Floor */}
                                <div className="col-span-2 py-5 px-2 rounded-2xl bg-gradient-to-b from-rose-950/40 to-indigo-950/40 border-2 border-dashed border-rose-500/30 flex flex-col items-center justify-center relative overflow-hidden">
                                    <Sparkles className="w-5 h-5 text-amber-400 mb-1" />
                                    <div className="text-[11px] font-black text-white tracking-widest uppercase">
                                        Pista de Baile
                                    </div>
                                    <div className="text-[8px] text-rose-300/80 mt-0.5">
                                        Luces & Efectos
                                    </div>
                                </div>

                                {/* Bar */}
                                <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300">
                                    <Utensils className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                                    <div className="text-[9px] font-black uppercase">Open Bar</div>
                                    <div className="text-[8px] text-zinc-400">Coctelería</div>
                                </div>
                            </div>

                            {/* Banquet Tables Grid */}
                            <div className="pt-2">
                                <div className="text-[9px] font-bold text-zinc-400 text-center uppercase tracking-wider mb-2.5">
                                    Zona de Mesas Principales
                                </div>
                                <div className="grid grid-cols-4 gap-2.5">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => {
                                        const isMyTable = guest?.table_number && String(guest.table_number).trim() === String(num);
                                        return (
                                            <div
                                                key={num}
                                                className={`relative p-2.5 rounded-xl text-center transition-all ${
                                                    isMyTable
                                                        ? 'bg-amber-500 text-zinc-950 font-black shadow-lg shadow-amber-500/50 ring-4 ring-amber-300 scale-105'
                                                        : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700'
                                                }`}
                                            >
                                                {isMyTable && (
                                                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-zinc-950 text-amber-400 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-amber-400 whitespace-nowrap shadow">
                                                        ¡TU MESA!
                                                    </div>
                                                )}
                                                <div className="text-xs font-black">
                                                    Mesa {num}
                                                </div>
                                                <div className={`text-[8px] ${isMyTable ? 'text-zinc-950/80 font-bold' : 'text-zinc-500'}`}>
                                                    {isMyTable ? '⭐ Reservada' : '8 Asientos'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Entrance at bottom */}
                            <div className="text-center pt-2 border-t border-zinc-800/80 text-[10px] text-zinc-400 flex items-center justify-center gap-1.5 font-bold">
                                <span>🚪</span>
                                <span>Recepción y Acceso Principal al Salón</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowSeatingModal(false)}
                            className="w-full py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
