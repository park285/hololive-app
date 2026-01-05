/**
 * AuthModal - 인증 모달 컴포넌트
 * 로그인/회원가입 폼을 모달 형태로 표시
 * NOTE: 별도 페이지 라우팅 없이 앱 내 어디서든 인증 가능
 */
import { useNavigate } from "react-router-dom";
import { useModalStore } from "@/stores/modalStore";
import { BaseModal } from "@/components/ui/BaseModal";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

export function AuthModal() {
    const { isAuthModalOpen, authModalView, closeAuthModal, setAuthModalView } = useModalStore();
    const navigate = useNavigate();

    /** 로그인 성공 시 모달 닫기 */
    const handleLoginSuccess = () => {
        closeAuthModal();
    };

    /** 회원가입 성공 시 로그인 뷰로 전환 */
    const handleRegisterSuccess = () => {
        setAuthModalView('login');
        // TODO: 토스트 메시지 표시 "회원가입 성공, 로그인해주세요"
    };

    /** 비밀번호 찾기는 별도 페이지로 이동 */
    const handleForgotPassword = () => {
        closeAuthModal();
        navigate('/forgot-password');
    };

    return (
        <BaseModal
            isOpen={isAuthModalOpen}
            onClose={closeAuthModal}
            maxWidth="sm"
            showHeaderBorder={false}
        >
            {authModalView === 'login' && (
                <LoginForm
                    onSwitchToRegister={() => setAuthModalView('register')}
                    onSwitchToForgotPassword={handleForgotPassword}
                    onSuccess={handleLoginSuccess}
                />
            )}
            {authModalView === 'register' && (
                <RegisterForm
                    onSwitchToLogin={() => setAuthModalView('login')}
                    onSuccess={handleRegisterSuccess}
                />
            )}
        </BaseModal>
    );
}
