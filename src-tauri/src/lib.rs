// Hololive Stream Notifier - Tauri 백엔드
// Tauri 커맨드에 대한 자세한 내용: https://tauri.app/develop/calling-rust/

#![cfg_attr(test, allow(clippy::expect_used, clippy::unwrap_used))]
// tauri 매크로가 내부적으로 wildcard import를 생성하여 pedantic lint와 충돌함
#![allow(clippy::wildcard_imports)]

mod api;
pub mod auth;
mod commands;
mod db;
mod models;
mod scheduler;

use api::ApiClient;
use auth::OAuthState;
use db::Database;
use models::Settings;
use parking_lot::RwLock;
use std::sync::Arc;
use tauri::Manager;
use tracing::{error, info, warn};

/// 앱 상태 (DB 연결 + API 클라이언트)
/// API 클라이언트는 HTTP 커넥션 풀링을 위해 재사용됨
pub struct AppState {
    pub db: Database,
    /// 공유 API 클라이언트 (설정 변경 시 재생성됨)
    api_client: Arc<RwLock<Option<ApiClient>>>,
    /// 현재 API base URL (변경 감지용)
    api_base_url: Arc<RwLock<String>>,
}

impl AppState {
    /// API 클라이언트 가져오기 (없으면 생성)
    #[allow(clippy::significant_drop_tightening)]
    pub fn get_api_client(&self) -> Option<ApiClient> {
        // 현재 설정된 base URL 확인
        let current_url = self
            .db
            .get_setting("api_base_url")
            .ok()
            .flatten()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| Settings::default().api_base_url);

        // URL이 변경되었는지 확인
        let mut cached_url = self.api_base_url.write();
        let mut client_guard = self.api_client.write();

        if *cached_url != current_url || client_guard.is_none() {
            // 클라이언트 재생성
            match ApiClient::new(&current_url) {
                Ok(new_client) => {
                    *cached_url = current_url;
                    *client_guard = Some(new_client);
                }
                Err(e) => {
                    warn!("Failed to create API client: {e}");
                    return None;
                }
            }
        }

        client_guard.clone()
    }

    /// 새 `AppState` 생성
    fn new(db: Database) -> Self {
        Self {
            db,
            api_client: Arc::new(RwLock::new(None)),
            api_base_url: Arc::new(RwLock::new(String::new())),
        }
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! You've been greeted from Rust!")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 개발 모드: .env 파일에서 환경변수 로드
    // 우선 src-tauri/.env 시도 (Tauri dev는 프로젝트 루트에서 실행됨)
    let tauri_env_path = std::path::Path::new("src-tauri/.env");
    if tauri_env_path.exists() {
        if let Err(e) = dotenvy::from_path(tauri_env_path) {
            warn!("Failed to load src-tauri/.env: {}", e);
        }
    } else {
        // fallback: 현재 디렉터리의 .env (cargo run 등에서 직접 실행 시)
        let _ = dotenvy::dotenv();
    }

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // 프로덕션 모드: 번들된 리소스에서 .env 파일 로드
            // Tauri v2에서는 resolve() 메소드로 번들 리소스 경로를 얻어야 함
            use tauri::path::BaseDirectory;
            match app.path().resolve(".env", BaseDirectory::Resource) {
                Ok(env_path) => {
                    if env_path.exists() {
                        if let Err(e) = dotenvy::from_path(&env_path) {
                            warn!("Failed to load bundled .env: {}", e);
                        } else {
                            info!("Loaded .env from: {:?}", env_path);
                        }
                    } else {
                        warn!("Bundled .env not found at: {:?}", env_path);
                    }
                }
                Err(e) => {
                    warn!("Failed to resolve .env resource path: {}", e);
                }
            }

            // 앱 데이터 디렉터리에 DB 생성
            let app_data_dir = app.path().app_data_dir()?;
            let db = Database::open(&app_data_dir)?;

            // 앱 상태 등록
            let scheduler_db = db.clone();
            app.manage(AppState::new(db));
            app.manage(OAuthState::default());

            scheduler::start(app.handle().clone(), scheduler_db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            // API 커맨드
            commands::fetch_live_streams,
            commands::fetch_upcoming_streams,
            commands::fetch_live_streams_delta,
            commands::fetch_upcoming_streams_delta,
            commands::fetch_members,
            commands::search_members,
            commands::get_channel,
            commands::get_channels_batch,
            commands::search_channels,
            commands::get_profile_by_channel_id,
            commands::get_profile_by_name,
            // alarms/settings/history (local DB)
            commands::get_alarms,
            commands::add_alarm,
            commands::remove_alarm,
            commands::toggle_alarm,
            commands::get_settings,
            commands::update_setting,
            commands::clear_cache,
            commands::test_notification,
            commands::was_notified,
            commands::record_notification,
            commands::cleanup_old_notifications,
            // OAuth 인증
            commands::start_google_login,
            commands::handle_deep_link_callback,
            commands::refresh_token,
            commands::logout,
            commands::get_current_user,
        ]);

    #[allow(clippy::large_stack_frames)]
    if let Err(e) = builder.run(tauri::generate_context!()) {
        error!("error while running tauri application: {}", e);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        assert_eq!(
            greet("Alice"),
            "Hello, Alice! You've been greeted from Rust!"
        );
    }
}
