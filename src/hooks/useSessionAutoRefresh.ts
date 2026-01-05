import { useEffect } from "react";
import { useSessionAuthStore } from "@/stores/sessionAuthStore";

const REFRESH_BEFORE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24시간

export function useSessionAutoRefresh() {
    const { isAuthenticated, refreshSession } = useSessionAuthStore();
    const session = useSessionAuthStore((state) => state.session);

    useEffect(() => {
        if (!isAuthenticated || !session?.expiresAt) return;

        const expiresAt = new Date(session.expiresAt).getTime();
        const now = Date.now();
        const timeUntilRefresh = expiresAt - now - REFRESH_BEFORE_EXPIRY_MS;

        if (timeUntilRefresh <= 0) {
            // 이미 갱신 시점 도달
            refreshSession();
            return;
        }

        const timer = setTimeout(() => {
            refreshSession();
        }, timeUntilRefresh);

        return () => clearTimeout(timer);
    }, [isAuthenticated, session?.expiresAt, refreshSession]);
}
