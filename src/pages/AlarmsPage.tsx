import { useTranslation } from "react-i18next";
import { Bell, Trash2, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlarms, useRemoveAlarm, useToggleAlarm } from "@/hooks/useHoloQueries";
import type { Alarm } from "@/types";

/**
 * 알람 관리 페이지 컴포넌트입니다.
 * 등록된 알람 목록을 확인하고 설정을 변경합니다.
 * NOTE: 알람 데이터에 다국어 이름이 포함되어 있어 별도 멤버 데이터 fetch 불필요
 */
export default function AlarmsPage() {
    const { t, i18n } = useTranslation();
    const {
        data: alarms = [],
        isLoading: isLoadingAlarms,
        isError: isErrorAlarms,
        refetch: refetchAlarms
    } = useAlarms();
    const removeAlarmMutation = useRemoveAlarm();
    const toggleAlarmMutation = useToggleAlarm();

    /**
     * 언어에 따라 알람의 멤버 이름을 반환하는 헬퍼 함수
     * 알람 데이터에 저장된 다국어 이름을 직접 사용
     */
    const getAlarmDisplayName = (alarm: Alarm): string => {
        switch (i18n.language) {
            case 'ko':
                return alarm.memberNameKo || alarm.memberName;
            case 'ja':
                return alarm.memberNameJa || alarm.memberName;
            default: // 'en' or fallback
                return alarm.memberName;
        }
    };

    // 에러 발생 시 재시도 UI 표시
    if (isErrorAlarms) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="p-4 rounded-full bg-destructive/10 text-destructive">
                    <AlertCircle className="w-8 h-8" />
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-semibold">{t('common.error')}</h3>
                    <p className="text-muted-foreground mt-1">
                        {t('common.errorDesc') || t('common.error')}
                    </p>
                    <button
                        onClick={() => {
                            refetchAlarms();
                        }}
                        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 mx-auto"
                    >
                        <RefreshCw className="w-4 h-4" />
                        {t('common.retry')}
                    </button>
                </div>
            </div>
        );
    }

    // 로딩 중일 때 스켈레톤 표시
    if (isLoadingAlarms) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="h-8 w-32 bg-muted rounded animate-pulse" />
                    <div className="h-5 w-16 bg-muted rounded animate-pulse" />
                </div>
                <div className="space-y-4">
                    <div className="text-center text-muted-foreground animate-pulse py-4">
                        {t('common.loadingAlarms')}
                    </div>
                    <div className="grid gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (alarms.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="p-4 rounded-full bg-muted">
                    <Bell className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-semibold">{t('alarms.empty')}</h3>
                    <p className="text-muted-foreground mt-1">
                        {t('alarms.emptyDesc')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">{t('alarms.title')}</h2>
                <span className="text-sm text-muted-foreground">
                    {t('alarms.total', { count: alarms.length })}
                </span>
            </div>

            <div className="grid gap-4">
                {alarms.map((alarm) => (
                    <div
                        key={alarm.channelId}
                        className={cn(
                            "flex items-center justify-between p-4 rounded-xl border transition-all",
                            alarm.enabled
                                ? "bg-card border-border shadow-sm"
                                : "bg-muted/30 border-transparent text-muted-foreground"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "p-2 rounded-full transition-colors",
                                alarm.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                                <Bell className="w-5 h-5" />
                            </div>

                            <div>
                                <h3 className={cn("font-semibold", !alarm.enabled && "font-medium")}>
                                    {getAlarmDisplayName(alarm)}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                    <Clock className="w-3 h-3" />
                                    <span>{t('alarms.notifyBefore', { minutes: alarm.notifyMinutesBefore })}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={alarm.enabled}
                                    onChange={(e) => toggleAlarmMutation.mutate({
                                        channelId: alarm.channelId,
                                        enabled: e.target.checked
                                    })}
                                />
                                <div className="w-11 h-6 bg-input rounded-full peer peer-focus:ring-2 peer-focus:ring-primary/20 
                                              peer-checked:after:translate-x-full peer-checked:after:border-white 
                                              after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                                              after:bg-background after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 
                                              after:transition-all peer-checked:bg-primary hover:bg-accent cursor-pointer transition-colors"></div>
                            </label>

                            <button
                                onClick={() => removeAlarmMutation.mutate({ channelId: alarm.channelId })}
                                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                                title={t('alarms.deleteAlarm')}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
