// 설정 CRUD 작업
// Key-Value 형태 설정 저장

use rusqlite::params;

use super::{Database, DbResult};
use crate::models::Settings;

impl Database {
    /// 전체 설정 조회 (없으면 기본값)
    pub fn get_settings(&self) -> DbResult<Settings> {
        self.with_conn(|conn| {
            let mut settings = Settings::default();

            let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
            let rows = stmt.query_map([], |row| {
                let key: String = row.get(0)?;
                let value: String = row.get(1)?;
                Ok((key, value))
            })?;

            for (key, value) in rows.flatten() {
                // 에러 무시 (잘못된 값은 기본값 유지)
                let _ = settings.update(&key, &value);
            }

            Ok(settings)
        })
    }

    /// 단일 설정 저장
    pub fn set_setting(&self, key: &str, value: &str) -> DbResult<()> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )?;
            Ok(())
        })
    }

    /// 단일 설정 조회
    pub fn get_setting(&self, key: &str) -> DbResult<Option<String>> {
        self.with_conn(|conn| {
            let value = conn
                .query_row(
                    "SELECT value FROM settings WHERE key = ?1",
                    params![key],
                    |row| row.get(0),
                )
                .ok();
            Ok(value)
        })
    }

    /// 전체 설정 저장
    pub fn save_settings(&self, settings: &Settings) -> DbResult<()> {
        self.with_conn(|conn| {
            // 트랜잭션으로 일괄 저장
            let tx = conn.unchecked_transaction()?;

            let pairs = [
                (
                    "notify_minutes_before",
                    settings.notify_minutes_before.to_string(),
                ),
                ("notify_on_live", settings.notify_on_live.to_string()),
                (
                    "notify_on_upcoming",
                    settings.notify_on_upcoming.to_string(),
                ),
                (
                    "polling_interval_seconds",
                    settings.polling_interval_seconds.to_string(),
                ),
                ("api_base_url", settings.api_base_url.clone()),
                ("theme", settings.theme.as_str().to_string()),
                ("language", settings.language.as_str().to_string()),
                (
                    "offline_cache_enabled",
                    settings.offline_cache_enabled.to_string(),
                ),
                ("hide_graduated", settings.hide_graduated.to_string()),
                (
                    "notification_sound_path",
                    settings.notification_sound_path.clone().unwrap_or_default(),
                ),
            ];

            for (key, value) in pairs {
                tx.execute(
                    "INSERT INTO settings (key, value) VALUES (?1, ?2)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    params![key, value],
                )?;
            }

            tx.commit()?;
            Ok(())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_settings_crud() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        // 기본값 확인
        let settings = db.get_settings().expect("Failed to get settings");
        assert_eq!(settings.notify_minutes_before, 5);
        assert!(settings.notify_on_live);

        // 단일 설정 변경
        db.set_setting("notify_minutes_before", "10")
            .expect("Failed to set");

        let settings = db.get_settings().expect("Failed to get settings");
        assert_eq!(settings.notify_minutes_before, 10);

        // 전체 설정 저장
        let new_settings = Settings {
            polling_interval_seconds: 30,
            ..Settings::default()
        };
        db.save_settings(&new_settings).expect("Failed to save");

        let settings = db.get_settings().expect("Failed to get settings");
        assert_eq!(settings.polling_interval_seconds, 30);
    }

    #[test]
    fn test_get_settings_ignores_invalid_values() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        db.set_setting("notify_minutes_before", "not-a-number")
            .expect("Failed to set");
        db.set_setting("notify_on_live", "not-a-bool")
            .expect("Failed to set");
        db.set_setting("theme", "not-a-theme")
            .expect("Failed to set");

        let settings = db.get_settings().expect("Failed to get settings");
        assert_eq!(settings.notify_minutes_before, 5);
        assert!(settings.notify_on_live);
        assert_eq!(settings.theme, crate::models::Theme::System);
    }
}
