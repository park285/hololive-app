/**
 * Built-in 멀티뷰 프리셋 (프론트엔드 관리)
 * 
 * GRID_CONFIG와 동기화되어 그리드 크기 변경 시 자동 반영됨
 */

import { GRID_CONFIG, LayoutItem } from '@/types/multiview';

export interface LayoutPreset {
    id: string;
    name: string;
    layout: LayoutItem[];
    isBuiltIn: boolean;
    videoCellCount: number;
    createdAt?: string;
}

const { COLS, ROWS } = GRID_CONFIG;

// 헬퍼: 비율 기반 레이아웃 생성 (그리드 크기 자동 적용)
function createCell(
    id: string,
    xRatio: number,
    yRatio: number,
    wRatio: number,
    hRatio: number
): LayoutItem {
    return {
        i: id,
        x: Math.round(xRatio * COLS),
        y: Math.round(yRatio * ROWS),
        w: Math.round(wRatio * COLS),
        h: Math.round(hRatio * ROWS),
        isDraggable: true,
        isResizable: true,
    };
}

/**
 * Built-in 프리셋 목록
 * 비율 기반으로 정의되어 GRID_CONFIG 변경 시 자동 적용
 */
export const BUILTIN_PRESETS: LayoutPreset[] = [
    // === 기본 레이아웃 ===
    {
        id: 'builtin_1',
        name: '1🎞️ (전체화면)',
        layout: [
            createCell('cell_1', 0, 0, 1, 1), // 100% x 100%
        ],
        isBuiltIn: true,
        videoCellCount: 1,
    },
    {
        id: 'builtin_2',
        name: '2🎞️ (좌우 분할)',
        layout: [
            createCell('cell_1', 0, 0, 0.5, 1),     // 왼쪽 50%
            createCell('cell_2', 0.5, 0, 0.5, 1),  // 오른쪽 50%
        ],
        isBuiltIn: true,
        videoCellCount: 2,
    },
    {
        id: 'builtin_2v',
        name: '2🎞️ (상하 분할)',
        layout: [
            createCell('cell_1', 0, 0, 1, 0.5),    // 상단 50%
            createCell('cell_2', 0, 0.5, 1, 0.5), // 하단 50%
        ],
        isBuiltIn: true,
        videoCellCount: 2,
    },
    {
        id: 'builtin_2x2',
        name: '2x2🎞️',
        layout: [
            createCell('cell_1', 0, 0, 0.5, 0.5),      // 좌상
            createCell('cell_2', 0.5, 0, 0.5, 0.5),   // 우상
            createCell('cell_3', 0, 0.5, 0.5, 0.5),   // 좌하
            createCell('cell_4', 0.5, 0.5, 0.5, 0.5), // 우하
        ],
        isBuiltIn: true,
        videoCellCount: 4,
    },
    {
        id: 'builtin_3',
        name: '3🎞️ (1+2)',
        layout: [
            createCell('cell_1', 0, 0, 0.6, 1),       // 왼쪽 큰 영상 (60%)
            createCell('cell_2', 0.6, 0, 0.4, 0.5),  // 우상
            createCell('cell_3', 0.6, 0.5, 0.4, 0.5),// 우하
        ],
        isBuiltIn: true,
        videoCellCount: 3,
    },
    {
        id: 'builtin_3x2',
        name: '3x2🎞️',
        layout: [
            createCell('cell_1', 0, 0, 0.333, 0.5),
            createCell('cell_2', 0.333, 0, 0.333, 0.5),
            createCell('cell_3', 0.666, 0, 0.334, 0.5),
            createCell('cell_4', 0, 0.5, 0.333, 0.5),
            createCell('cell_5', 0.333, 0.5, 0.333, 0.5),
            createCell('cell_6', 0.666, 0.5, 0.334, 0.5),
        ],
        isBuiltIn: true,
        videoCellCount: 6,
    },
    {
        id: 'builtin_3x3',
        name: '3x3🎞️',
        layout: [
            createCell('cell_1', 0, 0, 0.333, 0.333),
            createCell('cell_2', 0.333, 0, 0.333, 0.333),
            createCell('cell_3', 0.666, 0, 0.334, 0.333),
            createCell('cell_4', 0, 0.333, 0.333, 0.333),
            createCell('cell_5', 0.333, 0.333, 0.333, 0.333),
            createCell('cell_6', 0.666, 0.333, 0.334, 0.333),
            createCell('cell_7', 0, 0.666, 0.333, 0.334),
            createCell('cell_8', 0.333, 0.666, 0.333, 0.334),
            createCell('cell_9', 0.666, 0.666, 0.334, 0.334),
        ],
        isBuiltIn: true,
        videoCellCount: 9,
    },
    {
        id: 'builtin_4x4',
        name: '4x4🎞️',
        layout: Array.from({ length: 16 }, (_, i) => {
            const row = Math.floor(i / 4);
            const col = i % 4;
            return createCell(`cell_${i + 1}`, col * 0.25, row * 0.25, 0.25, 0.25);
        }),
        isBuiltIn: true,
        videoCellCount: 16,
    },
    // === 채팅 포함 레이아웃 ===
    {
        id: 'builtin_side_chat',
        name: '1🎞️ + 💬 (사이드)',
        layout: [
            createCell('cell_1', 0, 0, 0.75, 1),    // 영상 75%
            createCell('chat_1', 0.75, 0, 0.25, 1), // 채팅 25%
        ],
        isBuiltIn: true,
        videoCellCount: 1,
    },
    {
        id: 'builtin_2_1chat',
        name: '2🎞️ + 1💬',
        layout: [
            createCell('cell_1', 0, 0, 0.5, 0.5),      // 좌상 영상
            createCell('cell_2', 0, 0.5, 0.5, 0.5),   // 좌하 영상
            createCell('chat_1', 0.5, 0, 0.5, 1),     // 우측 채팅
        ],
        isBuiltIn: true,
        videoCellCount: 2,
    },
    {
        id: 'builtin_1_bottom_chat',
        name: '1🎞️ + 💬 (하단)',
        layout: [
            createCell('cell_1', 0, 0, 1, 0.65),      // 영상 65%
            createCell('chat_1', 0, 0.65, 1, 0.35),  // 채팅 35%
        ],
        isBuiltIn: true,
        videoCellCount: 1,
    },
];

/**
 * 프리셋 ID로 찾기
 */
export function getPresetById(id: string): LayoutPreset | undefined {
    return BUILTIN_PRESETS.find(p => p.id === id);
}

/**
 * 프리셋 레이아웃 적용 (셀 ID 새로 생성)
 */
export function applyPresetLayout(preset: LayoutPreset): LayoutItem[] {
    // 각 셀에 고유 ID 부여 (timestamp + index 기반)
    const timestamp = Date.now();
    return preset.layout.map((item, index) => ({
        ...item,
        i: `${timestamp}_${index}`,
    }));
}
