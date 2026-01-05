import { GripVertical, X } from 'lucide-react';
import { useMultiviewStore } from '@/stores/multiviewStore';
import { usePlayerPoolContext } from '@/hooks/usePlayerPool';
import type { CellContent } from '@/types/multiview';
import { VideoCell } from './VideoCell';
import { EmptyCell } from './EmptyCell';
import { cn } from '@/lib/utils';

interface GridCellProps {
    cellId: string;
    content?: CellContent;
    /** 편집 모드 여부 (Shield 표시용) */
    isEditMode?: boolean;
}

export function GridCell({ cellId, content, isEditMode = false }: GridCellProps) {
    const removeCell = useMultiviewStore(state => state.removeCell);
    const removeContent = useMultiviewStore(state => state.removeContent);
    const { isPlayerActive, activatePlayer } = usePlayerPoolContext();

    // 콘텐츠가 없으면 렌더링 생략 (Race Condition 방지)
    if (!content) return null;

    const isVideo = content?.type === 'video' && content?.videoId;

    // 전역 삭제로 다른 기기에서 부활되지 않도록 함
    const handleRemove = () => {
        // 모바일에서는 전역 삭제 (removeContent)를 사용해야
        // reconcileLayout이 "레이아웃에 누락된 아이템"으로 부활시키지 않음
        if (removeContent) {
            removeContent(cellId);
        } else {
            removeCell(cellId);
        }
    };

    const renderContent = () => {
        if (!content || content.type === 'empty') {
            return <EmptyCell cellId={cellId} />;
        }

        if (content.type === 'video' && content.videoId) {
            return (
                <VideoCell
                    cellId={cellId}
                    videoId={content.videoId}
                    videoSource={content.videoSource || 'youtube'}
                    isActive={isPlayerActive(cellId)}
                    onActivate={() => activatePlayer(cellId)}
                />
            );
        }

        return <EmptyCell cellId={cellId} />;
    };

    return (
        <div className={cn(
            "cell-container group relative h-full w-full overflow-hidden rounded-lg border shadow-sm transition-all duration-200",
            "border-border bg-card hover:border-border/80"
        )}>
            {/* 드래그 핸들 - 비디오 셀에서 항상 표시, 빈 셀에서는 hover 시 */}
            <div className={cn(
                "cell-drag-handle absolute left-0 top-0 z-20 flex h-10 w-10 cursor-move items-center justify-center transition-all duration-200 rounded-br-xl",
                isVideo
                    ? "bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-sky-600"
                    : "bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-primary"
            )}>
                <GripVertical className="h-5 w-5" />
            </div>

            {/* 터치 이벤트 흡수용 Shield - iframe의 형제 요소로 배치 */}
            {isEditMode && (
                <div
                    className="iframe-shield absolute inset-0 z-20 bg-transparent"
                    aria-hidden="true"
                />
            )}

            {/* 삭제 버튼 - cell-delete-btn 클래스로 z-index: 60 적용 */}
            <button
                onClick={handleRemove}
                className={cn(
                    "cell-delete-btn absolute right-2 top-2 z-30 flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200",
                    isVideo
                        ? "bg-black/80 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600"
                        : "bg-black/80 text-white opacity-0 group-hover:opacity-100 hover:bg-destructive"
                )}
                aria-label="셀 삭제"
            >
                <X className="h-4 w-4" />
            </button>

            {/* 리사이즈 가이드 (모서리) */}

            {/* Bottom-Right (Default) */}
            <div className="absolute bottom-0 right-0 z-10 w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none">
                <svg viewBox="0 0 16 16" className="w-full h-full text-muted-foreground">
                    <path d="M14 2v12H2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
            </div>

            {/* Bottom-Left */}
            <div className="absolute bottom-0 left-0 z-10 w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none rotate-90">
                <svg viewBox="0 0 16 16" className="w-full h-full text-muted-foreground">
                    <path d="M14 2v12H2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
            </div>

            {/* 콘텐츠 */}
            <div className="h-full w-full">
                {renderContent()}
            </div>
        </div>
    );
}
