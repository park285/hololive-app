/**
 * Multiview Zustand Store
 * 멀티뷰 레이아웃, 콘텐츠, 플레이어 상태 관리
 *
 * **설계 원칙**:
 * - 실시간 상태(layout, playerStates)는 프론트엔드에서 관리
 * - 영속성(저장/로드)은 백엔드 IPC로 위임
 * - 프리셋 적용 시 백엔드에서 디코딩하여 새 ID 생성 허용
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';
import { invoke } from '@tauri-apps/api/core';
import type {
    LayoutItem,
    CellContent,
    PlayerState,
    MultiviewStore,
    DecodedLayout,
} from '@/types/multiview';
import { GRID_CONFIG } from '@/types/multiview';
import { sanitizeGhostReferences } from '@/utils/layoutReconciler';

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
    layout: [] as LayoutItem[],
    content: {} as Record<string, CellContent>,
    playerStates: {} as Record<string, PlayerState>,
    muteOthersEnabled: true,
    activePresetId: undefined as string | undefined,
    isLoading: false,
    error: null as string | null,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 고유한 셀 ID 생성
 * crypto.randomUUID()의 첫 8자 사용
 */
function generateCellId(): string {
    return crypto.randomUUID().slice(0, 8);
}

/**
 * 기본 플레이어 상태 생성
 */
function createDefaultPlayerState(cellId: string): PlayerState {
    return {
        cellId,
        muted: true, // 기본 음소거 (다중 영상 동시 재생 시 필수)
        volume: 50,
        playing: false,
        currentTime: undefined,
        playbackRate: 1.0,
    };
}

/**
 * 빈 그리드에서 새 셀의 위치 계산
 * 기존 레이아웃과 충돌하지 않는 위치 찾기 (화면 내에서만 검색)
 */
function findEmptyPosition(
    layout: LayoutItem[],
    width: number,
    height: number
): { x: number; y: number } | null {
    const { COLS, ROWS } = GRID_CONFIG;

    // 점유된 셀 맵 생성
    const occupied = new Set<string>();
    for (const item of layout) {
        for (let dx = 0; dx < item.w; dx++) {
            for (let dy = 0; dy < item.h; dy++) {
                occupied.add(`${item.x + dx},${item.y + dy}`);
            }
        }
    }

    // 빈 공간 찾기 (좌상단부터 스캔)
    for (let y = 0; y <= ROWS - height; y++) {
        for (let x = 0; x <= COLS - width; x++) {
            let canPlace = true;

            // 해당 영역이 비어있는지 확인
            outer: for (let dx = 0; dx < width && canPlace; dx++) {
                for (let dy = 0; dy < height && canPlace; dy++) {
                    if (occupied.has(`${x + dx},${y + dy}`)) {
                        canPlace = false;
                        break outer;
                    }
                }
            }

            if (canPlace) {
                return { x, y };
            }
        }
    }

    // 빈 공간이 없으면 null 반환 (화면 밖 배치 방지)
    return null;
}

// ============================================================================
// Store Definition
// ============================================================================

export const useMultiviewStore = create<MultiviewStore>((set, get) => ({
    ...initialState,

    // --------------------------------------------------------------------------
    // Layout Actions
    // --------------------------------------------------------------------------

    setLayout: (layout) => {
        set({ layout, activePresetId: undefined });
    },

    addCell: (size, options) => {
        const { layout, content, playerStates } = get();

        // 최대 개수 제한 체크
        if (options?.maxCount && layout.length >= options.maxCount) {
            set({ error: `해당 크기의 셀은 최대 ${options.maxCount}개까지만 생성 가능합니다.` });
            return;
        }

        const cellId = generateCellId();
        let result = null;

        if (size) {
            // 고정 크기 요청
            const pos = findEmptyPosition(layout, size.w, size.h);
            if (pos) {
                result = { x: pos.x, y: pos.y, w: size.w, h: size.h };
            }
        } else {
            // 기본 크기: 3x3 배치 (9개 셀)
            const DEFAULT_W = 4;   // 24열 기준 3개 = 8열씩
            const DEFAULT_H = 2;   // 24행 기준 3개 = 8행씩
            const pos = findEmptyPosition(layout, DEFAULT_W, DEFAULT_H);
            if (pos) {
                result = { x: pos.x, y: pos.y, w: DEFAULT_W, h: DEFAULT_H };
            }
        }

        // 공간이 없으면 에러 처리
        if (!result) {
            set({ error: '빈 공간이 없어 셀을 추가할 수 없습니다. 기존 셀을 정리하거나 크기를 조절해주세요.' });
            return;
        }

        const newCell: LayoutItem = {
            i: cellId,
            x: result.x,
            y: result.y,
            w: result.w,
            h: result.h,
            isDraggable: true,
            isResizable: true,
        };

        const newContent: CellContent = {
            id: cellId,
            type: 'empty',
        };

        const newPlayerState = createDefaultPlayerState(cellId);

        set({
            layout: [...layout, newCell],
            content: { ...content, [cellId]: newContent },
            playerStates: { ...playerStates, [cellId]: newPlayerState },
        });
    },

    removeCell: (cellId) => {
        const { layout, content, playerStates } = get();

        const newContent = { ...content };
        const newPlayerStates = { ...playerStates };
        delete newContent[cellId];
        delete newPlayerStates[cellId];

        set({
            layout: layout.filter((item) => item.i !== cellId),
            content: newContent,
            playerStates: newPlayerStates,
        });
    },

    // 전역 콘텐츠 삭제 (다른 기기에서 부활 방지)
    removeContent: (cellId) => {
        const { layout, content, playerStates } = get();

        // 콘텐츠와 플레이어 상태 삭제
        const newContent = { ...content };
        const newPlayerStates = { ...playerStates };
        delete newContent[cellId];
        delete newPlayerStates[cellId];

        // 모든 레이아웃에서 해당 ID 제거
        const newLayout = layout.filter((item) => item.i !== cellId);

        set({
            layout: newLayout,
            content: newContent,
            playerStates: newPlayerStates,
        });

        console.info(`[MultiviewStore] Global remove: ${cellId}`);
    },

    updateCellContent: (cellId, contentUpdate) => {
        const { content, playerStates } = get();

        const existingContent = content[cellId] || { id: cellId, type: 'empty' };
        const updatedContent = { ...existingContent, ...contentUpdate };

        // 비디오가 설정되면 타입을 'video'로 변경
        if (contentUpdate.videoId && updatedContent.type === 'empty') {
            updatedContent.type = 'video';
        }

        // 플레이어 상태가 없으면 생성
        let newPlayerStates = playerStates;
        if (!playerStates[cellId]) {
            newPlayerStates = {
                ...playerStates,
                [cellId]: createDefaultPlayerState(cellId),
            };
        }

        set({
            content: { ...content, [cellId]: updatedContent },
            playerStates: newPlayerStates,
        });
    },

    // --------------------------------------------------------------------------
    // Player State Actions
    // --------------------------------------------------------------------------

    setPlayerState: (cellId, stateUpdate) => {
        const { playerStates, muteOthersEnabled } = get();

        // 음소거 해제 시 다른 셀 자동 음소거 (muteOthersEnabled가 true인 경우)
        if (muteOthersEnabled && stateUpdate.muted === false) {
            const newStates: Record<string, PlayerState> = {};

            for (const id of Object.keys(playerStates)) {
                newStates[id] = {
                    ...playerStates[id],
                    muted: id !== cellId,
                };
            }

            newStates[cellId] = { ...newStates[cellId], ...stateUpdate };
            set({ playerStates: newStates });
        } else {
            const existingState =
                playerStates[cellId] || createDefaultPlayerState(cellId);

            set({
                playerStates: {
                    ...playerStates,
                    [cellId]: { ...existingState, ...stateUpdate },
                },
            });
        }
    },

    muteOthers: (activeCellId) => {
        const { playerStates } = get();
        const newStates: Record<string, PlayerState> = {};

        for (const id of Object.keys(playerStates)) {
            newStates[id] = {
                ...playerStates[id],
                muted: id !== activeCellId,
            };
        }

        set({ playerStates: newStates });
    },

    toggleMuteOthersMode: () => {
        set((state) => ({ muteOthersEnabled: !state.muteOthersEnabled }));
    },

    // --------------------------------------------------------------------------
    // Preset Actions
    // --------------------------------------------------------------------------

    applyPreset: async (presetId) => {
        set({ isLoading: true, error: null });

        try {
            // 백엔드에서 프리셋 디코딩 (새 ID 생성됨)
            const decoded = await invoke<DecodedLayout>('apply_multiview_preset', {
                presetId,
            });

            // 새 플레이어 상태 생성
            const newPlayerStates: Record<string, PlayerState> = {};
            for (const cellId of Object.keys(decoded.content)) {
                newPlayerStates[cellId] = createDefaultPlayerState(cellId);
            }

            set({
                layout: decoded.layout,
                content: decoded.content,
                playerStates: newPlayerStates,
                activePresetId: presetId,
                isLoading: false,
            });
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            set({ error: errorMessage, isLoading: false });
            console.error('[MultiviewStore] applyPreset failed:', e);
        }
    },

    applyPresetLayout: (preset: { id: string; layout: LayoutItem[] }) => {
        // 새 셀 ID 생성 (timestamp + index)
        const timestamp = Date.now();
        const newLayout: LayoutItem[] = preset.layout.map((item: LayoutItem, index: number) => ({
            ...item,
            i: `${timestamp}_${index}`,
        }));

        // 콘텐츠 및 플레이어 상태 초기화
        const newContent: Record<string, CellContent> = {};
        const newPlayerStates: Record<string, PlayerState> = {};

        for (const item of newLayout) {
            newContent[item.i] = {
                id: item.i,
                type: 'empty',
            };
            newPlayerStates[item.i] = createDefaultPlayerState(item.i);
        }

        set({
            layout: newLayout,
            content: newContent,
            playerStates: newPlayerStates,
            activePresetId: preset.id,
        });
    },

    saveAsPreset: async (name) => {
        const { layout, content } = get();
        set({ isLoading: true, error: null });

        try {
            await invoke('save_multiview_preset', {
                name,
                layout,
                content,
            });
            set({ isLoading: false });
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            set({ error: errorMessage, isLoading: false });
            console.error('[MultiviewStore] saveAsPreset failed:', e);
        }
    },

    // --------------------------------------------------------------------------
    // Persistence Actions
    // --------------------------------------------------------------------------

    saveState: async () => {
        const { layout, content, playerStates, muteOthersEnabled, activePresetId } =
            get();
        set({ isLoading: true, error: null });

        try {
            await invoke('save_multiview_state', {
                layout,
                content,
                playerStates,
                muteOthers: muteOthersEnabled,
                activePresetId,
            });
            set({ isLoading: false });
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            set({ error: errorMessage, isLoading: false });
            console.error('[MultiviewStore] saveState failed:', e);
        }
    },

    loadState: async () => {
        set({ isLoading: true, error: null });

        try {
            const state = await invoke<{
                layout: LayoutItem[];
                content: Record<string, CellContent>;
                playerStates: Record<string, PlayerState>;
                muteOthersEnabled: boolean;
                activePresetId?: string;
            } | null>('load_multiview_state');

            if (state) {
                // 콘텐츠 없는 레이아웃 아이템 제거
                const sanitizedLayout = sanitizeGhostReferences(state.layout, state.content);

                if (sanitizedLayout.length !== state.layout.length) {
                    console.warn(
                        `[Ghost Cleaner] Removed ${state.layout.length - sanitizedLayout.length} orphan items on load`
                    );
                }

                set({
                    layout: sanitizedLayout,
                    content: state.content,
                    playerStates: state.playerStates,
                    muteOthersEnabled: state.muteOthersEnabled,
                    activePresetId: state.activePresetId,
                    isLoading: false,
                });
            } else {
                set({ isLoading: false });
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            set({ error: errorMessage, isLoading: false });
            console.error('[MultiviewStore] loadState failed:', e);
        }
    },

    // --------------------------------------------------------------------------
    // Utility Actions
    // --------------------------------------------------------------------------

    reset: () => {
        set(initialState);
    },

    clearError: () => {
        set({ error: null });
    },
}));

// ============================================================================
// Selector Hooks (Performance Optimization)
// ============================================================================

/**
 * 레이아웃만 구독 (드래그/리사이즈 시 최적화)
 */
export const useMultiviewLayout = () =>
    useMultiviewStore((state) => state.layout);

/**
 * 콘텐츠만 구독
 */
export const useMultiviewContent = () =>
    useMultiviewStore((state) => state.content);

/**
 * 플레이어 상태만 구독
 */
export const useMultiviewPlayerStates = () =>
    useMultiviewStore((state) => state.playerStates);

/**
 * 특정 셀의 플레이어 상태만 구독
 */
export const useCellPlayerState = (cellId: string) =>
    useMultiviewStore((state) => state.playerStates[cellId]);

/**
 * 로딩/에러 상태만 구독
 */
export const useMultiviewStatus = () =>
    useMultiviewStore(
        useShallow((state) => ({
            isLoading: state.isLoading,
            error: state.error,
        }))
    );
