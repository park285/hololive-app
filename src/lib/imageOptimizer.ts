/**
 * 이미지 최적화 유틸리티
 * wsrv.nl 오픈 소스 이미지 프록시를 사용하여 캐싱, WebP 변환, 품질 최적화 제공
 */

/**
 * 이미지 최적화 헬퍼 (wsrv.nl 오픈 소스 이미지 프록시 사용)
 * - 캐싱, WebP 변환, 품질 최적화
 * - 원본 URL을 그대로 사용 (품질 업그레이드 시 maxresdefault가 없는 영상에서 실패할 수 있음)
 * @param url - 원본 이미지 URL
 */
export function getOptimizedThumbnail(url?: string): string | undefined {
    if (!url) return undefined;

    // YouTube 썸네일 품질 업그레이드 
    let targetUrl = url;
    if (targetUrl.includes('/mqdefault.jpg')) {
        targetUrl = targetUrl.replace('/mqdefault.jpg', '/sddefault.jpg');
    }
    else if (targetUrl.includes('/hqdefault.jpg')) {
        targetUrl = targetUrl.replace('/hqdefault.jpg', '/sddefault.jpg');
    }

    // wsrv.nl로 WebP 변환 및 품질 최적화 (q=85: 선명도 향상)
    return `https://wsrv.nl/?url=${encodeURIComponent(targetUrl)}&q=85&output=webp`;
}

/**
 * 프로필 이미지 최적화 헬퍼
 * @param url - 원본 프로필 이미지 URL
 * @param displaySize - CSS 표시 크기 (기본 80px)
 * @param dpr - Device Pixel Ratio (기본 3x, 최대 선명도)
 */
export function getOptimizedProfileImage(
    url?: string,
    displaySize: number = 80,
    dpr: number = 3
): string | undefined {
    if (!url) return undefined;

    // DPR 적용: 고해상도 디스플레이에서 선명한 이미지 제공
    const actualSize = displaySize * dpr;
    // 고해상도는 품질도 상향 (3x: q=85, 2x: q=80, 1x: q=70)
    const quality = dpr >= 3 ? 85 : dpr >= 2 ? 80 : 70;

    // wsrv.nl로 리사이즈 및 WebP 변환
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${actualSize}&h=${actualSize}&fit=cover&q=${quality}&output=webp`;
}
