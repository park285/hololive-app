import { Routes, Route, HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Layout } from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage";
import MembersPage from "@/pages/MembersPage";
import AlarmsPage from "@/pages/AlarmsPage";
import SettingsPage from "@/pages/SettingsPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";

const MultiviewPage = lazy(() => import("@/components/multiview/MultiviewPage"));
import { MultiviewSkeleton } from "@/components/multiview/MultiviewSkeleton";
import { useEffect } from "react";
import { useSettings } from "@/hooks/useHoloQueries";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  onAction,
  registerActionTypes,
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";
import { useSessionRestore } from "@/hooks/useSessionRestore";
import { useSessionAutoRefresh } from "@/hooks/useSessionAutoRefresh";
import { useSessionExpiredListener } from "@/hooks/useSessionExpiredListener";
import { AuthModal } from "@/components/auth/AuthModal";
import { ToastContainer } from "@/components/ui/Toast";

// NOTE: Tauri 앱의 `file://` 프로토콜 환경에서 라우팅 호환성을 보장하기 위해 `HashRouter`를 사용함

/**
 * QueryClient 설정입니다.
 * 기본적으로 5분간 stale 상태를 유지하고, 창 포커스 시 자동 재검증을 비활성화합니다.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // NOTE: 5분간 fresh 상태 유지
      gcTime: 1000 * 60 * 60, // NOTE: 1시간 후 가비지 컬렉션
      retry: 1,
      refetchOnWindowFocus: false, // NOTE: Tauri 앱에서는 불필요하므로 비활성화
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * 테마 설정을 관리하는 컴포넌트입니다.
 * `settings.theme` 값에 따라 `<html>` 요소에 테마 클래스를 동적으로 적용합니다.
 * NOTE: 테마를 localStorage에도 저장하여 새로고침 시 깜빡임을 방지합니다.
 */
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useSettings();

  useEffect(() => {
    const theme = settings?.['theme'];
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "dark") {
      root.classList.add("dark");
      localStorage.setItem('app-theme', 'dark');
    } else if (theme === "light") {
      root.classList.add("light");
      localStorage.setItem('app-theme', 'light');
    } else {
      // system
      localStorage.setItem('app-theme', 'system');
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      }
    }
  }, [settings]);

  return <>{children}</>;
}

function AppContent() {
  // 세션 복원 및 자동 갱신 훅 사용 (로그인된 경우에만 동작)
  useSessionRestore();
  useSessionAutoRefresh();
  useSessionExpiredListener();  // 백엔드 세션 만료 이벤트 리스너

  useEffect(() => {
    // 알림 권한 요청 및 Action Type 등록, 클릭 리스너 설정 (Mobile에서만 필요)
    // Desktop에서는 Rust 레벨의 notify-rust가 클릭 처리를 담당
    let notificationCleanup: (() => void) | undefined;
    const setupNotifications = async () => {
      try {
        // 알림 권한 확인 및 요청 (Android 13+ 필수, Desktop에서도 안전하게 호출 가능)
        let granted = await isPermissionGranted();
        if (!granted) {
          const permission = await requestPermission();
          granted = permission === 'granted';
          console.log('[App] 알림 권한 요청 결과:', granted);
        }

        // Mobile에서만 Action Type 등록 및 onAction 리스너 설정
        try {
          await registerActionTypes([
            {
              id: 'stream-notification',
              actions: [
                {
                  id: 'open-stream',
                  title: '열기',
                  foreground: true,
                },
              ],
            },
          ]);
          console.log('[App] Action Type 등록 완료 (Mobile)');

          // 알림 클릭/액션 이벤트 리스너 등록
          const unlisten = await onAction((notification) => {
            console.log('[App] 알림 액션 수신:', notification);
            // extra 데이터에서 YouTube URL 추출
            const youtubeUrl = (notification.extra as Record<string, unknown>)?.youtubeUrl as string | undefined;
            if (youtubeUrl) {
              console.log('[App] YouTube URL 열기:', youtubeUrl);
              openUrl(youtubeUrl).catch((err) => {
                console.error('[App] URL 열기 실패:', err);
              });
            }
          });
          return () => unlisten.unregister();
        } catch (mobileErr) {
          // Desktop에서는 registerActionTypes가 지원되지 않아 에러 발생 가능 - 무시
          console.log('[App] Mobile 알림 설정 건너뜀 (Desktop 환경)');
          return undefined;
        }
      } catch (err) {
        console.error('[App] 알림 설정 실패:', err);
        return undefined;
      }
    };
    setupNotifications().then((unlisten) => {
      notificationCleanup = unlisten;
    });

    return () => {
      if (notificationCleanup) notificationCleanup();
    };
  }, []);

  return (
    <ThemeProvider>
      {/* 인증 모달 - 전역에서 접근 가능 */}
      <AuthModal />
      <Routes>
        {/* Auth Routes (Optional Login) - 모달화되었으나 직접 URL 접근 유지 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Main App Routes (No Authentication Required) */}
        <Route path="/" element={<Layout><DashboardPage /></Layout>} />
        <Route path="/members" element={<Layout><MembersPage /></Layout>} />
        <Route path="/alarms" element={<Layout><AlarmsPage /></Layout>} />
        <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />


        <Route path="/multiview" element={
          <Layout>
            <Suspense fallback={<MultiviewSkeleton />}>
              <MultiviewPage />
            </Suspense>
          </Layout>
        } />
      </Routes>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AppContent />
      </HashRouter>
      <ToastContainer />
    </QueryClientProvider>
  );
}
