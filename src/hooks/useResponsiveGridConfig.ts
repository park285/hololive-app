/**
 * 반응형 그리드 설정 Hook
 * 
 * 화면 크기에 따른 그리드 설정을 제공한다.
 * - Desktop (768px 이상): 24열 그리드
 * - Mobile (768px 미만): 4열 그리드
 */

import { useState, useEffect, useMemo } from 'react';
import { useIsMobile } from './useIsMobile';
import { GRID_CONFIG } from '@/types/multiview';

interface ResponsiveGridConfig {
    /** 현재 컬럼 수 (4 또는 24) */
    cols: number;
    /** 현재 행 높이 (px) */
    rowHeight: number;
    /** 현재 breakpoint 키 */
    breakpoint: 'lg' | 'sm';
    /** 모바일(4열) 모드 여부 */
    isPhoneLayout: boolean;
    /** 화면 너비 */
    width: number;
}

/**
 * 반응형 그리드 설정 훅
 * @param containerWidth 컨테이너 너비 (기본값: window.innerWidth)
 */
export function useResponsiveGridConfig(containerWidth?: number): ResponsiveGridConfig {
    const isMobile = useIsMobile();

    // 화면 크기 변경 감지를 위한 resize 이벤트 구독
    const [width, setWidth] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth : 1024
    );

    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // containerWidth가 제공되면 사용, 아니면 window width 사용
    const effectiveWidth = containerWidth ?? width;

    // 768px 미만일 때만 4열 레이아웃 적용 (태블릿은 24열 유지)
    const isPhoneLayout = isMobile && effectiveWidth < 768;

    const config = useMemo((): ResponsiveGridConfig => {
        const cols = isPhoneLayout ? 4 : GRID_CONFIG.COLS; // 4 or 24
        const breakpoint = isPhoneLayout ? 'sm' : 'lg';

        // 마진 포함 정밀 행 높이 계산
        // react-grid-layout 공식: totalHeight = rowHeight * rows + margin * (rows - 1)
        const [marginX] = GRID_CONFIG.MARGIN;
        const totalMarginWidth = marginX * (cols - 1);
        const cellWidth = (effectiveWidth - totalMarginWidth) / cols;

        // 16:9 비율 기준 행 높이 (셀 하나가 16:9가 되도록)
        const rowHeight = Math.floor(cellWidth * (9 / 16));

        return {
            cols,
            rowHeight: Math.max(rowHeight, 30), // 최소 30px
            breakpoint,
            isPhoneLayout,
            width: effectiveWidth,
        };
    }, [isPhoneLayout, effectiveWidth]);

    return config;
}

export default useResponsiveGridConfig;
