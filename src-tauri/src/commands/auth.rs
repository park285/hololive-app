// Google OAuth Tauri 커맨드
// 모든 플랫폼에서 서버 프록시 방식 사용 (Desktop/Mobile 통합)

use crate::auth::{
    build_auth_url, exchange_code_for_token, fetch_user_profile, generate_pkce_challenge,
    generate_pkce_verifier, generate_state, refresh_access_token, revoke_token, AuthError,
    GoogleOAuthConfig, OAuthState, TokenResponse, UserProfile,
};
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::{error, info};

/// 저장된 인증 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthData {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: i64, // Unix timestamp
    pub user: UserProfile,
}

/// 로그인 시작 응답
#[derive(Debug, Serialize)]
pub struct LoginStartResponse {
    pub auth_url: String,
    pub port: u16,
    pub platform: String,
}

/// `OAuth` 자격증명
fn get_oauth_credentials() -> (String, String) {
    const CLIENT_ID: &str =
        "492773568117-sh0n6n1jc31sbibtpqngtkebena2m26t.apps.googleusercontent.com";
    const CLIENT_SECRET: &str = "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";
    (CLIENT_ID.to_string(), CLIENT_SECRET.to_string())
}

/// 통합 `OAuth` 설정 가져오기 (서버 프록시 방식)
fn get_oauth_config() -> GoogleOAuthConfig {
    let (client_id, client_secret) = get_oauth_credentials();
    GoogleOAuthConfig::new_for_mobile(client_id, client_secret)
}

/// PKCE 및 state 저장 헬퍼
fn store_oauth_state(
    oauth_state: &OAuthState,
    verifier: &str,
    state: &str,
) -> Result<(), AuthError> {
    {
        let mut pkce = oauth_state
            .pkce_verifier
            .lock()
            .map_err(|_| AuthError::PkceNotFound)?;
        *pkce = Some(verifier.to_string());
    }
    {
        let mut stored_state = oauth_state
            .state
            .lock()
            .map_err(|_| AuthError::InvalidState)?;
        *stored_state = Some(state.to_string());
    }
    Ok(())
}

/// 로그인 시작 - 모든 플랫폼에서 서버 프록시 방식 사용
#[tauri::command]
#[allow(clippy::unused_async)]
pub async fn start_google_login(
    oauth_state: State<'_, OAuthState>,
) -> Result<LoginStartResponse, AuthError> {
    let config = get_oauth_config();

    let verifier = generate_pkce_verifier();
    let challenge = generate_pkce_challenge(&verifier);
    let state = generate_state();

    store_oauth_state(&oauth_state, &verifier, &state)?;

    let auth_url = build_auth_url(&config, &challenge, &state);

    info!("OAuth login started with proxy redirect (unified flow)");
    Ok(LoginStartResponse {
        auth_url,
        port: 0, // 서버 프록시 방식에서는 사용 안 함
        platform: "unified".to_string(),
    })
}

/// 토큰 갱신
#[tauri::command]
pub async fn refresh_token(refresh_token: String) -> Result<TokenResponse, AuthError> {
    let config = get_oauth_config();
    refresh_access_token(&config, &refresh_token).await
}

/// 로그아웃 - 토큰 취소
#[tauri::command]
pub async fn logout(access_token: String) -> Result<(), AuthError> {
    revoke_token(&access_token).await
}

/// 현재 사용자 프로필 가져오기
#[tauri::command]
pub async fn get_current_user(access_token: String) -> Result<UserProfile, AuthError> {
    fetch_user_profile(&access_token).await
}

/// Deep Link 콜백 처리 (서버 프록시 방식)
/// 앱이 `hololive-app://callback?code=XXX&state=YYY` 형태로 열릴 때 호출
#[tauri::command]
pub async fn handle_deep_link_callback(
    code: String,
    state: String,
    oauth_state: State<'_, OAuthState>,
) -> Result<AuthData, AuthError> {
    info!(
        "Deep link callback received: code={}, state={}",
        code.chars().take(10).collect::<String>(),
        state.chars().take(10).collect::<String>()
    );

    // State 검증
    let expected_state = {
        let guard = oauth_state
            .state
            .lock()
            .map_err(|_| AuthError::InvalidState)?;
        guard.clone()
    };

    if expected_state.as_ref() != Some(&state) {
        error!(
            "State mismatch: expected {:?}, got {}",
            expected_state, state
        );
        return Err(AuthError::InvalidState);
    }

    // PKCE verifier 가져오기
    let pkce_verifier = {
        let guard = oauth_state
            .pkce_verifier
            .lock()
            .map_err(|_| AuthError::PkceNotFound)?;
        guard.clone().ok_or(AuthError::PkceNotFound)?
    };

    // OAuth 설정 (통합)
    let config = get_oauth_config();

    // 토큰 교환
    let token = exchange_code_for_token(&config, &code, &pkce_verifier).await?;

    // 사용자 프로필 가져오기
    let user = fetch_user_profile(&token.access_token).await?;

    let expires_at =
        chrono::Utc::now().timestamp() + i64::try_from(token.expires_in).unwrap_or(3600);

    info!(
        "Deep link OAuth completed successfully for user: {}",
        user.email
    );

    Ok(AuthData {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at,
        user,
    })
}
