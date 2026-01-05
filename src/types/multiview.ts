/**
 * Multiview 타입 정의 모듈
 * 멀티뷰(분할화면) 기능을 위한 TypeScript 타입 정의
 * Rust 백엔드 models/multiview.rs와 동기화 유지
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * 그리드 아이템 (react-grid-layout 호환)
 * 24x24 그리드 시스템 기반
 */
export interface LayoutItem {
    /** 고유 ID */
    i: string;
    /** 가로 위치 (0-23) */
    x: number;
    /** 세로 위치 (0-23) */
    y: number;
    /** 너비 (1-24, 그리드 단위) */
    w: number;
    /** 높이 (1-24, 그리드 단위) */
    h: number;
    /** 드래그 가능 여부 */
    isDraggable?: boolean;
    /** 리사이즈 가능 여부 */
    isResizable?: boolean;
    /** 고정 여부 (드래그/리사이즈 모두 비활성화) */
    static?: boolean;
}

/** 셀 콘텐츠 유형 */
export type CellType = 'video' | 'chat' | 'empty';

/** 비디오 소스 유형 */
export type VideoSource = 'youtube' | 'twitch';

/**
 * 셀 콘텐츠
 * LayoutItem과 1:1 매핑
 */
export interface CellContent {
    /** LayoutItem.i와 매칭되는 ID */
    id: string;
    /** 셀 타입 */
    type: CellType;
    /** YouTube video ID 또는 Twitch 채널 */
    videoId?: string;
    /** 비디오 소스 */
    videoSource?: VideoSource;
    /** 비디오 메타데이터 (캐싱용) */
    videoMeta?: VideoMetadata;
    /** 채팅 셀의 경우, 연결된 비디오 인덱스 */
    chatTab?: number;
}

/**
 * 비디오 메타데이터 (백엔드 oEmbed 조회 결과)
 */
export interface VideoMetadata {
    /** 비디오 ID */
    id: string;
    /** 비디오 제목 */
    title: string;
    /** 채널 ID */
    channelId: string;
    /** 채널 이름 */
    channelName: string;
    /** 썸네일 URL */
    thumbnail?: string;
    /** 상태: live | upcoming | past */
    status?: 'live' | 'upcoming' | 'past';
}

/**
 * 플레이어 상태
 */
export interface PlayerState {
    /** 셀 ID */
    cellId: string;
    /** 음소거 여부 */
    muted: boolean;
    /** 볼륨 (0-100) */
    volume: number;
    /** 재생 중 여부 */
    playing: boolean;
    /** 현재 재생 시간 (아카이브 동기화용) */
    currentTime?: number;
    /** 재생 속도 */
    playbackRate?: number;
}

// ============================================================================
// Preset & Encoding Types
// ============================================================================

/**
 * 프리셋 레이아웃
 */
export interface LayoutPreset {
    /** 프리셋 ID */
    id: string;
    /** 프리셋 이름 */
    name: string;
    /** 인코딩된 레이아웃 문자열 */
    encodedLayout: string;
    /** 기본 제공 프리셋 여부 */
    isBuiltIn: boolean;
    /** 비디오 셀 개수 (필터링용) */
    videoCellCount: number;
    /** 생성 시각 */
    createdAt?: string;
}

/**
 * 인코딩된 레이아웃 (URL 공유용)
 */
export interface EncodedLayout {
    /** 인코딩된 레이아웃 문자열 */
    encoded: string;
    /** 비디오 셀 개수 */
    videoCellCount: number;
}

/**
 * 레이아웃 디코딩 결과
 */
export interface DecodedLayout {
    /** 레이아웃 아이템 배열 */
    layout: LayoutItem[];
    /** 셀 콘텐츠 맵 */
    content: Record<string, CellContent>;
    /** 비디오 셀 개수 */
    videoCellCount: number;
}

/**
 * 레이아웃 유효성 검증 결과
 */
export interface ValidationResult {
    /** 유효 여부 */
    valid: boolean;
    /** 오류 메시지 목록 */
    errors: string[];
    /** 경고 메시지 목록 */
    warnings: string[];
}

// ============================================================================
// State Types
// ============================================================================

/**
 * 멀티뷰 전체 상태 (저장/로드용)
 * Rust MultiviewState와 동기화
 */
export interface MultiviewState {
    /** 레이아웃 아이템 배열 */
    layout: LayoutItem[];
    /** 셀 콘텐츠 맵 */
    content: Record<string, CellContent>;
    /** 플레이어 상태 맵 */
    playerStates: Record<string, PlayerState>;
    /** 다른 셀 음소거 모드 활성화 여부 */
    muteOthersEnabled: boolean;
    /** 현재 활성 프리셋 ID */
    activePresetId?: string;
}

// ============================================================================
// Store Types (Zustand 확장)
// ============================================================================

/**
 * Multiview Store 인터페이스
 * State + Actions 통합 정의
 */
export interface MultiviewStore extends MultiviewState {
    // Layout Actions
    /** 레이아웃 설정 (드래그/리사이즈 후) */
    setLayout: (layout: LayoutItem[]) => void;
    /** 새 셀 추가 */
    addCell: (size?: { w: number; h: number }, options?: { maxCount?: number }) => void;
    /** 셀 삭제 (레이아웃에서만) */
    removeCell: (cellId: string) => void;
    /** 전역 콘텐츠 삭제 (다른 기기에서 부활 방지) */
    removeContent: (cellId: string) => void;
    /** 셀 콘텐츠 업데이트 */
    updateCellContent: (cellId: string, content: Partial<CellContent>) => void;

    // Player State Actions
    /** 플레이어 상태 설정 */
    setPlayerState: (cellId: string, state: Partial<PlayerState>) => void;
    /** 특정 셀 외 모두 음소거 */
    muteOthers: (activeCellId: string) => void;
    /** 음소거 모드 토글 */
    toggleMuteOthersMode: () => void;

    // Preset Actions
    /** 프리셋 적용 (백엔드 IPC) */
    applyPreset: (presetId: string) => Promise<void>;
    /** 프리셋 레이아웃 적용 (프론트엔드 전용, Built-in 프리셋) */
    applyPresetLayout: (preset: { id: string; layout: LayoutItem[] }) => void;
    /** 현재 레이아웃을 프리셋으로 저장 */
    saveAsPreset: (name: string) => Promise<void>;

    // Persistence Actions (Backend IPC)
    /** 현재 상태 저장 */
    saveState: () => Promise<void>;
    /** 저장된 상태 로드 */
    loadState: () => Promise<void>;

    // Utility Actions
    /** 상태 초기화 */
    reset: () => void;
    /** 로딩 상태 */
    isLoading: boolean;
    /** 에러 상태 */
    error: string | null;
    /** 에러 클리어 */
    clearError: () => void;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * 셀 ID 생성 옵션
 */
export interface CellIdOptions {
    /** ID 길이 (기본: 8) */
    length?: number;
}

/**
 * 그리드 설정 상수
 */
export const GRID_CONFIG = {
    /** 그리드 열 수 (24분할로 변경하여 2,3,4,6,8,12 등분 지원) */
    COLS: 24,
    /** 그리드 행 수 */
    ROWS: 24,
    /** 최소 셀 너비 */
    MIN_W: 2,
    /** 최소 셀 높이 */
    MIN_H: 2,
    /** 기본 셀 너비 */
    DEFAULT_W: 8,
    /** 기본 셀 높이 */
    DEFAULT_H: 8,
    /** 셀 마진 [x, y] */
    MARGIN: [1, 1] as const,
    /** 컨테이너 패딩 [x, y] */
    CONTAINER_PADDING: [0, 0] as const,
} as const;

/**
 * 플레이어 풀 설정
 */
export const PLAYER_POOL_CONFIG = {
    /** 최대 동시 활성 플레이어 수 */
    MAX_ACTIVE_PLAYERS: 6,
    /** 기본 볼륨 */
    DEFAULT_VOLUME: 50,
} as const;
