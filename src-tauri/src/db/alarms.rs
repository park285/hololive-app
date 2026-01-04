// 알람 CRUD 작업
// 멤버별 알람 등록/해제/조회

use chrono::{DateTime, Utc};
use rusqlite::{params, Row};

use super::{Database, DbError, DbResult};
use crate::models::Alarm;

impl Database {
    /// 모든 알람 조회
    pub fn get_alarms(&self) -> DbResult<Vec<Alarm>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, channel_id, member_name, member_name_ko, member_name_ja,
                        enabled, notify_minutes_before, created_at
                 FROM alarms ORDER BY created_at DESC",
            )?;

            let alarms = stmt
                .query_map([], row_to_alarm)?
                .collect::<Result<Vec<_>, _>>()?;

            Ok(alarms)
        })
    }

    /// 활성화된 알람만 조회
    pub fn get_enabled_alarms(&self) -> DbResult<Vec<Alarm>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, channel_id, member_name, member_name_ko, member_name_ja,
                        enabled, notify_minutes_before, created_at
                 FROM alarms WHERE enabled = 1 ORDER BY created_at DESC",
            )?;

            let alarms = stmt
                .query_map([], row_to_alarm)?
                .collect::<Result<Vec<_>, _>>()?;

            Ok(alarms)
        })
    }

    /// 채널 ID로 알람 조회
    pub fn get_alarm_by_channel(&self, channel_id: &str) -> DbResult<Option<Alarm>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, channel_id, member_name, member_name_ko, member_name_ja,
                        enabled, notify_minutes_before, created_at
                 FROM alarms WHERE channel_id = ?1",
            )?;

            let alarm = stmt.query_row(params![channel_id], row_to_alarm).ok();
            Ok(alarm)
        })
    }

    /// 알람 추가
    pub fn add_alarm(&self, alarm: &Alarm) -> DbResult<i64> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO alarms (channel_id, member_name, member_name_ko, member_name_ja, enabled, notify_minutes_before)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(channel_id) DO UPDATE SET
                    member_name = excluded.member_name,
                    member_name_ko = excluded.member_name_ko,
                    member_name_ja = excluded.member_name_ja,
                    enabled = excluded.enabled,
                    notify_minutes_before = excluded.notify_minutes_before",
                params![
                    alarm.channel_id,
                    alarm.member_name,
                    alarm.member_name_ko,
                    alarm.member_name_ja,
                    alarm.enabled,
                    alarm.notify_minutes_before,
                ],
            )?;

            Ok(conn.last_insert_rowid())
        })
    }

    /// 알람 삭제
    pub fn remove_alarm(&self, channel_id: &str) -> DbResult<bool> {
        self.with_conn(|conn| {
            let affected = conn.execute(
                "DELETE FROM alarms WHERE channel_id = ?1",
                params![channel_id],
            )?;
            Ok(affected > 0)
        })
    }

    /// 알람 토글 (활성화/비활성화)
    pub fn toggle_alarm(&self, channel_id: &str) -> DbResult<bool> {
        self.with_conn(|conn| {
            let affected = conn.execute(
                "UPDATE alarms SET enabled = NOT enabled WHERE channel_id = ?1",
                params![channel_id],
            )?;

            if affected == 0 {
                return Err(DbError::NotFound(format!("Alarm not found: {channel_id}")));
            }

            // 변경된 상태 반환
            let enabled: bool = conn.query_row(
                "SELECT enabled FROM alarms WHERE channel_id = ?1",
                params![channel_id],
                |row| row.get(0),
            )?;

            Ok(enabled)
        })
    }

    /// 알람 알림 시간 업데이트
    pub fn update_alarm_notify_minutes(&self, channel_id: &str, minutes: i32) -> DbResult<()> {
        self.with_conn(|conn| {
            let affected = conn.execute(
                "UPDATE alarms SET notify_minutes_before = ?1 WHERE channel_id = ?2",
                params![minutes, channel_id],
            )?;

            if affected == 0 {
                return Err(DbError::NotFound(format!("Alarm not found: {channel_id}")));
            }

            Ok(())
        })
    }
}

/// DB Row를 Alarm 구조체로 변환
fn row_to_alarm(row: &Row<'_>) -> rusqlite::Result<Alarm> {
    let created_at_str: Option<String> = row.get(7)?;
    let created_at = created_at_str.and_then(|s| {
        DateTime::parse_from_rfc3339(&s)
            .ok()
            .map(|dt| dt.with_timezone(&Utc))
    });

    Ok(Alarm {
        id: row.get(0)?,
        channel_id: row.get(1)?,
        member_name: row.get(2)?,
        member_name_ko: row.get(3)?,
        member_name_ja: row.get(4)?,
        enabled: row.get(5)?,
        notify_minutes_before: row.get(6)?,
        created_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_alarm_crud() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        // 추가
        let alarm = Alarm::new("UC123".to_string(), "Test Member".to_string());
        let id = db.add_alarm(&alarm).expect("Failed to add alarm");
        assert!(id > 0);

        // 조회
        let alarms = db.get_alarms().expect("Failed to get alarms");
        assert_eq!(alarms.len(), 1);
        assert_eq!(alarms[0].channel_id, "UC123");

        // 토글
        let enabled = db.toggle_alarm("UC123").expect("Failed to toggle");
        assert!(!enabled);

        // 삭제
        let removed = db.remove_alarm("UC123").expect("Failed to remove");
        assert!(removed);

        let alarms = db.get_alarms().expect("Failed to get alarms");
        assert!(alarms.is_empty());
    }

    #[test]
    fn test_alarm_upsert_and_not_found_errors() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        let alarm = Alarm::new("UC123".to_string(), "Member A".to_string()).with_notify_minutes(5);
        db.add_alarm(&alarm).expect("Failed to add alarm");

        let updated_alarm = Alarm {
            enabled: false,
            ..Alarm::new("UC123".to_string(), "Member B".to_string()).with_notify_minutes(10)
        };
        db.add_alarm(&updated_alarm)
            .expect("Failed to upsert alarm");

        let fetched = db
            .get_alarm_by_channel("UC123")
            .expect("Failed to get alarm")
            .expect("Alarm not found");
        assert_eq!(fetched.member_name, "Member B");
        assert_eq!(fetched.notify_minutes_before, 10);
        assert!(!fetched.enabled);

        let err = db.toggle_alarm("NOT_EXISTS").unwrap_err();
        assert!(matches!(err, DbError::NotFound(_)));

        let err = db
            .update_alarm_notify_minutes("NOT_EXISTS", 10)
            .unwrap_err();
        assert!(matches!(err, DbError::NotFound(_)));
    }

    #[test]
    fn test_get_enabled_alarms_and_update_notify_minutes() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        assert!(db
            .get_alarm_by_channel("NOT_EXISTS")
            .expect("Failed to query")
            .is_none());

        let alarm1 = Alarm::new("UC1".to_string(), "Member 1".to_string()).with_notify_minutes(5);
        let alarm2 = Alarm::new("UC2".to_string(), "Member 2".to_string()).with_notify_minutes(7);
        db.add_alarm(&alarm1).expect("Failed to add alarm1");
        db.add_alarm(&alarm2).expect("Failed to add alarm2");

        // 하나 비활성화
        let enabled = db.toggle_alarm("UC2").expect("Failed to toggle");
        assert!(!enabled);

        let enabled_alarms = db
            .get_enabled_alarms()
            .expect("Failed to get enabled alarms");
        assert_eq!(enabled_alarms.len(), 1);
        assert_eq!(enabled_alarms[0].channel_id, "UC1");

        db.update_alarm_notify_minutes("UC1", 15)
            .expect("Failed to update minutes");
        let fetched = db
            .get_alarm_by_channel("UC1")
            .expect("Failed to fetch")
            .expect("Alarm not found");
        assert_eq!(fetched.notify_minutes_before, 15);
    }
}
