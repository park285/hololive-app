import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSessionAuthStore } from "@/stores/sessionAuthStore";
import { validators } from "@/lib/validation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "@/components/ui/Toast";

const REGISTER_ERROR_MESSAGES: Record<string, string> = {
    EmailExists: "이미 가입된 이메일입니다",
    InvalidInput: "입력 정보를 확인해주세요",
    NetworkError: "네트워크 연결을 확인해주세요",
    Unknown: "알 수 없는 오류가 발생했습니다",
};

export default function RegisterPage() {
    const navigate = useNavigate();
    const { register, isLoading, error, clearError } = useSessionAuthStore();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [fieldErrors, setFieldErrors] = useState<{
        email?: string;
        password?: string;
        confirmPassword?: string;
        displayName?: string;
    }>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        setFieldErrors({});

        // Validation
        const emailError = validators.email(email);
        const passwordError = validators.password(password);
        const confirmError = validators.passwordConfirm(password, confirmPassword);
        const nameError = validators.displayName(displayName);

        if (emailError || passwordError || confirmError || nameError) {
            setFieldErrors({
                email: emailError || undefined,
                password: passwordError || undefined,
                confirmPassword: confirmError || undefined,
                displayName: nameError || undefined,
            });
            return;
        }

        try {
            await register(email, password, displayName);
            // 회원가입 성공 알림 표시 후 로그인 페이지로 이동
            toast.success("회원가입이 완료되었습니다! 로그인해주세요.");
            navigate("/login");
        } catch {
            // Error handling via store state
        }
    };

    const getErrorMessage = (err: string | null) => {
        if (!err) return null;
        return REGISTER_ERROR_MESSAGES[err] || err;
    };

    // Password strength indicator logic could be added here if needed
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasLength = password.length >= 8;

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="w-full max-w-[400px] space-y-6 rounded-xl border bg-card p-8 shadow-lg">
                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold tracking-tight">회원가입</h1>
                    <p className="text-sm text-muted-foreground">
                        새로운 계정을 생성합니다
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
                        <Input
                            type="text"
                            placeholder="닉네임"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            disabled={isLoading}
                            hasError={!!fieldErrors.displayName}
                        />
                        {fieldErrors.displayName && (
                            <p className="text-xs text-destructive">{fieldErrors.displayName}</p>
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
                        {/* Password Requirements */}
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span style={{ color: hasLength ? '#27c7fe' : undefined }}>8자 이상</span>
                            <span style={{ color: hasLength && hasLetter ? '#27c7fe' : undefined }}>·</span>
                            <span style={{ color: hasLetter ? '#27c7fe' : undefined }}>영문 포함</span>
                            <span style={{ color: hasLetter && hasNumber ? '#27c7fe' : undefined }}>·</span>
                            <span style={{ color: hasNumber ? '#27c7fe' : undefined }}>숫자 포함</span>
                        </div>
                        {fieldErrors.password && (
                            <p className="text-xs text-destructive">{fieldErrors.password}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Input
                            type="password"
                            placeholder="비밀번호 확인"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isLoading}
                            hasError={!!fieldErrors.confirmPassword}
                        />
                        {fieldErrors.confirmPassword && (
                            <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>
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
                        {isLoading ? "가입 중..." : "회원가입"}
                    </Button>
                </form>

                <div className="text-center text-sm text-muted-foreground">
                    이미 계정이 있으신가요?{" "}
                    <Link
                        to="/login"
                        className="font-medium text-primary hover:underline"
                    >
                        로그인
                    </Link>
                </div>
            </div>
        </div>
    );
}
