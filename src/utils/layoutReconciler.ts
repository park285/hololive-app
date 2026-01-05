/**
 * 레이아웃 정합성 유틸리티
 * 
 * 레이아웃과 콘텐츠 간의 불일치를 자동 보정한다.
 * - 콘텐츠 없는 레이아웃 아이템(유령 참조) 제거
 * - 레이아웃 없는 콘텐츠 자동 추가
 */

import type { LayoutItem, CellContent } from '@/types/multiview';

/**
 * Ghost Reference 제거 (Sanitize)
 * 
 * 레이아웃에는 있지만 콘텐츠가 없는 아이템을 제거합니다.
 * 모바일에서 removeContent(전역 삭제) 후 PC 레이아웃에 남은 유령 참조를 정리합니다.
 * 
 * @param layout 레이아웃 배열
 * @param content 콘텐츠 맵
 * @returns 정리된 레이아웃 배열
 */
export function sanitizeGhostReferences(
    layout: LayoutItem[],
    content: Record<string, CellContent>
): LayoutItem[] {
    return layout.filter(item => {
        const hasContent = item.i in content;
        if (!hasContent) {
            console.warn(`[Ghost Cleaner] Removing orphan layout item: ${item.i}`);
        }
        return hasContent;
    });
}

/**
 * 모든 레이아웃(lg, md, sm)에서 Ghost Reference 제거
 * 
 * @param layouts 반응형 레이아웃 객체
 * @param content 콘텐츠 맵
 * @returns 정리된 레이아웃 객체
 */
export function sanitizeAllLayouts(
    layouts: { lg?: LayoutItem[]; md?: LayoutItem[]; sm?: LayoutItem[] },
    content: Record<string, CellContent>
): { lg: LayoutItem[]; md?: LayoutItem[]; sm?: LayoutItem[] } {
    return {
        lg: sanitizeGhostReferences(layouts.lg ?? [], content),
        md: layouts.md ? sanitizeGhostReferences(layouts.md, content) : undefined,
        sm: layouts.sm ? sanitizeGhostReferences(layouts.sm, content) : undefined,
    };
}

/**
 * 레이아웃과 콘텐츠 간 불일치 자동 보정 (Auto-Reconciliation)
 * 
 * 1. Pruning: 콘텐츠 없는 셀 제거 (Ghost Cleaner)
 * 2. Appending: 레이아웃 없는 콘텐츠 추가 (y=Infinity로 자동 배치)
 * 
 * @param targetLayout 대상 레이아웃 배열
 * @param activeContent 활성 콘텐츠 맵
 * @param cols 컬럼 수 (기본: 4)
 * @returns 보정된 레이아웃 배열
 */
export function reconcileLayout(
    targetLayout: LayoutItem[] | undefined,
    activeContent: Record<string, CellContent>,
    cols: number = 4
): LayoutItem[] {
    const layout = targetLayout ?? [];

    // 1. Pruning: 콘텐츠 없는 셀 제거
    const prunedLayout = sanitizeGhostReferences(layout, activeContent);

    // 2. Appending: 레이아웃에 없는 콘텐츠 추가
    const layoutIds = new Set(prunedLayout.map(item => item.i));
    const missingContentIds = Object.keys(activeContent).filter(id => !layoutIds.has(id));

    if (missingContentIds.length > 0) {
        console.info(`[Reconciler] Adding ${missingContentIds.length} missing items to layout`);
    }

    const newItems: LayoutItem[] = missingContentIds.map((id, index) => ({
        i: id,
        x: (index % cols) * Math.floor(cols / 2), // 간격을 두고 배치
        y: Infinity, // react-grid-layout이 자동으로 맨 아래에 배치
        w: Math.floor(cols / 2), // 기본 너비 (4열이면 2, 24열이면 12)
        h: 2, // 기본 높이
        isDraggable: true,
        isResizable: true,
    }));

    return [...prunedLayout, ...newItems];
}

export default {
    sanitizeGhostReferences,
    sanitizeAllLayouts,
    reconcileLayout,
};
