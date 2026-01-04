// Settings 모델 - 앱 설정
// 로컬 SQLite에 저장되는 사용자 설정

use serde::{Deserialize, Serialize};

/// 테마 설정
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

impl Theme {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::System => "system",
            Self::Light => "light",
            Self::Dark => "dark",
        }
    }
}

/// 언어 설정
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    #[default]
    Ko,
    Ja,
    En,
}

impl Language {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Ko => "ko",
            Self::Ja => "ja",
            Self::En => "en",
        }
    }

    pub const fn display_name(self) -> &'static str {
        match self {
            Self::Ko => "한국어",
            Self::Ja => "日本語",
            Self::En => "English",
        }
    }
}

/// 앱 설정
///
/// # 프론트엔드/백엔드 타입 일관성
///
/// | 레이어 | 네이밍 컨벤션 | 예시 |
/// |--------|---------------|------|
/// | Rust 필드 | `snake_case` | `notify_minutes_before` |
/// | SQLite 키 | `snake_case` | `notify_minutes_before` |
/// | JSON 직렬화 | `camelCase` | `notifyMinutesBefore` |
/// | TypeScript | `camelCase` | `notifyMinutesBefore` |
///
/// `#[serde(rename_all = "camelCase")]`가 자동으로 변환을 수행합니다.
/// 프론트엔드에서 설정 업데이트 시에는 **snake_case 키**를 사용해야 합니다.
/// (예: `updateSetting({ key: 'notify_minutes_before', value: '10' })`)
#[allow(clippy::struct_excessive_bools)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// 기본 알림 시간 (방송 시작 N분 전)
    #[serde(default = "default_notify_minutes")]
    pub notify_minutes_before: i32,

    /// 라이브 시작 시 알림
    #[serde(default = "default_true")]
    pub notify_on_live: bool,

    /// 예정 방송 알림
    #[serde(default = "default_true")]
    pub notify_on_upcoming: bool,

    /// 폴링 주기 (초)
    #[serde(default = "default_polling_interval")]
    pub polling_interval_seconds: i32,

    /// 서버 API Base URL (hololive-kakao-bot-go)
    #[serde(default = "default_api_base_url")]
    pub api_base_url: String,

    /// 테마
    #[serde(default)]
    pub theme: Theme,

    /// 언어
    #[serde(default)]
    pub language: Language,

    /// 오프라인 캐시 활성화
    #[serde(default = "default_true")]
    pub offline_cache_enabled: bool,

    /// 졸업 멤버 숨기기
    #[serde(default = "default_false")]
    pub hide_graduated: bool,
    /// 알림 사운드 파일 경로 (mp3/wav)
    #[serde(
        default,
        alias = "notification_sound_path",
        skip_serializing_if = "Option::is_none"
    )]
    pub notification_sound_path: Option<String>,
}

const fn default_notify_minutes() -> i32 {
    5
}

const fn default_true() -> bool {
    true
}

const fn default_polling_interval() -> i32 {
    60
}

const fn default_false() -> bool {
    false
}

fn default_api_base_url() -> String {
    "https://api.capu.blog".to_string()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            notify_minutes_before: 5,
            notify_on_live: true,
            notify_on_upcoming: true,
            polling_interval_seconds: 60,
            api_base_url: default_api_base_url(),
            theme: Theme::System,
            language: Language::Ko,
            offline_cache_enabled: true,
            hide_graduated: false,
            notification_sound_path: None,
        }
    }
}

impl Settings {
    /// 단일 설정 업데이트
    pub fn update(&mut self, key: &str, value: &str) -> Result<(), String> {
        match key {
            "notify_minutes_before" => {
                self.notify_minutes_before = value.parse().map_err(|_| "Invalid number")?;
            }
            "notify_on_live" => {
                self.notify_on_live = value.parse().map_err(|_| "Invalid boolean")?;
            }
            "notify_on_upcoming" => {
                self.notify_on_upcoming = value.parse().map_err(|_| "Invalid boolean")?;
            }
            "polling_interval_seconds" => {
                self.polling_interval_seconds = value.parse().map_err(|_| "Invalid number")?;
            }
            "api_base_url" => {
                self.api_base_url = value.trim().to_string();
            }
            "theme" => {
                self.theme =
                    serde_json::from_str(&format!("\"{value}\"")).map_err(|_| "Invalid theme")?;
            }
            "language" => {
                self.language = serde_json::from_str(&format!("\"{value}\""))
                    .map_err(|_| "Invalid language")?;
            }
            "offline_cache_enabled" => {
                self.offline_cache_enabled = value.parse().map_err(|_| "Invalid boolean")?;
            }
            "hide_graduated" => {
                self.hide_graduated = value.parse().map_err(|_| "Invalid boolean")?;
            }
            "notification_sound_path" => {
                let trimmed = value.trim();
                self.notification_sound_path = if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                };
            }
            _ => return Err(format!("Unknown setting: {key}")),
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_parses_numbers_booleans_and_enums() {
        let mut settings = Settings::default();

        settings.update("notify_minutes_before", "10").unwrap();
        assert_eq!(settings.notify_minutes_before, 10);

        settings.update("notify_on_live", "false").unwrap();
        assert!(!settings.notify_on_live);

        settings.update("polling_interval_seconds", "30").unwrap();
        assert_eq!(settings.polling_interval_seconds, 30);

        settings.update("theme", "dark").unwrap();
        assert_eq!(settings.theme, Theme::Dark);

        settings.update("language", "en").unwrap();
        assert_eq!(settings.language, Language::En);

        settings
            .update("api_base_url", "  http://example.com  ")
            .unwrap();
        assert_eq!(settings.api_base_url, "http://example.com");
    }

    #[test]
    fn test_update_rejects_invalid_values() {
        let mut settings = Settings::default();

        assert!(settings.update("notify_minutes_before", "x").is_err());
        assert!(settings.update("notify_on_live", "x").is_err());
        assert!(settings.update("theme", "invalid").is_err());
        assert!(settings.update("language", "invalid").is_err());
    }

    #[test]
    fn test_update_rejects_unknown_key() {
        let mut settings = Settings::default();
        let err = settings.update("unknown_key", "1").unwrap_err();
        assert!(err.contains("Unknown setting"));
    }
}
