import React, { useState, useEffect, useRef } from 'react';
import { 
    Radio, Camera, Video, VideoOff, Mic, MicOff, RefreshCw, 
    Sparkles, AlertCircle, ArrowLeft, Tv, ExternalLink, Zap, 
    ShieldCheck, Check, Copy
} from 'lucide-react';
import { apiFetch } from '../api';

const RTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ]
};

export default function LiveBroadcastCamera({ eventId }) {
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Media stream state
    const [stream, setStream] = useState(null);
    const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (front)
    const [isMuted, setIsMuted] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);

    // Broadcast state
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('idle'); // 'idle' | 'starting' | 'waiting_viewer' | 'connected' | 'error'
    const [durationSeconds, setDurationSeconds] = useState(0);
    const [broadcasterName, setBroadcasterName] = useState('Cámara Móvil Salón');
    const [copiedUrl, setCopiedUrl] = useState(false);

    const videoRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const heartbeatTimerRef = useRef(null);
    const answerPollTimerRef = useRef(null);
    const durationTimerRef = useRef(null);
    const processedCandidatesRef = useRef(new Set());

    // 1. Fetch Event Info
    useEffect(() => {
        fetchEventInfo();
        return () => {
            stopBroadcast();
            stopCamera();
        };
    }, [eventId]);

    const fetchEventInfo = async () => {
        try {
            const { ok, json } = await apiFetch(`/api/events/${eventId}/public-invitation`);
            if (ok && json?.event) {
                setEvent(json.event);
            } else {
                setError('Evento no encontrado.');
            }
        } catch (err) {
            console.error(err);
            setError('Error al conectar con el evento.');
        } finally {
            setLoading(false);
        }
    };

    // 2. Initialize Camera on Mount
    useEffect(() => {
        if (!loading && !error) {
            startCamera(facingMode);
        }
    }, [loading, facingMode]);

    const startCamera = async (mode) => {
        try {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }

            const constraints = {
                video: {
                    facingMode: mode,
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30, max: 60 }
                },
                audio: true
            };

            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(mediaStream);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }

            // Check if track supports torch/flashlight
            const videoTrack = mediaStream.getVideoTracks()[0];
            if (videoTrack) {
                const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
                setHasTorch(Boolean(capabilities.torch));
            }

            // If we're already broadcasting and changed camera, replace tracks in RTCPeerConnection
            if (peerConnectionRef.current && isBroadcasting) {
                const senders = peerConnectionRef.current.getSenders();
                const newVideoTrack = mediaStream.getVideoTracks()[0];
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                if (videoSender && newVideoTrack) {
                    videoSender.replaceTrack(newVideoTrack);
                }
            }
        } catch (err) {
            console.error('Error starting camera:', err);
            setError('No se pudo acceder a la cámara o micrófono. Asegurate de otorgar permisos.');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            setStream(null);
        }
    };

    // Toggle Front / Back Camera
    const toggleCamera = () => {
        const nextMode = facingMode === 'environment' ? 'user' : 'environment';
        setFacingMode(nextMode);
    };

    // Toggle Flashlight (Torch)
    const toggleTorch = async () => {
        if (!stream) return;
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) return;
        try {
            const next = !torchOn;
            await videoTrack.applyConstraints({
                advanced: [{ torch: next }]
            });
            setTorchOn(next);
        } catch (e) {
            console.warn('Torch error:', e);
        }
    };

    // Toggle Microphone Mute
    const toggleMute = () => {
        if (!stream) return;
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            setIsMuted(!audioTrack.enabled);
        }
    };

    // 3. Start WebRTC Live Broadcast
    const startBroadcast = async () => {
        if (!stream) {
            await startCamera(facingMode);
        }

        setIsBroadcasting(true);
        setConnectionStatus('starting');
        setDurationSeconds(0);
        processedCandidatesRef.current = new Set();

        try {
            const pc = new RTCPeerConnection(RTC_CONFIG);
            peerConnectionRef.current = pc;

            // Add local tracks
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
            });

            // Send local ICE candidates to backend
            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    try {
                        await apiFetch(`/api/events/${eventId}/live-stream/candidate`, {
                            method: 'POST',
                            body: JSON.stringify({
                                sender: 'broadcaster',
                                candidate: event.candidate.toJSON(),
                            })
                        });
                    } catch (e) {
                        console.error('Error sending ice candidate:', e);
                    }
                }
            };

            // Monitor connection state
            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'connected') {
                    setConnectionStatus('connected');
                } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                    setConnectionStatus('waiting_viewer');
                }
            };

            // Create Offer
            const offer = await pc.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false,
            });
            await pc.setLocalDescription(offer);

            // Register Offer on Backend
            const { ok } = await apiFetch(`/api/events/${eventId}/live-stream/start`, {
                method: 'POST',
                body: JSON.stringify({
                    offer: { type: offer.type, sdp: offer.sdp },
                    broadcaster_name: broadcasterName || 'Cámara en Vivo',
                })
            });

            if (!ok) {
                throw new Error('Error al registrar la transmisión en el servidor');
            }

            setConnectionStatus('waiting_viewer');

            // Timer for duration
            durationTimerRef.current = setInterval(() => {
                setDurationSeconds(prev => prev + 1);
            }, 1000);

            // Heartbeat loop every 5s
            heartbeatTimerRef.current = setInterval(async () => {
                try {
                    await apiFetch(`/api/events/${eventId}/live-stream/heartbeat`, { method: 'POST' });
                } catch (e) {
                    console.error('Heartbeat error:', e);
                }
            }, 5000);

            // Poll for Answer and Viewer ICE candidates every 1.5s
            let answerApplied = false;
            answerPollTimerRef.current = setInterval(async () => {
                try {
                    const { ok, json } = await apiFetch(`/api/events/${eventId}/live-stream/status`);
                    if (ok && json?.active && json?.answer && !answerApplied && pc.signalingState === 'have-local-offer') {
                        answerApplied = true;
                        const remoteDesc = new RTCSessionDescription(json.answer);
                        await pc.setRemoteDescription(remoteDesc);
                    }

                    // Fetch ICE candidates from Viewer (projector)
                    if (answerApplied) {
                        const candRes = await apiFetch(`/api/events/${eventId}/live-stream/candidates?for=broadcaster`);
                        if (candRes.ok && Array.isArray(candRes.json?.candidates)) {
                            for (const cand of candRes.json.candidates) {
                                const candStr = JSON.stringify(cand);
                                if (!processedCandidatesRef.current.has(candStr)) {
                                    processedCandidatesRef.current.add(candStr);
                                    try {
                                        await pc.addIceCandidate(new RTCIceCandidate(cand));
                                    } catch (err) {
                                        console.warn('Error adding ICE candidate:', err);
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('Polling error:', err);
                }
            }, 1500);

        } catch (err) {
            console.error('Error starting live broadcast:', err);
            setConnectionStatus('error');
            setIsBroadcasting(false);
            if (durationTimerRef.current) clearInterval(durationTimerRef.current);
            if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
            if (answerPollTimerRef.current) clearInterval(answerPollTimerRef.current);
        }
    };

    // 4. Stop WebRTC Live Broadcast
    const stopBroadcast = async () => {
        setIsBroadcasting(false);
        setConnectionStatus('idle');

        if (durationTimerRef.current) clearInterval(durationTimerRef.current);
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        if (answerPollTimerRef.current) clearInterval(answerPollTimerRef.current);

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        try {
            await apiFetch(`/api/events/${eventId}/live-stream/stop`, { method: 'POST' });
        } catch (e) {
            console.error('Error stopping stream on server:', e);
        }
    };

    const formatDuration = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const projectionUrl = `${window.location.origin}/evento/${eventId}/proyeccion`;

    const handleCopyProjectionLink = () => {
        navigator.clipboard.writeText(projectionUrl);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2500);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white space-y-3 font-sans">
                <Radio className="w-10 h-10 text-rose-500 animate-pulse" />
                <span className="text-sm font-bold text-zinc-300">Conectando Cámara de Transmisión...</span>
            </div>
        );
    }

    if (error && !event) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white text-center space-y-4 font-sans">
                <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
                <h2 className="text-lg font-black">{error}</h2>
                <a
                    href="/"
                    className="px-5 py-2.5 rounded-xl bg-zinc-800 text-xs font-bold text-white hover:bg-zinc-700"
                >
                    Volver al Inicio
                </a>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black text-white select-none flex flex-col justify-between overflow-hidden font-sans">
            {/* VIEWFINDER (Live Camera feed) */}
            <div className="absolute inset-0 z-0 bg-zinc-950 flex items-center justify-center overflow-hidden">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted // Local preview always muted to prevent audio feedback screech
                    className={`w-full h-full object-cover transition-transform duration-300 ${
                        facingMode === 'user' ? 'scale-x-[-1]' : ''
                    }`}
                />

                {/* Subtle Rule-of-Thirds Grid */}
                <div className="absolute inset-0 pointer-events-none opacity-15 grid grid-cols-3 grid-rows-3">
                    <div className="border-r border-b border-white" />
                    <div className="border-r border-b border-white" />
                    <div className="border-b border-white" />
                    <div className="border-r border-b border-white" />
                    <div className="border-r border-b border-white" />
                    <div className="border-b border-white" />
                    <div className="border-r border-white" />
                    <div className="border-r border-white" />
                    <div />
                </div>

                {/* Live Broadcast Glow Border */}
                {isBroadcasting && (
                    <div className="absolute inset-0 pointer-events-none border-4 border-rose-500/80 animate-pulse shadow-[inset_0_0_40px_rgba(244,63,94,0.4)]" />
                )}
            </div>

            {/* TOP BAR: EVENT TITLE & CONNECTION BADGE */}
            <header className="relative z-20 p-4 pt-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <a
                        href={`/evento/${eventId}/invitacion`}
                        className="p-2 rounded-xl bg-black/50 backdrop-blur-md border border-white/20 text-white hover:bg-white/10"
                        title="Volver"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </a>
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                            Cámara en Vivo para Pantalla Gigante
                        </div>
                        <h1 className="text-sm sm:text-base font-black text-white truncate max-w-[200px] sm:max-w-xs">
                            {event?.couple_names || event?.title}
                        </h1>
                    </div>
                </div>

                {/* Live Pill / Status */}
                <div className="flex items-center gap-2">
                    {isBroadcasting ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-600 text-white text-xs font-black shadow-lg animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-white" />
                            <span>EN DIRECTO {formatDuration(durationSeconds)}</span>
                        </div>
                    ) : (
                        <div className="px-3 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-700 text-zinc-300 text-xs font-bold">
                            ⚪ Lista para transmitir
                        </div>
                    )}
                </div>
            </header>

            {/* CONNECTION STATUS BANNER */}
            {isBroadcasting && (
                <div className="relative z-20 px-4 py-2 text-center animate-fade-in">
                    {connectionStatus === 'connected' ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/90 text-zinc-950 font-black text-[11px] shadow-lg">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Transmitiendo en la Pantalla Gigante</span>
                        </div>
                    ) : connectionStatus === 'waiting_viewer' ? (
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/90 text-zinc-950 font-bold text-[11px] shadow-lg">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Esperando que el proyector sintonice la señal...</span>
                        </div>
                    ) : connectionStatus === 'starting' ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 text-white font-bold text-[11px]">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Iniciando señal WebRTC...</span>
                        </div>
                    ) : null}
                </div>
            )}

            {/* PROJECTOR REMINDER HELPER (if not broadcasting) */}
            {!isBroadcasting && (
                <div className="relative z-10 px-4 py-3 mx-4 rounded-2xl bg-black/60 backdrop-blur-md border border-white/15 text-center space-y-2 max-w-sm mx-auto">
                    <div className="text-[11px] text-zinc-200">
                        Abrí el proyector en la pantalla del salón para recibir tu transmisión en vivo:
                    </div>
                    <div className="flex items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={handleCopyProjectionLink}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center gap-1.5 transition-transform active:scale-95 shadow cursor-pointer"
                        >
                            {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedUrl ? '¡Link Copiado!' : 'Copiar Link Proyector'}</span>
                        </button>
                        <a
                            href={projectionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs flex items-center"
                            title="Abrir proyector en otra pestaña"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            )}

            {/* BOTTOM CONTROLS DOCK */}
            <footer className="relative z-20 p-6 pb-8 bg-gradient-to-t from-black/95 via-black/60 to-transparent space-y-4">
                {/* Secondary camera controls */}
                <div className="flex items-center justify-center gap-4">
                    {/* Switch Front / Back Camera */}
                    <button
                        type="button"
                        onClick={toggleCamera}
                        className="p-3.5 rounded-2xl bg-zinc-900/80 backdrop-blur-md border border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all shadow-lg cursor-pointer"
                        title="Cambiar cámara (Frontal / Trasera)"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>

                    {/* Microphone mute toggle */}
                    <button
                        type="button"
                        onClick={toggleMute}
                        className={`p-3.5 rounded-2xl backdrop-blur-md border transition-all active:scale-95 shadow-lg cursor-pointer ${
                            isMuted 
                                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' 
                                : 'bg-zinc-900/80 border-zinc-700 text-zinc-200 hover:text-white'
                        }`}
                        title={isMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
                    >
                        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    {/* Flashlight toggle if supported */}
                    {hasTorch && (
                        <button
                            type="button"
                            onClick={toggleTorch}
                            className={`p-3.5 rounded-2xl backdrop-blur-md border transition-all active:scale-95 shadow-lg cursor-pointer ${
                                torchOn 
                                    ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold' 
                                    : 'bg-zinc-900/80 border-zinc-700 text-zinc-200 hover:text-white'
                            }`}
                            title="Linterna / Iluminación"
                        >
                            <Zap className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Primary Broadcast Action Button */}
                <div className="flex justify-center">
                    {isBroadcasting ? (
                        <button
                            type="button"
                            onClick={stopBroadcast}
                            className="w-full max-w-xs py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 hover:from-rose-500 hover:to-rose-600 text-white font-black text-sm uppercase tracking-wider shadow-2xl shadow-rose-600/40 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer border-2 border-white/30"
                        >
                            <span className="w-3.5 h-3.5 bg-white rounded-sm animate-pulse" />
                            <span>Finalizar Transmisión</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={startBroadcast}
                            className="w-full max-w-xs py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-red-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white font-black text-sm uppercase tracking-wider shadow-2xl shadow-rose-500/50 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer border-2 border-white/40"
                        >
                            <span className="w-3.5 h-3.5 bg-white rounded-full animate-ping" />
                            <span>Iniciar En Vivo al Proyector</span>
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
}
