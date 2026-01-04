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

    // NOTE: 품질 업그레이드 제거 - maxresdefault가 없는 영상에서 이미지 로드 실패 방지
    // 원본 URL 그대로 사용, WebP 변환 및 캐싱만 적용 (q=70: 모바일 최적화)
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&q=70&output=webp`;
}

/**
 * 프로필 이미지 최적화 헬퍼
 * @param url - 원본 프로필 이미지 URL
 * @param size - 원하는 크기 (기본 80px)
 */
export function getOptimizedProfileImage(url?: string, size: number = 80): string | undefined {
    if (!url) return undefined;

    // wsrv.nl로 리사이즈 및 WebP 변환 (q=70: 모바일 최적화)
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${size}&h=${size}&fit=cover&q=70&output=webp`;
}
