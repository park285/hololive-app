// 세션 기반 인증 Tauri 커맨드
// Frontend에서 호출하는 단일 진입점
// 세션 토큰만 OS Keyring에 저장, 사용자 정보는 앱 시작 시 API로 복원

use crate::api::session_auth::SessionAuthClient;
use crate::auth::{
    storage,
    types::{AuthState, CommandError, SessionAuthError, User},
};
use tauri::{AppHandle, Emitter};
use tracing::{info, warn};

/// 로그인
#[tauri::command]
pub async fn session_login(
    app: AppHandle,
    email: String,
    password: String,
) -> Result<AuthState, SessionAuthError> {
    let client = SessionAuthClient::new();
    let auth_state = client.login(&email, &password).await?;

    // 세션만 저장 (사용자 정보는 저장하지 않음)
    storage::save_session(&app, &auth_state.session)?;

    Ok(auth_state)
}

/// 회원가입
#[tauri::command]
pub async fn session_register(
    email: String,
    password: String,
    display_name: String,
) -> Result<User, SessionAuthError> {
    let client = SessionAuthClient::new();
    client.register(&email, &password, &display_name).await
}

/// 로그아웃
#[tauri::command]
pub async fn session_logout(app: AppHandle) -> Result<(), SessionAuthError> {
    // 저장된 세션 로드
    if let Some(session) = storage::load_session(&app) {
        let client = SessionAuthClient::new();
        // 서버 에러는 무시 (로컬 세션은 항상 삭제)
        let _ = client.logout(&session.token).await;
    }

    // 로컬 세션 삭제
    storage::clear_session(&app)?;

    info!("Session logout completed");
    Ok(())
}

/// 앱 시작 시 세션 복원
/// 저장된 세션 토큰으로 사용자 정보를 API에서 조회
#[tauri::command]
pub async fn session_restore(app: AppHandle) -> Result<Option<AuthState>, SessionAuthError> {
    let Some(session) = storage::load_session(&app) else {
        return Ok(None);
    };

    // 세션 유효성 검증 및 사용자 정보 조회
    let client = SessionAuthClient::new();
    match client.get_me(&session.token).await {
        Ok(user) => {
            info!("Session restored for user: {}", user.email);
            Ok(Some(AuthState { session, user }))
        }
        Err(SessionAuthError::Unauthorized | SessionAuthError::SessionExpired) => {
            // 세션 만료 - 로컬 삭제 및 프론트엔드 알림
            info!("Session expired, clearing local state and emitting event");
            let _ = storage::clear_session(&app);
            emit_session_expired(&app);
            Ok(None)
        }
        Err(e) => Err(e),
    }
}

/// 세션 갱신
#[tauri::command]
pub async fn session_refresh(app: AppHandle) -> Result<AuthState, CommandError> {
    let session = storage::load_session(&app)
        .ok_or_else(|| CommandError::from(SessionAuthError::Unauthorized))?;

    let client = SessionAuthClient::new();
    match client.refresh(&session.token).await {
        Ok(new_session) => {
            // 새 세션 저장
            storage::save_session(&app, &new_session).map_err(CommandError::from)?;

            // 사용자 정보 조회
            let user = client
                .get_me(&new_session.token)
                .await
                .map_err(CommandError::from)?;

            info!("Session refreshed successfully");
            Ok(AuthState {
                session: new_session,
                user,
            })
        }
        Err(SessionAuthError::SessionExpired | SessionAuthError::Unauthorized) => {
            // 세션 만료 - 로컬 삭제 및 프론트엔드 알림
            info!("Session expired during refresh, clearing local state");
            let _ = storage::clear_session(&app);
            emit_session_expired(&app);
            Err(CommandError::from(SessionAuthError::SessionExpired))
        }
        Err(e) => Err(CommandError::from(e)),
    }
}

/// 현재 사용자 정보 조회
#[tauri::command]
pub async fn session_get_current_user(app: AppHandle) -> Result<User, SessionAuthError> {
    let session = storage::load_session(&app).ok_or(SessionAuthError::Unauthorized)?;

    let client = SessionAuthClient::new();
    client.get_me(&session.token).await
}

/// 세션 만료 시간 조회 (자동 갱신용)
#[tauri::command]
#[allow(clippy::needless_pass_by_value)] // Tauri 커맨드는 AppHandle을 값으로 받아야 함
pub fn get_session_expiry(app: AppHandle) -> Option<String> {
    storage::get_session_expiry(&app)
}

/// 비밀번호 재설정 요청
#[tauri::command]
pub async fn session_request_password_reset(email: String) -> Result<(), SessionAuthError> {
    let client = SessionAuthClient::new();
    client.request_password_reset(&email).await
}

/// 세션 만료 이벤트를 프론트엔드로 emit
fn emit_session_expired(app: &AppHandle) {
    if let Err(e) = app.emit("auth:session-expired", ()) {
        warn!("Failed to emit session-expired event: {e}");
    }
}
