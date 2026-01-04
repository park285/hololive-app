// 오프라인 캐시 CRUD 작업
// 네트워크 단절 시 마지막 성공 데이터 제공

use chrono::{DateTime, Utc};
use rusqlite::params;

use super::{Database, DbResult};

/// 캐시 가능한 데이터 키
pub enum CacheKey {
    LiveStreams,
    UpcomingStreams(Option<u32>),
    Members,
    /// 채널 프로필 이미지 캐시 (정적 데이터, 7일 유효)
    ChannelPhotos,
}

impl CacheKey {
    #[must_use]
    pub fn to_key_string(&self) -> String {
        match self {
            Self::LiveStreams => "live_streams".to_string(),
            Self::UpcomingStreams(None) => "upcoming_streams".to_string(),
            Self::UpcomingStreams(Some(h)) => format!("upcoming_streams_{h}"),
            Self::Members => "members".to_string(),
            Self::ChannelPhotos => "channel_photos".to_string(),
        }
    }
}

/// 캐시 엔트리 (데이터 + 캐시 시간)
pub struct CacheEntry {
    pub data: String,
    pub cached_at: DateTime<Utc>,
}

impl Database {
    /// 캐시 데이터 저장 (UPSERT)
    pub fn set_cache(&self, key: &CacheKey, cache_data: &str) -> DbResult<()> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO offline_cache (key, data, cached_at)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET data = excluded.data, cached_at = excluded.cached_at",
                params![key.to_key_string(), cache_data, Utc::now().to_rfc3339()],
            )?;
            Ok(())
        })
    }

    /// 테스트용: 특정 시간으로 캐시 데이터 저장
    #[cfg(test)]
    pub fn set_cache_at(
        &self,
        key: &CacheKey,
        cache_data: &str,
        cached_at: DateTime<Utc>,
    ) -> DbResult<()> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO offline_cache (key, data, cached_at)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET data = excluded.data, cached_at = excluded.cached_at",
                params![key.to_key_string(), cache_data, cached_at.to_rfc3339()],
            )?;
            Ok(())
        })
    }

    /// 캐시 데이터 조회
    pub fn get_cache(&self, key: &CacheKey) -> DbResult<Option<CacheEntry>> {
        self.with_conn(|conn| {
            let entry = conn
                .query_row(
                    "SELECT data, cached_at FROM offline_cache WHERE key = ?1",
                    params![key.to_key_string()],
                    |row| {
                        let cache_data: String = row.get(0)?;
                        let cached_at_str: String = row.get(1)?;
                        let cached_at = DateTime::parse_from_rfc3339(&cached_at_str)
                            .map_or_else(|_| Utc::now(), |dt| dt.with_timezone(&Utc));
                        Ok(CacheEntry {
                            data: cache_data,
                            cached_at,
                        })
                    },
                )
                .ok();
            Ok(entry)
        })
    }

    /// 캐시 데이터 삭제
    pub fn clear_cache(&self, key: &CacheKey) -> DbResult<()> {
        self.with_conn(|conn| {
            conn.execute(
                "DELETE FROM offline_cache WHERE key = ?1",
                params![key.to_key_string()],
            )?;
            Ok(())
        })
    }

    /// 모든 캐시 데이터 삭제
    pub fn clear_all_cache(&self) -> DbResult<usize> {
        self.with_conn(|conn| {
            let affected = conn.execute("DELETE FROM offline_cache", [])?;
            Ok(affected)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_crud() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        // 캐시 저장
        db.set_cache(&CacheKey::LiveStreams, r#"[{"id":"1"}]"#)
            .expect("Failed to set cache");

        // 캐시 조회
        let entry = db
            .get_cache(&CacheKey::LiveStreams)
            .expect("Failed to get cache")
            .expect("Cache not found");
        assert_eq!(entry.data, r#"[{"id":"1"}]"#);

        // 캐시 업데이트 (UPSERT)
        db.set_cache(&CacheKey::LiveStreams, r#"[{"id":"2"}]"#)
            .expect("Failed to update cache");
        let entry = db
            .get_cache(&CacheKey::LiveStreams)
            .expect("Failed to get cache")
            .expect("Cache not found");
        assert_eq!(entry.data, r#"[{"id":"2"}]"#);

        // 단일 캐시 삭제
        db.clear_cache(&CacheKey::LiveStreams)
            .expect("Failed to clear cache");
        let entry = db
            .get_cache(&CacheKey::LiveStreams)
            .expect("Failed to get cache");
        assert!(entry.is_none());
    }

    #[test]
    fn test_clear_all_cache() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        db.set_cache(&CacheKey::LiveStreams, "data1")
            .expect("Failed to set");
        db.set_cache(&CacheKey::UpcomingStreams(None), "data2")
            .expect("Failed to set");

        let affected = db.clear_all_cache().expect("Failed to clear all");
        assert_eq!(affected, 2);

        assert!(db
            .get_cache(&CacheKey::LiveStreams)
            .expect("Failed")
            .is_none());
        assert!(db
            .get_cache(&CacheKey::UpcomingStreams(None))
            .expect("Failed")
            .is_none());
    }

    // === CacheKey 테스트 ===

    #[test]
    fn test_cache_key_to_string() {
        // 모든 CacheKey가 올바른 문자열로 변환되는지 확인
        assert_eq!(CacheKey::LiveStreams.to_key_string(), "live_streams");
        assert_eq!(
            CacheKey::UpcomingStreams(None).to_key_string(),
            "upcoming_streams"
        );
        assert_eq!(
            CacheKey::UpcomingStreams(Some(24)).to_key_string(),
            "upcoming_streams_24"
        );
        assert_eq!(
            CacheKey::UpcomingStreams(Some(48)).to_key_string(),
            "upcoming_streams_48"
        );
        assert_eq!(CacheKey::Members.to_key_string(), "members");
        assert_eq!(CacheKey::ChannelPhotos.to_key_string(), "channel_photos");
    }

    // === CacheEntry 테스트 ===

    #[test]
    fn test_cache_entry_cached_at() {
        // 캐시 저장 시점이 정확히 기록되는지 확인
        let db = Database::open_in_memory().expect("Failed to create DB");
        let before = Utc::now();

        db.set_cache(&CacheKey::LiveStreams, "test_data")
            .expect("Failed to set cache");

        let after = Utc::now();

        let entry = db
            .get_cache(&CacheKey::LiveStreams)
            .expect("Failed to get cache")
            .expect("Cache not found");

        // cached_at이 저장 시점 범위 내에 있어야 함
        assert!(entry.cached_at >= before);
        assert!(entry.cached_at <= after);
    }

    #[test]
    fn test_cache_ttl_simulation() {
        // TTL 시뮬레이션: set_cache_at으로 과거 시간에 캐시 저장
        let db = Database::open_in_memory().expect("Failed to create DB");

        // 2분 전 시간으로 캐시 저장
        let past_time = Utc::now() - chrono::Duration::seconds(120);
        db.set_cache_at(&CacheKey::LiveStreams, "old_data", past_time)
            .expect("Failed to set cache");

        let entry = db
            .get_cache(&CacheKey::LiveStreams)
            .expect("Failed to get cache")
            .expect("Cache not found");

        // 저장된 시간이 과거 시간인지 확인
        assert_eq!(entry.cached_at, past_time);

        // TTL 체크 로직 시뮬레이션 (1분 TTL 가정)
        let ttl = chrono::Duration::seconds(60);
        let is_expired = Utc::now().signed_duration_since(entry.cached_at) > ttl;
        assert!(is_expired, "캐시가 만료되어야 함 (2분 전 저장, 1분 TTL)");
    }

    #[test]
    fn test_cache_ttl_valid() {
        // TTL 시뮬레이션: 유효한 캐시
        let db = Database::open_in_memory().expect("Failed to create DB");

        // 30초 전 시간으로 캐시 저장
        let recent_time = Utc::now() - chrono::Duration::seconds(30);
        db.set_cache_at(&CacheKey::LiveStreams, "fresh_data", recent_time)
            .expect("Failed to set cache");

        let entry = db
            .get_cache(&CacheKey::LiveStreams)
            .expect("Failed to get cache")
            .expect("Cache not found");

        // TTL 체크 로직 시뮬레이션 (1분 TTL 가정)
        let ttl = chrono::Duration::seconds(60);
        let is_expired = Utc::now().signed_duration_since(entry.cached_at) > ttl;
        assert!(!is_expired, "캐시가 유효해야 함 (30초 전 저장, 1분 TTL)");
    }

    // === 다중 키 테스트 ===

    #[test]
    fn test_multiple_cache_keys_isolation() {
        // 서로 다른 CacheKey가 독립적으로 동작하는지 확인
        let db = Database::open_in_memory().expect("Failed to create DB");

        db.set_cache(&CacheKey::LiveStreams, "live_data")
            .expect("Failed to set");
        db.set_cache(&CacheKey::UpcomingStreams(None), "upcoming_data")
            .expect("Failed to set");
        db.set_cache(&CacheKey::Members, "members_data")
            .expect("Failed to set");

        // 각 키가 독립적으로 저장되어야 함
        let live = db
            .get_cache(&CacheKey::LiveStreams)
            .expect("Failed")
            .expect("Not found");
        let upcoming = db
            .get_cache(&CacheKey::UpcomingStreams(None))
            .expect("Failed")
            .expect("Not found");
        let members = db
            .get_cache(&CacheKey::Members)
            .expect("Failed")
            .expect("Not found");

        assert_eq!(live.data, "live_data");
        assert_eq!(upcoming.data, "upcoming_data");
        assert_eq!(members.data, "members_data");

        // 하나만 삭제해도 다른 것은 유지
        db.clear_cache(&CacheKey::LiveStreams)
            .expect("Failed to clear");

        assert!(db
            .get_cache(&CacheKey::LiveStreams)
            .expect("Failed")
            .is_none());
        assert!(db
            .get_cache(&CacheKey::UpcomingStreams(None))
            .expect("Failed")
            .is_some());
        assert!(db.get_cache(&CacheKey::Members).expect("Failed").is_some());
    }

    #[test]
    fn test_cache_get_nonexistent() {
        // 존재하지 않는 키 조회
        let db = Database::open_in_memory().expect("Failed to create DB");

        let result = db
            .get_cache(&CacheKey::LiveStreams)
            .expect("Failed to query");

        assert!(result.is_none());
    }
}
