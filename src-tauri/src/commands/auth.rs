// Google OAuth Tauri 커맨드
// 로컬 HTTP 서버(Desktop) 및 프록시 방식(Mobile) 지원

use crate::auth::{
    build_auth_url, exchange_code_for_token, fetch_user_profile, generate_pkce_challenge,
    generate_pkce_verifier, generate_state, refresh_access_token, revoke_token, AuthError,
    GoogleOAuthConfig, OAuthState, Platform, TokenResponse, UserProfile,
};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::TcpListener;
use tauri::{AppHandle, Emitter, State};
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

/// Desktop용 `OAuth` 설정 가져오기
fn get_desktop_oauth_config(port: u16) -> GoogleOAuthConfig {
    let (client_id, client_secret) = get_oauth_credentials();
    GoogleOAuthConfig::new_with_port(client_id, client_secret, port)
}

/// Mobile용 `OAuth` 설정 가져오기 (프록시 방식)
fn get_mobile_oauth_config() -> GoogleOAuthConfig {
    let (client_id, client_secret) = get_oauth_credentials();
    GoogleOAuthConfig::new_for_mobile(client_id, client_secret)
}

/// 사용 가능한 포트 찾기 (Desktop용)
fn find_available_port() -> Result<u16, AuthError> {
    for port in 49152..50000 {
        if TcpListener::bind(format!("127.0.0.1:{port}")).is_ok() {
            return Ok(port);
        }
    }
    Err(AuthError::ServerError(
        "사용 가능한 포트를 찾을 수 없습니다".to_string(),
    ))
}

/// PKCE 및 state 저장 헬퍼
fn store_oauth_state(
    oauth_state: &OAuthState,
    verifier: &str,
    state: &str,
    port: Option<u16>,
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
    {
        let mut stored_port = oauth_state
            .redirect_port
            .lock()
            .map_err(|_| AuthError::ServerError("포트 저장 실패".to_string()))?;
        *stored_port = port;
    }
    Ok(())
}

/// 로그인 시작 - 플랫폼별 분기 처리
#[tauri::command]
pub async fn start_google_login(
    app_handle: AppHandle,
    oauth_state: State<'_, OAuthState>,
) -> Result<LoginStartResponse, AuthError> {
    let platform = Platform::detect();

    match platform {
        Platform::Desktop => start_desktop_login(app_handle, oauth_state).await,
        Platform::Mobile => start_mobile_login(oauth_state).await,
    }
}

/// Desktop 로그인 (기존 loopback 서버 방식)
#[allow(clippy::unused_async)]
async fn start_desktop_login(
    app_handle: AppHandle,
    oauth_state: State<'_, OAuthState>,
) -> Result<LoginStartResponse, AuthError> {
    let port = find_available_port()?;
    let config = get_desktop_oauth_config(port);

    let verifier = generate_pkce_verifier();
    let challenge = generate_pkce_challenge(&verifier);
    let state = generate_state();

    store_oauth_state(&oauth_state, &verifier, &state, Some(port))?;

    let auth_url = build_auth_url(&config, &challenge, &state);

    // 백그라운드에서 로컬 서버 시작
    let verifier_clone = verifier;
    let state_clone = state;
    tokio::spawn(async move {
        if let Err(e) =
            start_callback_server(port, verifier_clone, state_clone, config, app_handle).await
        {
            error!("OAuth callback server error: {}", e);
        }
    });

    info!("Desktop OAuth login started on port {}", port);
    Ok(LoginStartResponse {
        auth_url,
        port,
        platform: "desktop".to_string(),
    })
}

/// Mobile 로그인 (프록시 서버 방식)
#[allow(clippy::unused_async)]
async fn start_mobile_login(
    oauth_state: State<'_, OAuthState>,
) -> Result<LoginStartResponse, AuthError> {
    let config = get_mobile_oauth_config();

    let verifier = generate_pkce_verifier();
    let challenge = generate_pkce_challenge(&verifier);
    let state = generate_state();

    // Mobile에서는 port 사용 안 함
    store_oauth_state(&oauth_state, &verifier, &state, None)?;

    let auth_url = build_auth_url(&config, &challenge, &state);

    info!("Mobile OAuth login started with proxy redirect");
    Ok(LoginStartResponse {
        auth_url,
        port: 0, // Mobile에서는 사용 안 함
        platform: "mobile".to_string(),
    })
}

/// 로컬 콜백 서버 시작
async fn start_callback_server(
    port: u16,
    pkce_verifier: String,
    expected_state: String,
    config: GoogleOAuthConfig,
    app_handle: AppHandle,
) -> Result<(), AuthError> {
    let listener = TcpListener::bind(format!("127.0.0.1:{port}"))
        .map_err(|e| AuthError::ServerError(e.to_string()))?;

    info!("OAuth callback server listening on port {}", port);

    // 단일 연결만 처리 (OAuth 콜백)
    if let Ok((mut stream, _)) = listener.accept() {
        let mut buffer = [0u8; 4096];
        let bytes_read = stream
            .read(&mut buffer)
            .map_err(|e| AuthError::ServerError(e.to_string()))?;

        let request = String::from_utf8_lossy(&buffer[..bytes_read]);

        // GET 요청에서 쿼리 파라미터 추출
        if let Some(query_start) = request.find("GET /callback?") {
            let query_end = request[query_start..]
                .find(" HTTP")
                .unwrap_or(request.len());
            let query_str = &request[query_start + 14..query_start + query_end];

            // 쿼리 파라미터 파싱
            let params: std::collections::HashMap<_, _> = query_str
                .split('&')
                .filter_map(|pair| {
                    let mut parts = pair.splitn(2, '=');
                    Some((parts.next()?, parts.next()?))
                })
                .collect();

            let code = params.get("code").map(std::string::ToString::to_string);
            let state = params.get("state").map(std::string::ToString::to_string);
            let error = params.get("error").map(std::string::ToString::to_string);

            // 성공 HTML 응답
            let (status, body) = if error.is_some() {
                (
                    "400 Bad Request",
                    r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>로그인 실패</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;}
.container{text-align:center;color:#fff;}.icon{font-size:64px;margin-bottom:20px;}h1{color:#e74c3c;}</style></head>
<body><div class="container"><div class="icon">❌</div><h1>로그인 실패</h1><p>인증이 취소되었습니다. 창을 닫고 다시 시도해주세요.</p></div></body></html>"#,
                )
            } else if let (Some(code), Some(state)) = (code, state) {
                // State 검증
                if state == expected_state {
                    // 토큰 교환 시도
                    match exchange_code_for_token(&config, &code, &pkce_verifier).await {
                        Ok(token) => {
                            // 사용자 프로필 가져오기
                            match fetch_user_profile(&token.access_token).await {
                                Ok(user) => {
                                    let expires_at = chrono::Utc::now().timestamp()
                                        + i64::try_from(token.expires_in).unwrap_or(3600);

                                    let auth_data = AuthData {
                                        access_token: token.access_token,
                                        refresh_token: token.refresh_token,
                                        expires_at,
                                        user,
                                    };

                                    // 프론트엔드로 인증 데이터 전송
                                    let _ = app_handle.emit("oauth-success", &auth_data);

                                    (
                                        "200 OK",
                                        r#"<!DOCTYPE html>
                <html><head><meta charset="utf-8"><title>로그인 성공</title>
                <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);}
                .container{text-align:center;color:#fff;}.icon{font-size:64px;margin-bottom:20px;}h1{margin-bottom:10px;}</style></head>
                <body><div class="container"><div class="icon">✅</div><h1>로그인 성공!</h1><p>이 창을 닫고 앱으로 돌아가세요.</p>
                <script>setTimeout(()=>window.close(),2000);</script></div></body></html>"#,
                                    )
                                }
                                Err(e) => {
                                    let _ = app_handle.emit("oauth-error", e.to_string());
                                    (
                                        "500 Internal Server Error",
                                        r#"<!DOCTYPE html>
                <html><head><meta charset="utf-8"><title>프로필 오류</title>
                <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;}
                .container{text-align:center;color:#fff;}.icon{font-size:64px;margin-bottom:20px;}h1{color:#e74c3c;}</style></head>
                <body><div class="container"><div class="icon">⚠️</div><h1>프로필 가져오기 실패</h1><p>다시 시도해주세요.</p></div></body></html>"#,
                                    )
                                }
                            }
                        }
                        Err(e) => {
                            let _ = app_handle.emit("oauth-error", e.to_string());
                            (
                                "500 Internal Server Error",
                                r#"<!DOCTYPE html>
                <html><head><meta charset="utf-8"><title>토큰 오류</title>
                <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;}
                .container{text-align:center;color:#fff;}.icon{font-size:64px;margin-bottom:20px;}h1{color:#e74c3c;}</style></head>
                <body><div class="container"><div class="icon">⚠️</div><h1>인증 오류</h1><p>토큰 교환에 실패했습니다.</p></div></body></html>"#,
                            )
                        }
                    }
                } else {
                    (
                        "400 Bad Request",
                        r#"<!DOCTYPE html>
                <html><head><meta charset="utf-8"><title>보안 오류</title>
                <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;}
                .container{text-align:center;color:#fff;}.icon{font-size:64px;margin-bottom:20px;}h1{color:#e74c3c;}</style></head>
                <body><div class="container"><div class="icon">🔒</div><h1>보안 오류</h1><p>요청이 변조되었을 수 있습니다. 다시 시도해주세요.</p></div></body></html>"#,
                    )
                }
            } else {
                (
                    "400 Bad Request",
                    r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>잘못된 요청</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;}
.container{text-align:center;color:#fff;}.icon{font-size:64px;margin-bottom:20px;}h1{color:#e74c3c;}</style></head>
<body><div class="container"><div class="icon">❓</div><h1>잘못된 요청</h1><p>인증 코드가 없습니다.</p></div></body></html>"#,
                )
            };

            let response = format!(
                "HTTP/1.1 {}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                status,
                body.len(),
                body
            );

            let _ = stream.write_all(response.as_bytes());
            let _ = stream.flush();
        }
    }

    Ok(())
}

/// 토큰 갱신 (플랫폼별 분기)
#[tauri::command]
pub async fn refresh_token(
    refresh_token: String,
    oauth_state: State<'_, OAuthState>,
) -> Result<TokenResponse, AuthError> {
    let platform = Platform::detect();

    let config = match platform {
        Platform::Desktop => {
            let port = {
                let guard = oauth_state
                    .redirect_port
                    .lock()
                    .map_err(|_| AuthError::ServerError("포트 가져오기 실패".to_string()))?;
                guard.unwrap_or(49152)
            };
            get_desktop_oauth_config(port)
        }
        Platform::Mobile => get_mobile_oauth_config(),
    };

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

/// Deep Link 콜백 처리 (모바일 프록시 방식용)
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

    // Mobile용 OAuth 설정
    let config = get_mobile_oauth_config();

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
