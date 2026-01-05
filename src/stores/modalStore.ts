/**
 * 모달 상태 관리 스토어
 * 인증 모달(로그인/회원가입)의 열림/닫힘 상태와 현재 뷰를 관리
 */
import { create } from 'zustand';

/** 인증 모달에서 표시할 수 있는 뷰 타입 */
export type AuthView = 'login' | 'register' | 'forgot-password';

interface ModalState {
    /** 인증 모달 열림 여부 */
    isAuthModalOpen: boolean;
    /** 현재 표시 중인 인증 뷰 */
    authModalView: AuthView;
    /** 인증 모달 열기 (기본: 로그인 뷰) */
    openAuthModal: (view?: AuthView) => void;
    /** 인증 모달 닫기 */
    closeAuthModal: () => void;
    /** 인증 모달 뷰 전환 */
    setAuthModalView: (view: AuthView) => void;
}

export const useModalStore = create<ModalState>((set) => ({
    isAuthModalOpen: false,
    authModalView: 'login',
    openAuthModal: (view = 'login') => set({ isAuthModalOpen: true, authModalView: view }),
    closeAuthModal: () => set({ isAuthModalOpen: false }),
    setAuthModalView: (view) => set({ authModalView: view }),
}));
