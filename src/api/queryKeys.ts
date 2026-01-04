/**
 * Query Key Factory
 * TanStack Query의 `queryKey`를 중앙 관리하여 일관성 및 타입 안전성을 확보합니다.
 *
 * @see https://tkdodo.eu/blog/effective-react-query-keys#use-query-key-factories
 */

export const queryKeys = {
    /** 스트림 관련 쿼리 키 */
    streams: {
        all: ['streams'] as const,
        live: ['streams', 'live'] as const,
        upcoming: ['streams', 'upcoming'] as const,
    },

    /** 멤버 관련 쿼리 키 */
    members: {
        all: ['members'] as const,
        search: (query: string) => ['members', 'search', query] as const,
    },

    /** 알람 관련 쿼리 키 */
    alarms: {
        all: ['alarms'] as const,
    },

    /** 설정 관련 쿼리 키 */
    settings: {
        all: ['settings'] as const,
    },
} as const;

/** 타입 추출용 */
export type QueryKeys = typeof queryKeys;
