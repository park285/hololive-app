// 세션 인증 API 클라이언트
// api.capu.blog 서버의 /api/auth/* 엔드포인트 호출

use crate::auth::types::{
    AuthState, LoginRequest, LoginResponse, MeResponse, RefreshResponse, RegisterRequest,
    RegisterResponse, Session, SessionAuthError, User,
};
use reqwest::Client;
use tracing::{error, info};

const BASE_URL: &str = "https://api.capu.blog";

/// 세션 인증 API 클라이언트
pub struct SessionAuthClient {
    client: Client,
}

impl Default for SessionAuthClient {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionAuthClient {
    /// 새 클라이언트 생성
    #[must_use]
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    /// 로그인
    pub async fn login(&self, email: &str, password: &str) -> Result<AuthState, SessionAuthError> {
        info!("Attempting login for: {email}");

        let res = self
            .client
            .post(format!("{BASE_URL}/api/auth/login"))
            .json(&LoginRequest {
                email: email.to_string(),
                password: password.to_string(),
            })
            .send()
            .await
            .map_err(|e| SessionAuthError::NetworkError(e.to_string()))?;

        let status = res.status().as_u16();
        match status {
            200 => {
                let body: LoginResponse = res
                    .json()
                    .await
                    .map_err(|e| SessionAuthError::NetworkError(e.to_string()))?;
                info!("Login successful for: {email}");
                Ok(AuthState {
                    session: body.session,
                    user: body.user,
                })
            }
            401 => {
                error!("Login failed: invalid credentials");
                Err(SessionAuthError::InvalidCredentials)
            }
            403 => {
                error!("Login failed: account locked");
                Err(SessionAuthError::AccountLocked)
            }
            429 => {
                error!("Login failed: rate limited");
                Err(SessionAuthError::RateLimited)
            }
            _ => {
                let error_text = res.text().await.unwrap_or_default();
                error!("Login failed with status {status}: {error_text}");
                Err(SessionAuthError::Unknown(format!(
                    "HTTP {status}: {error_text}"
                )))
            }
        }
    }

    /// 회원가입
    pub async fn register(
        &self,
        email: &str,
        password: &str,
        display_name: &str,
    ) -> Result<User, SessionAuthError> {
        info!("Attempting registration for: {email}");

        let res = self
            .client
            .post(format!("{BASE_URL}/api/auth/register"))
            .json(&RegisterRequest {
                email: email.to_string(),
                password: password.to_string(),
                display_name: display_name.to_string(),
            })
            .send()
            .await
            .map_err(|e| SessionAuthError::NetworkError(e.to_string()))?;

        let status = res.status().as_u16();
        match status {
            201 => {
                let body: RegisterResponse = res
                    .json()
                    .await
                    .map_err(|e| SessionAuthError::NetworkError(e.to_string()))?;
                info!("Registration successful for: {email}");
                Ok(body.user)
            }
            400 => {
                let error_text = res.text().await.unwrap_or_default();
                error!("Registration failed: invalid input - {error_text}");
                Err(SessionAuthError::InvalidInput(error_text))
            }
            409 => {
                error!("Registration failed: email exists");
                Err(SessionAuthError::EmailExists)
            }
            _ => {
                let error_text = res.text().await.unwrap_or_default();
                error!("Registration failed with status {status}: {error_text}");
                Err(SessionAuthError::Unknown(format!(
                    "HTTP {status}: {error_text}"
                )))
            }
        }
    }

    /// 로그아웃
    pub async fn logout(&self, token: &str) -> Result<(), SessionAuthError> {
        info!("Attempting logout");

        let res = self
            .client
            .post(format!("{BASE_URL}/api/auth/logout"))
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| SessionAuthError::NetworkError(e.to_string()))?;

        if res.status().is_success() {
            info!("Logout successful");
        } else {
            // 로그아웃은 서버 에러가 나도 로컬 세션은 삭제하므로 경고만
            let status = res.status().as_u16();
            error!("Logout server response was {status}, proceeding anyway");
        }
        Ok(())
    }

    /// 세션 갱신
    pub async fn refresh(&self, token: &str) -> Result<Session, SessionAuthError> {
        info!("Attempting session refresh");

        let res = self
            .client
            .post(format!("{BASE_URL}/api/auth/refresh"))
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| SessionAuthError::NetworkError(e.to_string()))?;

        let status = res.status().as_u16();
        match status {
            200 => {
                let body: RefreshResponse = res
                    .json()
                    .await
                    .map_err(|e| SessionAuthError::NetworkError(e.to_string()))?;
                info!("Session refresh successful");
                Ok(body.session)
            }
            401 => {
                error!("Session refresh failed: unauthorized");
                Err(SessionAuthError::SessionExpired)
            }
            _ => {
                let error_text = res.text().await.unwrap_or_default();
                error!("Session refresh failed with status {status}: {error_text}");
                Err(SessionAuthError::Unknown(format!(
                    "HTTP {status}: {error_text}"
                )))
            }
        }
    }

    /// 현재 사용자 조회
    pub async fn get_me(&self, token: &str) -> Result<User, SessionAuthError> {
        let res = self
            .client
            .get(format!("{BASE_URL}/api/auth/me"))
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| SessionAuthError::NetworkError(e.to_string()))?;

        let status = res.status().as_u16();
        match status {
            200 => {
                let body: MeResponse = res
                    .json()
                    .await
                    .map_err(|e| SessionAuthError::NetworkError(e.to_string()))?;
                Ok(body.user)
            }
            401 => Err(SessionAuthError::Unauthorized),
            _ => {
                let error_text = res.text().await.unwrap_or_default();
                Err(SessionAuthError::Unknown(format!(
                    "HTTP {status}: {error_text}"
                )))
            }
        }
    }

    /// 비밀번호 재설정 요청
    pub async fn request_password_reset(&self, email: &str) -> Result<(), SessionAuthError> {
        info!("Requesting password reset for: {email}");

        let res = self
            .client
            .post(format!("{BASE_URL}/api/auth/password/reset-request"))
            .json(&serde_json::json!({ "email": email }))
            .send()
            .await
            .map_err(|e| SessionAuthError::NetworkError(e.to_string()))?;

        if res.status().is_success() {
            info!("Password reset request sent");
        }
        // 보안상 이메일 존재 여부를 노출하지 않으므로 항상 성공으로 처리
        Ok(())
    }
}
