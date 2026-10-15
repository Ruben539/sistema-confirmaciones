import React, { useState, useEffect, useRef } from 'react';
import { Settings, Save, X, Sparkles, MessageSquare, Heart, Calendar, MapPin, User, ShieldCheck, Image as ImageIcon, Upload, Trash2, Eye, Smartphone, Check } from 'lucide-react';
import GoogleLocationPicker from './GoogleLocationPicker';
import DateInput from './DateInput';
import { getPlan, planIncludesDigitalInvitation } from '../plans';
import { apiFetch } from '../api';

export default function EventSettingsModal({ isOpen, onClose, event, user, onSave }) {
    const [formData, setFormData] = useState({
        title: '',
        couple_names: '',
        event_date: '',
        rsvp_deadline_date: '',
        reminder_interval_days: '',
        reminder_max_count: 3,
        location: '',
        message_template: '',
        user_id: '',
        digital_invitation_addon: false,
    });
    const [planners, setPlanners] = useState([]);
    const [loading, setLoading] = useState(false);

    // Flyer / Cover photo state
    const [coverPhotoFile, setCoverPhotoFile] = useState(null);
    const [coverPreview, setCoverPreview] = useState(null);
    const [isRemovingCover, setIsRemovingCover] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const fileInputRef = useRef(null);

    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        if (event) {
            setFormData({
                title: event.title || '',
                couple_names: event.couple_names || '',
                event_date: event.event_date || '',
                rsvp_deadline_date: event.rsvp_deadline_date || '',
                reminder_interval_days: event.reminder_interval_days ?? '',
                reminder_max_count: event.reminder_max_count ?? 3,
                location: event.location || '',
                message_template: event.message_template || "¡Hola {nombre}! Te invitamos al evento de {pareja} ✨\n\nRespondé directamente a este mensaje:\n1️⃣ 1 - Confirmar Asistencia\n2️⃣ 2 - No podré asistir",
                user_id: event.user_id || '',
                digital_invitation_addon: Boolean(event.digital_invitation_addon),
            });
            setCoverPreview(event.cover_photo_url || null);
            setCoverPhotoFile(null);
            setIsRemovingCover(false);
        }
        if (isOpen && isAdmin) {
            fetchPlanners();
        }
    }, [event, isOpen, user]);

    const fetchPlanners = async () => {
        try {
            const { ok, json } = await apiFetch('/api/planners');
            if (ok && json) {
                setPlanners(json);
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (!isOpen) return null;

    // Client-side image optimization
    const compressImage = (file, maxWidth = 1920, maxHeight = 1920, quality = 0.85) => {
        if (!file.type.startsWith('image/') || file.size < 1.2 * 1024 * 1024) {
            return Promise.resolve(file);
        }
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
                    }, 'image/jpeg', quality);
                };
            };
        });
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const optimized = await compressImage(file);
        setCoverPhotoFile(optimized);
        setCoverPreview(URL.createObjectURL(optimized));
        setIsRemovingCover(false);
    };

    const handleRemoveCover = () => {
        setCoverPhotoFile(null);
        setCoverPreview(null);
        setIsRemovingCover(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');

            if (isRemovingCover) {
                await fetch(`/api/events/${event.id}/cover-photo`, {
                    method: 'DELETE',
                    headers: {
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                });
            } else if (coverPhotoFile) {
                const photoData = new FormData();
                photoData.append('photo', coverPhotoFile);
                await fetch(`/api/events/${event.id}/cover-photo`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: photoData
                });
            }

            await onSave(event.id, formData);
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Formatted preview message
    const previewMessageText = (formData.message_template || '')
        .replace(/\{nombre\}/g, 'Juan Pérez')
        .replace(/\{pareja\}/g, formData.couple_names || formData.title || 'nosotros')
        .replace(/\{lugares\}/g, '3 personas')
        .replace(/\{lugar\}/g, formData.location || 'Salón de Eventos')
        .replace(/\{link\}/g, `${window.location.origin}/confirmar/ejemplo`);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/75 backdrop-blur-md animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[90vh] overflow-hidden">
                    {/* Header (Fixed) */}
                    <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-900/80 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl text-rose-600 dark:text-rose-400 border border-rose-200/50">
                                <Settings className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Configuración del Evento</h2>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Personalizá los detalles, la tarjeta de invitación y la plantilla de WhatsApp.</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Form Body (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                        {/* Planner Assignment Bar */}
                        <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60">
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                                <User className="w-4 h-4 text-amber-500" /> Wedding Planner Asignada/o
                            </label>

                            {isAdmin ? (
                                <select
                                    value={formData.user_id}
                                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                                    className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-2.5 font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                                >
                                    <option value="">-- Sin Asignar --</option>
                                    {planners.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 pt-1">
                                    <span className="bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-3 py-1 rounded-xl">
                                        {event?.planner?.name || user?.name || 'Asignado a ti'}
                                    </span>
                                    <span className="text-[11px] text-zinc-400 font-normal italic">(Asignado por el Administrador)</span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                    <Heart className="w-3.5 h-3.5 text-rose-500" /> Título del Evento *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                                    placeholder="ej: Evento Anual / Boda Sofía & Mateo / XV de Valentina"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                    <Heart className="w-3.5 h-3.5 text-amber-500" /> Nombres de la Pareja / Anfitriones
                                </label>
                                <input
                                    type="text"
                                    value={formData.couple_names}
                                    onChange={(e) => setFormData({ ...formData, couple_names: e.target.value })}
                                    className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                                    placeholder="Sofía & Mateo"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-blue-500" /> Fecha del Evento
                                </label>
                                <DateInput
                                    value={formData.event_date}
                                    onChange={(date) => setFormData({ ...formData, event_date: date })}
                                    className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-amber-500" /> Fecha Límite de Confirmación (RSVP)
                                </label>
                                <DateInput
                                    value={formData.rsvp_deadline_date}
                                    max={formData.event_date || undefined}
                                    onChange={(date) => setFormData({ ...formData, rsvp_deadline_date: date })}
                                    className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                                    Los invitados pueden confirmar hasta las 23:59 de este día. Si lo dejás vacío se usa el plazo de {event?.rsvp_deadline_days ?? 7} días antes del evento.
                                </p>
                            </div>

                            <div className={formData.reminder_interval_days > 0 ? '' : 'sm:col-span-2'}>
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                    <MessageSquare className="w-3.5 h-3.5 text-amber-500" /> Recordatorios a invitados pendientes
                                </label>
                                <select
                                    value={formData.reminder_interval_days}
                                    onChange={(e) => setFormData({ ...formData, reminder_interval_days: e.target.value === '' ? '' : Number(e.target.value) })}
                                    className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                                >
                                    <option value="">Uno solo, el día antes de la fecha límite</option>
                                    <option value={1}>Cada 1 día</option>
                                    <option value={2}>Cada 2 días</option>
                                    <option value={3}>Cada 3 días</option>
                                    <option value={5}>Cada 5 días</option>
                                    <option value={7}>Cada 7 días</option>
                                    <option value={0}>No enviar recordatorios</option>
                                </select>
                            </div>

                            {formData.reminder_interval_days > 0 && (
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                        Máximo de recordatorios por invitado
                                    </label>
                                    <select
                                        value={formData.reminder_max_count}
                                        onChange={(e) => setFormData({ ...formData, reminder_max_count: Number(e.target.value) })}
                                        className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                                    >
                                        {[1, 2, 3, 4, 5].map((n) => (
                                            <option key={n} value={n}>{n} {n === 1 ? 'recordatorio' : 'recordatorios'}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <p className="sm:col-span-2 text-[10px] text-zinc-500 dark:text-zinc-400 -mt-2">
                                {formData.reminder_interval_days > 0
                                    ? `Se envía a quienes recibieron la invitación y no respondieron, cada ${formData.reminder_interval_days} ${formData.reminder_interval_days === 1 ? 'día' : 'días'} desde el último mensaje, hasta la fecha límite.`
                                    : formData.reminder_interval_days === 0
                                        ? 'No se enviarán recordatorios automáticos para este evento.'
                                        : 'Se envía un único recordatorio a los pendientes el día anterior a la fecha límite.'}
                                {' '}Siempre se respetan las pausas entre mensajes, el límite diario y el horario de envío (9 a 21 h).
                            </p>
                        </div>

                        {/* Invitación Digital: incluida según el plan o habilitada como adicional pago */}
                        {isAdmin && (
                            <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                                {planIncludesDigitalInvitation(event?.plan_type) ? (
                                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                                        <span>Invitación Digital incluida en el {getPlan(event?.plan_type).label}</span>
                                    </div>
                                ) : (
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.digital_invitation_addon}
                                            onChange={(e) => setFormData({ ...formData, digital_invitation_addon: e.target.checked })}
                                            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                                                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Habilitar Invitación Digital (adicional)
                                            </span>
                                            <span className="text-[10px] text-amber-700 dark:text-amber-400 block">
                                                Es un servicio adicional que no incluye ningún plan. Activala solo si el cliente la contrató.
                                            </span>
                                        </div>
                                    </label>
                                )}
                            </div>
                        )}

                        {/* Google Maps Location Search & Map Picker */}
                        <div className="pt-1">
                            <GoogleLocationPicker
                                value={formData.location}
                                onChange={(loc) => setFormData({ ...formData, location: loc })}
                                placeholder="Buscar ciudad, calle, barrio o local..."
                            />
                        </div>

                        {/* Flyer / Invitation Card Section */}
                        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                    <ImageIcon className="w-4 h-4 text-rose-500" />
                                    <span>Tarjeta o Flyer de Invitación (WhatsApp)</span>
                                </label>
                                {coverPreview && (
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Imagen Adjunta
                                    </span>
                                )}
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                className="hidden"
                                onChange={handleFileSelect}
                            />

                            {coverPreview ? (
                                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-700/80">
                                    <div className="relative group shrink-0">
                                        <img
                                            src={coverPreview}
                                            alt="Flyer de Invitación"
                                            className="w-28 h-36 sm:w-24 sm:h-32 object-cover rounded-xl shadow-md border border-zinc-200 dark:border-zinc-700"
                                        />
                                    </div>

                                    <div className="flex-1 space-y-2 text-center sm:text-left">
                                        <div>
                                            <p className="text-xs font-bold text-zinc-900 dark:text-white">Tarjeta de invitación activa</p>
                                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                                Esta imagen se enviará en WhatsApp en la cabecera del mensaje con tu texto debajo como pie de foto (*caption*).
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-all"
                                            >
                                                <Upload className="w-3.5 h-3.5" /> Cambiar Imagen
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleRemoveCover}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Quitar Imagen
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowPreview(!showPreview)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-all"
                                            >
                                                <Smartphone className="w-3.5 h-3.5" /> {showPreview ? 'Ocultar Vista Previa' : 'Ver en WhatsApp'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-rose-400 dark:hover:border-rose-500 rounded-2xl bg-white dark:bg-zinc-900/50 hover:bg-rose-50/30 transition-all text-center cursor-pointer group"
                                >
                                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-2xl text-rose-500 group-hover:scale-110 transition-transform">
                                        <Upload className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">Subir Tarjeta o Flyer de la Fiesta</span>
                                        <span className="text-[11px] text-zinc-400">Recomendado formato vertical (JPG, PNG o WEBP). Se enviará en el mensaje de WhatsApp.</span>
                                    </div>
                                </button>
                            )}
                        </div>

                        {/* WhatsApp Template */}
                        <div className="pt-2">
                            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                    <MessageSquare className="w-3.5 h-3.5 text-green-500" /> Plantilla de Mensaje de WhatsApp
                                </span>
                                <span className="text-[11px] text-zinc-400 font-normal">Variables: &#123;nombre&#125;, &#123;pareja&#125;, &#123;lugar&#125;, &#123;lugares&#125;, &#123;link&#125;</span>
                            </label>
                            <textarea
                                rows={5}
                                value={formData.message_template}
                                onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                                className="w-full text-xs rounded-xl border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 font-medium focus:ring-2 focus:ring-rose-500 outline-none leading-relaxed"
                            />
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                                En invitaciones de 2 o más personas se agrega solo «🎟️ Lugares reservados: 5 personas» antes de «Respondé…». Usá &#123;lugares&#125; si querés ubicarlo vos.
                            </p>
                        </div>

                        {/* Interactive WhatsApp Live Preview */}
                        <div className="pt-1">
                            <button
                                type="button"
                                onClick={() => setShowPreview(!showPreview)}
                                className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                            >
                                <Smartphone className="w-4 h-4" />
                                <span>{showPreview ? 'Ocultar vista previa de WhatsApp' : 'Ver cómo se verá el mensaje en WhatsApp'}</span>
                            </button>

                            {showPreview && (
                                <div className="mt-3 p-4 bg-emerald-950/20 dark:bg-zinc-950 border border-emerald-500/30 rounded-2xl">
                                    <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <Smartphone className="w-3.5 h-3.5" /> Vista Previa Real en WhatsApp
                                    </div>
                                    <div className="max-w-sm mx-auto bg-white dark:bg-[#1f2c34] text-zinc-900 dark:text-zinc-100 rounded-2xl shadow-xl overflow-hidden border border-zinc-200 dark:border-zinc-700/80">
                                        {coverPreview && (
                                            <div className="w-full bg-zinc-900 max-h-72 overflow-hidden flex items-center justify-center">
                                                <img
                                                    src={coverPreview}
                                                    alt="Flyer en WhatsApp"
                                                    className="w-full object-contain max-h-72"
                                                />
                                            </div>
                                        )}
                                        <div className="p-3 text-xs whitespace-pre-line leading-relaxed font-sans">
                                            {previewMessageText}
                                            <div className="text-right text-[10px] text-zinc-400 mt-1 flex items-center justify-end gap-1">
                                                <span>19:45</span>
                                                <span className="text-emerald-500 font-bold">✓✓</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Footer (Fixed Pinned) */}
                    <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3 bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur-sm shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold transition-all shadow-md hover:bg-rose-600 dark:hover:bg-rose-400 dark:hover:text-white disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            <span>{loading ? 'Guardando...' : 'Guardar Cambios'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
