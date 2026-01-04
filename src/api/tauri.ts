import { invoke } from "@tauri-apps/api/core";
import { Stream, Member, Alarm, Settings, StreamsDeltaResponse } from "@/types";

/**
 * Tauri API 호출을 래핑하는 모듈입니다.
 * Rust 백엔드의 커맨드를 타입 안전하게 호출합니다.
 */

// --- Streams ---

/**
 * 현재 라이브 중인 스트림 목록을 조회합니다.
 */
export async function fetchLiveStreams(): Promise<Stream[]> {
    // Rust 커맨드는 Vec<Stream>을 직접 반환함
    return await invoke<Stream[]>("fetch_live_streams");
}

/**
 * 예정된 스트림 목록을 조회합니다.
 * @param hours 조회할 시간 범위 (1-168). 생략 시 기본값(24h) 적용.
 */
export async function fetchUpcomingStreams(hours?: number): Promise<Stream[]> {
    // Rust 커맨드는 Vec<Stream>을 직접 반환함
    return await invoke<Stream[]>("fetch_upcoming_streams", { hours });
}

/**
 * 라이브 스트림 Delta 조회 - 변경된 데이터만 반환합니다.
 * @returns 추가/삭제/변경된 스트림 정보
 */
export async function fetchLiveStreamsDelta(): Promise<StreamsDeltaResponse> {
    return await invoke<StreamsDeltaResponse>("fetch_live_streams_delta");
}

/**
 * 예정 스트림 Delta 조회 - 변경된 데이터만 반환합니다.
 * @returns 추가/삭제/변경된 스트림 정보
 */
export async function fetchUpcomingStreamsDelta(): Promise<StreamsDeltaResponse> {
    return await invoke<StreamsDeltaResponse>("fetch_upcoming_streams_delta");
}

// --- Members ---

/**
 * 전체 멤버 목록을 조회합니다.
 */
export async function fetchMembers(): Promise<Member[]> {
    // Rust 커맨드는 Vec<Member>를 직접 반환함
    return await invoke<Member[]>("fetch_members");
}

/**
 * 멤버를 검색합니다.
 * @param query 검색어 (이름, 별명 등)
 * @param hideGraduated 졸업 멤버 숨김 여부
 */
export async function searchMembers(query: string, hideGraduated?: boolean): Promise<Member[]> {
    // Rust 커맨드는 Vec<Member>를 직접 반환함
    return await invoke<Member[]>("search_members", { query, hideGraduated });
}

// --- Alarms ---

/**
 * 등록된 알람 목록을 조회합니다.
 */
export async function getAlarms(): Promise<Alarm[]> {
    return await invoke<Alarm[]>("get_alarms");
}

/**
 * 알람을 추가합니다.
 * @param channelId 채널 ID
 * @param memberName 영문 이름 (기본값)
 * @param memberNameKo 한국어 이름 (선택)
 * @param memberNameJa 일본어 이름 (선택)
 */
export async function addAlarm(
    channelId: string,
    memberName: string,
    memberNameKo?: string,
    memberNameJa?: string
): Promise<void> {
    await invoke("add_alarm", { channelId, memberName, memberNameKo, memberNameJa });
}

/**
 * 알람을 삭제합니다.
 * @param channelId 채널 ID
 */
export async function removeAlarm(channelId: string): Promise<void> {
    await invoke("remove_alarm", { channelId });
}

/**
 * 알람 활성화 여부를 토글합니다.
 * @param channelId 채널 ID
 * @param enabled 활성화 여부
 */
export async function toggleAlarm(channelId: string, enabled: boolean): Promise<void> {
    await invoke("toggle_alarm", { channelId, enabled });
}

// --- Settings ---

/**
 * 모든 설정을 조회합니다.
 */
export async function getSettings(): Promise<Settings> {
    return await invoke<Settings>("get_settings");
}

/**
 * 설정을 업데이트합니다.
 * @param key 설정 키
 * @param value 설정 값
 */
export async function updateSetting(key: string, value: string): Promise<void> {
    await invoke("update_setting", { key, value });
}

/**
 * 앱 데이터 캐시를 삭제합니다.
 */
export async function clearCache(): Promise<void> {
    await invoke("clear_cache");
}
