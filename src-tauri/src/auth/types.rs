// 세션 기반 인증 타입 정의
// Google OAuth 의존성을 제거하고 api.capu.blog 서버 기반 세션 인증용

use serde::{Deserialize, Serialize};

/// 사용자 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub email: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

/// 세션 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub token: String,
    pub expires_at: String, // ISO 8601
}

/// 인증 상태 (클라이언트 저장용)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthState {
    pub session: Session,
    pub user: User,
}

/// 로그인 요청
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

/// 회원가입 요청
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub display_name: String,
}

/// 비밀번호 재설정 요청
#[derive(Debug, Serialize)]
pub struct PasswordResetRequest {
    pub email: String,
}

/// 비밀번호 재설정 실행
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordResetExecute {
    pub token: String,
    pub new_password: String,
}

// === API 응답 타입 ===

/// 로그인 응답
#[derive(Debug, Deserialize)]
pub struct LoginResponse {
    pub success: bool,
    pub session: Session,
    pub user: User,
}

/// 회원가입 응답
#[derive(Debug, Deserialize)]
pub struct RegisterResponse {
    pub success: bool,
    pub user: User,
}

/// 세션 갱신 응답
#[derive(Debug, Deserialize)]
pub struct RefreshResponse {
    pub success: bool,
    pub session: Session,
}

/// 현재 사용자 조회 응답
#[derive(Debug, Deserialize)]
pub struct MeResponse {
    pub success: bool,
    pub user: User,
}

/// 일반 성공 응답
#[derive(Debug, Deserialize)]
pub struct SuccessResponse {
    pub success: bool,
    #[serde(default)]
    pub message: Option<String>,
}

/// API 에러 응답
#[derive(Debug, Deserialize)]
pub struct ErrorResponse {
    pub success: bool,
    pub error: ErrorDetail,
}

#[derive(Debug, Deserialize)]
pub struct ErrorDetail {
    pub code: String,
    pub message: String,
}

/// 인증 오류
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionAuthError {
    InvalidCredentials,
    EmailExists,
    InvalidInput(String),
    Unauthorized,
    NetworkError(String),
    StorageError(String),
    RateLimited,
    AccountLocked,
    SessionExpired,
    Unknown(String),
}

impl SessionAuthError {
    /// 에러 코드 반환 (프론트엔드 분기 처리용)
    #[must_use]
    pub const fn code(&self) -> &'static str {
        match self {
            Self::InvalidCredentials => "INVALID_CREDENTIALS",
            Self::EmailExists => "EMAIL_EXISTS",
            Self::InvalidInput(_) => "INVALID_INPUT",
            Self::Unauthorized => "UNAUTHORIZED",
            Self::NetworkError(_) => "NETWORK_ERROR",
            Self::StorageError(_) => "STORAGE_ERROR",
            Self::RateLimited => "RATE_LIMITED",
            Self::AccountLocked => "ACCOUNT_LOCKED",
            Self::SessionExpired => "SESSION_EXPIRED",
            Self::Unknown(_) => "UNKNOWN",
        }
    }
}

impl std::fmt::Display for SessionAuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidCredentials => write!(f, "Invalid email or password"),
            Self::EmailExists => write!(f, "Email already registered"),
            Self::InvalidInput(msg) => write!(f, "Invalid input: {msg}"),
            Self::Unauthorized => write!(f, "Unauthorized"),
            Self::NetworkError(msg) => write!(f, "Network error: {msg}"),
            Self::StorageError(msg) => write!(f, "Storage error: {msg}"),
            Self::RateLimited => write!(f, "Too many requests, please try again later"),
            Self::AccountLocked => write!(f, "Account locked due to too many failed attempts"),
            Self::SessionExpired => write!(f, "Session expired, please login again"),
            Self::Unknown(msg) => write!(f, "Unknown error: {msg}"),
        }
    }
}

impl std::error::Error for SessionAuthError {}

/// 커맨드 에러 응답 (프론트엔드 전달용 구조화된 에러)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: String,
    pub message: String,
}

impl From<SessionAuthError> for CommandError {
    fn from(e: SessionAuthError) -> Self {
        Self {
            code: e.code().to_string(),
            message: e.to_string(),
        }
    }
}
