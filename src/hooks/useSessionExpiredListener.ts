// 세션 만료 이벤트 리스너 Hook
// Rust 백엔드에서 세션 만료 감지 시 자동 로그아웃 처리

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSessionAuthStore } from "@/stores/sessionAuthStore";

/**
 * 세션 만료 이벤트를 수신하여 자동 로그아웃 처리
 * App 또는 루트 레벨에서 한 번만 호출
 */
export function useSessionExpiredListener() {
    const isAuthenticated = useSessionAuthStore((state) => state.isAuthenticated);

    useEffect(() => {
        if (!isAuthenticated) return;

        let unlisten: (() => void) | undefined;
        let isCancelled = false;

        const setupListener = async () => {
            try {
                const unlistenFn = await listen<void>("auth:session-expired", () => {
                    console.warn("[Auth] Session expired event received, logging out");
                    // 강제 로그아웃 (서버 호출 없이 클라이언트 상태만 초기화)
                    useSessionAuthStore.setState({
                        isAuthenticated: false,
                        user: null,
                        error: null,
                        isLoading: false,
                    });
                });

                // Ghost State 방어: await 완료 시점에 이미 언마운트됐으면 즉시 정리
                if (isCancelled) {
                    unlistenFn();
                } else {
                    unlisten = unlistenFn;
                }
            } catch (error) {
                console.error("[Auth] Failed to setup session expired listener:", error);
            }
        };

        setupListener();

        return () => {
            isCancelled = true;
            unlisten?.();  // 동기적 cleanup
        };
    }, [isAuthenticated]);
}
