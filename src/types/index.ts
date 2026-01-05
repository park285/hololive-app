/**
 * Hololive 앱 공통 타입 정의 모듈
 * Rust 백엔드와 프론트엔드 간 데이터 구조를 정의합니다.
 */

/**
 * 채널 정보
 * YouTube 채널의 기본 메타데이터를 나타냅니다.
 */
export interface Channel {
    /** 채널 고유 ID (YouTube channel ID) */
    id: string;
    /** 채널 이름 */
    name: string;
    /** 채널 프로필 이미지 URL */
    photo?: string;
    /** 소속 조직 (예: hololive, nijisanji) */
    org?: string;
}

/** 스트림 상태: 라이브 중 | 예정됨 | 종료됨 */
export type StreamStatus = 'live' | 'upcoming' | 'past';

/**
 * 스트림 정보
 * 라이브 방송 또는 예정된 방송의 상세 정보를 나타냅니다.
 */
export interface Stream {
    /** 스트림 고유 ID (YouTube video ID) */
    id: string;
    /** 방송 제목 */
    title: string;
    /** 채널 ID */
    channelId: string;
    /** 채널 이름 */
    channelName: string;
    /** 방송 상태 */
    status: StreamStatus;
    /** 예정된 시작 시간 (ISO 8601 형식) */
    startScheduled?: string;
    /** 실제 시작 시간 (ISO 8601 형식) */
    startActual?: string;
    /** 방송 길이 (초 단위) */
    duration?: number;
    /** 썸네일 이미지 URL */
    thumbnail?: string;
    /** YouTube 방송 링크 */
    link?: string;
    /** 채널 상세 정보 */
    channel?: Channel;
    /** 시작까지 남은 초 (Rust 백엔드에서 사전 계산) */
    secondsUntilStart?: number;
}

/**
 * 멤버 별명 (다국어)
 * 검색 최적화를 위한 다국어 별명 목록입니다.
 */
export interface Aliases {
    /** 한국어 별명 목록 */
    ko: string[];
    /** 일본어 별명 목록 */
    ja: string[];
}

/**
 * 멤버 정보
 * 홀로라이브 멤버의 프로필 정보를 나타냅니다.
 */
export interface Member {
    /** 채널 ID (YouTube channel ID) */
    channelId: string;
    /** 영문 이름 */
    name: string;
    /** 한국어 이름 */
    nameKo?: string;
    /** 일본어 이름 */
    nameJa?: string;
    /** 다국어 별명 */
    aliases?: Aliases;
    /** 졸업 여부 */
    graduated: boolean;
    /** 소속 그룹/세대 */
    group?: string;
    /** 프로필 이미지 URL */
    photo?: string;
}

/**
 * 알람 설정
 * 특정 멤버의 방송 알림 설정을 나타냅니다.
 */
export interface Alarm {
    /** 알람 고유 ID (DB primary key) */
    id: number;
    /** 대상 채널 ID */
    channelId: string;
    /** 멤버 이름 - 영문 (기본값) */
    memberName: string;
    /** 멤버 이름 - 한국어 */
    memberNameKo?: string;
    /** 멤버 이름 - 일본어 */
    memberNameJa?: string;
    /** 알람 활성화 여부 */
    enabled: boolean;
    /** 방송 시작 전 알림 시간 (분 단위) */
    notifyMinutesBefore: number;
    /** 알람 생성 시간 (ISO 8601 형식) */
    createdAt?: string;
}

/**
 * 앱 설정
 * 사용자가 커스터마이징할 수 있는 앱 전체 설정입니다.
 */
export interface Settings {
    /** 방송 시작 전 알림 시간 (분 단위, 기본값: 5) */
    notifyMinutesBefore: number;
    /** 라이브 시작 시 알림 여부 */
    notifyOnLive: boolean;
    /** 예정된 방송 알림 여부 */
    notifyOnUpcoming: boolean;
    /** API 폴링 간격 (초 단위) */
    pollingIntervalSeconds: number;
    /** API 서버 기본 URL */
    apiBaseUrl: string;
    /** 테마 설정: 시스템 | 라이트 | 다크 */
    theme: 'system' | 'light' | 'dark';
    /** 언어 설정: 한국어 | 일본어 | 영어 */
    language: 'ko' | 'ja' | 'en';
    /** 오프라인 캐시 사용 여부 */
    offlineCacheEnabled: boolean;
    /** 졸업 멤버 숨김 여부 */
    hideGraduated: boolean;
    /** 알림음 파일 경로 (없으면 기본음) */
    notificationSoundPath?: string;
}

/**
 * Delta Update 응답
 * 캐시된 데이터와 새 데이터를 비교하여 변경 사항만 전달합니다.
 * 네트워크 대역폭과 렌더링 성능 최적화에 사용됩니다.
 * 
 * Payload Diet: hasChanges가 false일 때 다른 필드는 생략됩니다.
 * JSON 예시: {"hasChanges":false} (최소 페이로드)
 */
export interface StreamsDeltaResponse {
    /** 변경 사항 존재 여부 ("Trust the Flag" - 프론트엔드 판단 기준) */
    hasChanges: boolean;
    /** 전체 스트림 목록 (변경이 있을 때만 포함, 없으면 undefined) */
    streams?: Stream[];
    /** 새로 추가된 스트림 ID 목록 (없으면 undefined) */
    added?: string[];
    /** 삭제된 스트림 ID 목록 (없으면 undefined) */
    removed?: string[];
    /** 업데이트된 스트림 ID 목록 (없으면 undefined) */
    updated?: string[];
}

/**
 * 세션 인증 에러 코드
 * Rust 백엔드의 SessionAuthError::code()와 동일한 값
 */
export type SessionAuthErrorCode =
    | 'INVALID_CREDENTIALS'
    | 'EMAIL_EXISTS'
    | 'INVALID_INPUT'
    | 'UNAUTHORIZED'
    | 'NETWORK_ERROR'
    | 'STORAGE_ERROR'
    | 'RATE_LIMITED'
    | 'ACCOUNT_LOCKED'
    | 'SESSION_EXPIRED'
    | 'UNKNOWN';

/**
 * 커맨드 에러 응답
 * Rust 백엔드에서 반환하는 구조화된 에러 타입
 */
export interface CommandError {
    /** 에러 코드 (분기 처리용) */
    code: SessionAuthErrorCode;
    /** 사람이 읽을 수 있는 에러 메시지 */
    message: string;
}

/**
 * Tauri 커맨드 에러를 CommandError로 파싱
 * @param error - invoke에서 throw된 에러
 * @returns 파싱된 CommandError 또는 기본 에러
 */
export function parseCommandError(error: unknown): CommandError {
    // 이미 CommandError 형태인 경우
    if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        'message' in error
    ) {
        return error as CommandError;
    }

    // 문자열 에러
    if (typeof error === 'string') {
        return {
            code: 'UNKNOWN',
            message: error,
        };
    }

    // Error 객체
    if (error instanceof Error) {
        return {
            code: 'UNKNOWN',
            message: error.message,
        };
    }

    return {
        code: 'UNKNOWN',
        message: 'An unknown error occurred',
    };
}

