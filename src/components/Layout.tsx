import { Link, useLocation } from "react-router-dom";
import {
    LayoutDashboard,
    Users,
    Bell,
    Settings,
    Menu,
    X,
    Play,
    LayoutGrid,
    LogOut,
    LogIn,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSessionAuthStore } from "@/stores/sessionAuthStore";
import { useModalStore } from "@/stores/modalStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useSidebarStore } from "@/stores/sidebarStore";

/**
 * 네비게이션 메뉴 아이템의 구조를 정의합니다.
 */
interface NavItem {
    id: string;
    labelKey: string;
    href: string;
    icon: React.ElementType;
}

const navItems: NavItem[] = [
    { id: 'dashboard', labelKey: "nav.dashboard", href: "/", icon: LayoutDashboard },
    { id: 'multiview', labelKey: "nav.multiview", href: "/multiview", icon: LayoutGrid },
    { id: 'members', labelKey: "nav.members", href: "/members", icon: Users },
    { id: 'alarms', labelKey: "nav.alarms", href: "/alarms", icon: Bell },
    { id: 'settings', labelKey: "nav.settings", href: "/settings", icon: Settings },
];

/**
 * 앱의 메인 레이아웃 컴포넌트입니다.
 * 제공된 최신 디자인 가이드를 준수하여 Glassmorphism, Gradient, Dark Mode를 적용했습니다.
 */
export function Layout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const { t } = useTranslation();
    const isMobile = useIsMobile();

    // Auth Store & Modal
    const { isAuthenticated, logout, user } = useSessionAuthStore();
    const { openAuthModal } = useModalStore();

    // 사이드바 상태 관리 (Zustand Store)
    const {
        isSidebarOpen,
        setSidebarOpen,
        isSidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebarCollapsed
    } = useSidebarStore();

    // 페이지 이동 시 사이드바 닫기 (모바일)
    useEffect(() => {
        setSidebarOpen(false);
        window.scrollTo(0, 0);
    }, [location.pathname, setSidebarOpen]);

    const handleLogout = () => {
        if (window.confirm(t('auth.logoutConfirm', 'Are you sure you want to logout?'))) {
            logout();
        }
    };

    const handleLogin = () => {
        openAuthModal('login');
    };

    // 현재 페이지 타이틀 찾기
    const currentNav = navItems.find(item => item.href === location.pathname) || navItems[0];
    const pageTitle = t(currentNav.labelKey);

    const SidebarContent = (
        <>
            {/* 로고 영역 */}
            <div className={cn(
                "h-20 flex items-center shrink-0 transition-all duration-300 border-b border-border/40",
                isSidebarCollapsed ? "justify-center px-0" : "justify-between px-4"
            )}>
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="shrink-0 w-8 h-8 bg-gradient-to-br from-sky-400 to-cyan-400 rounded-lg flex items-center justify-center shadow-md shadow-sky-500/20">
                        <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                    </div>
                    <span className={cn(
                        "text-lg font-bold bg-gradient-to-r from-sky-500 to-cyan-500 bg-clip-text text-transparent whitespace-nowrap transition-all duration-300",
                        isSidebarCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                    )}>
                        Hololive
                    </span>
                </div>
            </div>

            {/* Toggle Handles */}
            {!isMobile && (
                <button
                    onClick={toggleSidebarCollapsed}
                    className="absolute right-0 translate-x-1/2 top-24 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
                >
                    {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            )}

            {/* 네비게이션 */}
            <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto scrollbar-hide">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                        <Link
                            key={item.id}
                            to={item.href}
                            title={isSidebarCollapsed ? t(item.labelKey) : undefined}
                            className={cn(
                                "flex items-center px-3 py-3.5 rounded-xl transition-all duration-200 group relative overflow-hidden",
                                isActive
                                    ? "bg-sky-50 text-sky-600 shadow-sm shadow-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:shadow-none"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200",
                                isSidebarCollapsed && "justify-center"
                            )}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-sky-500 rounded-r-full" />
                            )}

                            <item.icon
                                size={22}
                                strokeWidth={isActive ? 2.5 : 2}
                                className={cn(
                                    "shrink-0 transition-colors",
                                    isActive
                                        ? "text-sky-500 dark:text-sky-400"
                                        : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                                )}
                            />

                            <span
                                className={cn(
                                    "ml-3 font-medium whitespace-nowrap transition-all duration-300",
                                    isSidebarCollapsed ? "w-0 opacity-0 overflow-hidden ml-0" : "w-auto opacity-100"
                                )}
                            >
                                {t(item.labelKey)}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            {/* Holodex Credit Footer */}
            <div className={cn(
                "px-4 pb-2 text-center transition-all duration-300",
                isSidebarCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100 h-auto"
            )}>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    Powered by <a href="https://holodex.net" target="_blank" rel="noopener noreferrer" className="font-bold text-[#5a9bf5] hover:text-[#4c84d1] transition-colors">Holodex</a>
                </p>
            </div>

            {/* 유저 프로필 / 로그아웃 */}
            <div className="p-4 border-t border-border/40">
                {isAuthenticated ? (
                    <>
                        <div className={cn(
                            "flex items-center gap-3 mb-4 transition-all duration-300",
                            isSidebarCollapsed ? "justify-center" : "px-2"
                        )}>
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sky-400 to-cyan-400 p-[2px] shrink-0 shadow-md shadow-sky-500/20">
                                <div className="h-full w-full rounded-full bg-white dark:bg-slate-100 flex items-center justify-center overflow-hidden">
                                    {user?.avatarUrl ? (
                                        <img src={user.avatarUrl} alt="User" className="h-full w-full object-cover" />
                                    ) : (
                                        <span className="font-bold text-sm bg-gradient-to-r from-sky-500 to-cyan-500 bg-clip-text text-transparent">
                                            {user?.displayName?.[0]?.toUpperCase() ?? "U"}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className={cn(
                                "flex flex-col min-w-0 transition-all duration-300",
                                isSidebarCollapsed ? "w-0 opacity-0 hidden" : "w-full opacity-100"
                            )}>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                                    {user?.displayName ?? "Unknown User"}
                                </span>
                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">
                                    {user?.email ?? ""}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className={cn(
                                "flex items-center w-full p-3.5 rounded-xl hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors group dark:hover:bg-rose-900/10 dark:text-slate-400 dark:hover:text-rose-400",
                                isSidebarCollapsed ? "justify-center px-0" : "justify-start"
                            )}
                            title={t('auth.logout')}
                        >
                            <LogOut size={20} className="group-hover:stroke-rose-600 dark:group-hover:stroke-rose-400 transition-colors" />
                            {!isSidebarCollapsed && <span className="ml-3 font-medium">{t('auth.logout')}</span>}
                        </button>
                    </>
                ) : (
                    <button
                        onClick={handleLogin}
                        className={cn(
                            "flex items-center w-full p-3.5 rounded-xl hover:bg-sky-50 text-slate-500 hover:text-sky-600 transition-colors group dark:hover:bg-sky-900/10 dark:text-slate-400 dark:hover:text-sky-400",
                            isSidebarCollapsed ? "justify-center px-0" : "justify-start"
                        )}
                        title={t('auth.login')}
                    >
                        <LogIn size={20} className="group-hover:stroke-sky-600 dark:group-hover:stroke-sky-400 transition-colors" />
                        {!isSidebarCollapsed && <span className="ml-3 font-medium">{t('auth.login')}</span>}
                    </button>
                )}
            </div>
        </>
    );

    const isMultiview = location.pathname === '/multiview';

    return (
        <div className="flex h-[100dvh] bg-slate-50 dark:bg-background overflow-hidden font-display selection:bg-sky-200 dark:selection:bg-sky-900">
            {/* 동적 배경 (미묘한 효과) - Multiview에서는 제거하거나 단순화할 수 있음 */}
            {!isMultiview && (
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-sky-50/50 to-transparent dark:from-sky-900/10"></div>
                </div>
            )}

            {/* 사이드바 (Mobile Overlay / Desktop Static) */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-40 bg-white/80 dark:bg-card/80 backdrop-blur-xl border-r border-slate-200 dark:border-border/50 flex flex-col transition-[width,transform] duration-300 ease-in-out shadow-sm",
                    isMobile
                        ? (isSidebarOpen ? "translate-x-0 w-[180px] rounded-r-3xl shadow-2xl border-r-0" : "-translate-x-full w-[180px] rounded-r-3xl border-r-0")
                        : (isSidebarCollapsed ? "w-[80px]" : "w-[180px]"),
                    "lg:relative lg:translate-x-0"
                )}
            >
                {SidebarContent}

                {/* Mobile Close Button */}
                {isMobile && isSidebarOpen && (
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="absolute right-4 top-6 p-2 text-slate-400 hover:text-slate-600"
                    >
                        <X size={20} />
                    </button>
                )}
            </aside>

            {/* Overlay Background (Mobile & Tablet Expanded) */}
            {((isMobile && isSidebarOpen) || (!isMobile && !isSidebarCollapsed)) && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
                    onClick={() => isMobile ? setSidebarOpen(false) : setSidebarCollapsed(true)}
                />
            )}

            {/* 메인 콘텐츠 */}
            <main className={cn(
                "flex-1 flex flex-col min-w-0 overflow-hidden relative z-10 transition-all duration-300",
                !isMobile && "pl-[80px] lg:pl-0" // Tablet: Pad for fixed collapsed sidebar
            )}>
                {/* 헤더 - Glass 효과 (Multiview에서는 숨김) */}
                {!isMultiview && (
                    <header className="h-20 bg-white/60 dark:bg-background/60 backdrop-blur-md border-b border-slate-200/50 dark:border-border/50 flex items-center px-6 sm:px-8 sticky top-0 z-20">
                        <div className="flex items-center gap-4">
                            {isMobile && (
                                <button
                                    onClick={() => setSidebarOpen(true)}
                                    className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                                >
                                    <Menu size={20} />
                                </button>
                            )}
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-foreground tracking-tight">
                                    {pageTitle}
                                </h2>
                                <p className="text-xs text-slate-400 dark:text-muted-foreground font-medium mt-0.5 hidden sm:block">
                                    Unified Bot Management System
                                </p>
                            </div>
                        </div>
                    </header>
                )}

                <div className={cn(
                    "flex-1 overflow-auto",
                    isMultiview ? "p-0 overflow-hidden" : "p-4 sm:p-6 scroll-smooth"
                )}>
                    <div className={cn(
                        "w-full h-full",
                        !isMultiview && "max-w-7xl mx-auto"
                    )}>
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
