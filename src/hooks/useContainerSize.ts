import { useState, useEffect, useCallback, RefObject } from 'react';

interface ContainerSize {
    width: number;
    height: number;
}

/**
 * 컨테이너 크기를 추적하는 훅
 * - 초기 마운트 시 즉시 크기 측정
 * - ResizeObserver를 통한 변경 감지
 * - 디바운싱으로 성능 최적화
 */
export function useContainerSize(
    ref: RefObject<HTMLElement | null>,
    debounceMs: number = 16 // ~60fps
): ContainerSize {
    const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 });

    // 크기 측정 함수
    const measureSize = useCallback(() => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        setSize(prev => {
            // 변경이 없으면 업데이트 스킵 (불필요한 리렌더 방지)
            if (prev.width === rect.width && prev.height === rect.height) {
                return prev;
            }
            return { width: rect.width, height: rect.height };
        });
    }, [ref]);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        // 초기 측정 (즉시)
        measureSize();

        // 디바운스 타이머
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const handleResize = (entries: ResizeObserverEntry[]) => {
            // entries 배열이 비어있을 경우 방어
            if (!entries.length) return;

            // 디바운싱: 빠른 연속 리사이즈 최적화
            if (timeoutId) clearTimeout(timeoutId);

            timeoutId = setTimeout(() => {
                const { width, height } = entries[0].contentRect;
                setSize(prev => {
                    if (prev.width === width && prev.height === height) {
                        return prev;
                    }
                    return { width, height };
                });
            }, debounceMs);
        };

        const observer = new ResizeObserver(handleResize);
        observer.observe(element);

        // 윈도우 리사이즈 이벤트도 감지 (사이드바 토글 등)
        const handleWindowResize = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(measureSize, debounceMs);
        };
        window.addEventListener('resize', handleWindowResize);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', handleWindowResize);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [ref, debounceMs, measureSize]);

    return size;
}
