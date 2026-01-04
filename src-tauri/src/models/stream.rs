// Stream 모델 - YouTube/Holodex 스트림 데이터
// 원본: hololive-kakao-bot-go/internal/domain/stream.go

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 스트림 상태
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum StreamStatus {
    Live,
    #[default]
    Upcoming,
    Past,
}

/// YouTube/Holodex 스트림 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stream {
    /// YouTube 비디오 ID
    pub id: String,

    /// 방송 제목
    pub title: String,

    /// YouTube 채널 ID
    #[serde(alias = "channel_id")]
    pub channel_id: String,

    /// 채널 이름
    #[serde(default, alias = "channel_name")]
    pub channel_name: String,

    /// 스트림 상태 (live, upcoming, past)
    pub status: StreamStatus,

    /// 예정 시작 시간 (RFC3339)
    #[serde(
        default,
        alias = "start_scheduled",
        skip_serializing_if = "Option::is_none"
    )]
    pub start_scheduled: Option<DateTime<Utc>>,

    /// 실제 시작 시간
    #[serde(
        default,
        alias = "start_actual",
        skip_serializing_if = "Option::is_none"
    )]
    pub start_actual: Option<DateTime<Utc>>,

    /// 방송 길이 (초)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration: Option<i64>,

    /// 썸네일 URL
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,

    /// 방송 URL
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,

    /// 채널 정보 (선택적 포함)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub channel: Option<super::Channel>,

    /// 시작까지 남은 초 (프론트엔드 렌더링 최적화용, Rust에서 사전 계산)
    /// NOTE: API 응답 시점 기준으로 계산되므로 프론트에서는 단순 포맷팅만 수행함
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seconds_until_start: Option<i64>,
}

#[allow(dead_code)]
impl Stream {
    /// YouTube 비디오 URL 생성
    pub fn youtube_url(&self) -> String {
        format!("https://www.youtube.com/watch?v={id}", id = self.id)
    }

    /// 시작까지 남은 분 계산 (테스트 용이성을 위해 now 주입)
    pub fn minutes_until_start_at(&self, now: DateTime<Utc>) -> Option<i64> {
        self.start_scheduled
            .map(|scheduled| (scheduled - now).num_minutes())
    }

    /// 시작까지 남은 분 계산
    pub fn minutes_until_start(&self) -> Option<i64> {
        self.minutes_until_start_at(Utc::now())
    }

    /// 시작까지 남은 초 계산 (테스트 용이성을 위해 now 주입)
    pub fn seconds_until_start_at(&self, now: DateTime<Utc>) -> Option<i64> {
        self.start_scheduled
            .map(|scheduled| (scheduled - now).num_seconds())
    }

    /// 상대 시간을 사전 계산하여 `seconds_until_start` 필드를 채움
    /// NOTE: API 응답 전송 전에 호출하여 프론트엔드 렌더링 부하를 감소시킴
    #[must_use]
    pub fn with_computed_time(mut self) -> Self {
        self.seconds_until_start = self.seconds_until_start_at(Utc::now());
        self
    }

    /// 알림 대상 여부 확인 (시작 N분 전, 테스트 용이성을 위해 now 주입)
    pub fn should_notify_at(&self, minutes_before: i64, now: DateTime<Utc>) -> bool {
        if self.status != StreamStatus::Upcoming {
            return false;
        }

        self.minutes_until_start_at(now)
            .is_some_and(|mins| mins > 0 && mins <= minutes_before)
    }

    /// 알림 대상 여부 확인 (시작 N분 전)
    pub fn should_notify(&self, minutes_before: i64) -> bool {
        self.should_notify_at(minutes_before, Utc::now())
    }
}

/// API 응답 래퍼
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamListResponse {
    pub status: String,
    #[serde(default)]
    pub streams: Vec<Stream>,
}

/// 델타 업데이트 응답
/// 캐시된 데이터와 새 데이터를 비교하여 변경 사항만 전달
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamsDeltaResponse {
    /// 전체 스트림 목록 (변경이 있을 때만 포함)
    pub streams: Vec<Stream>,
    /// 새로 추가된 스트림 ID 목록
    pub added: Vec<String>,
    /// 삭제된 스트림 ID 목록
    pub removed: Vec<String>,
    /// 업데이트된 스트림 ID 목록
    pub updated: Vec<String>,
    /// 변경 사항 존재 여부
    pub has_changes: bool,
}

impl StreamsDeltaResponse {
    /// 변경 없음 응답 생성
    #[must_use]
    pub const fn no_changes() -> Self {
        Self {
            streams: Vec::new(),
            added: Vec::new(),
            removed: Vec::new(),
            updated: Vec::new(),
            has_changes: false,
        }
    }

    /// 두 스트림 목록을 비교하여 Delta 생성
    pub fn compute(old_streams: &[Stream], new_streams: &[Stream]) -> Self {
        use std::collections::{HashMap, HashSet};

        // HashMap 사전 할당으로 메모리 효율성 향상
        let mut old_map: HashMap<&str, &Stream> = HashMap::with_capacity(old_streams.len());
        for s in old_streams {
            old_map.insert(s.id.as_str(), s);
        }

        let mut new_map: HashMap<&str, &Stream> = HashMap::with_capacity(new_streams.len());
        for s in new_streams {
            new_map.insert(s.id.as_str(), s);
        }

        let old_ids: HashSet<&str> = old_map.keys().copied().collect();
        let new_ids: HashSet<&str> = new_map.keys().copied().collect();

        // 추가된 스트림
        let added: Vec<String> = new_ids
            .difference(&old_ids)
            .map(|id| (*id).to_string())
            .collect();

        // 삭제된 스트림
        let removed: Vec<String> = old_ids
            .difference(&new_ids)
            .map(|id| (*id).to_string())
            .collect();

        // 변경된 스트림 (동일 ID지만 내용이 다른 경우)
        // NOTE: intersection 결과이므로 old_map/new_map 모두 해당 키를 보유, unwrap 안전
        #[allow(clippy::unwrap_used)]
        let updated: Vec<String> = new_ids
            .intersection(&old_ids)
            .filter(|id| {
                let old = old_map.get(*id).unwrap();
                let new = new_map.get(*id).unwrap();
                !streams_equal(old, new)
            })
            .map(|id| (*id).to_string())
            .collect();

        let has_changes = !added.is_empty() || !removed.is_empty() || !updated.is_empty();

        Self {
            streams: if has_changes {
                new_streams.to_vec()
            } else {
                Vec::new()
            },
            added,
            removed,
            updated,
            has_changes,
        }
    }
}

/// 두 스트림이 동일한지 비교 (주요 필드만)
fn streams_equal(a: &Stream, b: &Stream) -> bool {
    a.id == b.id
        && a.title == b.title
        && a.status == b.status
        && a.start_scheduled == b.start_scheduled
        && a.start_actual == b.start_actual
        && a.duration == b.duration
        && a.thumbnail == b.thumbnail
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, TimeZone};

    fn sample_stream(status: StreamStatus, start_scheduled: Option<DateTime<Utc>>) -> Stream {
        Stream {
            id: "vid1".to_string(),
            title: "title".to_string(),
            channel_id: "UC123".to_string(),
            channel_name: "channel".to_string(),
            status,
            start_scheduled,
            start_actual: None,
            duration: None,
            thumbnail: None,
            link: None,
            channel: None,
            seconds_until_start: None,
        }
    }

    #[test]
    fn test_youtube_url() {
        let stream = sample_stream(StreamStatus::Upcoming, None);
        assert_eq!(stream.youtube_url(), "https://www.youtube.com/watch?v=vid1");
    }

    #[test]
    fn test_minutes_until_start_at() {
        let now = Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap();
        let scheduled = now + Duration::minutes(10);
        let stream = sample_stream(StreamStatus::Upcoming, Some(scheduled));

        assert_eq!(stream.minutes_until_start_at(now), Some(10));
    }

    #[test]
    fn test_should_notify_at() {
        let now = Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap();

        let scheduled_in_5 = now + Duration::minutes(5);
        let stream = sample_stream(StreamStatus::Upcoming, Some(scheduled_in_5));
        assert!(stream.should_notify_at(5, now));

        let scheduled_in_6 = now + Duration::minutes(6);
        let stream = sample_stream(StreamStatus::Upcoming, Some(scheduled_in_6));
        assert!(!stream.should_notify_at(5, now));

        let scheduled_now = now;
        let stream = sample_stream(StreamStatus::Upcoming, Some(scheduled_now));
        assert!(!stream.should_notify_at(5, now));

        let scheduled_in_5 = now + Duration::minutes(5);
        let stream = sample_stream(StreamStatus::Live, Some(scheduled_in_5));
        assert!(!stream.should_notify_at(5, now));
    }

    // === StreamsDeltaResponse 테스트 ===

    /// 테스트용 스트림 생성 헬퍼 (ID 지정 가능)
    fn stream_with_id(id: &str, title: &str) -> Stream {
        Stream {
            id: id.to_string(),
            title: title.to_string(),
            channel_id: "UC123".to_string(),
            channel_name: "channel".to_string(),
            status: StreamStatus::Upcoming,
            start_scheduled: None,
            start_actual: None,
            duration: None,
            thumbnail: None,
            link: None,
            channel: None,
            seconds_until_start: None,
        }
    }

    #[test]
    fn test_delta_no_changes() {
        // 동일한 데이터: 변경 없음
        let old = vec![stream_with_id("vid1", "Title 1")];
        let new = vec![stream_with_id("vid1", "Title 1")];

        let delta = StreamsDeltaResponse::compute(&old, &new);

        assert!(!delta.has_changes);
        assert!(delta.added.is_empty());
        assert!(delta.removed.is_empty());
        assert!(delta.updated.is_empty());
        assert!(delta.streams.is_empty()); // 변경 없으면 빈 배열
    }

    #[test]
    fn test_delta_added_streams() {
        // 새 스트림 추가
        let old = vec![stream_with_id("vid1", "Title 1")];
        let new = vec![
            stream_with_id("vid1", "Title 1"),
            stream_with_id("vid2", "Title 2"),
        ];

        let delta = StreamsDeltaResponse::compute(&old, &new);

        assert!(delta.has_changes);
        assert_eq!(delta.added.len(), 1);
        assert!(delta.added.contains(&"vid2".to_string()));
        assert!(delta.removed.is_empty());
        assert!(delta.updated.is_empty());
        assert_eq!(delta.streams.len(), 2);
    }

    #[test]
    fn test_delta_removed_streams() {
        // 스트림 삭제
        let old = vec![
            stream_with_id("vid1", "Title 1"),
            stream_with_id("vid2", "Title 2"),
        ];
        let new = vec![stream_with_id("vid1", "Title 1")];

        let delta = StreamsDeltaResponse::compute(&old, &new);

        assert!(delta.has_changes);
        assert!(delta.added.is_empty());
        assert_eq!(delta.removed.len(), 1);
        assert!(delta.removed.contains(&"vid2".to_string()));
        assert!(delta.updated.is_empty());
    }

    #[test]
    fn test_delta_updated_streams() {
        // 스트림 제목 변경
        let old = vec![stream_with_id("vid1", "Old Title")];
        let new = vec![stream_with_id("vid1", "New Title")];

        let delta = StreamsDeltaResponse::compute(&old, &new);

        assert!(delta.has_changes);
        assert!(delta.added.is_empty());
        assert!(delta.removed.is_empty());
        assert_eq!(delta.updated.len(), 1);
        assert!(delta.updated.contains(&"vid1".to_string()));
    }

    #[test]
    fn test_delta_mixed_changes() {
        // 복합 변경: 추가 + 삭제 + 수정
        let old = vec![
            stream_with_id("vid1", "Title 1"),     // 삭제됨
            stream_with_id("vid2", "Old Title 2"), // 수정됨
        ];
        let new = vec![
            stream_with_id("vid2", "New Title 2"), // 수정됨
            stream_with_id("vid3", "Title 3"),     // 추가됨
        ];

        let delta = StreamsDeltaResponse::compute(&old, &new);

        assert!(delta.has_changes);
        assert_eq!(delta.added.len(), 1);
        assert!(delta.added.contains(&"vid3".to_string()));
        assert_eq!(delta.removed.len(), 1);
        assert!(delta.removed.contains(&"vid1".to_string()));
        assert_eq!(delta.updated.len(), 1);
        assert!(delta.updated.contains(&"vid2".to_string()));
    }

    #[test]
    fn test_delta_empty_old() {
        // 초기 로드: 모든 스트림이 새로 추가됨
        let old: Vec<Stream> = vec![];
        let new = vec![stream_with_id("vid1", "Title 1")];

        let delta = StreamsDeltaResponse::compute(&old, &new);

        assert!(delta.has_changes);
        assert_eq!(delta.added.len(), 1);
        assert!(delta.removed.is_empty());
        assert!(delta.updated.is_empty());
    }

    #[test]
    fn test_delta_empty_new() {
        // 모든 스트림 종료: 전부 삭제됨
        let old = vec![stream_with_id("vid1", "Title 1")];
        let new: Vec<Stream> = vec![];

        let delta = StreamsDeltaResponse::compute(&old, &new);

        assert!(delta.has_changes);
        assert!(delta.added.is_empty());
        assert_eq!(delta.removed.len(), 1);
        assert!(delta.updated.is_empty());
    }

    #[test]
    fn test_delta_no_changes_response() {
        // no_changes() 헬퍼 테스트
        let delta = StreamsDeltaResponse::no_changes();

        assert!(!delta.has_changes);
        assert!(delta.streams.is_empty());
        assert!(delta.added.is_empty());
        assert!(delta.removed.is_empty());
        assert!(delta.updated.is_empty());
    }

    // === 추가 Stream 메서드 테스트 ===

    #[test]
    fn test_seconds_until_start_at() {
        let now = Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap();
        let scheduled = now + Duration::seconds(300);
        let stream = sample_stream(StreamStatus::Upcoming, Some(scheduled));

        assert_eq!(stream.seconds_until_start_at(now), Some(300));
    }

    #[test]
    fn test_with_computed_time() {
        let now = Utc::now();
        let scheduled = now + Duration::minutes(10);
        let stream = sample_stream(StreamStatus::Upcoming, Some(scheduled));

        assert!(stream.seconds_until_start.is_none());

        let computed = stream.with_computed_time();
        assert!(computed.seconds_until_start.is_some());
        // 대략 600초 (10분) 근처여야 함
        let secs = computed.seconds_until_start.unwrap();
        assert!(secs > 590 && secs <= 600);
    }

    #[test]
    fn test_minutes_until_start_no_scheduled() {
        // start_scheduled가 None인 경우
        let stream = sample_stream(StreamStatus::Upcoming, None);
        assert!(stream.minutes_until_start().is_none());
    }
}
