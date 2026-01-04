// Channel 모델 - YouTube 채널 정보
// 원본: hololive-kakao-bot-go/internal/domain/channel.go

use serde::{Deserialize, Serialize};

/// YouTube 채널 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Channel {
    /// YouTube 채널 ID
    pub id: String,

    /// 채널명 (일본어 등)
    pub name: String,

    /// 영문 이름
    #[serde(
        default,
        alias = "english_name",
        skip_serializing_if = "Option::is_none"
    )]
    pub english_name: Option<String>,

    /// 프로필 사진 URL
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub photo: Option<String>,

    /// 트위터 핸들
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub twitter: Option<String>,

    /// 총 영상 수
    #[serde(
        default,
        alias = "video_count",
        skip_serializing_if = "Option::is_none"
    )]
    pub video_count: Option<i64>,

    /// 구독자 수
    #[serde(
        default,
        alias = "subscriber_count",
        skip_serializing_if = "Option::is_none"
    )]
    pub subscriber_count: Option<i64>,

    /// 소속 (Hololive, Nijisanji 등)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub org: Option<String>,

    /// 세부 소속
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suborg: Option<String>,

    /// 그룹 (기수 등)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
}

#[allow(dead_code)]
impl Channel {
    /// 표시용 이름 (영문명 우선, 없으면 기본 이름)
    pub fn display_name(&self) -> &str {
        self.english_name.as_deref().unwrap_or(&self.name)
    }

    /// YouTube 채널 URL
    pub fn youtube_url(&self) -> String {
        format!("https://www.youtube.com/channel/{id}", id = self.id)
    }

    /// 프로필 사진 URL (기본값 제공)
    pub fn photo_url(&self) -> &str {
        self.photo.as_deref().unwrap_or("")
    }

    /// 구독자 수 포맷팅 (한국어)
    pub fn formatted_subscriber_count(&self) -> String {
        self.subscriber_count
            .map_or_else(|| "불명".to_string(), format_korean_number)
    }
}

/// 한국어 숫자 포맷팅 (예: 1234567 -> "123만 4567")
#[allow(dead_code)]
fn format_korean_number(n: i64) -> String {
    if n >= 10_000 {
        let man = n / 10_000;
        let rest = n % 10_000;
        if rest > 0 {
            format!("{man}만 {rest}")
        } else {
            format!("{man}만")
        }
    } else {
        n.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_channel(subscriber_count: Option<i64>) -> Channel {
        Channel {
            id: "UC123".to_string(),
            name: "JP Name".to_string(),
            english_name: Some("EN Name".to_string()),
            photo: None,
            twitter: None,
            video_count: None,
            subscriber_count,
            org: None,
            suborg: None,
            group: None,
        }
    }

    #[test]
    fn test_display_name_prefers_english_name() {
        let channel = sample_channel(None);
        assert_eq!(channel.display_name(), "EN Name");

        let channel = Channel {
            english_name: None,
            ..sample_channel(None)
        };
        assert_eq!(channel.display_name(), "JP Name");
    }

    #[test]
    fn test_youtube_url() {
        let channel = sample_channel(None);
        assert_eq!(
            channel.youtube_url(),
            "https://www.youtube.com/channel/UC123"
        );
    }

    #[test]
    fn test_formatted_subscriber_count() {
        let channel = sample_channel(None);
        assert_eq!(channel.formatted_subscriber_count(), "불명");

        let channel = sample_channel(Some(9_999));
        assert_eq!(channel.formatted_subscriber_count(), "9999");

        let channel = sample_channel(Some(10_000));
        assert_eq!(channel.formatted_subscriber_count(), "1만");

        let channel = sample_channel(Some(1_234_567));
        assert_eq!(channel.formatted_subscriber_count(), "123만 4567");
    }

    #[test]
    fn test_format_korean_number() {
        assert_eq!(format_korean_number(0), "0");
        assert_eq!(format_korean_number(9_999), "9999");
        assert_eq!(format_korean_number(10_000), "1만");
        assert_eq!(format_korean_number(10_001), "1만 1");
        assert_eq!(format_korean_number(20_000), "2만");
    }
}
