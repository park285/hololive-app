import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings, useUpdateSetting, useClearCache } from "@/hooks/useHoloQueries";
import { AlertModal } from "@/components/ui/AlertModal";
import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { open } from "@tauri-apps/plugin-dialog";
import type { Settings } from "@/types";
import { PageTransition } from "@/components/layout/PageTransition";

const defaultSettings: Settings = {
    notifyMinutesBefore: 5,
    notifyOnLive: true,
    notifyOnUpcoming: true,
    pollingIntervalSeconds: 60,
    apiBaseUrl: 'https://api.capu.blog',
    theme: 'system',
    language: 'ko',
    offlineCacheEnabled: true,
    hideGraduated: false,
};

/**
 * 설정 페이지 컴포넌트입니다.
 * 앱의 전역 설정을 관리합니다.
 * 
 * Performance: Framer Motion 완전 제거, CSS 애니메이션으로 대체
 */
export default function SettingsPage() {
    const { t, i18n } = useTranslation();
    const { data: settings = defaultSettings } = useSettings();
    const updateSettingMutation = useUpdateSetting();
    const clearCacheMutation = useClearCache();

    const [alertState, setAlertState] = useState<{
        isOpen: boolean
        title: string
        message: string
        type: 'success' | 'error' | 'info' | 'warning'
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    })

    const [showClearCacheConfirm, setShowClearCacheConfirm] = useState(false)

    const themeMode = settings.theme;
    const pollingInterval = String(settings.pollingIntervalSeconds);
    const currentLanguage = i18n.language;

    const handleThemeChange = (mode: string) => {
        updateSettingMutation.mutate({ key: 'theme', value: mode });
    };

    const handlePollingIntervalChange = (value: string) => {
        updateSettingMutation.mutate({ key: 'polling_interval_seconds', value });
    };

    const handleLanguageChange = (lang: string) => {
        i18n.changeLanguage(lang);
    };

    const handleHideGraduatedChange = (enabled: boolean) => {
        updateSettingMutation.mutate({ key: 'hide_graduated', value: enabled ? 'true' : 'false' });
    };

    const handleTestNotification = async () => {
        console.log('[SettingsPage] 테스트 알림 발송 시도...');
        try {
            let permissionGranted = await isPermissionGranted();
            console.log('[SettingsPage] 현재 권한 상태:', permissionGranted);

            if (!permissionGranted) {
                console.log('[SettingsPage] 권한 요청 중...');
                const permission = await requestPermission();
                permissionGranted = permission === 'granted';
                console.log('[SettingsPage] 권한 요청 결과:', permission);
            }
            await invoke('test_notification');
            console.log('[SettingsPage] 테스트 알림 발송 성공');
            setAlertState({
                isOpen: true,
                title: t('common.success', '성공'),
                message: '알림이 발송되었습니다! 시스템 트레이를 확인하세요.',
                type: 'success'
            });
        } catch (error) {
            console.error('[SettingsPage] 테스트 알림 발송 실패:', error);
            setAlertState({
                isOpen: true,
                title: t('common.error', '오류'),
                message: `알림 발송 실패: ${error} `,
                type: 'error'
            });
        }
    };

    const handleClearCache = async () => {
        try {
            await clearCacheMutation.mutateAsync();
            setAlertState({
                isOpen: true,
                title: t('common.success', '성공'),
                message: t('settings.clearCacheSuccess'),
                type: 'success'
            });
        } catch (error) {
            console.error('[SettingsPage] 캐시 초기화 실패:', error);
            setAlertState({
                isOpen: true,
                title: t('common.error', '오류'),
                message: t('settings.clearCacheError', { error: error instanceof Error ? error.message : String(error) }),
                type: 'error'
            });
        } finally {
            setShowClearCacheConfirm(false);
        }
    };

    const handleSelectSound = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Audio',
                    extensions: ['mp3', 'wav', 'ogg', 'flac']
                }]
            });

            if (selected) {
                updateSettingMutation.mutate({
                    key: 'notification_sound_path',
                    value: String(selected)
                });
            }
        } catch (error) {
            console.error('파일 선택 실패:', error);
            setAlertState({
                isOpen: true,
                title: t('common.error', '오류'),
                message: '파일 선택 중 오류가 발생했습니다.',
                type: 'error'
            });
        }
    };

    const handleResetSound = () => {
        updateSettingMutation.mutate({ key: 'notification_sound_path', value: '' });
    };

    return (
        <PageTransition className="space-y-8 max-w-2xl pb-20">
            <h2 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h2>

            {/* 테마 설정 */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold">{t('settings.display')}</h3>
                <div className="p-4 rounded-2xl border bg-card/50 backdrop-blur-sm">
                    <label className="block text-sm font-medium mb-3 text-muted-foreground">{t('settings.themeMode')}</label>
                    <div className="grid grid-cols-3 gap-2 p-1 bg-muted/50 rounded-xl relative">
                        {(['light', 'dark', 'system'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => handleThemeChange(mode)}
                                className={`
                                    relative w-full px-4 py-2 text-sm font-medium capitalize rounded-lg transition-all duration-200 z-10
                                    ${themeMode === mode
                                        ? "text-primary-foreground bg-primary shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                    }
                                `}
                            >
                                <span className="relative z-10">{t(`settings.${mode}`)}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* 언어 설정 */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold">{t('settings.language')}</h3>
                <div className="p-4 rounded-2xl border bg-card/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium">{t('settings.language')}</div>
                            <div className="text-xs text-muted-foreground">{t('settings.languageDesc')}</div>
                        </div>
                        <div className="relative">
                            <select
                                value={currentLanguage}
                                onChange={(e) => handleLanguageChange(e.target.value)}
                                className="appearance-none bg-background border rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer transition-shadow hover:bg-accent/50"
                            >
                                <option value="ko">한국어</option>
                                <option value="en">English</option>
                                <option value="ja">日本語</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-xs">
                                ▼
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 데이터 설정 */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold">{t('settings.dataSync')}</h3>
                <div className="p-4 rounded-2xl border bg-card/50 backdrop-blur-sm space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium">{t('settings.updateInterval')}</div>
                            <div className="text-xs text-muted-foreground">{t('settings.updateIntervalDesc')}</div>
                        </div>
                        <div className="relative">
                            <select
                                value={pollingInterval}
                                onChange={(e) => handlePollingIntervalChange(e.target.value)}
                                className="appearance-none bg-background border rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer transition-shadow hover:bg-accent/50"
                            >
                                <option value="30">{t('settings.seconds', { count: 30 })}</option>
                                <option value="60">{t('settings.minutes', { count: 1 })}</option>
                                <option value="300">{t('settings.minutes', { count: 5 })}</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-xs">
                                ▼
                            </div>
                        </div>
                    </div>

                    {/* 졸업멤버 숨기기 토글 */}
                    <div className="flex items-center justify-between group cursor-pointer" onClick={() => handleHideGraduatedChange(!settings.hideGraduated)}>
                        <div>
                            <div className="font-medium group-hover:text-primary transition-colors">{t('settings.hideGraduated')}</div>
                            <div className="text-xs text-muted-foreground">{t('settings.hideGraduatedDesc')}</div>
                        </div>
                        <div
                            className={`toggle-switch ${settings.hideGraduated ? 'bg-primary' : 'bg-muted'}`}
                        >
                            <span
                                className="toggle-switch-knob"
                                data-checked={settings.hideGraduated}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* 알림 설정 */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold">{t('settings.notifications')}</h3>
                <div className="p-4 rounded-2xl border bg-card/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 mr-4 overflow-hidden">
                            <div className="font-medium">{t('settings.notificationSound')}</div>
                            <div className="text-xs text-muted-foreground mb-1">{t('settings.notificationSoundDesc')}</div>
                            {settings.notificationSoundPath && (
                                <div
                                    className="text-xs text-primary font-mono bg-primary/10 px-2 py-1.5 rounded-md break-all animate-expand"
                                >
                                    {settings.notificationSoundPath}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                            {settings.notificationSoundPath && (
                                <button
                                    onClick={handleResetSound}
                                    className="btn-interactive px-3 py-1.5 border rounded-xl hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 text-sm transition-colors text-muted-foreground"
                                >
                                    {t('settings.defaultSound')}
                                </button>
                            )}
                            <button
                                onClick={handleSelectSound}
                                className="btn-interactive px-3 py-1.5 border rounded-xl hover:bg-accent text-sm flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <span className="text-base">🎵</span>
                                {t('settings.selectFile')}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* 고급 설정 */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold">{t('settings.advancedSettings')}</h3>
                <div className="p-4 rounded-2xl border bg-card/50 backdrop-blur-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium">{t('settings.testNotification')}</div>
                            <div className="text-xs text-muted-foreground">{t('settings.testNotificationDesc')}</div>
                        </div>
                        <button
                            onClick={handleTestNotification}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                        >
                            {t('settings.sendTestNotification')}
                        </button>
                    </div>

                    <hr className="border-border/50" />
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-destructive">{t('settings.clearCache')}</div>
                            <div className="text-xs text-muted-foreground">{t('settings.clearCacheDesc')}</div>
                        </div>
                        <button
                            onClick={() => setShowClearCacheConfirm(true)}
                            className="btn-interactive px-4 py-2 bg-white text-destructive border border-destructive/20 rounded-xl hover:bg-destructive hover:text-white transition-all text-sm font-medium shadow-sm"
                        >
                            {t('settings.clearCache')}
                        </button>
                    </div>
                </div>
            </section>

            {/* 앱 정보 및 크레딧 */}
            <div className="pt-10 mt-8 border-t border-border/40">
                <div className="flex flex-col items-center justify-center gap-4">
                    <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:gap-3">
                        <span className="font-bold text-lg tracking-tight bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
                            {t('app.name')}
                        </span>
                        <div
                            className="animate-fade-up px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground text-[10px] font-mono font-medium tracking-wider border border-border/40 backdrop-blur-sm"
                        >
                            {t('app.version')}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 transition-colors duration-300 hover:text-muted-foreground">
                        <span className="font-medium">{t('common.poweredBy')}</span>
                        <a
                            href="https://holodex.net"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-[#5a9bf5] hover:text-[#4c84d1] hover:underline decoration-2 underline-offset-2 flex items-center gap-1 transition-all"
                        >
                            Holodex
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="opacity-70"
                            >
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>


            {/* Alert Modals */}
            <AlertModal
                isOpen={alertState.isOpen}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />

            <AlertModal
                isOpen={showClearCacheConfirm}
                onClose={() => setShowClearCacheConfirm(false)}
                title={t('settings.clearCache')}
                message={t('settings.clearCacheConfirm')}
                type="warning"
                showCancel
                confirmText={t('common.delete', '삭제')}
                onConfirm={handleClearCache}
            />
        </PageTransition >
    );
}
