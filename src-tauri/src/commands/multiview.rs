// Multiview Tauri IPC 커맨드
// Frontend에서 invoke()로 호출하는 멀티뷰 관련 엔드포인트
//
// **설계 원칙**:
// - 영속성 저장: layout JSON 직접 저장 (ID 보존)
// - URL 공유: encode/decode 사용 (새 ID 생성 허용)

#![allow(clippy::needless_pass_by_value)]

use crate::models::multiview::{
    CellContent, DecodedLayout, EncodedLayout, LayoutItem, LayoutPreset, MultiviewState,
    PlayerState, ValidationResult, VideoMetadata,
};
use crate::multiview;
use crate::AppState;
use serde::Deserialize;
use std::collections::HashMap;
use tauri::State;

#[derive(Deserialize)]
struct OEmbedResponse {
    title: String,
    author_name: String,
    author_url: Option<String>,
    thumbnail_url: Option<String>,
}

/// 비디오 메타데이터 배치 조회 (YouTube oEmbed)
///
/// YouTube Data API Key 없이 공개 oEmbed API를 사용하여 메타데이터 조회.
/// 실패한 비디오는 결과에서 제외됨.
#[tauri::command]
pub async fn fetch_video_metadata(video_ids: Vec<String>) -> Result<Vec<VideoMetadata>, String> {
    let client = reqwest::Client::builder()
        .user_agent("hololive-notifier/0.1")
        .build()
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    for id in video_ids {
        let url = format!(
            "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={id}&format=json"
        );

        // 순차 처리 (실패 시 무시하고 다음으로 진행)
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                if let Ok(oembed) = resp.json::<OEmbedResponse>().await {
                    results.push(VideoMetadata {
                        id: id.clone(),
                        title: oembed.title,
                        channel_id: oembed.author_url.unwrap_or_default(), // oEmbed는 채널 ID 대신 URL을 줌
                        channel_name: oembed.author_name,
                        thumbnail: oembed.thumbnail_url,
                        status: None, // oEmbed로는 방송 상태 알 수 없음
                    });
                }
            }
        }
    }

    Ok(results)
}

/// 레이아웃 인코딩 (URL 공유용)
///
/// 24x24 그리드의 각 셀을 Base64-like 문자로 압축하여 URL-safe 문자열 생성.
/// **주의**: 디코딩 시 새로운 ID가 생성되므로, 영속성 저장에는 사용하지 않음.
#[tauri::command]
pub fn encode_multiview_layout(
    layout: Vec<LayoutItem>,
    content: HashMap<String, CellContent>,
    include_videos: bool,
) -> Result<EncodedLayout, String> {
    multiview::encode_layout(&layout, &content, include_videos)
}

/// 레이아웃 디코딩 (URL 파라미터 -> 구조체)
///
/// **주의**: 새로운 랜덤 ID가 생성됨. URL 공유 로드 시에만 사용.
#[tauri::command]
pub fn decode_multiview_layout(encoded: String) -> Result<DecodedLayout, String> {
    multiview::decode_layout(&encoded)
}

/// 현재 레이아웃 저장 (SQLite)
///
/// layout을 JSON으로 직접 저장하여 셀 ID를 보존함.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn save_multiview_state(
    state: State<'_, AppState>,
    layout: Vec<LayoutItem>,
    content: HashMap<String, CellContent>,
    player_states: HashMap<String, PlayerState>,
    mute_others: bool,
    active_preset_id: Option<String>,
) -> Result<(), String> {
    state
        .db
        .with_conn(|conn| {
            crate::db::multiview::save_state(
                conn,
                &layout,
                &content,
                &player_states,
                mute_others,
                active_preset_id.as_deref(),
            )
        })
        .map_err(|e| e.to_string())
}

/// 저장된 레이아웃 로드
///
/// layout JSON에서 직접 복원하여 ID 일관성 보장.
#[tauri::command]
pub fn load_multiview_state(state: State<'_, AppState>) -> Result<Option<MultiviewState>, String> {
    state
        .db
        .with_conn(crate::db::multiview::load_state)
        .map_err(|e| e.to_string())
}

/// 프리셋 저장
///
/// 프리셋은 `encoded_layout으로` 저장 (적용 시 새 ID 생성 허용)
#[tauri::command]
pub fn save_multiview_preset(
    state: State<'_, AppState>,
    name: String,
    layout: Vec<LayoutItem>,
    content: HashMap<String, CellContent>,
) -> Result<LayoutPreset, String> {
    // 레이아웃 인코딩 (프리셋 저장용)
    let encoded = multiview::encode_layout(&layout, &content, false)?;

    // 비디오 셀 개수 계산 (u8 범위 내에서 안전하게 변환 - 최대 16셀이므로 truncation 불가)
    #[allow(clippy::cast_possible_truncation)]
    let video_count = content
        .values()
        .filter(|c| c.cell_type == "video" || c.cell_type == "empty")
        .count() as u8;

    // 고유 ID 생성
    let id = format!("custom_{}", chrono::Utc::now().timestamp_millis());

    // DB 저장
    state
        .db
        .with_conn(|conn| {
            crate::db::multiview::save_preset(conn, &id, &name, &encoded.encoded, video_count)
        })
        .map_err(|e| e.to_string())
}

/// 프리셋 목록 조회 (Built-in + Custom)
#[tauri::command]
pub fn get_multiview_presets(state: State<'_, AppState>) -> Result<Vec<LayoutPreset>, String> {
    let mut presets = multiview::get_builtin_presets();

    let custom = state
        .db
        .with_conn(crate::db::multiview::get_custom_presets)
        .map_err(|e| e.to_string())?;

    presets.extend(custom);
    Ok(presets)
}

/// 프리셋 삭제 (Built-in은 삭제 불가)
#[tauri::command]
pub fn delete_multiview_preset(
    state: State<'_, AppState>,
    preset_id: String,
) -> Result<(), String> {
    state
        .db
        .with_conn(|conn| crate::db::multiview::delete_preset(conn, &preset_id))
        .map_err(|e| e.to_string())
}

/// 레이아웃 유효성 검증
#[tauri::command]
pub fn validate_multiview_layout(layout: Vec<LayoutItem>) -> ValidationResult {
    multiview::validate_layout(&layout)
}

/// 프리셋 적용 (디코딩하여 반환)
///
/// **주의**: 디코딩 시 새로운 ID가 생성됨.
/// Frontend에서는 반환된 layout/content를 그대로 사용해야 함.
#[tauri::command]
pub fn apply_multiview_preset(
    state: State<'_, AppState>,
    preset_id: String,
) -> Result<DecodedLayout, String> {
    // 1. Built-in 프리셋에서 찾기
    let builtin = multiview::get_builtin_presets();
    if let Some(preset) = builtin.iter().find(|p| p.id == preset_id) {
        return multiview::decode_layout(&preset.encoded_layout);
    }

    // 2. DB에서 찾기
    let custom = state
        .db
        .with_conn(|conn| crate::db::multiview::get_preset(conn, &preset_id))
        .map_err(|e| e.to_string())?;

    match custom {
        Some(preset) => multiview::decode_layout(&preset.encoded_layout),
        None => Err(format!("프리셋을 찾을 수 없습니다: {preset_id}")),
    }
}
