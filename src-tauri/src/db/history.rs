// 알림 히스토리 CRUD 작업
// 중복 발송 방지 + 일정 변경 감지

use chrono::{DateTime, Duration, Utc};
use rusqlite::params;

use super::{Database, DbResult};
use crate::models::NotificationHistory;

impl Database {
    /// 특정 스트림의 최근 알림 기록 조회
    pub fn get_notification_history(
        &self,
        stream_id: &str,
    ) -> DbResult<Option<NotificationHistory>> {
        self.with_conn(|conn| {
            let history = conn
                .query_row(
                    "SELECT stream_id, start_scheduled_at, notified_at, minutes_until
                     FROM notification_history
                     WHERE stream_id = ?1
                     ORDER BY notified_at DESC
                     LIMIT 1",
                    params![stream_id],
                    |row| {
                        let stream_id: String = row.get(0)?;
                        let start_scheduled_str: Option<String> = row.get(1)?;
                        let notified_at_str: String = row.get(2)?;
                        let minutes_until: i32 = row.get(3)?;

                        let start_scheduled_at = start_scheduled_str.and_then(|s| {
                            DateTime::parse_from_rfc3339(&s)
                                .ok()
                                .map(|dt| dt.with_timezone(&Utc))
                        });

                        let notified_at = DateTime::parse_from_rfc3339(&notified_at_str)
                            .map_or_else(|_| Utc::now(), |dt| dt.with_timezone(&Utc));

                        Ok(NotificationHistory {
                            stream_id,
                            start_scheduled_at,
                            notified_at,
                            minutes_until,
                        })
                    },
                )
                .ok();

            Ok(history)
        })
    }

    /// 알림 발송 기록 저장
    pub fn record_notification(&self, history: &NotificationHistory) -> DbResult<()> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO notification_history (stream_id, start_scheduled_at, notified_at, minutes_until)
                 VALUES (?1, ?2, ?3, ?4)",
                params![
                    history.stream_id,
                    history.start_scheduled_at.map(|dt| dt.to_rfc3339()),
                    history.notified_at.to_rfc3339(),
                    history.minutes_until,
                ],
            )?;
            Ok(())
        })
    }

    /// 이미 알림을 보냈는지 확인 (동일 스트림, 동일 분 전)
    pub fn was_notified(&self, stream_id: &str, minutes_until: i32) -> DbResult<bool> {
        self.with_conn(|conn| {
            let count: i32 = conn.query_row(
                "SELECT COUNT(*) FROM notification_history
                 WHERE stream_id = ?1 AND minutes_until = ?2",
                params![stream_id, minutes_until],
                |row| row.get(0),
            )?;
            Ok(count > 0)
        })
    }

    /// 일정 변경 감지 (이전 알림과 현재 예정 시간 비교)
    pub fn detect_schedule_change(
        &self,
        stream_id: &str,
        new_scheduled: Option<DateTime<Utc>>,
    ) -> DbResult<Option<i64>> {
        let history = self.get_notification_history(stream_id)?;
        Ok(history.and_then(|h| h.schedule_changed(new_scheduled)))
    }

    /// 오래된 히스토리 정리 (기본 7일)
    pub fn cleanup_old_notifications(&self, days: i64) -> DbResult<usize> {
        self.with_conn(|conn| {
            let cutoff = Utc::now() - Duration::days(days);

            let affected = conn.execute(
                "DELETE FROM notification_history WHERE notified_at < ?1",
                params![cutoff.to_rfc3339()],
            )?;

            Ok(affected)
        })
    }

    /// 일정 변경 알림 기록 업데이트 (새 예정 시간 반영)
    pub fn update_schedule_in_history(
        &self,
        stream_id: &str,
        new_scheduled: Option<DateTime<Utc>>,
    ) -> DbResult<()> {
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE notification_history SET start_scheduled_at = ?1
                 WHERE stream_id = ?2",
                params![new_scheduled.map(|dt| dt.to_rfc3339()), stream_id],
            )?;
            Ok(())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notification_history() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        let stream_id = "abc123";
        let scheduled = Some(Utc::now() + Duration::hours(1));

        // 첫 알림 기록
        let history = NotificationHistory::new(stream_id.to_string(), scheduled, 5);
        db.record_notification(&history).expect("Failed to record");

        // 중복 확인
        assert!(db.was_notified(stream_id, 5).expect("Failed to check"));
        assert!(!db.was_notified(stream_id, 10).expect("Failed to check"));

        // 일정 변경 감지 (변경 없음)
        let change = db
            .detect_schedule_change(stream_id, scheduled)
            .expect("Failed to detect");
        assert!(change.is_none());

        // 일정 변경 감지 (30분 앞당겨짐)
        let new_scheduled = scheduled.map(|s| s - Duration::minutes(30));
        let change = db
            .detect_schedule_change(stream_id, new_scheduled)
            .expect("Failed to detect");
        assert_eq!(change, Some(-30));
    }

    #[test]
    fn test_cleanup_old_notifications_and_update_schedule() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        let stream_id = "cleanup123";
        let scheduled_old = Some(Utc::now() + Duration::hours(1));

        let old_history = NotificationHistory {
            stream_id: stream_id.to_string(),
            start_scheduled_at: scheduled_old,
            notified_at: Utc::now() - Duration::days(10),
            minutes_until: 5,
        };
        db.record_notification(&old_history)
            .expect("Failed to record old history");

        assert!(db.was_notified(stream_id, 5).expect("Failed to check"));

        let affected = db.cleanup_old_notifications(7).expect("Failed to cleanup");
        assert_eq!(affected, 1);

        assert!(!db.was_notified(stream_id, 5).expect("Failed to check"));

        // 최신 레코드 추가 후 스케줄 업데이트 확인
        let history = NotificationHistory::new(stream_id.to_string(), scheduled_old, 5);
        db.record_notification(&history)
            .expect("Failed to record history");

        let new_scheduled = Some(Utc::now() + Duration::hours(2));
        db.update_schedule_in_history(stream_id, new_scheduled)
            .expect("Failed to update schedule");

        let fetched = db
            .get_notification_history(stream_id)
            .expect("Failed to fetch history")
            .expect("History not found");
        assert_eq!(fetched.start_scheduled_at, new_scheduled);
    }
}
