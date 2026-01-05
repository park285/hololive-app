import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSessionAuthStore } from "@/stores/sessionAuthStore";
import { validators } from "@/lib/validation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Eye, EyeOff } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
    InvalidCredentials: "이메일 또는 비밀번호가 올바르지 않습니다",
    AccountLocked: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요",
    RateLimited: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요",
    NetworkError: "네트워크 연결을 확인해주세요",
    Unknown: "알 수 없는 오류가 발생했습니다",
};

export default function LoginPage() {
    const navigate = useNavigate();
    const { login, isLoading, error, clearError } = useSessionAuthStore();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        setFieldErrors({});

        // Validation
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
            navigate("/");
        } catch (err) {
            // Store automatically sets error, but we can access it if needed
            // Error mapping is handled by displaying the store's error state
            // or mapping raw error codes if the backend sends codes.
            // Assuming store.error might contain raw codes or messages.
            // For now, we display store.error directly or map if it matches keys.
        }
    };

    const getErrorMessage = (err: string | null) => {
        if (!err) return null;
        return ERROR_MESSAGES[err] || err;
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="w-full max-w-[400px] space-y-6 rounded-xl border bg-card p-8 shadow-lg">
                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold tracking-tight">로그인</h1>
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
                    <Link
                        to="/forgot-password"
                        className="text-muted-foreground hover:text-primary hover:underline"
                    >
                        비밀번호를 잊으셨나요?
                    </Link>
                    <div className="text-muted-foreground">
                        계정이 없으신가요?{" "}
                        <Link
                            to="/register"
                            className="font-medium text-primary hover:underline"
                        >
                            회원가입
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
