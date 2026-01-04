// Tauri 채널 및 프로필 API 커맨드
// 프론트엔드에서 invoke()로 호출하는 채널/프로필 조회 엔드포인트

use std::collections::HashMap;
use tauri::State;
use tracing::{info, warn};

use crate::api::profiles::ProfileResponse;
use crate::api::ApiError;
use crate::models::Channel;
use crate::AppState;

// === 채널 API 커맨드 ===

/// 단일 채널 정보 조회
///
/// spec.md 2.1: GET `/api/holo/channels?channelId={CHANNEL_ID}`
#[tauri::command]
pub async fn get_channel(
    state: State<'_, AppState>,
    channel_id: String,
) -> Result<Option<Channel>, ApiError> {
    info!("[Channel] Fetching channel: {}", channel_id);

    let client = state.get_api_client().ok_or_else(|| {
        ApiError::Internal("API 클라이언트를 생성할 수 없습니다. 설정을 확인해주세요.".to_string())
    })?;

    match client.get_channel(&channel_id).await {
        Ok(channel) => {
            info!("[Channel] Successfully fetched channel: {}", channel_id);
            Ok(channel)
        }
        Err(e) => {
            warn!("[Channel] Failed to fetch channel {}: {}", channel_id, e);
            Err(e)
        }
    }
}

/// 여러 채널 정보 배치 조회
///
/// spec.md 2.2: GET /api/holo/channels?channelIds={ID1},{ID2},{ID3}...
/// 최대 100개까지 한 번에 조회 가능
#[tauri::command]
pub async fn get_channels_batch(
    state: State<'_, AppState>,
    channel_ids: Vec<String>,
) -> Result<HashMap<String, Channel>, ApiError> {
    info!("[Channel] Batch fetching {} channels", channel_ids.len());

    if channel_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let client = state.get_api_client().ok_or_else(|| {
        ApiError::Internal("API 클라이언트를 생성할 수 없습니다. 설정을 확인해주세요.".to_string())
    })?;

    match client.get_channels_batch(&channel_ids).await {
        Ok(channels) => {
            let channels_map: HashMap<String, Channel> =
                channels.into_iter().map(|c| (c.id.clone(), c)).collect();
            info!(
                "[Channel] Successfully fetched {} channels",
                channels_map.len()
            );
            Ok(channels_map)
        }
        Err(e) => {
            warn!("[Channel] Batch fetch failed: {}", e);
            Err(e)
        }
    }
}

/// 채널 검색
///
/// spec.md 2.3: GET /api/holo/channels/search?q={QUERY}
/// 아직 백엔드 API에 구현되지 않은 경우 에러 반환
#[tauri::command]
pub async fn search_channels(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<Channel>, ApiError> {
    info!("[Channel] Searching channels with query: {}", query);

    let _client = state.get_api_client().ok_or_else(|| {
        ApiError::Internal("API 클라이언트를 생성할 수 없습니다. 설정을 확인해주세요.".to_string())
    })?;

    // NOTE: 채널 검색은 현재 백엔드 API에서 지원하지 않음
    // 향후 /api/holo/channels/search 엔드포인트 추가 시 구현
    warn!("[Channel] Channel search is not yet implemented in backend API");
    Err(ApiError::Internal(
        "채널 검색 API가 아직 구현되지 않았습니다.".to_string(),
    ))
}

// === 프로필 API 커맨드 ===

/// 채널 ID로 프로필 조회
///
/// spec.md 6.1: GET `/api/holo/profiles?channelId={CHANNEL_ID}`
#[tauri::command]
pub async fn get_profile_by_channel_id(
    state: State<'_, AppState>,
    channel_id: String,
) -> Result<ProfileResponse, ApiError> {
    info!("[Profile] Fetching profile by channelId: {}", channel_id);

    let client = state.get_api_client().ok_or_else(|| {
        ApiError::Internal("API 클라이언트를 생성할 수 없습니다. 설정을 확인해주세요.".to_string())
    })?;

    match client.get_profile_by_channel_id(&channel_id).await {
        Ok(resp) => {
            info!("[Profile] Successfully fetched profile for: {}", channel_id);
            Ok(resp)
        }
        Err(e) => {
            warn!(
                "[Profile] Failed to fetch profile for {}: {}",
                channel_id, e
            );
            Err(e)
        }
    }
}

/// 이름으로 프로필 조회
///
/// spec.md 6.2: GET `/api/holo/profiles/name?name={ENGLISH_NAME}`
#[tauri::command]
pub async fn get_profile_by_name(
    state: State<'_, AppState>,
    name: String,
) -> Result<ProfileResponse, ApiError> {
    info!("[Profile] Fetching profile by name: {}", name);

    let client = state.get_api_client().ok_or_else(|| {
        ApiError::Internal("API 클라이언트를 생성할 수 없습니다. 설정을 확인해주세요.".to_string())
    })?;

    match client.get_profile_by_name(&name).await {
        Ok(resp) => {
            info!("[Profile] Successfully fetched profile for: {}", name);
            Ok(resp)
        }
        Err(e) => {
            warn!("[Profile] Failed to fetch profile for {}: {}", name, e);
            Err(e)
        }
    }
}
