use std::collections::HashMap;

use chrono::{Duration, Utc};
use tauri::State;
use tracing::{info, warn};

use crate::api::ApiError;
use crate::db::{cache::CacheKey, Database};
use crate::models::Member;
use crate::AppState;

/// 멤버 목록 및 프로필 이미지 캐시 유효 기간 (7일)
const CACHE_TTL_DAYS: i64 = 7;

/// 캐시된 프로필 이미지 맵 로드 (TTL 체크 포함)
fn load_cached_photos(db: &Database) -> HashMap<String, String> {
    db.get_cache(&CacheKey::ChannelPhotos)
        .ok()
        .flatten()
        .and_then(|entry| {
            let ttl = Duration::days(CACHE_TTL_DAYS);
            if Utc::now().signed_duration_since(entry.cached_at) > ttl {
                return None;
            }
            serde_json::from_str(&entry.data).ok()
        })
        .unwrap_or_default()
}

/// 프로필 이미지 캐시 저장
fn save_photos_to_cache(db: &Database, photos: &HashMap<String, String>) {
    if let Ok(json) = serde_json::to_string(photos) {
        let _ = db.set_cache(&CacheKey::ChannelPhotos, &json);
    }
}

/// 캐시된 멤버 목록 로드 (TTL 체크 포함)
///
/// **Cache-First 전략**:
/// - 유효한 캐시(7일 이내)가 있으면 API 호출 없이 즉시 반환
/// - 캐시가 만료되었거나 없으면 API에서 갱신
fn load_cached_members_if_valid(db: &Database) -> Option<Vec<Member>> {
    db.get_cache(&CacheKey::Members)
        .ok()
        .flatten()
        .and_then(|entry| {
            let ttl = Duration::days(CACHE_TTL_DAYS);
            if Utc::now().signed_duration_since(entry.cached_at) > ttl {
                info!("member_cache_expired: refreshing from API");
                return None;
            }
            serde_json::from_str(&entry.data).ok()
        })
}

/// 캐시된 멤버 목록 로드 (TTL 무시, 오프라인 fallback용)
fn load_cached_members_any(db: &Database) -> Option<Vec<Member>> {
    db.get_cache(&CacheKey::Members)
        .ok()
        .flatten()
        .and_then(|entry| serde_json::from_str(&entry.data).ok())
}

async fn fetch_members_impl(state: &AppState) -> Result<Vec<Member>, ApiError> {
    let db = &state.db;
    // === Cache-First 전략 ===
    // 1. 유효한 캐시가 있으면 API 호출 없이 즉시 반환
    if let Some(mut cached_members) = load_cached_members_if_valid(db) {
        // 캐시된 멤버에도 프로필 이미지가 없으면 추가로 가져오기
        let cached_photos = load_cached_photos(db);
        let needs_photos = cached_members
            .iter()
            .any(|m| m.photo.is_none() && !cached_photos.contains_key(&m.channel_id));

        if needs_photos {
            info!("member_cache_hit_but_missing_photos: fetching photos");
            let client = state
                .get_api_client()
                .ok_or_else(|| ApiError::Internal("클라이언트 생성 실패".to_string()))?;
            let channel_ids_to_fetch: Vec<String> = cached_members
                .iter()
                .filter(|m| m.photo.is_none() && !cached_photos.contains_key(&m.channel_id))
                .map(|m| m.channel_id.clone())
                .collect();

            if !channel_ids_to_fetch.is_empty() {
                let mut all_photos = cached_photos;
                let new_photos = client.get_channel_photos(&channel_ids_to_fetch).await;
                all_photos.extend(new_photos);
                save_photos_to_cache(db, &all_photos);

                // 멤버에 프로필 이미지 병합
                for member in &mut cached_members {
                    if member.photo.is_none() {
                        if let Some(photo) = all_photos.get(&member.channel_id) {
                            member.photo = Some(photo.clone());
                        }
                    }
                }

                // 업데이트된 멤버 목록 다시 캐시
                if let Ok(json) = serde_json::to_string(&cached_members) {
                    let _ = db.set_cache(&CacheKey::Members, &json);
                }
            }
        } else {
            // 캐시된 이미지로 병합
            for member in &mut cached_members {
                if member.photo.is_none() {
                    if let Some(photo) = cached_photos.get(&member.channel_id) {
                        member.photo = Some(photo.clone());
                    }
                }
            }
        }

        info!(
            "member_cache_hit: returning {} members from cache",
            cached_members.len()
        );
        return Ok(cached_members);
    }

    // 2. 캐시가 없거나 만료됨 → API에서 갱신
    let client = state
        .get_api_client()
        .ok_or_else(|| ApiError::Internal("클라이언트 생성 실패".to_string()))?;

    match client.get_members().await {
        Ok(mut members) => {
            // 프로필 이미지 처리
            let mut cached_photos = load_cached_photos(db);

            let channel_ids_to_fetch: Vec<String> = members
                .iter()
                .filter(|m| m.photo.is_none() && !cached_photos.contains_key(&m.channel_id))
                .map(|m| m.channel_id.clone())
                .collect();

            if !channel_ids_to_fetch.is_empty() {
                info!(
                    "fetching_photos: {} new photos needed",
                    channel_ids_to_fetch.len()
                );
                let new_photos = client.get_channel_photos(&channel_ids_to_fetch).await;
                cached_photos.extend(new_photos);
                save_photos_to_cache(db, &cached_photos);
            }

            for member in &mut members {
                if member.photo.is_none() {
                    if let Some(photo) = cached_photos.get(&member.channel_id) {
                        member.photo = Some(photo.clone());
                    }
                }
            }

            // 멤버 목록 캐시 저장
            if let Ok(json) = serde_json::to_string(&members) {
                let _ = db.set_cache(&CacheKey::Members, &json);
            }

            info!("member_cache_refreshed: {} members cached", members.len());
            Ok(members)
        }
        Err(err) => {
            // 네트워크 에러 시 만료된 캐시라도 사용 (오프라인 지원)
            if let Some(cached) = load_cached_members_any(db) {
                warn!("fetch_members_fallback_to_expired_cache: {err}");
                return Ok(cached);
            }
            Err(err)
        }
    }
}

/// 멤버 필터링 (검색어 + 졸업멤버 필터)
///
/// # Arguments
/// * `members` - 전체 멤버 목록
/// * `query` - 검색어 (빈 문자열이면 전체 반환)
/// * `hide_graduated` - 졸업 멤버 숨김 여부
fn filter_members(members: Vec<Member>, query: &str, hide_graduated: bool) -> Vec<Member> {
    let query = query.trim();

    members
        .into_iter()
        .filter(|m| {
            // 졸업멤버 필터
            if hide_graduated && m.graduated {
                return false;
            }
            // 검색어 필터 (빈 문자열이면 통과)
            if query.is_empty() {
                return true;
            }
            m.matches_query(query)
        })
        .collect()
}

#[tauri::command]
pub async fn fetch_members(state: State<'_, AppState>) -> Result<Vec<Member>, ApiError> {
    fetch_members_impl(state.inner()).await
}

/// 멤버 검색 커맨드
///
/// # Arguments
/// * `query` - 검색어 (이름, 별명 등)
/// * `hide_graduated` - 졸업 멤버 숨김 여부 (설정 페이지에서 관리)
#[tauri::command]
pub async fn search_members(
    state: State<'_, AppState>,
    query: String,
    hide_graduated: Option<bool>,
) -> Result<Vec<Member>, ApiError> {
    let members = fetch_members(state).await?;
    Ok(filter_members(
        members,
        &query,
        hide_graduated.unwrap_or(false),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    fn sample_member(channel_id: &str, name: &str) -> Member {
        Member {
            channel_id: channel_id.to_string(),
            name: name.to_string(),
            name_ko: None,
            name_ja: None,
            aliases: None,
            graduated: false,
            group: None,
            photo: None,
        }
    }

    #[test]
    fn test_load_cached_photos_returns_empty_when_no_cache() {
        let db = Database::open_in_memory().expect("Failed to create DB");
        let photos = load_cached_photos(&db);
        assert!(photos.is_empty());
    }

    #[test]
    fn test_load_cached_photos_returns_data_when_fresh() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        let mut photos = HashMap::new();
        photos.insert(
            "UC1".to_string(),
            "https://example.com/photo1.jpg".to_string(),
        );
        photos.insert(
            "UC2".to_string(),
            "https://example.com/photo2.jpg".to_string(),
        );

        let json = serde_json::to_string(&photos).expect("Failed to serialize");
        db.set_cache(&CacheKey::ChannelPhotos, &json)
            .expect("Failed to set cache");

        let loaded = load_cached_photos(&db);
        assert_eq!(loaded.len(), 2);
        assert!(loaded.contains_key("UC1"));
    }

    #[test]
    fn test_load_cached_members_if_valid_returns_none_when_expired() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        let cached_members = vec![sample_member("UC1", "Test")];
        let cached_json = serde_json::to_string(&cached_members).expect("Failed to serialize");
        let expired_time = Utc::now() - Duration::days(8);
        db.set_cache_at(&CacheKey::Members, &cached_json, expired_time)
            .expect("Failed to set cache");

        let result = load_cached_members_if_valid(&db);
        assert!(result.is_none());
    }

    #[test]
    fn test_load_cached_members_if_valid_returns_data_when_fresh() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        let cached_members = vec![sample_member("UC1", "Test")];
        let cached_json = serde_json::to_string(&cached_members).expect("Failed to serialize");
        db.set_cache(&CacheKey::Members, &cached_json)
            .expect("Failed to set cache");

        let result = load_cached_members_if_valid(&db);
        assert!(result.is_some());
        assert_eq!(result.unwrap().len(), 1);
    }

    #[test]
    fn test_load_cached_members_any_returns_expired_data() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        let cached_members = vec![sample_member("UC1", "Test")];
        let cached_json = serde_json::to_string(&cached_members).expect("Failed to serialize");
        let expired_time = Utc::now() - Duration::days(8);
        db.set_cache_at(&CacheKey::Members, &cached_json, expired_time)
            .expect("Failed to set cache");

        let result = load_cached_members_any(&db);
        assert!(result.is_some());
        assert_eq!(result.unwrap().len(), 1);
    }

    #[test]
    fn test_filter_members_by_query_trims_and_filters() {
        let members = vec![
            sample_member("UC1", "Mori Calliope"),
            sample_member("UC2", "Gawr Gura"),
        ];

        // 빈 검색어: 전체 반환
        let all = filter_members(members.clone(), "   ", false);
        assert_eq!(all.len(), 2);

        // 검색어 필터링
        let filtered = filter_members(members, "mori", false);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].channel_id, "UC1");
    }

    #[test]
    fn test_filter_members_hides_graduated() {
        let mut graduated_member = sample_member("UC3", "Graduated Member");
        graduated_member.graduated = true;

        let members = vec![
            sample_member("UC1", "Active 1"),
            graduated_member,
            sample_member("UC2", "Active 2"),
        ];

        // hide_graduated=false: 전체 반환
        let all = filter_members(members.clone(), "", false);
        assert_eq!(all.len(), 3);

        // hide_graduated=true: 졸업멤버 제외
        let active_only = filter_members(members.clone(), "", true);
        assert_eq!(active_only.len(), 2);
        assert!(active_only.iter().all(|m| !m.graduated));

        // 검색어 + 졸업멤버 필터 조합
        let filtered = filter_members(members, "Active", true);
        assert_eq!(filtered.len(), 2);
    }

    #[test]
    fn test_save_photos_to_cache_and_reload() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        let mut photos = HashMap::new();
        photos.insert(
            "UC1".to_string(),
            "https://example.com/photo.jpg".to_string(),
        );

        save_photos_to_cache(&db, &photos);

        let loaded = load_cached_photos(&db);
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded.get("UC1").unwrap(), "https://example.com/photo.jpg");
    }
}
