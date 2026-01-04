import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import { queryKeys } from '@/api/queryKeys';
import {
    fetchLiveStreams,
    fetchUpcomingStreams,
    fetchLiveStreamsDelta,
    fetchUpcomingStreamsDelta,
    fetchMembers,
    searchMembers,
    getAlarms,
    addAlarm,
    removeAlarm,
    toggleAlarm,
    getSettings,
    updateSetting,
    clearCache
} from '@/api/tauri';
import type { Member, Alarm, Settings, Stream, StreamsDeltaResponse } from '@/types';

/**
 * Hololive 앱의 데이터 페칭 및 뮤테이션을 위한 React Query 커스텀 훅 모듈입니다.
 * Zustand 기반의 수동 상태 관리를 대체하여 캐싱, 자동 재검증, Optimistic UI를 제공합니다.
 */

// 스트림

/**
 * 현재 라이브 중인 스트림 목록을 조회합니다. (Delta Update 지원)
 * 첫 로드는 전체 데이터, 이후 갱신은 변경 사항만 적용합니다.
 * @param options - 추가 쿼리 옵션 (refetchInterval 등)
 */
export function useLiveStreams(options?: { refetchInterval?: number }) {
    const queryClient = useQueryClient();
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const refetchInterval = options?.refetchInterval ?? 60_000;

    // 초기 데이터 로드 (전체)
    const query = useQuery({
        queryKey: queryKeys.streams.live,
        queryFn: fetchLiveStreams,
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60,
        // NOTE: refetchInterval 사용 안 함 - Delta polling으로 대체
    });

    // Delta 기반 갱신 함수 (메모이제이션으로 불필요한 재생성 방지)
    const deltaRefetch = useCallback(async () => {
        try {
            const delta: StreamsDeltaResponse = await fetchLiveStreamsDelta();

            if (delta.hasChanges) {
                // 변경이 있으면 새 데이터로 캐시 업데이트
                queryClient.setQueryData<Stream[]>(queryKeys.streams.live, delta.streams);
                console.log(`[LiveStreams Delta] added: ${delta.added.length}, removed: ${delta.removed.length}, updated: ${delta.updated.length}`);
            }
        } catch (error) {
            console.error('[LiveStreams Delta] Error:', error);
        }
    }, [queryClient]);

    // Delta polling 설정
    useEffect(() => {
        // 초기 데이터 로드 완료 후 Delta polling 시작
        if (query.isSuccess && !intervalRef.current) {
            intervalRef.current = setInterval(deltaRefetch, refetchInterval);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [query.isSuccess, deltaRefetch, refetchInterval]);

    return query;
}

/**
 * 예정된 스트림 목록을 조회합니다. (Delta Update 지원)
 * @param options - 추가 쿼리 옵션 (refetchInterval, hours 등)
 */
export function useUpcomingStreams(options?: {
    refetchInterval?: number;
    hours?: number;
}) {
    const queryClient = useQueryClient();
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const refetchInterval = options?.refetchInterval ?? 60_000;
    const hours = options?.hours;

    // 초기 데이터 로드 (전체)
    const query = useQuery({
        queryKey: [...queryKeys.streams.upcoming, { hours }],
        queryFn: () => fetchUpcomingStreams(hours),
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60,
    });

    // Delta 기반 갱신 함수 (메모이제이션으로 불필요한 재생성 방지)
    const deltaRefetch = useCallback(async () => {
        try {
            // NOTE: Delta 조회는 현재 기본값(24h)만 지원함
            // hours 파라미터가 있는 경우 Delta 조회 대신 전체 리페치를 고려해야 할 수도 있음
            const delta: StreamsDeltaResponse = await fetchUpcomingStreamsDelta();

            if (delta.hasChanges) {
                queryClient.setQueryData<Stream[]>([...queryKeys.streams.upcoming, { hours }], delta.streams);
                console.log(`[UpcomingStreams Delta] added: ${delta.added.length}, removed: ${delta.removed.length}, updated: ${delta.updated.length}`);
            }
        } catch (error) {
            console.error('[UpcomingStreams Delta] Error:', error);
        }
    }, [queryClient, hours]);

    // Delta polling 설정
    useEffect(() => {
        // hours가 지정된 경우 Delta Polling 비활성화 (API 미지원)
        if (query.isSuccess && !intervalRef.current && !hours) {
            intervalRef.current = setInterval(deltaRefetch, refetchInterval);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [query.isSuccess, deltaRefetch, refetchInterval, hours]);

    return query;
}

// 멤버

/**
 * 전체 멤버 목록을 조회합니다.
 * 멤버 데이터는 정적 데이터로 거의 변경되지 않으므로 캐싱을 최대화합니다.
 */
export function useMembers() {
    return useQuery({
        queryKey: queryKeys.members.all,
        queryFn: fetchMembers,
        staleTime: Infinity, // NOTE: 수동 새로고침 전까지 항상 fresh 상태 유지
        gcTime: 1000 * 60 * 60 * 24, // NOTE: 24시간 캐시 유지
    });
}

/**
 * 멤버를 검색합니다.
 * Rust 백엔드에서 필터링을 수행하여 일관성을 유지합니다.
 * @param query - 검색어 (빈 문자열이면 전체 목록 반환)
 * @param hideGraduated - 졸업 멤버 숨김 여부 (설정에서 관리)
 */
export function useSearchMembers(query: string, hideGraduated?: boolean) {
    // NOTE: 쿼리 키를 구조화된 방식으로 관리하여 캐시 일관성 보장
    return useQuery({
        queryKey: [...queryKeys.members.search(query), { hideGraduated: !!hideGraduated }],
        queryFn: () => searchMembers(query, hideGraduated),
        staleTime: Infinity, // NOTE: 검색 결과도 정적 데이터로 취급
        gcTime: 1000 * 60 * 60, // NOTE: 1시간 캐시 유지
    });
}

// 알람

/**
 * 등록된 알람 목록을 조회합니다.
 */
export function useAlarms() {
    return useQuery({
        queryKey: queryKeys.alarms.all,
        queryFn: getAlarms,
        staleTime: 5 * 60_000, // NOTE: 5분간 fresh 상태 유지 (사용자 조작 시에만 변경됨)
    });
}

/**
 * 알람 등록 뮤테이션을 제공합니다.
 * Optimistic UI를 적용하여 즉각적인 피드백을 제공합니다.
 */
export function useAddAlarm() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ member }: { member: Member }) => {
            // NOTE: 다국어 이름을 함께 저장하여 알람 페이지에서 별도 멤버 데이터 fetch 불필요
            await addAlarm(
                member.channelId,
                member.name,
                member.nameKo,
                member.nameJa
            );
        },
        // NOTE: Optimistic Update - 서버 응답 전에 UI를 먼저 업데이트함
        onMutate: async ({ member }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.alarms.all });

            const previousAlarms = queryClient.getQueryData<Alarm[]>(queryKeys.alarms.all);

            const optimisticAlarm: Alarm = {
                id: Date.now(), // 임시 ID
                channelId: member.channelId,
                memberName: member.name,
                memberNameKo: member.nameKo,
                memberNameJa: member.nameJa,
                enabled: true,
                notifyMinutesBefore: 5,
            };

            queryClient.setQueryData<Alarm[]>(queryKeys.alarms.all, (old) =>
                old ? [...old, optimisticAlarm] : [optimisticAlarm]
            );

            return { previousAlarms };
        },
        onError: (_error, _variables, context) => {
            // 실패 시 이전 상태로 롤백함
            if (context?.previousAlarms) {
                queryClient.setQueryData(queryKeys.alarms.all, context.previousAlarms);
            }
        },
        onSettled: () => {
            // 성공/실패 무관하게 서버 데이터로 동기화함
            void queryClient.invalidateQueries({ queryKey: queryKeys.alarms.all });
        },
    });
}

/**
 * 알람 삭제 뮤테이션을 제공합니다.
 */
export function useRemoveAlarm() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ channelId }: { channelId: string }) => {
            await removeAlarm(channelId);
        },
        onMutate: async ({ channelId }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.alarms.all });

            const previousAlarms = queryClient.getQueryData<Alarm[]>(queryKeys.alarms.all);

            queryClient.setQueryData<Alarm[]>(queryKeys.alarms.all, (old) =>
                old?.filter((a) => a.channelId !== channelId) ?? []
            );

            return { previousAlarms };
        },
        onError: (_error, _variables, context) => {
            if (context?.previousAlarms) {
                queryClient.setQueryData(queryKeys.alarms.all, context.previousAlarms);
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.alarms.all });
        },
    });
}

/**
 * 알람 활성화/비활성화 토글 뮤테이션을 제공합니다.
 */
export function useToggleAlarm() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ channelId, enabled }: { channelId: string; enabled: boolean }) => {
            await toggleAlarm(channelId, enabled);
        },
        onMutate: async ({ channelId, enabled }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.alarms.all });

            const previousAlarms = queryClient.getQueryData<Alarm[]>(queryKeys.alarms.all);

            queryClient.setQueryData<Alarm[]>(queryKeys.alarms.all, (old) =>
                old?.map((a) => (a.channelId === channelId ? { ...a, enabled } : a)) ?? []
            );

            return { previousAlarms };
        },
        onError: (_error, _variables, context) => {
            if (context?.previousAlarms) {
                queryClient.setQueryData(queryKeys.alarms.all, context.previousAlarms);
            }
        },
    });
}

// 설정

/**
 * 전체 설정을 조회합니다.
 */
export function useSettings() {
    return useQuery({
        queryKey: queryKeys.settings.all,
        queryFn: getSettings,
    });
}

/**
 * 설정 업데이트 뮤테이션을 제공합니다.
 */
export function useUpdateSetting() {
    const queryClient = useQueryClient();

    // 백엔드 키(snake_case) → 프론트엔드 키(camelCase) 매핑
    const keyMapping: Record<string, keyof Settings> = {
        'notify_minutes_before': 'notifyMinutesBefore',
        'notify_on_live': 'notifyOnLive',
        'notify_on_upcoming': 'notifyOnUpcoming',
        'polling_interval_seconds': 'pollingIntervalSeconds',
        'api_base_url': 'apiBaseUrl',
        'theme': 'theme',
        'language': 'language',
        'offline_cache_enabled': 'offlineCacheEnabled',
        'hide_graduated': 'hideGraduated',
    };

    return useMutation({
        mutationFn: async ({ key, value }: { key: string; value: string }) => {
            await updateSetting(key, value);
        },
        onMutate: async ({ key, value }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.settings.all });

            const previousSettings = queryClient.getQueryData<Settings>(queryKeys.settings.all);
            console.log('onMutate - previousSettings:', previousSettings, 'key:', key, 'value:', value);

            const frontendKey = keyMapping[key];
            if (frontendKey && previousSettings) {
                // 값 타입 변환
                let parsedValue: unknown = value;
                if (value === 'true') parsedValue = true;
                else if (value === 'false') parsedValue = false;
                else if (!isNaN(Number(value))) parsedValue = Number(value);

                const newSettings = {
                    ...previousSettings,
                    [frontendKey]: parsedValue,
                };
                console.log('onMutate - newSettings:', newSettings);
                queryClient.setQueryData<Settings>(queryKeys.settings.all, newSettings);
            }

            return { previousSettings };
        },
        onError: (_error, _variables, context) => {
            console.error('onError - rolling back');
            if (context?.previousSettings) {
                queryClient.setQueryData(queryKeys.settings.all, context.previousSettings);
            }
        },
        onSettled: () => {
            // 서버와 동기화를 위해 설정 쿼리 무효화
            void queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
        },
    });
}

/**
 * 캐시 초기화 뮤테이션을 제공합니다.
 */
export function useClearCache() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            await clearCache();
        },
        onSuccess: () => {
            // 모든 쿼리 무효화 (데이터 다시 불러오기)
            void queryClient.invalidateQueries();
        },
    });
}
