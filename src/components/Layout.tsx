import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Bell, Settings, Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { UserMenu } from "./UserMenu";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Button } from "./ui/Button";

/**
 * 네비게이션 메뉴 아이템의 구조를 정의합니다.
 */
interface NavItem {
    labelKey: string;
    href: string;
    icon: React.ElementType;
}

const navItems: NavItem[] = [
    { labelKey: "nav.dashboard", href: "/", icon: LayoutDashboard },
    { labelKey: "nav.members", href: "/members", icon: Users },
    { labelKey: "nav.alarms", href: "/alarms", icon: Bell },
    { labelKey: "nav.settings", href: "/settings", icon: Settings },
];

/**
 * 앱의 메인 레이아웃 컴포넌트입니다.
 * 왼쪽 사이드바 네비게이션과 오른쪽 메인 콘텐츠 영역을 포함합니다.
 * 모바일에서는 사이드바가 오버레이 형태의 드로어로 변경됩니다.
 */
export function Layout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // 페이지 이동 시 사이드바 닫기 (모바일전용)
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    // 사이드바 외부 클릭 시 닫기
    const closeSidebar = () => setIsSidebarOpen(false);

    const SidebarContent = (
        <>
            <div className="p-6 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent transform origin-left hover:scale-105 transition-transform duration-300">
                        Hololive
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1 tracking-wider font-medium">Stream Notifier</p>
                </div>
                {isMobile && (
                    <Button variant="ghost" size="icon" onClick={closeSidebar} className="lg:hidden">
                        <X className="w-5 h-5" />
                    </Button>
                )}
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                                "nav-link",
                                isActive && "active"
                            )}
                        >
                            <item.icon className="w-4 h-4" />
                            <span className="relative">{t(item.labelKey)}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-border/50">
                <UserMenu />
                <div className="mt-4 px-2 space-y-0.5">
                    <p className="text-[10px] text-muted-foreground/60 font-medium font-mono">{t('app.version')}</p>
                    <p className="text-[10px] text-muted-foreground/60 font-medium">
                        {t('common.poweredBy')} <a href="https://holodex.net" target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline transition-colors">Holodex</a>
                    </p>
                </div>
            </div>
        </>
    );

    return (
        <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden relative">
            {/* 모바일 상단 헤더 */}
            {isMobile && (
                <header className="fixed top-0 left-0 right-0 h-14 border-b bg-background/80 backdrop-blur-md flex items-center px-4 z-30 pt-[env(safe-area-inset-top)]">
                    <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)} className="mr-2">
                        <Menu className="w-5 h-5" />
                    </Button>
                    <span className="font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">Hololive</span>
                </header>
            )}

            {/* 사이드바 (데스크톱: 고정, 모바일: 오버레이) */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-40 w-64 border-r bg-card/95 flex flex-col backdrop-blur-xl transition-transform duration-300 lg:relative lg:translate-x-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
                    isMobile && (isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full")
                )}
            >
                {SidebarContent}
            </aside>

            {/* 모바일 사이드바 배경 (오버레이) */}
            {isMobile && isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity duration-300"
                    onClick={closeSidebar}
                />
            )}

            {/* 메인 콘텐츠 영역 */}
            <main className={cn(
                "flex-1 overflow-auto bg-background/50 relative",
                isMobile && "pt-14"
            )}>
                <div className="container mx-auto p-4 md:p-6 max-w-7xl min-h-full pt-[calc(1rem+env(safe-area-inset-top))] md:pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] pr-[calc(1rem+env(safe-area-inset-right))] md:pr-[calc(1.5rem+env(safe-area-inset-right))]">
                    {children}
                </div>
            </main>
        </div>
    );
}
