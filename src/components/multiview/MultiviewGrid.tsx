import { useCallback, useRef, useState, useEffect } from 'react';
import GridLayout from 'react-grid-layout';
import { useMultiviewStore, useMultiviewLayout, useMultiviewContent } from '@/stores/multiviewStore';
import { GRID_CONFIG } from '@/types/multiview';
import { GridCell } from './GridCell';
import { useContainerSize } from '@/hooks/useContainerSize';
import { useResponsiveGridConfig } from '@/hooks/useResponsiveGridConfig';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import 'react-grid-layout/css/styles.css';

interface MultiviewGridProps {
    /** 모바일 편집 모드 상태 (상위에서 전달) */
    isEditMode?: boolean;
}

export function MultiviewGrid({ isEditMode = false }: MultiviewGridProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { width, height } = useContainerSize(containerRef);

    // 반응형 그리드 설정 (Phone: 4열, Tablet/Desktop: 24열)
    const gridConfig = useResponsiveGridConfig(width);

    const layout = useMultiviewLayout();
    const content = useMultiviewContent();
    const setLayout = useMultiviewStore(state => state.setLayout);
    const addCell = useMultiviewStore(state => state.addCell);

    // 드래그/리사이즈 중 iframe 포인터 이벤트 차단
    const [isDragging, setIsDragging] = useState(false);
    const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 드래그 상태가 stuck 되는 것을 방지 - 안전 타임아웃
    useEffect(() => {
        if (isDragging) {
            // 5초 후에도 드래그 상태면 자동 해제 (stuck 방지)
            dragTimeoutRef.current = setTimeout(() => {
                console.warn('[MultiviewGrid] 드래그 상태 타임아웃 - 자동 해제');
                setIsDragging(false);
            }, 5000);
        }

        return () => {
            if (dragTimeoutRef.current) {
                clearTimeout(dragTimeoutRef.current);
                dragTimeoutRef.current = null;
            }
        };
    }, [isDragging]);

    // 컴포넌트 언마운트 시 드래그 상태 정리
    useEffect(() => {
        return () => {
            setIsDragging(false);
        };
    }, []);

    // Type assertion to bypass potential type definition mismatch for GridLayout props
    const Grid = GridLayout as any;

    // 그리드 레이아웃 변경 핸들러 - 저장 시 clamping 적용
    const handleLayoutChange = useCallback((newLayout: any) => {
        const converted = newLayout.map((item: any) => {
            // 그리드 범위 내로 clamping
            const clampedX = Math.min(Math.max(0, item.x), GRID_CONFIG.COLS - 1);
            const clampedY = Math.min(Math.max(0, item.y), GRID_CONFIG.ROWS - 1);
            const clampedW = Math.min(Math.max(GRID_CONFIG.MIN_W, item.w), GRID_CONFIG.COLS - clampedX);
            const clampedH = Math.min(Math.max(GRID_CONFIG.MIN_H, item.h), GRID_CONFIG.ROWS - clampedY);

            return {
                i: item.i,
                x: clampedX,
                y: clampedY,
                w: clampedW,
                h: clampedH,
                isDraggable: !item.static,
                isResizable: !item.static,
            };
        });
        setLayout(converted);
    }, [setLayout]);

    // 드래그/리사이즈 시작/종료 핸들러
    const handleDragStart = useCallback(() => setIsDragging(true), []);
    const handleDragStop = useCallback(() => setIsDragging(false), []);
    const handleResizeStart = useCallback(() => setIsDragging(true), []);
    const handleResizeStop = useCallback(() => setIsDragging(false), []);

    // 행 높이 계산 (24행 기준) - 마진을 고려하여 정확하게 계산
    // Formula: (ContainerHeight - (MarginY * (Rows - 1))) / Rows
    // 안전 여유분(-2px)을 추가하여 서브픽셀 렌더링 이슈 방지
    const effectiveHeight = height - (GRID_CONFIG.MARGIN[1] * (GRID_CONFIG.ROWS - 1)) - 2;
    const rowHeight = height > 0 ? Math.floor(effectiveHeight / GRID_CONFIG.ROWS) : 30;

    // 빈 그리드 상태
    const isEmpty = layout.length === 0;

    return (
        <div
            ref={containerRef}
            className={cn(
                "h-full w-full bg-background overflow-hidden relative",
                isEditMode && gridConfig.isPhoneLayout && "mobile-edit-mode"
            )}
        >
            {/* 드래그 중 iframe 포인터 이벤트 차단 오버레이 */}
            {isDragging && (
                <div className="absolute inset-0 z-50 cursor-grabbing" />
            )}

            {width > 0 && height > 0 && !isEmpty && (
                <Grid
                    className="layout"
                    layout={layout.map((item: any) => {
                        // 레이아웃 아이템이 그리드 범위를 벗어나지 않도록 강제 보정 (Clamping)
                        const clampedX = Math.min(Math.max(0, item.x), GRID_CONFIG.COLS - GRID_CONFIG.MIN_W);
                        const clampedY = Math.min(Math.max(0, item.y), GRID_CONFIG.ROWS - GRID_CONFIG.MIN_H);
                        const clampedW = Math.min(item.w, GRID_CONFIG.COLS - clampedX);
                        const clampedH = Math.min(item.h, GRID_CONFIG.ROWS - clampedY);

                        // 위치에 따른 동적 최대 크기 계산 (화면 사이즈에 맞게 가변)
                        const dynamicMaxW = GRID_CONFIG.COLS - clampedX;
                        const dynamicMaxH = GRID_CONFIG.ROWS - clampedY;

                        return {
                            ...item,
                            x: clampedX,
                            y: clampedY,
                            w: Math.max(GRID_CONFIG.MIN_W, clampedW),
                            h: Math.max(GRID_CONFIG.MIN_H, clampedH),
                            static: !item.isDraggable && !item.isResizable,
                            minW: GRID_CONFIG.MIN_W,
                            minH: GRID_CONFIG.MIN_H,
                            maxW: dynamicMaxW,
                            maxH: dynamicMaxH,
                        };
                    })}
                    cols={gridConfig.isPhoneLayout ? gridConfig.cols : GRID_CONFIG.COLS}
                    maxRows={GRID_CONFIG.ROWS}
                    rowHeight={gridConfig.isPhoneLayout ? gridConfig.rowHeight : rowHeight}
                    width={width}
                    margin={[GRID_CONFIG.MARGIN[0], GRID_CONFIG.MARGIN[1]]}
                    containerPadding={[GRID_CONFIG.CONTAINER_PADDING[0], GRID_CONFIG.CONTAINER_PADDING[1]]}
                    isDraggable
                    isResizable
                    isBounded
                    preventCollision
                    compactType={null}
                    onLayoutChange={handleLayoutChange}
                    onDragStart={handleDragStart}
                    onDragStop={handleDragStop}
                    onResizeStart={handleResizeStart}
                    onResizeStop={handleResizeStop}
                    draggableHandle=".cell-drag-handle"
                    resizeHandles={['se', 'sw', 's', 'e', 'w']}
                >
                    {layout.map((item: any) => (
                        <div key={item.i} className="grid-cell-wrapper">
                            <GridCell
                                cellId={item.i}
                                content={content[item.i]}
                                isEditMode={isEditMode && gridConfig.isPhoneLayout}
                            />
                        </div>
                    ))}
                </Grid>
            )
            }

            {/* 빈 그리드 상태 */}
            {
                width > 0 && height > 0 && isEmpty && (
                    <div className="flex flex-col h-full w-full items-center justify-center gap-6">
                        <div className="text-center space-y-2">
                            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-100 dark:from-sky-900/30 dark:to-cyan-900/30 flex items-center justify-center shadow-lg">
                                <Plus className="w-10 h-10 text-sky-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-foreground mt-4">멀티뷰 시작하기</h3>
                            <p className="text-muted-foreground text-sm max-w-xs">
                                여러 스트림을 동시에 시청하세요. 셀을 추가하고 드래그하여 레이아웃을 구성합니다.
                            </p>
                        </div>
                        <button
                            onClick={() => addCell()}
                            className="px-6 py-3 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-medium rounded-xl shadow-lg shadow-sky-500/25 transition-all hover:shadow-xl hover:shadow-sky-500/30 hover:-translate-y-0.5"
                        >
                            첫 번째 셀 추가
                        </button>
                    </div>
                )
            }

            {/* 초기 로딩 상태 */}
            {
                (width === 0 || height === 0) && (
                    <div className="absolute inset-0 p-4 grid grid-cols-3 grid-rows-4 gap-4 animate-pulse">
                        {/* Skeleton Items - 3x4 Grid simulation */}
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-xl bg-muted/40 border border-muted"
                                style={{
                                    animationDelay: `${i * 100}ms`
                                }}
                            />
                        ))}
                    </div>
                )
            }
        </div >
    );
}
