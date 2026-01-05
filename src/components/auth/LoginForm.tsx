/**
 * LoginForm - 로그인 폼 컴포넌트
 * 모달 내부에서 사용되는 재사용 가능한 로그인 UI
 */
import { useState } from "react";
import { useSessionAuthStore } from "@/stores/sessionAuthStore";
import { validators } from "@/lib/validation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Eye, EyeOff } from "lucide-react";

interface LoginFormProps {
    /** 회원가입 뷰로 전환 */
    onSwitchToRegister: () => void;
    /** 비밀번호 찾기 뷰로 전환 */
    onSwitchToForgotPassword: () => void;
    /** 로그인 성공 시 호출 */
    onSuccess: () => void;
}

/** 백엔드 에러 코드 → 사용자 친화적 메시지 매핑 */
const ERROR_MESSAGES: Record<string, string> = {
    InvalidCredentials: "이메일 또는 비밀번호가 올바르지 않습니다",
    AccountLocked: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요",
    RateLimited: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요",
    NetworkError: "네트워크 연결을 확인해주세요",
    Unknown: "알 수 없는 오류가 발생했습니다",
};

export function LoginForm({ onSwitchToRegister, onSwitchToForgotPassword, onSuccess }: LoginFormProps) {
    const { login, isLoading, error, clearError } = useSessionAuthStore();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        setFieldErrors({});

        const emailError = validators.email(email);
        const passwordError = validators.password(password);

        if (emailError || passwordError) {
            setFieldErrors({
                email: emailError || undefined,
                password: passwordError || undefined,
            });
            return;
        }

        try {
            await login(email, password);
            onSuccess();
        } catch (err) {
            // Error is handled by store state
        }
    };

    const getErrorMessage = (err: string | null) => {
        if (!err) return null;
        return ERROR_MESSAGES[err] || err;
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold tracking-tight">로그인</h2>
                <p className="text-sm text-muted-foreground">
                    이메일과 비밀번호로 로그인해주세요
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Input
                        type="email"
                        placeholder="이메일"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        hasError={!!fieldErrors.email}
                    />
                    {fieldErrors.email && (
                        <p className="text-xs text-destructive">{fieldErrors.email}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="relative">
                        <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="비밀번호"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            hasError={!!fieldErrors.password}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                    {fieldErrors.password && (
                        <p className="text-xs text-destructive">{fieldErrors.password}</p>
                    )}
                </div>

                {error && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {getErrorMessage(error)}
                    </div>
                )}

                <Button
                    type="submit"
                    className="w-full"
                    size="sm"
                    disabled={isLoading}
                >
                    {isLoading ? "로그인 중..." : "로그인"}
                </Button>
            </form>

            <div className="flex flex-col gap-2 text-center text-sm">
                <button
                    type="button"
                    onClick={onSwitchToForgotPassword}
                    className="text-muted-foreground hover:text-primary hover:underline"
                >
                    비밀번호를 잊으셨나요?
                </button>
                <div className="text-muted-foreground">
                    계정이 없으신가요?{" "}
                    <button
                        type="button"
                        onClick={onSwitchToRegister}
                        className="font-medium text-primary hover:underline"
                    >
                        회원가입
                    </button>
                </div>
            </div>
        </div>
    );
}
