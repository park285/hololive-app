
import { Stream } from "@/types";
import { cn } from "@/lib/utils";
import { getOptimizedThumbnail, getOptimizedProfileImage } from "@/lib/imageOptimizer";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

/**
 * 스트림 카드에 사용되는 시간 포맷팅 유틸리티입니다.
 * 현재 요구사항이 단순 포맷팅에 한정되어 있어 번들 크기 최적화를 위해 Intl API를 사용합니다.
 * NOTE: 타임존 변환, 복잡한 날짜 조작이 필요해지면 day.js 도입을 고려할 것.
 */

/**
 * 언어 코드를 Intl 로케일로 변환합니다.
 */
function getLocale(lang: string): string {
    const localeMap: Record<string, string> = {
        ko: "ko-KR",
        ja: "ja-JP",
        en: "en-US",
    };
    return localeMap[lang] || "en-US";
}

/**
 * 날짜 문자열을 현재 언어에 맞는 시간 형식으로 변환합니다.
 * @param dateStr - ISO 8601 형식의 날짜 문자열
 * @returns 현재 언어 로케일에 맞는 시간 문자열
 */
export function formatTime(dateStr?: string) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const locale = getLocale(i18n.language);
    return new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
    }).format(date);
}

/**
 * 초 단위를 상대적인 시간 표현으로 변환합니다.
 * Rust 백엔드에서 사전 계산된 `secondsUntilStart` 값을 사용합니다.
 * @param seconds - 시작까지 남은 초 (Rust에서 계산됨)
 * @param t - i18n 번역 함수
 * @returns 'N분 후', 'N시간 후' 등의 상대 시간 문자열 (언어별 번역 적용)
 */
export function formatRelativeTime(seconds: number | undefined, t: (key: string, options?: Record<string, unknown>) => string) {
    if (seconds === undefined || seconds === null) return "";

    // NOTE: 이미 지난 방송의 경우 '진행 중'으로 표시함
    if (seconds < 0) {
        return t('time.inProgress');
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return t('time.minutesLater', { count: minutes });
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return t('time.hoursLater', { count: hours });
    }
    return t('time.daysLater', { count: Math.floor(hours / 24) });
}

interface StreamCardProps {
    stream: Stream;
    className?: string;
    /** Above-the-fold 이미지 여부. true면 eager 로딩 */
    priority?: boolean;
}

/**
 * 스트림 정보를 카드 형태로 표시하는 컴포넌트입니다.
 * 썸네일, 채널 정보, 시작 시간, 라이브 상태 배지를 포함합니다.
 * NOTE: React Compiler가 자동으로 메모이제이션을 처리합니다.
 * @param stream - 표시할 스트림 데이터
 * @param className - 추가 CSS 클래스
 */
export function StreamCard({ stream, className, priority = false }: StreamCardProps) {
    const { t } = useTranslation();
    const isLive = stream.status === 'live';

    // YouTube 영상/라이브 URL
    const videoUrl = `https://www.youtube.com/watch?v=${stream.id}`;

    // 프로필 이미지 클릭 시 YouTube 영상 열기
    const handleImageClick = async () => {
        await openUrl(videoUrl);
    };

    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-xl bg-card border border-border shadow-sm stream-card",
                className
            )}
        >
            {/* Thumbnail - 클릭 시 YouTube 링크 */}
            <div
                className="aspect-video w-full overflow-hidden bg-muted cursor-pointer"
                onClick={handleImageClick}
            >
                {stream.thumbnail ? (
                    <img
                        // wsrv.nl 프록시로 캠싱 및 WebP 변환
                        src={getOptimizedThumbnail(stream.thumbnail)}
                        alt={stream.title}
                        className="h-full w-full object-cover stream-card-thumbnail"
                        loading={priority ? "eager" : "lazy"}
                        decoding="async"
                        fetchPriority={priority ? "high" : undefined}
                        onError={(e) => {
                            // 최적화 실패 시 원본 URL로 fallback
                            if (stream.thumbnail && e.currentTarget.src !== stream.thumbnail) {
                                e.currentTarget.src = stream.thumbnail;
                            }
                        }}
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        No Thumbnail
                    </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-2 left-2 flex gap-2">
                    {isLive && (
                        <span className="inline-flex items-center rounded-md bg-red-500/90 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                            LIVE
                        </span>
                    )}
                    {!isLive && (
                        <span className="inline-flex items-center rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                            {/* NOTE: Rust 백엔드에서 사전 계산된 secondsUntilStart 사용 */}
                            {formatRelativeTime(stream.secondsUntilStart, t)}
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-3">
                <div className="flex items-start gap-3">
                    {/* NOTE: `Stream` 객체 내 `channel` 정보가 없을 수 있어 옵셔널 체이닝을 사용함 */}
                    {stream.channel?.photo && (
                        <img
                            src={getOptimizedProfileImage(stream.channel.photo, 36)}
                            alt={stream.channelName}
                            className="h-9 w-9 rounded-full border border-border/50"
                            loading={priority ? "eager" : "lazy"}
                            decoding="async"
                            fetchPriority={priority ? "high" : undefined}
                            onError={(e) => {
                                if (stream.channel?.photo && e.currentTarget.src !== stream.channel.photo) {
                                    e.currentTarget.src = stream.channel.photo;
                                }
                            }}
                        />
                    )}

                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold leading-tight line-clamp-2 mb-1" title={stream.title}>
                            {stream.title}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                            {stream.channelName}
                        </p>
                        {!isLive && stream.startScheduled && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {t('time.startsAt', { time: formatTime(stream.startScheduled) })}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
