// Google OAuth 2.0 인증 모듈
// PKCE (Proof Key for Code Exchange) 기반 안전한 인증 흐름 구현
// 데스크톱 앱용 로컬 HTTP 서버 방식 사용

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use thiserror::Error;

/// `OAuth` 에러 타입
#[derive(Error, Debug)]
pub enum AuthError {
    #[error("PKCE verifier not found - please start login flow first")]
    PkceNotFound,
    #[error("Token exchange failed: {0}")]
    TokenExchange(String),
    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),
    #[error("Invalid state parameter")]
    InvalidState,
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    #[error("Server error: {0}")]
    ServerError(String),
}

impl Serialize for AuthError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Google `OAuth` 토큰 응답
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: u64,
    pub token_type: String,
    pub scope: Option<String>,
    pub id_token: Option<String>,
}

/// 사용자 프로필 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: String,
    pub email: String,
    pub name: String,
    pub picture: Option<String>,
}

/// `OAuth` 상태 (PKCE verifier 저장)
#[derive(Default)]
pub struct OAuthState {
    pub pkce_verifier: Mutex<Option<String>>,
    pub state: Mutex<Option<String>>,
    pub redirect_port: Mutex<Option<u16>>,
}

/// 플랫폼 타입 (Desktop vs Mobile)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Platform {
    Desktop,
    Mobile,
}

impl Platform {
    /// 현재 플랫폼 감지
    #[must_use]
    pub const fn detect() -> Self {
        #[cfg(target_os = "android")]
        {
            Self::Mobile
        }
        #[cfg(not(target_os = "android"))]
        {
            Self::Desktop
        }
    }
}

/// Google `OAuth` 설정
pub struct GoogleOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
}

/// 기본 `OAuth` 스코프
fn default_scopes() -> Vec<String> {
    vec![
        "openid".to_string(),
        "email".to_string(),
        "profile".to_string(),
        "https://www.googleapis.com/auth/youtube.readonly".to_string(),
        "https://www.googleapis.com/auth/calendar.readonly".to_string(),
    ]
}

impl GoogleOAuthConfig {
    /// 로컬 서버 리디렉션 URI로 설정 생성 (Desktop용)
    pub fn new_with_port(client_id: String, client_secret: String, port: u16) -> Self {
        Self {
            client_id,
            client_secret,
            redirect_uri: format!("http://127.0.0.1:{port}/callback"),
            scopes: default_scopes(),
        }
    }

    /// 프록시 서버 리디렉션 URI로 설정 생성 (Mobile용)
    pub fn new_for_mobile(client_id: String, client_secret: String) -> Self {
        Self {
            client_id,
            client_secret,
            redirect_uri: "https://api.capu.blog/oauth/callback".to_string(),
            scopes: default_scopes(),
        }
    }

    /// 커스텀 리디렉트 URI로 설정 생성
    pub fn new_with_redirect_uri(
        client_id: String,
        client_secret: String,
        redirect_uri: String,
    ) -> Self {
        Self {
            client_id,
            client_secret,
            redirect_uri,
            scopes: default_scopes(),
        }
    }
}

/// PKCE code verifier 생성 (43-128자의 랜덤 문자열)
pub fn generate_pkce_verifier() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    URL_SAFE_NO_PAD.encode(&bytes)
}

/// PKCE code challenge 생성 (verifier의 SHA256 해시를 `Base64URL` 인코딩)
pub fn generate_pkce_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    URL_SAFE_NO_PAD.encode(hash)
}

/// 랜덤 state 파라미터 생성 (CSRF 방지)
pub fn generate_state() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..16).map(|_| rng.gen()).collect();
    URL_SAFE_NO_PAD.encode(&bytes)
}

/// Google `OAuth` 인증 URL 생성
pub fn build_auth_url(config: &GoogleOAuthConfig, pkce_challenge: &str, state: &str) -> String {
    let scopes = config.scopes.join(" ");
    let encoded_scopes = urlencoding::encode(&scopes);
    let encoded_redirect = urlencoding::encode(&config.redirect_uri);

    format!(
        "https://accounts.google.com/o/oauth2/v2/auth?\
        client_id={}&\
        redirect_uri={}&\
        response_type=code&\
        scope={}&\
        code_challenge={}&\
        code_challenge_method=S256&\
        state={}&\
        access_type=offline&\
        prompt=consent",
        config.client_id, encoded_redirect, encoded_scopes, pkce_challenge, state
    )
}

/// 인증 코드를 토큰으로 교환
pub async fn exchange_code_for_token(
    config: &GoogleOAuthConfig,
    code: &str,
    pkce_verifier: &str,
) -> Result<TokenResponse, AuthError> {
    let client = reqwest::Client::new();

    let params = [
        ("client_id", config.client_id.as_str()),
        ("client_secret", config.client_secret.as_str()),
        ("code", code),
        ("code_verifier", pkce_verifier),
        ("grant_type", "authorization_code"),
        ("redirect_uri", config.redirect_uri.as_str()),
    ];

    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(AuthError::TokenExchange(error_text));
    }

    let token: TokenResponse = response.json().await?;
    Ok(token)
}

/// 리프레시 토큰을 사용하여 새 액세스 토큰 획득
pub async fn refresh_access_token(
    config: &GoogleOAuthConfig,
    refresh_token: &str,
) -> Result<TokenResponse, AuthError> {
    let client = reqwest::Client::new();

    let params = [
        ("client_id", config.client_id.as_str()),
        ("client_secret", config.client_secret.as_str()),
        ("refresh_token", refresh_token),
        ("grant_type", "refresh_token"),
    ];

    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(AuthError::TokenExchange(error_text));
    }

    let token: TokenResponse = response.json().await?;
    Ok(token)
}

/// 사용자 프로필 정보 가져오기
pub async fn fetch_user_profile(access_token: &str) -> Result<UserProfile, AuthError> {
    let client = reqwest::Client::new();

    let response = client
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(access_token)
        .send()
        .await?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(AuthError::TokenExchange(error_text));
    }

    let profile: UserProfile = response.json().await?;
    Ok(profile)
}

/// 액세스 토큰 취소 (로그아웃)
pub async fn revoke_token(token: &str) -> Result<(), AuthError> {
    let client = reqwest::Client::new();

    let _ = client
        .post("https://oauth2.googleapis.com/revoke")
        .form(&[("token", token)])
        .send()
        .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pkce_generation() {
        let verifier = generate_pkce_verifier();
        assert!(verifier.len() >= 43);

        let challenge = generate_pkce_challenge(&verifier);
        assert!(!challenge.is_empty());
    }

    #[test]
    fn test_state_generation() {
        let state = generate_state();
        assert!(!state.is_empty());
    }
}
