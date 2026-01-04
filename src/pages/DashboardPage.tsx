import { useTranslation } from "react-i18next";
import { startTransition, useState } from "react";
import { StreamCard } from "@/components/StreamCard";
import { StreamListItem } from "@/components/StreamListItem";
import { Loader2, Calendar } from "lucide-react";
import { useLiveStreams, useUpcomingStreams, useAlarms } from "@/hooks/useHoloQueries";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";

/**
 * 대시보드 페이지 컴포넌트입니다.
 * 현재 라이브 중인 스트림과 예정 스트림을 보여줍니다.
 * 
 * Performance: Framer Motion 제거, startTransition으로 무거운 업데이트 처리
 */
export default function DashboardPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const { data: liveStreams = [], isLoading: isLoadingLive } = useLiveStreams();
    const [upcomingHours, setUpcomingHours] = useState<number | undefined>(undefined);
    const { data: upcomingStreams = [], isLoading: isLoadingUpcoming } = useUpcomingStreams({ hours: upcomingHours });

    useAlarms();

    const isLoading = isLoadingLive || isLoadingUpcoming;

    const handleRefresh = () => {
        // React 18 Concurrent Mode: 무거운 목록 업데이트를 낮은 우선순위로 처리
        startTransition(() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.streams.live });
            void queryClient.invalidateQueries({ queryKey: queryKeys.streams.upcoming });
        });
    };

    return (
        <div className="space-y-8 pb-10">
            {/* 헤더 섹션 */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h2>
                <button
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="p-2 rounded-full hover:bg-accent disabled:opacity-50 transition-colors bg-card border shadow-sm active:scale-95"
                    title={t('dashboard.refresh')}
                >
                    <Loader2 className={`w-5 h-5 ${isLoading ? "animate-spin text-primary" : "text-muted-foreground"}`} />
                </button>
            </div>

            {/* 라이브 스트림 섹션 */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <h3 className="text-lg font-semibold">{t('dashboard.liveNow')}</h3>
                    <span className="text-sm text-muted-foreground ml-1 font-mono bg-muted px-1.5 rounded-md">
                        {liveStreams.length}
                    </span>
                </div>

                {liveStreams.length > 0 ? (
                    <div
                        key="live-streams"
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    >
                        {liveStreams.map((stream, index) => (
                            <div
                                key={stream.id}
                                className="stagger-item"
                                style={{ '--stagger-index': index } as React.CSSProperties}
                            >
                                <StreamCard stream={stream} />
                            </div>
                        ))}
                    </div>
                ) : isLoadingLive ? (
                    <div className="py-16 text-center border-2 border-dashed rounded-2xl bg-card/30 backdrop-blur-sm flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 mb-4 animate-spin text-muted-foreground/50" />
                        <p className="text-muted-foreground">{t('dashboard.loading')}</p>
                    </div>
                ) : (
                    <div className="py-16 text-center border-2 border-dashed rounded-2xl bg-card/30 backdrop-blur-sm">
                        <p className="text-muted-foreground">{t('dashboard.noLive')}</p>
                    </div>
                )}
            </section>

            {/* 예정 스트림 섹션 */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-500" />
                        <h3 className="text-lg font-bold tracking-tight text-foreground/90">
                            {t('dashboard.upcoming')}
                        </h3>
                        {upcomingStreams.length > 0 && (
                            <span className="ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 text-xs font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                                {upcomingStreams.length}
                            </span>
                        )}
                    </div>

                    <select
                        value={upcomingHours ?? 24}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            setUpcomingHours(val === 24 ? undefined : val);
                        }}
                        className="h-8 rounded-md border border-input bg-background/50 px-2 py-1 text-xs font-medium shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <option value={24}>24 Hours</option>
                        <option value={48}>48 Hours</option>
                        <option value={168}>1 Week</option>
                    </select>
                </div>

                {upcomingStreams.length > 0 ? (
                    <div
                        key="upcoming-streams"
                        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                    >
                        {upcomingStreams.map((stream, index) => (
                            <div
                                key={stream.id}
                                className="stagger-item"
                                style={{ '--stagger-index': index } as React.CSSProperties}
                            >
                                <StreamListItem stream={stream} />
                            </div>
                        ))}
                    </div>
                ) : isLoadingUpcoming ? (
                    <div className="py-12 text-center border-2 border-dashed rounded-xl bg-card/50 flex flex-col items-center justify-center">
                        <Loader2 className="w-6 h-6 mb-3 animate-spin text-muted-foreground/50" />
                        <p className="text-muted-foreground">{t('dashboard.loading')}</p>
                    </div>
                ) : (
                    <div className="py-12 text-center border-2 border-dashed rounded-xl bg-card/50">
                        <p className="text-muted-foreground">{t('dashboard.noUpcoming')}</p>
                    </div>
                )}
            </section>
        </div>
    );
}
