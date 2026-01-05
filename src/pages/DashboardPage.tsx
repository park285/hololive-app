import { useTranslation } from "react-i18next";
import { startTransition, useState } from "react";
import { StreamCard } from "@/components/StreamCard";
import { StreamListItem } from "@/components/StreamListItem";
import { Loader2, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
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

    const { data: liveStreams = [], isLoading: isLoadingLive, isFetching: isFetchingLive } = useLiveStreams();
    const [upcomingHours, setUpcomingHours] = useState<number | undefined>(() => {
        const saved = localStorage.getItem('dashboard_upcoming_hours');
        return saved ? Number(saved) : undefined;
    });
    const { data: upcomingStreams = [], isLoading: isLoadingUpcoming, isFetching: isFetchingUpcoming } = useUpcomingStreams({ hours: upcomingHours });

    useAlarms();

    const isFetching = isFetchingLive || isFetchingUpcoming;

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
                    disabled={isFetching}
                    className="p-2 rounded-full hover:bg-accent disabled:opacity-50 transition-colors bg-card border shadow-sm active:scale-95"
                    title={t('dashboard.refresh')}
                >
                    <Loader2 className={`w-5 h-5 ${isFetching ? "animate-spin text-primary" : "text-muted-foreground"}`} />
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
                    <Badge variant="red" className="ml-2 h-5 min-w-[20px] rounded-full px-1.5 justify-center">
                        {liveStreams.length}
                    </Badge>
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
                                <StreamCard stream={stream} priority={index < 4} className="h-full" />
                            </div>
                        ))}
                    </div>
                ) : isLoadingLive ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex flex-col rounded-xl border bg-card overflow-hidden shadow-sm animate-pulse">
                                <div className="aspect-video w-full bg-muted" />
                                <div className="p-3 space-y-2">
                                    <div className="flex items-start gap-3">
                                        <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
                                        <div className="flex-1 space-y-2 py-1">
                                            <div className="h-4 bg-muted rounded w-3/4" />
                                            <div className="h-3 bg-muted rounded w-1/2" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
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
                            <Badge variant="blue" className="ml-2 h-5 min-w-[20px] rounded-full px-1.5 justify-center">
                                {upcomingStreams.length}
                            </Badge>
                        )}
                    </div>

                    <select
                        value={upcomingHours ?? 24}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            const newValue = val === 24 ? undefined : val;
                            setUpcomingHours(newValue);
                            if (newValue) {
                                localStorage.setItem('dashboard_upcoming_hours', String(newValue));
                            } else {
                                localStorage.removeItem('dashboard_upcoming_hours');
                            }
                        }}
                        className="h-8 rounded-md border border-input bg-background/50 px-2 py-1 text-xs font-medium shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <option value={1}>1 Hour</option>
                        <option value={2}>2 Hours</option>
                        <option value={4}>4 Hours</option>
                        <option value={8}>8 Hours</option>
                        <option value={12}>12 Hours</option>
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
                                <StreamListItem stream={stream} priority={index < 3} className="h-full" />
                            </div>
                        ))}
                    </div>
                ) : isLoadingUpcoming ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-card border border-border/50 animate-pulse">
                                <div className="w-32 shrink-0 aspect-video rounded-lg bg-muted" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-muted rounded w-3/4" />
                                    <div className="h-3 bg-muted rounded w-1/2" />
                                </div>
                                <div className="shrink-0 min-w-[80px] flex flex-col items-end gap-2">
                                    <div className="h-4 bg-muted rounded w-12" />
                                    <div className="h-3 bg-muted rounded w-10" />
                                </div>
                            </div>
                        ))}
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
