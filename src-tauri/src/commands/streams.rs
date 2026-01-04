// 스트림 관련 IPC 커맨드
// Cache-First 전략: 유효한 캐시가 있으면 API 호출 없이 즉시 반환

#![allow(clippy::needless_pass_by_value)]

use chrono::{Duration, Utc};
use tauri::State;
use tracing::{info, warn};

use crate::api::ApiError;
use crate::db::{cache::CacheKey, Database};
use crate::models::Stream;
use crate::AppState;

/// 스트림 캐시 유효 기간 (1분) - 실시간 데이터이므로 짧게 설정
const CACHE_TTL_SECONDS: i64 = 60;

/// 캐시된 스트림 목록 로드 (TTL 체크 포함)
///
/// **Cache-First 전략**:
/// - 유효한 캐시(1분 이내)가 있으면 API 호출 없이 즉시 반환
/// - 캐시가 만료되었거나 없으면 None 반환
fn load_cached_streams_if_valid(db: &Database, key: &CacheKey) -> Option<Vec<Stream>> {
    db.get_cache(key).ok().flatten().and_then(|entry| {
        let ttl = Duration::seconds(CACHE_TTL_SECONDS);
        if Utc::now().signed_duration_since(entry.cached_at) > ttl {
            info!(
                "stream_cache_expired: {}, refreshing from API",
                key.to_key_string()
            );
            return None;
        }
        serde_json::from_str(&entry.data).ok()
    })
}

/// 캐시된 스트림 목록 로드 (TTL 무시, 오프라인 fallback용)
fn load_cached_streams_any(db: &Database, key: &CacheKey) -> Option<Vec<Stream>> {
    db.get_cache(key)
        .ok()
        .flatten()
        .and_then(|entry| serde_json::from_str(&entry.data).ok())
}

async fn fetch_live_streams_impl(state: &AppState) -> Result<Vec<Stream>, ApiError> {
    let db = &state.db;

    // === Cache-First 전략 ===
    // 1. 유효한 캐시가 있으면 API 호출 없이 즉시 반환
    if let Some(cached_streams) = load_cached_streams_if_valid(db, &CacheKey::LiveStreams) {
        info!(
            "live_stream_cache_hit: returning {} streams from cache",
            cached_streams.len()
        );
        return Ok(cached_streams);
    }

    // 2. 캐시가 없거나 만료됨 → API에서 갱신
    let client = state
        .get_api_client()
        .ok_or_else(|| ApiError::Internal("클라이언트 생성 실패".to_string()))?;

    match client.get_live_streams().await {
        Ok(streams) => {
            // NOTE: 프론트엔드 렌더링 최적화를 위해 상대 시간을 사전 계산함
            let streams: Vec<Stream> = streams
                .into_iter()
                .map(super::super::models::stream::Stream::with_computed_time)
                .collect();

            // 성공 시 캐시 저장
            if let Ok(json) = serde_json::to_string(&streams) {
                let _ = db.set_cache(&CacheKey::LiveStreams, &json);
            }
            info!(
                "live_stream_cache_refreshed: {} streams cached",
                streams.len()
            );
            Ok(streams)
        }
        Err(err) => {
            // 네트워크 에러 시 만료된 캐시라도 사용 (오프라인 지원)
            if let Some(cached) = load_cached_streams_any(db, &CacheKey::LiveStreams) {
                warn!("fetch_live_streams_fallback_to_expired_cache: {err}");
                return Ok(cached);
            }
            Err(err)
        }
    }
}

async fn fetch_upcoming_streams_impl(
    state: &AppState,
    hours: Option<u32>,
) -> Result<Vec<Stream>, ApiError> {
    let db = &state.db;

    // === Cache-First 전략 ===
    // 1. 유효한 캐시가 있으면 API 호출 없이 즉시 반환
    if let Some(cached_streams) =
        load_cached_streams_if_valid(db, &CacheKey::UpcomingStreams(hours))
    {
        info!(
            "upcoming_stream_cache_hit: returning {} streams from cache (hours: {:?})",
            cached_streams.len(),
            hours
        );
        return Ok(cached_streams);
    }

    // 2. 캐시가 없거나 만료됨 → API에서 갱신
    let client = state
        .get_api_client()
        .ok_or_else(|| ApiError::Internal("클라이언트 생성 실패".to_string()))?;

    match client.get_upcoming_streams(hours).await {
        Ok(streams) => {
            // NOTE: 프론트엔드 렌더링 최적화를 위해 상대 시간을 사전 계산함
            let streams: Vec<Stream> = streams
                .into_iter()
                .map(super::super::models::stream::Stream::with_computed_time)
                .collect();

            // 성공 시 캐시 저장
            if let Ok(json) = serde_json::to_string(&streams) {
                let _ = db.set_cache(&CacheKey::UpcomingStreams(hours), &json);
            }
            info!(
                "upcoming_stream_cache_refreshed: {} streams cached",
                streams.len()
            );
            Ok(streams)
        }
        Err(err) => {
            // 네트워크 에러 시 만료된 캐시라도 사용 (오프라인 지원)
            if let Some(cached) = load_cached_streams_any(db, &CacheKey::UpcomingStreams(hours)) {
                warn!("fetch_upcoming_streams_fallback_to_expired_cache: {err}");
                return Ok(cached);
            }
            Err(err)
        }
    }
}

#[tauri::command]
pub async fn fetch_live_streams(state: State<'_, AppState>) -> Result<Vec<Stream>, ApiError> {
    fetch_live_streams_impl(state.inner()).await
}

#[tauri::command]
pub async fn fetch_upcoming_streams(
    state: State<'_, AppState>,
    hours: Option<u32>,
) -> Result<Vec<Stream>, ApiError> {
    fetch_upcoming_streams_impl(state.inner(), hours).await
}

/// 라이브 스트림 Delta 조회 - 변경된 데이터만 반환
#[tauri::command]
pub async fn fetch_live_streams_delta(
    state: State<'_, AppState>,
) -> Result<crate::models::StreamsDeltaResponse, ApiError> {
    fetch_streams_delta_impl(state.inner(), &CacheKey::LiveStreams, true).await
}

/// 예정 스트림 Delta 조회 - 변경된 데이터만 반환
#[tauri::command]
pub async fn fetch_upcoming_streams_delta(
    state: State<'_, AppState>,
) -> Result<crate::models::StreamsDeltaResponse, ApiError> {
    fetch_streams_delta_impl(state.inner(), &CacheKey::UpcomingStreams(None), false).await
}

/// Delta 스트림 조회 공통 구현 (변경된 데이터만 반환)
async fn fetch_streams_delta_impl(
    state: &AppState,
    cache_key: &CacheKey,
    is_live: bool,
) -> Result<crate::models::StreamsDeltaResponse, ApiError> {
    use crate::models::StreamsDeltaResponse;

    let db = &state.db;
    let client = state
        .get_api_client()
        .ok_or_else(|| ApiError::Internal("클라이언트 생성 실패".to_string()))?;

    // 이전 캐시 데이터 로드
    let old_streams: Vec<Stream> = try_load_cache(db, cache_key).unwrap_or_default();

    // 새 데이터 fetch
    let new_streams_result = if is_live {
        client.get_live_streams().await
    } else {
        client.get_upcoming_streams(None).await
    };

    match new_streams_result {
        Ok(streams) => {
            // 상대 시간 사전 계산
            let new_streams: Vec<Stream> = streams
                .into_iter()
                .map(super::super::models::stream::Stream::with_computed_time)
                .collect();

            // Delta 변경사항 계산
            let delta = StreamsDeltaResponse::compute(&old_streams, &new_streams);

            // 변경이 있을 때만 캐시 업데이트
            if delta.has_changes {
                if let Ok(json) = serde_json::to_string(&new_streams) {
                    let _ = db.set_cache(cache_key, &json);
                }
            }

            Ok(delta)
        }
        Err(err) => {
            // 네트워크 에러 시 변경 없음으로 응답
            if !old_streams.is_empty() {
                warn!("fetch_streams_delta_fallback: {err}");
                return Ok(StreamsDeltaResponse::no_changes());
            }
            Err(err)
        }
    }
}

fn try_load_cache(db: &Database, key: &CacheKey) -> Option<Vec<Stream>> {
    db.get_cache(key)
        .ok()
        .flatten()
        .and_then(|entry| serde_json::from_str(&entry.data).ok())
}

#[cfg(test)]
#[allow(clippy::manual_string_new)]
mod tests {
    use super::*;
    use chrono::Duration;

    fn sample_stream(id: &str, channel_id: &str, title: &str) -> Stream {
        Stream {
            id: id.to_string(),
            title: title.to_string(),
            channel_id: channel_id.to_string(),
            channel_name: String::new(),
            status: crate::models::StreamStatus::Upcoming,
            start_scheduled: None,
            start_actual: None,
            duration: None,
            thumbnail: None,
            link: None,
            channel: None,
            seconds_until_start: None,
        }
    }

    #[test]
    fn test_load_cached_streams_if_valid_returns_none_when_expired() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        // 2분 전에 저장된 캐시 (TTL 1분이므로 만료됨)
        let cached_streams = vec![sample_stream("cached1", "UC1", "Cached")];
        let cached_json = serde_json::to_string(&cached_streams).expect("Failed to serialize");
        let expired_time = Utc::now() - Duration::seconds(120);
        db.set_cache_at(&CacheKey::LiveStreams, &cached_json, expired_time)
            .expect("Failed to set cache");

        // 만료된 캐시는 None 반환
        let result = load_cached_streams_if_valid(&db, &CacheKey::LiveStreams);
        assert!(result.is_none());
    }

    #[test]
    fn test_load_cached_streams_if_valid_returns_data_when_fresh() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        // 방금 저장된 캐시 (TTL 1분 이내)
        let cached_streams = vec![sample_stream("cached1", "UC1", "Cached")];
        let cached_json = serde_json::to_string(&cached_streams).expect("Failed to serialize");
        db.set_cache(&CacheKey::LiveStreams, &cached_json)
            .expect("Failed to set cache");

        // 유효한 캐시는 데이터 반환
        let result = load_cached_streams_if_valid(&db, &CacheKey::LiveStreams);
        assert!(result.is_some());
        assert_eq!(result.unwrap().len(), 1);
    }

    #[test]
    fn test_load_cached_streams_any_returns_expired_data() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        // 2분 전에 저장된 캐시 (TTL 1분이므로 만료됨)
        let cached_streams = vec![sample_stream("cached1", "UC1", "Cached")];
        let cached_json = serde_json::to_string(&cached_streams).expect("Failed to serialize");
        let expired_time = Utc::now() - Duration::seconds(120);
        db.set_cache_at(&CacheKey::LiveStreams, &cached_json, expired_time)
            .expect("Failed to set cache");

        // TTL 무시하고 데이터 반환 (오프라인 fallback용)
        let result = load_cached_streams_any(&db, &CacheKey::LiveStreams);
        assert!(result.is_some());
        assert_eq!(result.unwrap().len(), 1);
    }

    #[test]
    fn test_try_load_cache_returns_none_for_invalid_json() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        db.set_cache(&CacheKey::LiveStreams, "not-valid-json")
            .expect("Failed to set cache");

        let result = try_load_cache(&db, &CacheKey::LiveStreams);
        assert!(result.is_none());
    }

    #[test]
    fn test_try_load_cache_returns_none_when_empty() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        let result = try_load_cache(&db, &CacheKey::LiveStreams);
        assert!(result.is_none());
    }
}
