import { useState, useDeferredValue } from "react";
import { useTranslation } from "react-i18next";
import { MemberCard } from "@/components/MemberCard";
import { Search, AlertCircle, RefreshCw } from "lucide-react";
import { useSearchMembers, useAlarms, useAddAlarm, useRemoveAlarm, useSettings } from "@/hooks/useHoloQueries";
import type { Member } from "@/types";

/**
 * 멤버 목록 페이지 컴포넌트입니다.
 * 멤버 검색 및 알람 토글 기능을 제공합니다.
 * 
 * Performance: Framer Motion 제거, useDeferredValue로 검색 최적화
 */
export default function MembersPage() {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState("");
    const deferredQuery = useDeferredValue(searchQuery);

    const { data: settings } = useSettings();

    const {
        data: members = [],
        isLoading: isLoadingMembers,
        isError: isErrorMembers,
        refetch: refetchMembers
    } = useSearchMembers(deferredQuery, settings?.hideGraduated);

    const {
        data: alarms = [],
        isError: isErrorAlarms,
        refetch: refetchAlarms
    } = useAlarms();

    const addAlarmMutation = useAddAlarm();
    const removeAlarmMutation = useRemoveAlarm();

    const handleToggleAlarm = (member: Member) => {
        const isEnabled = alarms.some(a => a.channelId === member.channelId);
        if (isEnabled) {
            removeAlarmMutation.mutate({ channelId: member.channelId });
        } else {
            addAlarmMutation.mutate({ member });
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold tracking-tight">{t('members.title')}</h2>

                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                    <input
                        type="text"
                        placeholder={t('members.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-xl border bg-card/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-sans text-sm shadow-sm"
                    />
                </div>
            </div>

            {isErrorMembers || isErrorAlarms ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
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
                                refetchMembers();
                                refetchAlarms();
                            }}
                            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 mx-auto"
                        >
                            <RefreshCw className="w-4 h-4" />
                            {t('common.retry')}
                        </button>
                    </div>
                </div>
            ) : isLoadingMembers ? (
                <div className="space-y-4">
                    <div className="text-center text-muted-foreground animate-pulse">
                        {t('common.loadingMembers')}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="h-40 rounded-xl bg-muted/50 animate-pulse" />
                        ))}
                    </div>
                </div>
            ) : members.length > 0 ? (
                <div
                    key={`members-${deferredQuery}-${settings?.hideGraduated}`}
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                >
                    {members.map((member, index) => {
                        const isAlarmEnabled = alarms.some(a => a.channelId === member.channelId);
                        return (
                            <div
                                key={member.channelId}
                                className="stagger-item"
                                style={{ '--stagger-index': index } as React.CSSProperties}
                            >
                                <MemberCard
                                    member={member}
                                    isAlarmEnabled={isAlarmEnabled}
                                    onToggleAlarm={handleToggleAlarm}
                                />
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-2xl bg-card/30">
                    {t('members.noResults')}
                </div>
            )}
        </div>
    );
}
