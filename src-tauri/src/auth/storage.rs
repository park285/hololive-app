// 세션 토큰 보안 저장소
// 데스크톱: OS Keyring (Windows Credential Manager, macOS Keychain, Linux Secret Service)
// 모바일: tauri-plugin-store (암호화 미지원, 앱 샌드박스 의존)

use super::types::{Session, SessionAuthError};
use tauri::AppHandle;
use tracing::info;

// Desktop (Keyring 사용)
#[cfg(not(target_os = "android"))]
mod secure_storage {
    use super::*;
    use keyring::Entry;
    use tracing::warn;

    const SERVICE_NAME: &str = "hololive-notifier";
    const TOKEN_KEY: &str = "session_token";
    const EXPIRES_KEY: &str = "session_expires";

    fn get_entry(key: &str) -> Result<Entry, SessionAuthError> {
        Entry::new(SERVICE_NAME, key)
            .map_err(|e| SessionAuthError::StorageError(format!("Keyring entry error: {e}")))
    }

    /// 세션 토큰 저장 (OS Keyring)
    pub fn save_session(_app: &AppHandle, session: &Session) -> Result<(), SessionAuthError> {
        info!("[Keyring] save_session 시작");

        // 토큰 저장
        let token_entry = get_entry(TOKEN_KEY)?;
        token_entry.set_password(&session.token).map_err(|e| {
            warn!("[Keyring] 토큰 저장 실패: {e}");
            SessionAuthError::StorageError(format!("Failed to save token: {e}"))
        })?;

        // 만료 시간 저장
        let expires_entry = get_entry(EXPIRES_KEY)?;
        expires_entry
            .set_password(&session.expires_at)
            .map_err(|e| {
                warn!("[Keyring] 만료시간 저장 실패: {e}");
                SessionAuthError::StorageError(format!("Failed to save expiry: {e}"))
            })?;

        info!("[Keyring] Session saved to OS keyring 성공");
        Ok(())
    }

    /// 세션 토큰 로드 (OS Keyring)
    pub fn load_session(_app: &AppHandle) -> Option<Session> {
        info!("[Keyring] load_session 시작");

        let token_entry = match get_entry(TOKEN_KEY) {
            Ok(e) => e,
            Err(e) => {
                warn!("[Keyring] TOKEN_KEY entry 생성 실패: {:?}", e);
                return None;
            }
        };

        let expires_entry = match get_entry(EXPIRES_KEY) {
            Ok(e) => e,
            Err(e) => {
                warn!("[Keyring] EXPIRES_KEY entry 생성 실패: {:?}", e);
                return None;
            }
        };

        let token = match token_entry.get_password() {
            Ok(t) => {
                info!("[Keyring] 토큰 로드 성공");
                t
            }
            Err(keyring::Error::NoEntry) => {
                info!("[Keyring] 토큰 없음 (NoEntry)");
                return None;
            }
            Err(e) => {
                warn!("[Keyring] 토큰 로드 실패: {e}");
                return None;
            }
        };

        let expires_at = match expires_entry.get_password() {
            Ok(e) => {
                info!("[Keyring] 만료시간 로드 성공");
                e
            }
            Err(keyring::Error::NoEntry) => {
                info!("[Keyring] 만료시간 없음 (NoEntry)");
                return None;
            }
            Err(e) => {
                warn!("[Keyring] 만료시간 로드 실패: {e}");
                return None;
            }
        };

        info!("[Keyring] load_session 성공");
        Some(Session { token, expires_at })
    }

    /// 세션 토큰 삭제 (OS Keyring)
    #[allow(clippy::unnecessary_wraps)] // Android 버전과 API 일관성 유지
    pub fn clear_session(_app: &AppHandle) -> Result<(), SessionAuthError> {
        // 토큰 삭제 (없어도 에러 무시)
        if let Ok(token_entry) = get_entry(TOKEN_KEY) {
            let _ = token_entry.delete_credential();
        }

        // 만료 시간 삭제
        if let Ok(expires_entry) = get_entry(EXPIRES_KEY) {
            let _ = expires_entry.delete_credential();
        }

        info!("Session cleared from OS keyring");
        Ok(())
    }
}

// =====================
// Android (Store 사용 - 폴백)
// =====================
#[cfg(target_os = "android")]
mod secure_storage {
    use super::*;
    use tauri_plugin_store::StoreExt;
    use tracing::error;

    const STORE_PATH: &str = "session_auth.json";
    const SESSION_KEY: &str = "session";

    /// 세션 토큰 저장 (Store - 암호화 없음, 앱 샌드박스 의존)
    pub fn save_session(app: &AppHandle, session: &Session) -> Result<(), SessionAuthError> {
        let store = app
            .store(STORE_PATH)
            .map_err(|e| SessionAuthError::StorageError(e.to_string()))?;

        let value = serde_json::to_value(session)
            .map_err(|e| SessionAuthError::StorageError(e.to_string()))?;

        store.set(SESSION_KEY, value);
        store
            .save()
            .map_err(|e| SessionAuthError::StorageError(e.to_string()))?;

        info!("Session saved to store (Android)");
        Ok(())
    }

    /// 세션 토큰 로드 (Store)
    pub fn load_session(app: &AppHandle) -> Option<Session> {
        let store = match app.store(STORE_PATH) {
            Ok(s) => s,
            Err(e) => {
                error!("Failed to open store: {e}");
                return None;
            }
        };

        let value = store.get(SESSION_KEY)?;
        match serde_json::from_value(value) {
            Ok(session) => Some(session),
            Err(e) => {
                error!("Failed to deserialize session: {e}");
                None
            }
        }
    }

    /// 세션 토큰 삭제 (Store)
    pub fn clear_session(app: &AppHandle) -> Result<(), SessionAuthError> {
        let store = app
            .store(STORE_PATH)
            .map_err(|e| SessionAuthError::StorageError(e.to_string()))?;

        let _ = store.delete(SESSION_KEY);
        store
            .save()
            .map_err(|e| SessionAuthError::StorageError(e.to_string()))?;

        info!("Session cleared from store (Android)");
        Ok(())
    }
}

// =====================
// Public API (플랫폼 무관)
// =====================

/// 세션 저장
pub fn save_session(app: &AppHandle, session: &Session) -> Result<(), SessionAuthError> {
    secure_storage::save_session(app, session)
}

/// 세션 로드
pub fn load_session(app: &AppHandle) -> Option<Session> {
    secure_storage::load_session(app)
}

/// 세션 삭제
pub fn clear_session(app: &AppHandle) -> Result<(), SessionAuthError> {
    secure_storage::clear_session(app)
}

/// 세션 토큰만 가져오기 (API 호출용)
pub fn get_session_token(app: &AppHandle) -> Option<String> {
    load_session(app).map(|s| s.token)
}

/// 세션 만료 시간 가져오기
pub fn get_session_expiry(app: &AppHandle) -> Option<String> {
    load_session(app).map(|s| s.expires_at)
}

#[cfg(test)]
mod tests {
    // 테스트는 tauri AppHandle이 필요하므로 통합 테스트에서 수행
}
