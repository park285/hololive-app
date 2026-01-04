import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";

// 백엔드에서 정의한 구조체와 일치시켜야 함
export interface UserProfile {
    id: string;
    email: string;
    name: string;
    picture?: string;
}

export interface AuthData {
    access_token: string;
    refresh_token?: string;
    expires_at: number; // Unix 타임스탬프
    user: UserProfile;
}

interface AuthState {
    // 상태
    isAuthenticated: boolean;
    isLoading: boolean;
    user: UserProfile | null;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: number | null;
    error: string | null;

    // 액션
    startLogin: () => Promise<void>;
    logout: () => Promise<void>;
    refreshAccessToken: () => Promise<void>;
    initializeListener: () => Promise<UnlistenFn>;

    // 내부 setter
    setAuthData: (data: AuthData) => void;
    setError: (error: string) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            error: null,

            startLogin: async () => {
                set({ isLoading: true, error: null });
                try {
                    // 백엔드에 로그인 시작 요청 (로컬 서버 시작 및 URL 생성)
                    const response = await invoke<{ auth_url: string; port: number }>("start_google_login");
                    console.log("Login started, opening URL:", response.auth_url);

                    // 시스템 브라우저로 인증 URL 열기
                    await openUrl(response.auth_url);
                } catch (err) {
                    console.error("Failed to start login:", err);
                    set({
                        isLoading: false,
                        error: err instanceof Error ? err.message : "로그인 시작 실패"
                    });
                }
            },

            logout: async () => {
                const { accessToken } = get();
                set({ isLoading: true });
                try {
                    if (accessToken) {
                        await invoke("logout", { accessToken });
                    }
                } catch (err) {
                    console.warn("Logout failed on server:", err);
                } finally {
                    // 클라이언트 상태 초기화
                    set({
                        isAuthenticated: false,
                        isLoading: false,
                        user: null,
                        accessToken: null,
                        refreshToken: null,
                        expiresAt: null,
                        error: null,
                    });
                }
            },

            refreshAccessToken: async () => {
                const { refreshToken } = get();
                if (!refreshToken) return;

                try {
                    const response = await invoke<{ access_token: string; expires_in: number }>("refresh_token", {
                        refreshToken,
                    });

                    const expiresAt = Math.floor(Date.now() / 1000) + response.expires_in;

                    set({
                        accessToken: response.access_token,
                        expiresAt,
                    });
                } catch (err) {
                    console.error("Failed to refresh token:", err);
                    // 갱신 실패 시 로그아웃 처리
                    get().logout();
                }
            },

            setAuthData: (data: AuthData) => {
                set({
                    isAuthenticated: true,
                    isLoading: false,
                    user: data.user,
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token || get().refreshToken, // 기존 refresh token 유지
                    expiresAt: data.expires_at,
                    error: null,
                });
            },

            setError: (error: string) => {
                set({ isLoading: false, error });
            },

            initializeListener: async () => {
                // 백엔드 이벤트 리스너 설정 (Desktop용)
                const unlistenSuccess = await listen<AuthData>("oauth-success", (event) => {
                    console.log("OAuth success event received");
                    get().setAuthData(event.payload);
                });

                const unlistenError = await listen<string>("oauth-error", (event) => {
                    console.error("OAuth error event received:", event.payload);
                    get().setError(event.payload);
                });

                // Deep Link 리스너 설정 (Mobile용 프록시 방식)
                let unlistenDeepLink: (() => void) | undefined;
                try {
                    unlistenDeepLink = await onOpenUrl(async (urls: string[]) => {
                        for (const url of urls) {
                            console.log("Deep link received:", url);

                            // hololive-app://callback?code=XXX&state=YYY 형태
                            if (url.startsWith("hololive-app://callback")) {
                                await handleDeepLinkCallback(url, get);
                            }
                        }
                    });
                } catch (err) {
                    // Desktop에서는 Deep Link 플러그인이 다르게 동작할 수 있음
                    console.log("Deep link listener not available (expected on desktop):", err);
                }

                // 클린업 함수 반환
                return () => {
                    unlistenSuccess();
                    unlistenError();
                    unlistenDeepLink?.();
                };
            },
        }),
        {
            name: "hololive-auth-storage",
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                // 영구 저장할 필드만 선택
                isAuthenticated: state.isAuthenticated,
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                expiresAt: state.expiresAt,
            }),
        }
    )
);

async function handleDeepLinkCallback(url: string, get: () => AuthState) {
    const parsedUrl = new URL(url);
    const code = parsedUrl.searchParams.get("code");
    const state = parsedUrl.searchParams.get("state");
    const error = parsedUrl.searchParams.get("error");
    const errorDescription = parsedUrl.searchParams.get("error_description");

    if (error) {
        get().setError(errorDescription ?? error);
        return;
    }

    if (code && state) {
        try {
            const authData = await invoke<AuthData>("handle_deep_link_callback", {
                code,
                state,
            });
            get().setAuthData(authData);
        } catch (err) {
            get().setError(
                err instanceof Error ? err.message : "인증 실패"
            );
        }
    }
}
