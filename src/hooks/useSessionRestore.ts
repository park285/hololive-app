import { useEffect } from "react";
import { useSessionAuthStore } from "@/stores/sessionAuthStore";

/**
 * 앱 시작 시 세션 유효성 백그라운드 검증
 * localStorage 상태는 Zustand persist가 즉시 복원하므로 UI blocking 없음
 */
export function useSessionRestore() {
    const restoreSession = useSessionAuthStore((state) => state.restoreSession);

    useEffect(() => {
        restoreSession();
    }, [restoreSession]);
}
