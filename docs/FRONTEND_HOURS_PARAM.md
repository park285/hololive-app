# Frontend hours 파라미터 적용 가이드

> 작성일: 2026-01-04

## 개요

`/api/holo/streams/upcoming` 엔드포인트에 `hours` 파라미터가 추가되어, 프론트엔드에서 조회 범위를 유연하게 지정할 수 있습니다.

## Rust Client API 변경 사항

### 변경 전
```rust
pub async fn get_upcoming_streams(&self) -> ApiResult<Vec<Stream>>
```

### 변경 후
```rust
pub async fn get_upcoming_streams(&self, hours: Option<u32>) -> ApiResult<Vec<Stream>>
```

## 사용 방법

### 1. Tauri Command 확장 (필요 시)

현재 `fetch_upcoming_streams` command는 기본값(24시간)만 지원합니다.
hours 파라미터를 프론트엔드에서 전달하려면 command 수정이 필요합니다:

```rust
// src-tauri/src/commands/streams.rs
#[tauri::command]
pub async fn fetch_upcoming_streams(
    state: State<'_, AppState>,
    hours: Option<u32>,  // 추가
) -> Result<Vec<Stream>, ApiError> {
    // ... hours 파라미터 전달
    client.get_upcoming_streams(hours).await
}
```

### 2. Frontend (TypeScript) 호출

```typescript
// src/api/tauri.ts
export async function fetchUpcomingStreams(hours?: number): Promise<Stream[]> {
  return invoke('fetch_upcoming_streams', { hours });
}
```

### 3. React Query Hook 수정

```typescript
// src/hooks/useHoloQueries.ts
export function useUpcomingStreams(options?: { 
  refetchInterval?: number;
  hours?: number;  // 추가
}) {
    const queryClient = useQueryClient();
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const refetchInterval = options?.refetchInterval ?? 60_000;
    const hours = options?.hours;  // 추가

    const query = useQuery({
        queryKey: [...queryKeys.streams.upcoming, { hours }],  // 캐시 키에 hours 포함
        queryFn: () => fetchUpcomingStreams(hours),
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60,
    });
    
    // ... 나머지 동일
}
```

### 4. 컴포넌트에서 사용

```tsx
// 기본 24시간 조회
const { data: streams } = useUpcomingStreams();

// 48시간 조회
const { data: streams48h } = useUpcomingStreams({ hours: 48 });

// 1주일 조회
const { data: streamsWeek } = useUpcomingStreams({ hours: 168 });
```

## 파라미터 범위

| 값 | 설명 |
|----|------|
| `undefined` / `null` | 기본값 24시간 사용 |
| `1-24` | 단기 조회 (당일 확인용) |
| `24-72` | 중기 조회 (2-3일) |
| `72-168` | 장기 조회 (최대 1주일) |

> **주의**: 168시간(1주일)을 초과하는 값은 백엔드에서 168로 제한될 수 있습니다.

## 캐시 고려사항

- hours 값이 다르면 **별도 캐시 항목**으로 관리됩니다.
- 여러 hours 값을 동시에 사용하면 메모리 사용량이 증가합니다.
- Delta polling은 현재 기본값(None)만 지원합니다. hours 파라미터 사용 시 별도 처리가 필요합니다.

## 관련 파일

- `src-tauri/src/api/streams.rs` - API Client
- `src-tauri/src/commands/streams.rs` - Tauri Commands
- `src/api/tauri.ts` - Frontend API 래퍼
- `src/hooks/useHoloQueries.ts` - React Query 훅
- `spec.md` - API 문서
