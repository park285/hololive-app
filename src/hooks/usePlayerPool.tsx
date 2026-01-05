/**
 * Player Pool 관리 훅
 * 멀티뷰에서 동시 활성화할 수 있는 플레이어 수를 제한하여 메모리 최적화
 *
 * **설계 원칙**:
 * - 최대 6개의 YouTube/Twitch 플레이어만 동시 활성화
 * - 나머지 셀은 썸네일로 대체하여 메모리 절약
 * - LRU(Least Recently Used) 방식으로 오래된 플레이어 비활성화
 */

import { useState, useCallback, useMemo } from 'react';
import { PLAYER_POOL_CONFIG } from '@/types/multiview';

/**
 * Player Pool 상태 인터페이스
 */
export interface PlayerPoolState {
    /** 현재 활성화된 플레이어 ID 목록 (최신순) */
    activePlayerIds: string[];
    /** 특정 플레이어가 활성 상태인지 확인 */
    isPlayerActive: (cellId: string) => boolean;
    /** 플레이어 활성화 (비활성 상태면 활성화, 이미 활성화면 순서만 업데이트) */
    activatePlayer: (cellId: string) => void;
    /** 플레이어 비활성화 (명시적으로 비활성화할 때) */
    deactivatePlayer: (cellId: string) => void;
    /** 모든 플레이어 비활성화 */
    deactivateAll: () => void;
    /** 현재 활성 플레이어 수 */
    activeCount: number;
    /** 최대 활성 플레이어 수 */
    maxPlayers: number;
    /** 풀이 가득 찼는지 여부 */
    isFull: boolean;
}

/**
 * Player Pool 관리 훅
 *
 * @param maxPlayers - 최대 동시 활성 플레이어 수 (기본: 6)
 * @returns PlayerPoolState
 *
 * @example
 * ```tsx
 * const { isPlayerActive, activatePlayer } = usePlayerPool();
 *
 * // 셀 클릭 시 플레이어 활성화
 * const handleCellClick = (cellId: string) => {
 *   activatePlayer(cellId);
 * };
 *
 * // 렌더링 시 활성 상태 확인
 * if (isPlayerActive(cellId)) {
 *   return <YouTubePlayer videoId={videoId} />;
 * } else {
 *   return <VideoThumbnail videoId={videoId} onClick={() => activatePlayer(cellId)} />;
 * }
 * ```
 */
export function usePlayerPool(
    maxPlayers: number = PLAYER_POOL_CONFIG.MAX_ACTIVE_PLAYERS
): PlayerPoolState {
    const [activePlayerIds, setActivePlayerIds] = useState<string[]>([]);

    /**
     * 플레이어 활성화
     * - 이미 활성화된 경우: 순서만 맨 앞으로 이동 (MRU)
     * - 새로 활성화하는 경우: 맨 앞에 추가, 초과 시 가장 오래된 것 제거
     */
    const activatePlayer = useCallback(
        (cellId: string) => {
            setActivePlayerIds((prev) => {
                // 이미 활성화된 경우 순서만 업데이트
                if (prev.includes(cellId)) {
                    return [cellId, ...prev.filter((id) => id !== cellId)];
                }

                // 새로운 플레이어 추가
                const next = [cellId, ...prev];

                // 최대 개수 초과 시 가장 오래된 것 제거 (LRU)
                if (next.length > maxPlayers) {
                    return next.slice(0, maxPlayers);
                }

                return next;
            });
        },
        [maxPlayers]
    );

    /**
     * 플레이어 명시적 비활성화
     */
    const deactivatePlayer = useCallback((cellId: string) => {
        setActivePlayerIds((prev) => prev.filter((id) => id !== cellId));
    }, []);

    /**
     * 모든 플레이어 비활성화
     */
    const deactivateAll = useCallback(() => {
        setActivePlayerIds([]);
    }, []);

    /**
     * 특정 플레이어가 활성 상태인지 확인
     */
    const isPlayerActive = useCallback(
        (cellId: string) => {
            return activePlayerIds.includes(cellId);
        },
        [activePlayerIds]
    );

    /**
     * 파생 상태 계산
     */
    const activeCount = activePlayerIds.length;
    const isFull = activeCount >= maxPlayers;

    return useMemo(
        () => ({
            activePlayerIds,
            isPlayerActive,
            activatePlayer,
            deactivatePlayer,
            deactivateAll,
            activeCount,
            maxPlayers,
            isFull,
        }),
        [
            activePlayerIds,
            isPlayerActive,
            activatePlayer,
            deactivatePlayer,
            deactivateAll,
            activeCount,
            maxPlayers,
            isFull,
        ]
    );
}

// ============================================================================
// Player Pool Context (Optional - 컴포넌트 트리 전체 공유 시 사용)
// ============================================================================

import { createContext, useContext, ReactNode } from 'react';

const PlayerPoolContext = createContext<PlayerPoolState | null>(null);

/**
 * Player Pool Provider
 * 컴포넌트 트리 전체에서 동일한 플레이어 풀 상태 공유
 */
export function PlayerPoolProvider({
    children,
    maxPlayers = PLAYER_POOL_CONFIG.MAX_ACTIVE_PLAYERS,
}: {
    children: ReactNode;
    maxPlayers?: number;
}) {
    const poolState = usePlayerPool(maxPlayers);

    return (
        <PlayerPoolContext.Provider value= { poolState } >
        { children }
        </PlayerPoolContext.Provider>
  );
}

/**
 * Player Pool Context 소비자 훅
 * Provider 내부에서만 사용 가능
 */
export function usePlayerPoolContext(): PlayerPoolState {
    const context = useContext(PlayerPoolContext);

    if (!context) {
        throw new Error(
            'usePlayerPoolContext must be used within a PlayerPoolProvider'
        );
    }

    return context;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 플레이어 활성화 우선순위 계산
 * 사용자가 최근에 상호작용한 셀에 높은 우선순위 부여
 *
 * @param activeIds - 현재 활성 ID 목록 (최신순)
 * @param cellId - 확인할 셀 ID
 * @returns 우선순위 (0이 가장 높음, -1은 비활성)
 */
export function getPlayerPriority(
    activeIds: string[],
    cellId: string
): number {
    const index = activeIds.indexOf(cellId);
    return index === -1 ? -1 : index;
}

/**
 * 플레이어 풀에서 교체 대상 결정
 * 가장 오래된 (우선순위가 낮은) 플레이어 반환
 *
 * @param activeIds - 현재 활성 ID 목록
 * @returns 교체할 플레이어 ID 또는 undefined
 */
export function getPlayerToEvict(activeIds: string[]): string | undefined {
    if (activeIds.length === 0) return undefined;
    return activeIds[activeIds.length - 1]; // 가장 오래된 것
}

/**
 * 비디오 썸네일 URL 생성
 * 플레이어가 비활성 상태일 때 표시할 썸네일
 *
 * @param videoId - YouTube video ID
 * @param quality - 썸네일 품질 (default, medium, high, maxres)
 */
export function getYouTubeThumbnailUrl(
    videoId: string,
    quality: 'default' | 'medium' | 'high' | 'maxres' = 'high'
): string {
    const qualityMap = {
        default: 'default',
        medium: 'mqdefault',
        high: 'hqdefault',
        maxres: 'maxresdefault',
    };

    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}
