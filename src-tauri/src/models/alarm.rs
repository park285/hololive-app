// Alarm 모델 - 로컬 알람 설정
// Tauri 앱 전용 (로컬 SQLite 저장)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 알람 설정 (로컬 저장)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Alarm {
    /// 로컬 DB ID
    #[serde(default)]
    pub id: i64,

    /// YouTube 채널 ID
    pub channel_id: String,

    /// 멤버 표시 이름 (영문, 레거시 호환용)
    pub member_name: String,

    /// 다국어 이름: 한국어
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub member_name_ko: Option<String>,

    /// 다국어 이름: 일본어
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub member_name_ja: Option<String>,

    /// 활성화 여부
    #[serde(default = "default_enabled")]
    pub enabled: bool,

    /// 알림 시간 (방송 시작 N분 전)
    #[serde(default = "default_notify_minutes")]
    pub notify_minutes_before: i32,

    /// 생성 시각
    #[serde(default)]
    pub created_at: Option<DateTime<Utc>>,
}

const fn default_enabled() -> bool {
    true
}

const fn default_notify_minutes() -> i32 {
    5
}

impl Alarm {
    /// 새 알람 생성 (영문 이름만)
    pub fn new(channel_id: String, member_name: String) -> Self {
        Self {
            id: 0,
            channel_id,
            member_name,
            member_name_ko: None,
            member_name_ja: None,
            enabled: true,
            notify_minutes_before: 5,
            created_at: Some(Utc::now()),
        }
    }

    /// 다국어 이름 추가
    pub fn with_multilang_names(
        mut self,
        name_ko: Option<String>,
        name_ja: Option<String>,
    ) -> Self {
        self.member_name_ko = name_ko;
        self.member_name_ja = name_ja;
        self
    }

    /// 커스텀 알림 시간으로 생성
    pub const fn with_notify_minutes(mut self, minutes: i32) -> Self {
        self.notify_minutes_before = minutes;
        self
    }
}

/// 알림 히스토리 (중복 발송 방지)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationHistory {
    /// 스트림 ID (YouTube 비디오 ID)
    pub stream_id: String,

    /// 예정 시작 시간 (변경 감지용)
    pub start_scheduled_at: Option<DateTime<Utc>>,

    /// 알림 발송 시각
    pub notified_at: DateTime<Utc>,

    /// 알림 시점 (5분전, 3분전 등)
    pub minutes_until: i32,
}

impl NotificationHistory {
    /// 새 히스토리 생성
    pub fn new(
        stream_id: String,
        start_scheduled_at: Option<DateTime<Utc>>,
        minutes_until: i32,
    ) -> Self {
        Self {
            stream_id,
            start_scheduled_at,
            notified_at: Utc::now(),
            minutes_until,
        }
    }

    /// 일정 변경 감지
    pub fn schedule_changed(&self, new_scheduled: Option<DateTime<Utc>>) -> Option<i64> {
        match (self.start_scheduled_at, new_scheduled) {
            (Some(old), Some(new)) => {
                let diff_minutes = (new - old).num_minutes();
                if diff_minutes != 0 {
                    Some(diff_minutes)
                } else {
                    None
                }
            }
            _ => None,
        }
    }

    /// 변경 메시지 생성
    pub fn format_schedule_change(&self, new_scheduled: Option<DateTime<Utc>>) -> Option<String> {
        self.schedule_changed(new_scheduled).map(|diff| {
            if diff > 0 {
                format!("일정이 {diff}분 늦춰졌습니다.")
            } else {
                let minutes = -diff;
                format!("일정이 {minutes}분 앞당겨졌습니다.")
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, TimeZone};

    #[test]
    fn test_alarm_defaults_and_custom_minutes() {
        let alarm = Alarm::new("UC123".to_string(), "Test".to_string());
        assert_eq!(alarm.id, 0);
        assert_eq!(alarm.channel_id, "UC123");
        assert_eq!(alarm.member_name, "Test");
        assert!(alarm.enabled);
        assert_eq!(alarm.notify_minutes_before, 5);
        assert!(alarm.created_at.is_some());

        let alarm = alarm.with_notify_minutes(15);
        assert_eq!(alarm.notify_minutes_before, 15);
    }

    #[test]
    fn test_notification_history_schedule_change_and_message() {
        let old = Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap();
        let history = NotificationHistory {
            stream_id: "vid1".to_string(),
            start_scheduled_at: Some(old),
            notified_at: Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap(),
            minutes_until: 5,
        };

        let new_later = old + Duration::minutes(30);
        assert_eq!(history.schedule_changed(Some(new_later)), Some(30));
        assert_eq!(
            history.format_schedule_change(Some(new_later)).as_deref(),
            Some("일정이 30분 늦춰졌습니다.")
        );

        let new_earlier = old - Duration::minutes(10);
        assert_eq!(history.schedule_changed(Some(new_earlier)), Some(-10));
        assert_eq!(
            history.format_schedule_change(Some(new_earlier)).as_deref(),
            Some("일정이 10분 앞당겨졌습니다.")
        );

        assert_eq!(history.schedule_changed(Some(old)), None);
        assert_eq!(history.schedule_changed(None), None);
    }
}
