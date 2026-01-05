import { getYouTubeThumbnailUrl } from '@/hooks/usePlayerPool';
import { YouTubePlayer } from './YouTubePlayer';
import type { VideoSource } from '@/types/multiview';
import { Play } from 'lucide-react';

interface VideoCellProps {
    cellId: string;
    videoId: string;
    videoSource: VideoSource;
    isActive: boolean;
    onActivate: () => void;
}

export function VideoCell({
    cellId,
    videoId,
    videoSource,
    isActive,
    onActivate,
}: VideoCellProps) {
    // 활성 상태일 때 실제 플레이어 렌더링
    if (isActive) {
        return (
            <div className="relative h-full w-full group/player">
                {/* YouTube 플레이어 */}
                {videoSource === 'youtube' ? (
                    <YouTubePlayer cellId={cellId} videoId={videoId} />
                ) : (
                    <div className="h-full w-full flex items-center justify-center bg-black text-white">
                        Unsupported: {videoSource}
                    </div>
                )}

                {/* 활성 상태 인디케이터 (상단) */}
                <div className="absolute top-2 right-12 z-30 flex items-center gap-1 px-2 py-1 rounded-md bg-sky-500/80 text-white text-xs font-medium opacity-0 group-hover/player:opacity-100 transition-opacity pointer-events-none">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    활성
                </div>
            </div>
        );
    }

    // 비활성 상태: 썸네일 표시
    return (
        <button
            onClick={onActivate}
            className="h-full w-full relative group/thumb cursor-pointer overflow-hidden border-none outline-none p-0 bg-black"
            aria-label="스트림 재생"
        >
            <img
                src={getYouTubeThumbnailUrl(videoId, 'high')}
                alt="Video thumbnail"
                className="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                loading="lazy"
            />

            {/* 호버 시 재생 버튼 */}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-200">
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-xl transition-transform group-hover/thumb:scale-110">
                    <Play className="w-7 h-7 text-white fill-current ml-0.5" />
                </div>
            </div>
        </button>
    );
}
