// Multiview 데이터 모델
// 멀티뷰(분할화면) 기능을 위한 Rust 구조체 정의
// Frontend와 동일한 구조를 유지하여 IPC 직렬화/역직렬화 최적화

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 그리드 레이아웃 아이템 (react-grid-layout 호환)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayoutItem {
    /// 고유 ID
    pub i: String,
    /// 가로 위치 (0-23)
    pub x: u8,
    /// 세로 위치 (0-23)
    pub y: u8,
    /// 너비 (1-24, 그리드 단위)
    pub w: u8,
    /// 높이 (1-24, 그리드 단위)
    pub h: u8,
    /// 드래그 가능 여부
    #[serde(default = "default_true")]
    pub is_draggable: bool,
    /// 리사이즈 가능 여부
    #[serde(default = "default_true")]
    pub is_resizable: bool,
}

const fn default_true() -> bool {
    true
}

/// 셀 콘텐츠
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CellContent {
    /// LayoutItem.i와 매칭되는 ID
    pub id: String,
    /// 셀 타입: "video" | "chat" | "empty"
    #[serde(rename = "type")]
    pub cell_type: String,
    /// YouTube video ID 또는 Twitch 채널
    pub video_id: Option<String>,
    /// 비디오 소스: "youtube" | "twitch"
    pub video_source: Option<String>,
    /// 채팅 셀의 경우, 연결된 비디오 인덱스
    pub chat_tab: Option<u8>,
}

/// 플레이어 상태
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerState {
    /// 셀 ID
    pub cell_id: String,
    /// 음소거 여부
    pub muted: bool,
    /// 볼륨 (0-100)
    pub volume: u8,
    /// 재생 중 여부
    pub playing: bool,
    /// 현재 재생 시간 (아카이브 동기화용)
    pub current_time: Option<f64>,
    /// 재생 속도
    pub playback_rate: Option<f64>,
}

/// 인코딩된 레이아웃 (저장/공유용)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncodedLayout {
    /// 인코딩된 레이아웃 문자열
    pub encoded: String,
    /// 비디오 셀 개수
    pub video_cell_count: u8,
}

/// 프리셋 레이아웃 (DB 저장용)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayoutPreset {
    /// 프리셋 ID
    pub id: String,
    /// 프리셋 이름
    pub name: String,
    /// 인코딩된 레이아웃 문자열
    pub encoded_layout: String,
    /// 기본 제공 프리셋 여부
    pub is_built_in: bool,
    /// 비디오 셀 개수 (필터링용)
    pub video_cell_count: u8,
    /// 생성 시각
    pub created_at: Option<String>,
}

/// 레이아웃 디코딩 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecodedLayout {
    /// 레이아웃 아이템 배열
    pub layout: Vec<LayoutItem>,
    /// 셀 콘텐츠 맵
    pub content: HashMap<String, CellContent>,
    /// 비디오 셀 개수
    pub video_cell_count: u8,
}

/// 멀티뷰 전체 상태 (저장/로드용)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiviewState {
    /// 레이아웃 아이템 배열
    pub layout: Vec<LayoutItem>,
    /// 셀 콘텐츠 맵
    pub content: HashMap<String, CellContent>,
    /// 플레이어 상태 맵
    pub player_states: HashMap<String, PlayerState>,
    /// 다른 셀 음소거 모드 활성화 여부
    pub mute_others_enabled: bool,
    /// 현재 활성 프리셋 ID
    pub active_preset_id: Option<String>,
}

/// 레이아웃 유효성 검증 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    /// 유효 여부
    pub valid: bool,
    /// 오류 메시지 목록
    pub errors: Vec<String>,
    /// 경고 메시지 목록
    pub warnings: Vec<String>,
}

/// 비디오 메타데이터 (oEmbed 조회 결과)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoMetadata {
    /// 비디오 ID
    pub id: String,
    /// 비디오 제목
    pub title: String,
    /// 채널 ID
    pub channel_id: String,
    /// 채널 이름
    pub channel_name: String,
    /// 썸네일 URL
    pub thumbnail: Option<String>,
    /// 상태: "live" | "upcoming" | "past"
    pub status: Option<String>,
}
