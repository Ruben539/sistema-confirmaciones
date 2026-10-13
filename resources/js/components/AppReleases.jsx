import React, { useEffect, useRef, useState } from 'react';
import { Smartphone, Download, Upload, Trash2, ShieldCheck, Sparkles, FileUp, Info } from 'lucide-react';
import { apiFetch } from '../api';

const formatSize = (bytes) => (bytes ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : '');
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

const inputClass = 'w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium outline-none focus:ring-2 focus:ring-rose-500';

/**
 * "Aplicación": download the Wedding Check Android app. The admin uploads new versions here;
 * planners and hostesses see the newest one and get a notice in the panel when it changes.
 */
export default function AppReleases({ user, showToast, onReleasesChanged }) {
    const isAdmin = user?.role === 'admin';
    const [latest, setLatest] = useState(null);
    const [releases, setReleases] = useState([]);
    const [loading, setLoading] = useState(true);

    const [file, setFile] = useState(null);
    const [version, setVersion] = useState('');
    const [notes, setNotes] = useState('');
    const [progress, setProgress] = useState(null);
    const [error, setError] = useState(null);
    const fileRef = useRef(null);

    const load = async () => {
        const { ok, json } = await apiFetch('/api/app-releases');
        if (ok && json) {
            setLatest(json.latest);
            setReleases(json.releases || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    const handleDownload = () => {
        // Same-origin link with the session cookie: the browser saves the APK; the server marks it as seen
        window.location.href = latest.download_url;
        setTimeout(() => onReleasesChanged && onReleasesChanged(), 1500);
    };

    // XMLHttpRequest instead of fetch to show upload progress (APKs can weigh tens of MB)
    const handleUpload = (e) => {
        e.preventDefault();
        if (!file) return;
        setError(null);
        setProgress(0);

        const form = new FormData();
        form.append('apk', file);
        form.append('version', version.trim());
        if (notes.trim()) form.append('notes', notes.trim());

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/app-releases');
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (csrf) xhr.setRequestHeader('X-CSRF-TOKEN', csrf);
        xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) setProgress(Math.round((evt.loaded / evt.total) * 100));
        };
        xhr.onload = () => {
            setProgress(null);
            let json = null;
            try { json = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
            if (xhr.status >= 200 && xhr.status < 300) {
                setFile(null);
                setVersion('');
                setNotes('');
                if (fileRef.current) fileRef.current.value = '';
                showToast && showToast(json?.message || 'Versión publicada.');
                load();
                onReleasesChanged && onReleasesChanged();
            } else if (xhr.status === 413) {
                setError('El archivo supera el tamaño máximo permitido por el servidor (revisar upload_max_filesize, post_max_size y client_max_body_size).');
            } else {
                setError(json?.errors ? Object.values(json.errors).flat()[0] : json?.message || 'No se pudo subir el APK.');
            }
        };
        xhr.onerror = () => {
            setProgress(null);
            setError('Se perdió la conexión durante la subida.');
        };
        xhr.send(form);
    };

    const handleDelete = async (release) => {
        if (!window.confirm(`¿Eliminar la versión ${release.version}?`)) return;
        const { ok, json } = await apiFetch(`/api/app-releases/${release.id}`, { method: 'DELETE' });
        if (ok) {
            showToast && showToast(json?.message || 'Versión eliminada.');
            load();
            onReleasesChanged && onReleasesChanged();
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xl space-y-1">
                <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-rose-500" /> Aplicación
                </h2>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 max-w-2xl">
                    Wedding Check para Android: recepción de invitados con escaneo de QR, lista de invitados y timeline del evento.
                </p>
            </div>

            {/* Current version */}
            {loading ? (
                <div className="p-12 text-center text-xs text-zinc-500">Cargando...</div>
            ) : !latest ? (
                <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 space-y-2">
                    <Smartphone className="w-8 h-8 mx-auto text-zinc-400" />
                    <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">Todavía no hay una versión publicada</p>
                    <p>{isAdmin ? 'Subí el primer APK desde el formulario de abajo.' : 'Cuando el administrador la publique, vas a poder descargarla desde acá.'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 p-6 rounded-3xl bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-xl space-y-4">
                        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-white/80">
                            <Sparkles className="w-4 h-4" /> Última versión
                        </div>
                        <div>
                            <div className="text-3xl font-black">Versión {latest.version}</div>
                            <div className="text-xs text-white/85 mt-1">
                                Publicada el {formatDate(latest.created_at)} · {formatSize(latest.file_size)}
                            </div>
                        </div>
                        {latest.notes && (
                            <div className="p-3 rounded-2xl bg-white/15 text-xs leading-relaxed whitespace-pre-line">
                                {latest.notes}
                            </div>
                        )}
                        <button
                            onClick={handleDownload}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-rose-600 hover:bg-rose-50 text-sm font-black shadow-lg"
                        >
                            <Download className="w-5 h-5" /> Descargar APK
                        </button>
                    </div>

                    <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                        <div className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                            <Info className="w-4 h-4 text-blue-500" /> Cómo instalarla
                        </div>
                        <ol className="list-decimal pl-4 space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
                            <li>Abrí esta página desde el <strong>celular Android</strong> e iniciá sesión.</li>
                            <li>Tocá <strong>Descargar APK</strong>.</li>
                            <li>Abrí el archivo descargado. Si Android lo pide, permití <strong>instalar apps de esta fuente</strong>.</li>
                            <li>Ingresá con tu mismo usuario y contraseña del sistema.</li>
                        </ol>
                        <p className="text-[11px] text-zinc-400">Para actualizar, descargá la nueva versión e instalala encima: no se pierden los datos.</p>
                    </div>
                </div>
            )}

            {/* Admin: upload + history */}
            {isAdmin && (
                <>
                    <form onSubmit={handleUpload} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4 shadow-sm">
                        <div className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-amber-500" /> Publicar nueva versión
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Archivo APK</label>
                                <button type="button" onClick={() => fileRef.current?.click()} className={`${inputClass} flex items-center gap-2 text-left`}>
                                    <FileUp className="w-4 h-4 text-zinc-400 shrink-0" />
                                    <span className="truncate">{file ? `${file.name} · ${formatSize(file.size)}` : 'Elegir archivo .apk'}</span>
                                </button>
                                <input ref={fileRef} type="file" accept=".apk,application/vnd.android.package-archive" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Versión</label>
                                <input required value={version} onChange={(e) => setVersion(e.target.value)} className={inputClass} placeholder="1.2.0" />
                            </div>
                            <div className="sm:col-span-3">
                                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Novedades (las ven las planners)</label>
                                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="• Acreditación sincronizada entre varias puertas&#10;• Historial de movimientos por invitado" />
                            </div>
                        </div>

                        {progress !== null && (
                            <div className="space-y-1">
                                <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all" style={{ width: `${progress}%` }} />
                                </div>
                                <div className="text-[11px] text-zinc-500 font-bold">Subiendo... {progress}%</div>
                            </div>
                        )}
                        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

                        <div className="flex justify-end">
                            <button disabled={!file || !version.trim() || progress !== null} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black disabled:opacity-50">
                                <Upload className="w-4 h-4" /> Publicar versión
                            </button>
                        </div>
                    </form>

                    {releases.length > 0 && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden">
                            <div className="px-6 py-4 text-sm font-black text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800">Historial de versiones</div>
                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {releases.map((r, i) => (
                                    <div key={r.id} className="px-6 py-3 flex items-center justify-between gap-3 text-xs">
                                        <div>
                                            <div className="font-black text-zinc-900 dark:text-white">
                                                {r.version} {i === 0 && <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px]">ACTUAL</span>}
                                            </div>
                                            <div className="text-zinc-500">
                                                {formatDate(r.created_at)} · {formatSize(r.file_size)} · {r.downloads} {r.downloads === 1 ? 'descarga' : 'descargas'}
                                                {r.uploaded_by ? ` · ${r.uploaded_by}` : ''}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <a href={r.download_url} title="Descargar" className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                                <Download className="w-4 h-4" />
                                            </a>
                                            <button onClick={() => handleDelete(r)} title="Eliminar" className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
