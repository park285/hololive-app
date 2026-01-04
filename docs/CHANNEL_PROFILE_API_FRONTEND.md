# 채널 및 프로필 API 프론트엔드 구현 가이드

> 마지막 업데이트: 2026-01-04

이 문서는 `spec.md`에 정의된 **채널 API (2.1~2.3)** 및 **프로필 API (6.1~6.2)**의 프론트엔드 구현 방법을 설명합니다.

---

## 목차

1. [백엔드 커맨드 목록](#1-백엔드-커맨드-목록)
2. [TypeScript 타입 정의](#2-typescript-타입-정의)
3. [Tauri API 래퍼 함수](#3-tauri-api-래퍼-함수)
4. [React Query 훅](#4-react-query-훅)
5. [사용 예시](#5-사용-예시)

---

## 1. 백엔드 커맨드 목록

| 커맨드명 | spec.md | 설명 |
|----------|---------|------|
| `get_channel` | 2.1 | 단일 채널 조회 |
| `get_channels_batch` | 2.2 | 배치 채널 조회 (최대 100개) |
| `search_channels` | 2.3 | 채널 검색 (미구현) |
| `get_profile_by_channel_id` | 6.1 | 채널 ID로 프로필 조회 |
| `get_profile_by_name` | 6.2 | 이름으로 프로필 조회 |

---

## 2. TypeScript 타입 정의

`src/types/index.ts`에 추가:

```typescript
/**
 * 채널 상세 정보 (API 응답)
 */
export interface ChannelDetail {
    /** YouTube 채널 ID */
    id: string;
    /** 채널명 (일본어 등) */
    name: string;
    /** 영문명 */
    englishName?: string;
    /** 프로필 사진 URL */
    photo?: string;
    /** 트위터 핸들 */
    twitter?: string;
    /** 총 영상 수 */
    videoCount?: number;
    /** 구독자 수 */
    subscriberCount?: number;
    /** 소속 (Hololive, Nijisanji 등) */
    org?: string;
    /** 세부 소속 */
    suborg?: string;
    /** 그룹 (기수 등) */
    group?: string;
}

/**
 * 프로필 데이터 엔트리 (생일, 키 등)
 */
export interface ProfileDataEntry {
    label: string;
    value: string;
}

/**
 * 소셜 링크
 */
export interface ProfileSocialLink {
    label: string;
    url: string;
}

/**
 * 프로필 정보 (Hololive 공식 사이트 데이터)
 */
export interface Profile {
    /** URL 슬러그 (예: sakura-miko) */
    slug: string;
    /** 영문명 */
    englishName?: string;
    /** 일본어명 */
    japaneseName?: string;
    /** 캐치프레이즈 */
    catchphrase?: string;
    /** 설명 */
    description?: string;
    /** 데이터 엔트리 (생일, 키 등) */
    dataEntries?: ProfileDataEntry[];
    /** 소셜 링크 */
    socialLinks?: ProfileSocialLink[];
    /** 공식 페이지 URL */
    officialUrl?: string;
}

/**
 * 번역된 프로필 데이터
 */
export interface TranslatedProfile {
    /** 표시 이름 (로컬라이즈) */
    displayName?: string;
    /** 번역된 캐치프레이즈 */
    catchphrase?: string;
    /** 요약 (한국어) */
    summary?: string;
    /** 하이라이트 키워드 */
    highlights?: string[];
    /** 번역된 데이터 엔트리 */
    data?: ProfileDataEntry[];
}

/**
 * 프로필 API 응답
 */
export interface ProfileResponse {
    profile?: Profile;
    translated?: TranslatedProfile;
}
```

---

## 3. Tauri API 래퍼 함수

`src/api/tauri.ts`에 추가:

```typescript
import { invoke } from "@tauri-apps/api/core";
import { ChannelDetail, ProfileResponse } from "@/types";

// --- Channels ---

/**
 * 단일 채널 정보를 조회합니다.
 * @param channelId YouTube 채널 ID
 */
export async function getChannel(channelId: string): Promise<ChannelDetail | null> {
    return await invoke<ChannelDetail | null>("get_channel", { channelId });
}

/**
 * 여러 채널 정보를 배치로 조회합니다. (최대 100개)
 * @param channelIds 채널 ID 배열
 * @returns 채널 ID를 키로 하는 맵
 */
export async function getChannelsBatch(
    channelIds: string[]
): Promise<Record<string, ChannelDetail>> {
    return await invoke<Record<string, ChannelDetail>>("get_channels_batch", { channelIds });
}

/**
 * 채널을 검색합니다.
 * @param query 검색어
 * @note 현재 백엔드 미지원으로 항상 에러 반환
 */
export async function searchChannels(query: string): Promise<ChannelDetail[]> {
    return await invoke<ChannelDetail[]>("search_channels", { query });
}

// --- Profiles ---

/**
 * 채널 ID로 프로필을 조회합니다.
 * @param channelId YouTube 채널 ID
 */
export async function getProfileByChannelId(
    channelId: string
): Promise<ProfileResponse> {
    return await invoke<ProfileResponse>("get_profile_by_channel_id", { channelId });
}

/**
 * 영문 이름으로 프로필을 조회합니다.
 * @param name 영문명 (예: "Sakura Miko")
 */
export async function getProfileByName(name: string): Promise<ProfileResponse> {
    return await invoke<ProfileResponse>("get_profile_by_name", { name });
}
```

---

## 4. React Query 훅

`src/hooks/useHoloQueries.ts`에 추가:

```typescript
import { useQuery } from '@tanstack/react-query';
import { 
    getChannel, 
    getChannelsBatch, 
    getProfileByChannelId, 
    getProfileByName 
} from '@/api/tauri';
import { queryKeys } from '@/api/queryKeys';

// === 채널 쿼리 ===

/**
 * 단일 채널 정보를 조회합니다.
 * @param channelId 채널 ID
 */
export function useChannel(channelId: string | null) {
    return useQuery({
        queryKey: queryKeys.channels.detail(channelId ?? ''),
        queryFn: () => getChannel(channelId!),
        enabled: !!channelId,
        staleTime: 1000 * 60 * 60, // 1시간 캐시
    });
}

/**
 * 여러 채널 정보를 배치로 조회합니다.
 * @param channelIds 채널 ID 배열
 */
export function useChannelsBatch(channelIds: string[]) {
    return useQuery({
        queryKey: queryKeys.channels.batch(channelIds),
        queryFn: () => getChannelsBatch(channelIds),
        enabled: channelIds.length > 0,
        staleTime: 1000 * 60 * 60, // 1시간 캐시
    });
}

// === 프로필 쿼리 ===

/**
 * 채널 ID로 프로필을 조회합니다.
 * @param channelId 채널 ID
 */
export function useProfileByChannelId(channelId: string | null) {
    return useQuery({
        queryKey: queryKeys.profiles.byChannelId(channelId ?? ''),
        queryFn: () => getProfileByChannelId(channelId!),
        enabled: !!channelId,
        staleTime: 1000 * 60 * 60 * 24, // 24시간 캐시 (정적 데이터)
    });
}

/**
 * 영문 이름으로 프로필을 조회합니다.
 * @param name 영문명
 */
export function useProfileByName(name: string | null) {
    return useQuery({
        queryKey: queryKeys.profiles.byName(name ?? ''),
        queryFn: () => getProfileByName(name!),
        enabled: !!name,
        staleTime: 1000 * 60 * 60 * 24, // 24시간 캐시
    });
}
```

---

## 5. Query Keys 추가

`src/api/queryKeys.ts`에 추가:

```typescript
export const queryKeys = {
    // ... 기존 키 유지
    
    channels: {
        all: ['channels'] as const,
        detail: (id: string) => ['channels', 'detail', id] as const,
        batch: (ids: string[]) => ['channels', 'batch', ids.sort().join(',')] as const,
        search: (query: string) => ['channels', 'search', query] as const,
    },
    
    profiles: {
        all: ['profiles'] as const,
        byChannelId: (id: string) => ['profiles', 'channelId', id] as const,
        byName: (name: string) => ['profiles', 'name', name] as const,
    },
};
```

---

## 6. 사용 예시

### 프로필 상세 페이지

```tsx
import { useProfileByChannelId, useChannel } from '@/hooks/useHoloQueries';

function MemberProfilePage({ channelId }: { channelId: string }) {
    const { data: channel, isLoading: channelLoading } = useChannel(channelId);
    const { data: profile, isLoading: profileLoading } = useProfileByChannelId(channelId);

    if (channelLoading || profileLoading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="profile-page">
            {/* 채널 기본 정보 */}
            <header>
                <img src={channel?.photo} alt={channel?.name} />
                <h1>{profile?.translated?.displayName ?? channel?.englishName}</h1>
                <p>{profile?.translated?.catchphrase}</p>
            </header>

            {/* 프로필 데이터 */}
            <section>
                <h2>프로필</h2>
                <dl>
                    {profile?.translated?.data?.map((entry) => (
                        <div key={entry.label}>
                            <dt>{entry.label}</dt>
                            <dd>{entry.value}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            {/* 소셜 링크 */}
            <section>
                <h2>링크</h2>
                <ul>
                    {profile?.profile?.socialLinks?.map((link) => (
                        <li key={link.label}>
                            <a href={link.url} target="_blank" rel="noopener">
                                {link.label}
                            </a>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
```

### 배치 채널 조회 (스트림 목록용)

```tsx
import { useChannelsBatch } from '@/hooks/useHoloQueries';
import { useMemo } from 'react';

function StreamList({ streams }: { streams: Stream[] }) {
    // 스트림에서 채널 ID 추출
    const channelIds = useMemo(
        () => [...new Set(streams.map(s => s.channelId))],
        [streams]
    );

    // 배치로 채널 정보 조회
    const { data: channels } = useChannelsBatch(channelIds);

    return (
        <ul>
            {streams.map((stream) => {
                const channel = channels?.[stream.channelId];
                return (
                    <li key={stream.id}>
                        <img src={channel?.photo} alt="" />
                        <span>{stream.title}</span>
                    </li>
                );
            })}
        </ul>
    );
}
```

---

## 주의 사항

1. **채널 검색 (`search_channels`)**: 현재 백엔드 API에서 지원하지 않습니다. 향후 구현 예정입니다.

2. **프로필 데이터**: 모든 멤버에 대해 프로필이 존재하지 않을 수 있습니다. `profile: null` 케이스를 반드시 처리하세요.

3. **캐싱 전략**:
   - 채널 정보: 1시간 캐시 (구독자 수 등 변동 가능성)
   - 프로필 정보: 24시간 캐시 (정적 데이터)

4. **배치 요청 제한**: `get_channels_batch`는 최대 100개까지 지원합니다. 100개 초과 시 청크로 분할하세요.
