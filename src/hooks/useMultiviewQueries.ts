/**
 * Multiview TanStack Query 훅
 * 프리셋 조회, 비디오 메타데이터 조회 등 서버 상태 관리
 *
 * **설계 원칙**:
 * - Query: 프리셋 목록, 비디오 메타데이터 (캐싱 필요)
 * - Mutation: 프리셋 저장/삭제 (캐시 무효화)
 * - Zustand Store와 역할 분리: Query는 서버 상태, Store는 UI 상태
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type {
    LayoutPreset,
    VideoMetadata,
    LayoutItem,
    CellContent,
    EncodedLayout,
    DecodedLayout,
    ValidationResult,
} from '@/types/multiview';

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Multiview 관련 Query Key Factory
 * TanStack Query 캐시 관리 및 무효화에 사용
 */
export const multiviewKeys = {
    /** 모든 multiview 관련 쿼리 */
    all: ['multiview'] as const,

    /** 프리셋 목록 */
    presets: () => [...multiviewKeys.all, 'presets'] as const,

    /** 비디오 메타데이터 (video ID 배열 기준) */
    videoMeta: (ids: string[]) =>
        [...multiviewKeys.all, 'videos', ...ids.sort()] as const,

    /** 레이아웃 인코딩 결과 */
    encoded: (layoutHash: string) =>
        [...multiviewKeys.all, 'encoded', layoutHash] as const,

    /** 레이아웃 유효성 검증 */
    validation: (layoutHash: string) =>
        [...multiviewKeys.all, 'validation', layoutHash] as const,
};

// ============================================================================
// Preset Queries
// ============================================================================

/**
 * 프리셋 목록 조회 (Built-in + Custom)
 *
 * staleTime: Infinity - 프리셋은 자주 변경되지 않음
 * 변경 시 mutation에서 수동 무효화
 */
export function useMultiviewPresets() {
    return useQuery({
        queryKey: multiviewKeys.presets(),
        queryFn: async () => {
            const presets = await invoke<LayoutPreset[]>('get_multiview_presets');
            return presets;
        },
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60, // 1시간 캐시 유지
    });
}

/**
 * 프리셋 저장 Mutation
 * 성공 시 프리셋 목록 캐시 무효화
 */
export function useSavePreset() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: {
            name: string;
            layout: LayoutItem[];
            content: Record<string, CellContent>;
        }) => {
            const preset = await invoke<LayoutPreset>('save_multiview_preset', params);
            return preset;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: multiviewKeys.presets() });
        },
        onError: (error) => {
            console.error('[useMultiviewQueries] 프리셋 저장 실패:', error);
        },
    });
}

/**
 * 프리셋 삭제 Mutation
 * Built-in 프리셋은 삭제 불가 (백엔드에서 에러 반환)
 */
export function useDeletePreset() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (presetId: string) => {
            await invoke('delete_multiview_preset', { presetId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: multiviewKeys.presets() });
        },
        onError: (error) => {
            console.error('[useMultiviewQueries] 프리셋 삭제 실패:', error);
        },
    });
}

// ============================================================================
// Video Metadata Queries
// ============================================================================

/**
 * 비디오 메타데이터 배치 조회
 *
 * YouTube oEmbed API를 통해 비디오 제목, 채널명, 썸네일 조회
 * 실패한 비디오는 결과에서 제외됨
 *
 * @param videoIds - YouTube video ID 배열
 */
export function useVideoMetadata(videoIds: string[]) {
    // 중복 제거 및 정렬 (캐시 키 일관성)
    const uniqueIds = [...new Set(videoIds)].filter(Boolean).sort();

    return useQuery({
        queryKey: multiviewKeys.videoMeta(uniqueIds),
        queryFn: async () => {
            if (uniqueIds.length === 0) return [];

            const metadata = await invoke<VideoMetadata[]>('fetch_video_metadata', {
                videoIds: uniqueIds,
            });
            return metadata;
        },
        enabled: uniqueIds.length > 0,
        staleTime: 5 * 60 * 1000, // 5분
        gcTime: 30 * 60 * 1000, // 30분 캐시 유지
    });
}

/**
 * 단일 비디오 메타데이터 조회
 * useVideoMetadata의 단일 ID 버전
 */
export function useSingleVideoMetadata(videoId: string | undefined) {
    return useVideoMetadata(videoId ? [videoId] : []);
}

// ============================================================================
// Layout Encoding/Decoding Queries
// ============================================================================

/**
 * 레이아웃 인코딩 (URL 공유용)
 *
 * 현재 레이아웃을 압축된 문자열로 변환
 * includeVideos: true면 video ID도 포함
 */
export function useEncodeLayout(
    layout: LayoutItem[],
    content: Record<string, CellContent>,
    options: { includeVideos?: boolean; enabled?: boolean } = {}
) {
    const { includeVideos = false, enabled = true } = options;

    // 레이아웃 해시 생성 (캐시 키용)
    const layoutHash = JSON.stringify({ layout, content, includeVideos });

    return useQuery({
        queryKey: multiviewKeys.encoded(layoutHash),
        queryFn: async () => {
            const encoded = await invoke<EncodedLayout>('encode_multiview_layout', {
                layout,
                content,
                includeVideos,
            });
            return encoded;
        },
        enabled: enabled && layout.length > 0,
        staleTime: Infinity, // 입력이 같으면 결과도 같음
    });
}

/**
 * 레이아웃 디코딩 (URL 파라미터 → 구조체)
 *
 * **주의**: 디코딩 시 새로운 랜덤 ID가 생성됨
 * URL 공유 로드 시에만 사용
 */
export function useDecodeLayout(encoded: string | undefined) {
    return useQuery({
        queryKey: ['multiview', 'decode', encoded],
        queryFn: async () => {
            if (!encoded) throw new Error('No encoded layout');

            const decoded = await invoke<DecodedLayout>('decode_multiview_layout', {
                encoded,
            });
            return decoded;
        },
        enabled: !!encoded,
        staleTime: Infinity,
    });
}

// ============================================================================
// Validation Queries
// ============================================================================

/**
 * 레이아웃 유효성 검증
 *
 * 셀 충돌, 범위 초과, 최소 크기 등 검증
 * 드래그/리사이즈 완료 후 호출
 */
export function useValidateLayout(
    layout: LayoutItem[],
    options: { enabled?: boolean } = {}
) {
    const { enabled = true } = options;
    const layoutHash = JSON.stringify(layout);

    return useQuery({
        queryKey: multiviewKeys.validation(layoutHash),
        queryFn: async () => {
            const result = await invoke<ValidationResult>('validate_multiview_layout', {
                layout,
            });
            return result;
        },
        enabled: enabled && layout.length > 0,
        staleTime: Infinity,
    });
}

// ============================================================================
// Prefetch Utilities
// ============================================================================

/**
 * 프리셋 목록 프리페치
 * 멀티뷰 페이지 진입 전 미리 로드
 */
export function usePrefetchPresets() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.prefetchQuery({
            queryKey: multiviewKeys.presets(),
            queryFn: () => invoke<LayoutPreset[]>('get_multiview_presets'),
            staleTime: Infinity,
        });
    };
}

/**
 * 비디오 메타데이터 프리페치
 * 멀티뷰 셀에 비디오 추가 전 미리 로드
 */
export function usePrefetchVideoMetadata() {
    const queryClient = useQueryClient();

    return (videoIds: string[]) => {
        const uniqueIds = [...new Set(videoIds)].filter(Boolean).sort();
        if (uniqueIds.length === 0) return;

        queryClient.prefetchQuery({
            queryKey: multiviewKeys.videoMeta(uniqueIds),
            queryFn: () =>
                invoke<VideoMetadata[]>('fetch_video_metadata', { videoIds: uniqueIds }),
            staleTime: 5 * 60 * 1000,
        });
    };
}
