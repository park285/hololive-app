import { useState } from "react";
import { Link } from "react-router-dom";
import { useSessionAuthStore } from "@/stores/sessionAuthStore";
import { validators } from "@/lib/validation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
    const { requestPasswordReset, isLoading, error, clearError } = useSessionAuthStore();

    const [email, setEmail] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);
    const [fieldError, setFieldError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        setFieldError(null);
        setIsSuccess(false);

        const emailError = validators.email(email);
        if (emailError) {
            setFieldError(emailError);
            return;
        }

        try {
            await requestPasswordReset(email);
            setIsSuccess(true);
        } catch (err) {
            // Error handling
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="w-full max-w-[400px] space-y-6 rounded-xl border bg-card p-8 shadow-lg">
                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold tracking-tight">비밀번호 찾기</h1>
                    <p className="text-sm text-muted-foreground">
                        가입한 이메일 주소를 입력해주세요
                    </p>
                </div>

                {isSuccess ? (
                    <div className="space-y-4 text-center">
                        <div className="rounded-md bg-green-500/10 p-4 text-sm text-green-500">
                            등록된 이메일이라면 재설정 링크가 전송됩니다.
                            <br />
                            (현재 서버 구현: 토큰 생성만 수행됨)
                        </div>
                        <Link to="/login">
                            <Button variant="outline" className="w-full">
                                로그인 페이지로 돌아가기
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="email"
                                placeholder="이메일"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                                hasError={!!fieldError}
                            />
                            {fieldError && (
                                <p className="text-xs text-destructive">{fieldError}</p>
                            )}
                        </div>

                        {error && (
                            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? "요청 중..." : "비밀번호 재설정 링크 받기"}
                        </Button>
                    </form>
                )}

                <div className="text-center">
                    <Link
                        to="/login"
                        className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        로그인으로 돌아가기
                    </Link>
                </div>
            </div>
        </div>
    );
}
