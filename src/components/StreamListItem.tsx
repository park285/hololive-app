import { memo } from "react";
import { Stream } from "@/types";
import { cn } from "@/lib/utils";
import { getOptimizedThumbnail } from "@/lib/imageOptimizer";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink } from "lucide-react";
import { formatTime } from "./StreamCard";

interface StreamListItemProps {
    stream: Stream;
    className?: string;
}

/**
 * 예정된 방송을 리스트 형태로 보여주는 컴포넌트입니다.
 * 가로형 레이아웃으로 공간 효율성을 높이고 정보 전달에 집중합니다.
 */
export const StreamListItem = memo(function StreamListItem({ stream, className }: StreamListItemProps) {
    const videoUrl = `https://www.youtube.com/watch?v=${stream.id}`;

    const handleLinkClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await openUrl(videoUrl);
    };

    return (
        <div
            className={cn(
                "group flex items-center gap-4 p-3 rounded-xl bg-card border border-border/50 stream-list-item",
                className
            )}
        >
            {/* 썸네일 - 작고 둥글게 */}
            <div className="relative w-32 shrink-0 aspect-video rounded-lg overflow-hidden bg-muted">
                {stream.thumbnail ? (
                    <img
                        src={getOptimizedThumbnail(stream.thumbnail)}
                        alt={stream.title}
                        className="h-full w-full object-cover stream-list-item-thumbnail"
                        loading="lazy"
                        decoding="async"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No Image
                    </div>
                )}
            </div>

            {/* 정보 영역 */}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                <h3
                    className="text-sm font-bold leading-tight line-clamp-2 text-foreground/90 group-hover:text-primary transition-colors"
                    title={stream.title}
                >
                    {stream.title}
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                    {stream.channelName}
                </p>
            </div>

            {/* 시간 및 액션 영역 */}
            <div className="flex flex-col items-end justify-center gap-1.5 shrink-0 min-w-[80px]">
                {stream.startScheduled && (
                    <span className="text-sm font-bold tabular-nums tracking-tight">
                        {formatTime(stream.startScheduled)}
                    </span>
                )}

                <button
                    onClick={handleLinkClick}
                    className="flex items-center gap-1 text-[10px] font-medium text-red-500 hover:text-red-600 hover:underline transition-colors px-1 py-0.5"
                >
                    YouTube
                    <ExternalLink className="w-2.5 h-2.5" />
                </button>
            </div>
        </div>
    );
});
