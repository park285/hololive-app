// 간단한 Toast 알림 컴포넌트
// 성공/에러 메시지를 화면 하단에 표시

import { useEffect, useState } from "react";
import { create } from "zustand";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastStore {
    toasts: ToastMessage[];
    addToast: (type: ToastType, message: string, duration?: number) => void;
    removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
    toasts: [],
    addToast: (type, message, duration = 3000) => {
        const id = `${Date.now()}-${Math.random()}`;
        set((state) => ({
            toasts: [...state.toasts, { id, type, message, duration }],
        }));

        // 자동 제거
        if (duration > 0) {
            setTimeout(() => {
                set((state) => ({
                    toasts: state.toasts.filter((t) => t.id !== id),
                }));
            }, duration);
        }
    },
    removeToast: (id) =>
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        })),
}));

// 편의 함수
export const toast = {
    success: (message: string, duration?: number) =>
        useToastStore.getState().addToast("success", message, duration),
    error: (message: string, duration?: number) =>
        useToastStore.getState().addToast("error", message, duration),
    info: (message: string, duration?: number) =>
        useToastStore.getState().addToast("info", message, duration),
};

function ToastItem({ toast: t, onRemove }: { toast: ToastMessage; onRemove: () => void }) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // 마운트 후 애니메이션 시작
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const icons = {
        success: <CheckCircle className="h-5 w-5 text-green-400" />,
        error: <XCircle className="h-5 w-5 text-red-400" />,
        info: <Info className="h-5 w-5 text-blue-400" />,
    };

    const bgColors = {
        success: "bg-green-500/10 border-green-500/30",
        error: "bg-red-500/10 border-red-500/30",
        info: "bg-blue-500/10 border-blue-500/30",
    };

    return (
        <div
            className={`
                flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm
                transition-all duration-300 ease-out
                ${bgColors[t.type]}
                ${isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}
            `}
        >
            {icons[t.type]}
            <span className="flex-1 text-sm text-foreground">{t.message}</span>
            <button
                onClick={onRemove}
                className="text-muted-foreground hover:text-foreground transition-colors"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

export function ToastContainer() {
    const { toasts, removeToast } = useToastStore();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 left-1/2 z-[9999] flex -translate-x-1/2 flex-col gap-2">
            {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
            ))}
        </div>
    );
}
