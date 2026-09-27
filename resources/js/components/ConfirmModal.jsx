import React from 'react';
import { AlertTriangle, Trash2, HelpCircle, Send, X, AlertCircle } from 'lucide-react';

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title = '¿Estás seguro?',
    message = 'Esta acción no se puede deshacer.',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'danger',
    loading = false
}) {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (variant) {
            case 'warning':
                return <AlertCircle className="w-6 h-6 text-amber-500" />;
            case 'info':
                return <Send className="w-6 h-6 text-blue-500" />;
            case 'danger':
            default:
                return <Trash2 className="w-6 h-6 text-rose-500" />;
        }
    };

    const getIconBg = () => {
        switch (variant) {
            case 'warning':
                return 'bg-amber-50 dark:bg-amber-950/50 border-amber-200/60 dark:border-amber-800/50';
            case 'info':
                return 'bg-blue-50 dark:bg-blue-950/50 border-blue-200/60 dark:border-blue-800/50';
            case 'danger':
            default:
                return 'bg-rose-50 dark:bg-rose-950/50 border-rose-200/60 dark:border-rose-800/50';
        }
    };

    const getConfirmBtnStyle = () => {
        switch (variant) {
            case 'warning':
                return 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20';
            case 'info':
                return 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/20';
            case 'danger':
            default:
                return 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden transform transition-all scale-100">
                {/* Header */}
                <div className="p-6 pb-4 flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-2xl border ${getIconBg()} shrink-0`}>
                            {getIcon()}
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                                {title}
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                                {message}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Footer Buttons */}
                <div className="p-6 pt-2 flex items-center justify-end gap-3 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800/60 mt-4">
                    <button
                        type="button"
                        disabled={loading}
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>

                    <button
                        type="button"
                        disabled={loading}
                        onClick={onConfirm}
                        className={`px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-md active:scale-95 disabled:opacity-50 ${getConfirmBtnStyle()}`}
                    >
                        {loading ? 'Procesando...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
