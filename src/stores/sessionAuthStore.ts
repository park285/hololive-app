// 세션 기반 인증 Store
// api.capu.blog 서버의 세션 인증을 사용하는 Zustand Store

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import { parseCommandError, type SessionAuthErrorCode } from "@/types";

// 백엔드 타입과 일치
export interface User {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    createdAt?: string;
}

export interface Session {
    token: string;
    expiresAt: string;
}

export interface AuthState {
    session: Session;
    user: User;
}

interface SessionAuthState {
    // 상태
    isAuthenticated: boolean;
    isLoading: boolean;
    user: User | null;
    session: Session | null;  // 세션 정보 (만료 시간 포함)
    error: string | null;
    errorCode: SessionAuthErrorCode | null;  // 구조화된 에러 코드

    // 액션
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, displayName: string) => Promise<void>;
    logout: () => Promise<void>;
    restoreSession: () => Promise<void>;
    refreshSession: () => Promise<void>;
    requestPasswordReset: (email: string) => Promise<void>;
    clearError: () => void;
}

// Single-flight 패턴: 동시 요청 방지
let restorePromise: Promise<void> | null = null;
let refreshPromise: Promise<void> | null = null;

export const useSessionAuthStore = create<SessionAuthState>()(
    persist(
        (set, _get) => ({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            session: null,
            error: null,
            errorCode: null,

            login: async (email, password) => {
                set({ isLoading: true, error: null, errorCode: null });
                try {
                    const result = await invoke<AuthState>("session_login", { email, password });
                    set({
                        isAuthenticated: true,
                        user: result.user,
                        session: result.session,
                        isLoading: false,
                    });
                } catch (e) {
                    const cmdError = parseCommandError(e);
                    set({ error: cmdError.message, errorCode: cmdError.code, isLoading: false });
                    throw e;
                }
            },

            register: async (email, password, displayName) => {
                set({ isLoading: true, error: null, errorCode: null });
                try {
                    await invoke<User>("session_register", { email, password, displayName });
                    set({ isLoading: false });
                    // 회원가입 성공 후 자동 로그인은 하지 않음 (사용자가 명시적으로 로그인)
                } catch (e) {
                    const cmdError = parseCommandError(e);
                    set({ error: cmdError.message, errorCode: cmdError.code, isLoading: false });
                    throw e;
                }
            },

            logout: async () => {
                set({ isLoading: true });
                try {
                    await invoke("session_logout");
                } catch (e) {
                    console.warn("Logout failed on server:", e);
                } finally {
                    // 클라이언트 상태 초기화
                    set({
                        isAuthenticated: false,
                        isLoading: false,
                        user: null,
                        session: null,
                        error: null,
                        errorCode: null,
                    });
                }
            },

            restoreSession: async () => {
                // Single-flight: 이미 진행 중인 restore가 있으면 재사용
                if (restorePromise) {
                    return restorePromise;
                }

                restorePromise = (async () => {
                    // 계층화된 캐싱 패턴:
                    // 1. localStorage 상태는 Zustand persist가 이미 복원함 (동기, 즉시)
                    // 2. 로컬 만료 시간이 충분하면 백엔드 검증 스킵
                    // 3. 만료 임박 또는 만료된 경우에만 백엔드 검증

                    const currentState = useSessionAuthStore.getState();

                    // localStorage에 인증 상태가 없으면 검증 불필요
                    if (!currentState.isAuthenticated || !currentState.session) {
                        return;
                    }

                    // 로컬 만료 시간 체크 (5분 이상 남았으면 백엔드 호출 스킵)
                    const expiresAt = new Date(currentState.session.expiresAt).getTime();
                    const now = Date.now();
                    const SKIP_VALIDATION_THRESHOLD_MS = 5 * 60 * 1000; // 5분

                    if (expiresAt - now > SKIP_VALIDATION_THRESHOLD_MS) {
                        // 세션 유효, 백엔드 검증 스킵
                        return;
                    }

                    // 백그라운드 검증 (UI blocking 없음 - isLoading 설정 안 함)
                    try {
                        const result = await invoke<AuthState | null>("session_restore");
                        if (result) {
                            // Keyring 토큰 유효 - 최신 사용자 정보로 갱신
                            set({
                                user: result.user,
                                session: result.session,
                            });
                        } else {
                            // Keyring에 토큰 없음 = 세션 만료 또는 로그아웃됨
                            set({
                                isAuthenticated: false,
                                user: null,
                                session: null,
                            });
                        }
                    } catch {
                        // 네트워크 오류 등 - localStorage 상태 유지 (오프라인 지원)
                    }
                })().finally(() => {
                    restorePromise = null;
                });

                return restorePromise;
            },

            refreshSession: async () => {
                // Single-flight: 이미 진행 중인 refresh가 있으면 재사용
                if (refreshPromise) {
                    return refreshPromise;
                }

                refreshPromise = (async () => {
                    try {
                        const result = await invoke<AuthState>("session_refresh");
                        set({ user: result.user, session: result.session });
                    } catch {
                        // 세션 갱신 실패 시 로그아웃 처리
                        set({ isAuthenticated: false, user: null, session: null });
                    } finally {
                        refreshPromise = null;
                    }
                })();

                return refreshPromise;
            },

            requestPasswordReset: async (email) => {
                set({ isLoading: true, error: null, errorCode: null });
                try {
                    await invoke("session_request_password_reset", { email });
                    set({ isLoading: false });
                } catch (e) {
                    const cmdError = parseCommandError(e);
                    set({ error: cmdError.message, errorCode: cmdError.code, isLoading: false });
                    throw e;
                }
            },

            clearError: () => set({ error: null, errorCode: null }),
        }),
        {
            name: "hololive-session-auth-storage",
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                // 영구 저장할 필드만 선택 (세션 토큰은 Rust 백엔드에서 관리)
                isAuthenticated: state.isAuthenticated,
                user: state.user,
                session: state.session,
            }),
        }
    )
);
