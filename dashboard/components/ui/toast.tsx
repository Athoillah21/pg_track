"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, "id">) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, "id">) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { ...toast, id }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-md">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    useEffect(() => {
        const duration = toast.duration ?? 5000;
        if (duration > 0) {
            const timer = setTimeout(onClose, duration);
            return () => clearTimeout(timer);
        }
    }, [toast.duration, onClose]);

    const styles = {
        success: {
            bg: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
            icon: <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />,
            title: "text-green-900 dark:text-green-100",
            message: "text-green-700 dark:text-green-300",
            close: "text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
        },
        error: {
            bg: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
            icon: <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />,
            title: "text-red-900 dark:text-red-100",
            message: "text-red-700 dark:text-red-300",
            close: "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
        },
        warning: {
            bg: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800",
            icon: <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />,
            title: "text-yellow-900 dark:text-yellow-100",
            message: "text-yellow-700 dark:text-yellow-300",
            close: "text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
        },
        info: {
            bg: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
            icon: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
            title: "text-blue-900 dark:text-blue-100",
            message: "text-blue-700 dark:text-blue-300",
            close: "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
        },
    };

    const style = styles[toast.type];

    return (
        <div
            className={`${style.bg} border rounded-lg shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-right-full duration-300`}
        >
            {style.icon}
            <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${style.title}`}>{toast.title}</p>
                {toast.message && (
                    <p className={`text-xs mt-0.5 break-words ${style.message}`}>{toast.message}</p>
                )}
            </div>
            <button
                onClick={onClose}
                className={`${style.close} transition-colors shrink-0`}
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
