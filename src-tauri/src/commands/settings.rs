#![allow(clippy::needless_pass_by_value)]

use tauri::State;

use crate::db::{Database, DbError, DbResult};
use crate::models::Settings;
use crate::AppState;

fn validate_setting(key: &str, value: &str) -> DbResult<()> {
    let mut settings = Settings::default();
    settings.update(key, value).map_err(DbError::InvalidData)?;
    Ok(())
}

fn get_settings_impl(db: &Database) -> Result<Settings, DbError> {
    db.get_settings()
}

fn update_setting_impl(db: &Database, key: String, value: String) -> Result<(), DbError> {
    validate_setting(&key, &value)?;
    db.set_setting(&key, &value)
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<Settings, DbError> {
    get_settings_impl(&state.db)
}

#[tauri::command]
pub fn update_setting(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), DbError> {
    update_setting_impl(&state.db, key, value)
}

#[tauri::command]
pub fn clear_cache(state: State<'_, AppState>) -> Result<(), DbError> {
    state.db.clear_all_cache()?;
    Ok(())
}

/// 테스트 알림 발송 커맨드 - Windows 전용
/// winrt-toast-reborn을 사용하여 알림 클릭 시 YouTube 링크 열기 지원
#[cfg(target_os = "windows")]
#[tauri::command]
#[allow(clippy::unnecessary_wraps)]
pub fn test_notification(
    _app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    use crate::scheduler::play_sound;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use tracing::{info, warn};
    use winrt_toast_reborn::{Toast, ToastManager};

    let youtube_url = "https://www.youtube.com".to_string();

    // 별도 스레드에서 알림 표시 및 클릭 대기
    std::thread::spawn(move || {
        let manager = ToastManager::new(ToastManager::POWERSHELL_AUM_ID);

        let mut toast = Toast::new();
        toast
            .text1("🔔 테스트 알림")
            .text2("알림이 정상적으로 작동합니다! 클릭하면 YouTube가 열립니다.");

        let action_taken = Arc::new(AtomicBool::new(false));
        let action_clone = Arc::clone(&action_taken);
        let dismiss_clone = Arc::clone(&action_taken);
        let url_clone = youtube_url;

        let show_result = manager
            .on_activated(None, move |_action| {
                info!("test_notification_clicked: opening {url_clone}");
                if let Err(e) = open::that(&url_clone) {
                    warn!("test_notification_open_url_failed: {e}");
                }
                action_clone.store(true, Ordering::SeqCst);
            })
            .on_dismissed(move |_reason| {
                dismiss_clone.store(true, Ordering::SeqCst);
            })
            .on_failed(|e| {
                warn!("test_notification_failed: {e:?}");
            })
            .show(&toast);

        if let Err(e) = show_result {
            warn!("test_notification_show_failed: {e}");
        }

        // 알림 이벤트 대기 (최대 15초)
        let start = std::time::Instant::now();
        while start.elapsed() < std::time::Duration::from_secs(15) {
            if action_taken.load(Ordering::SeqCst) {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    });

    // 사운드 재생 (DB에서 설정 조회)
    if let Ok(settings) = state.db.get_settings() {
        play_sound(settings.notification_sound_path.as_ref());
    }

    Ok(())
}

/// 테스트 알림 발송 커맨드 - macOS/Linux 전용
/// tauri-plugin-notification 사용 (클릭 처리 미지원)
#[cfg(all(not(target_os = "android"), not(target_os = "windows")))]
#[tauri::command]
pub fn test_notification(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    use crate::scheduler::play_sound;
    use tauri_plugin_notification::NotificationExt;

    // 알림 발송
    app_handle
        .notification()
        .builder()
        .title("🔔 테스트 알림")
        .body("알림이 정상적으로 작동합니다!")
        .show()
        .map_err(|e| e.to_string())?;

    // 사운드 재생 (DB에서 설정 조회)
    if let Ok(settings) = state.db.get_settings() {
        play_sound(settings.notification_sound_path.as_ref());
    }

    Ok(())
}

/// 테스트 알림 발송 커맨드 - Android 전용
/// tauri-plugin-notification 사용
#[cfg(target_os = "android")]
#[tauri::command]
pub fn test_notification(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    use crate::scheduler::play_sound;
    use tauri_plugin_notification::NotificationExt;

    // 알림 발송
    app_handle
        .notification()
        .builder()
        .title("🔔 테스트 알림")
        .body("알림이 정상적으로 작동합니다!")
        .action_type_id("stream-notification")
        .extra("videoId", "test")
        .extra("youtubeUrl", "https://www.youtube.com")
        .show()
        .map_err(|e| e.to_string())?;

    // 사운드 재생 (DB에서 설정 조회)
    if let Ok(settings) = state.db.get_settings() {
        play_sound(settings.notification_sound_path.as_ref());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_setting_impl_validates_and_persists() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        update_setting_impl(&db, "notify_minutes_before".to_string(), "10".to_string())
            .expect("Failed to update setting");

        let settings = get_settings_impl(&db).expect("Failed to get settings");
        assert_eq!(settings.notify_minutes_before, 10);

        let err = update_setting_impl(&db, "unknown_key".to_string(), "1".to_string()).unwrap_err();
        assert!(matches!(err, DbError::InvalidData(_)));

        let err = update_setting_impl(&db, "notify_minutes_before".to_string(), "x".to_string())
            .unwrap_err();
        assert!(matches!(err, DbError::InvalidData(_)));
    }
}
