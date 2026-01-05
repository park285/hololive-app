import { useSessionAuthStore } from "@/stores/sessionAuthStore";
import { useModalStore } from "@/stores/modalStore";
import { LogIn, LogOut, User } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface UserMenuProps {
    className?: string;
    compact?: boolean;
}

export function UserMenu({ className, compact = false }: UserMenuProps) {
    const { user, isAuthenticated, isLoading, logout } = useSessionAuthStore();
    const { openAuthModal } = useModalStore();
    const { t } = useTranslation();

    /** 로그인 버튼 클릭 시 인증 모달 열기 */
    const handleLogin = () => {
        openAuthModal('login');
    };

    if (isLoading) {
        if (compact) {
            return (
                <div className={`w-8 h-8 rounded-full bg-muted animate-pulse ${className}`} />
            );
        }
        return (
            <div className={`flex items-center gap-2 p-2 text-sm text-muted-foreground animate-pulse ${className}`}>
                <div className="w-8 h-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                    <div className="h-3 w-16 bg-muted rounded" />
                </div>
            </div>
        );
    }

    if (isAuthenticated && user) {
        if (compact) {
            return (
                <div className={`relative group ${className}`}>
                    <button
                        onClick={() => {
                            if (window.confirm(t('auth.logoutConfirm', 'Are you sure you want to logout?'))) {
                                logout();
                            }
                        }}
                        className="relative"
                    >
                        {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.displayName} className="w-8 h-8 rounded-full border border-border bg-background object-cover" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                                <User className="w-4 h-4" />
                            </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                    </button>
                </div>
            );
        }

        return (
            <div className={`flex items-center gap-3 p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group relative ${className}`}>
                {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.displayName} className="w-8 h-8 rounded-full border border-border bg-background object-cover" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                        <User className="w-4 h-4" />
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>

                <button
                    onClick={() => logout()}
                    className="absolute right-2 p-1.5 rounded-md bg-background/80 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                    title={t('auth.logout') || "Logout"}
                >
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
        );
    }

    if (compact) {
        return (
            <button
                onClick={handleLogin}
                className={`p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${className}`}
                title={t('auth.login') || "Login"}
            >
                <LogIn className="w-5 h-5" />
            </button>
        );
    }

    return (
        <button
            onClick={handleLogin}
            className={`flex items-center justify-center gap-2 w-full py-1.5 px-3 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm ${className}`}
        >
            <LogIn className="w-4 h-4" />
            {t('auth.login') || "Login"}
        </button>
    );
}
