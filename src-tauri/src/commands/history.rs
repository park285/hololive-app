#![allow(clippy::needless_pass_by_value)]

use chrono::{DateTime, Utc};
use tauri::State;

use crate::db::{Database, DbError};
use crate::models::NotificationHistory;
use crate::AppState;

fn was_notified_impl(
    db: &Database,
    stream_id: String,
    minutes_until: i32,
) -> Result<bool, DbError> {
    if stream_id.trim().is_empty() {
        return Err(DbError::InvalidData("stream_id is required".to_string()));
    }
    if minutes_until <= 0 {
        return Err(DbError::InvalidData(
            "minutes_until must be positive".to_string(),
        ));
    }
    db.was_notified(&stream_id, minutes_until)
}

fn record_notification_impl(
    db: &Database,
    stream_id: String,
    start_scheduled_at: Option<DateTime<Utc>>,
    minutes_until: i32,
) -> Result<(), DbError> {
    if stream_id.trim().is_empty() {
        return Err(DbError::InvalidData("stream_id is required".to_string()));
    }
    if minutes_until <= 0 {
        return Err(DbError::InvalidData(
            "minutes_until must be positive".to_string(),
        ));
    }

    let history = NotificationHistory::new(stream_id, start_scheduled_at, minutes_until);
    db.record_notification(&history)
}

fn cleanup_old_notifications_impl(db: &Database, days: Option<i64>) -> Result<usize, DbError> {
    let days = days.unwrap_or(7);
    if days <= 0 {
        return Err(DbError::InvalidData("days must be positive".to_string()));
    }
    db.cleanup_old_notifications(days)
}

#[tauri::command]
pub fn was_notified(
    state: State<'_, AppState>,
    stream_id: String,
    minutes_until: i32,
) -> Result<bool, DbError> {
    was_notified_impl(&state.db, stream_id, minutes_until)
}

#[tauri::command]
pub fn record_notification(
    state: State<'_, AppState>,
    stream_id: String,
    start_scheduled_at: Option<DateTime<Utc>>,
    minutes_until: i32,
) -> Result<(), DbError> {
    record_notification_impl(&state.db, stream_id, start_scheduled_at, minutes_until)
}

#[tauri::command]
pub fn cleanup_old_notifications(
    state: State<'_, AppState>,
    days: Option<i64>,
) -> Result<usize, DbError> {
    cleanup_old_notifications_impl(&state.db, days)
}

#[cfg(test)]
#[allow(clippy::manual_string_new)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[test]
    fn test_was_notified_impl_validation() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        let err = was_notified_impl(&db, " ".to_string(), 5).unwrap_err();
        assert!(matches!(err, DbError::InvalidData(_)));

        let err = was_notified_impl(&db, "abc".to_string(), 0).unwrap_err();
        assert!(matches!(err, DbError::InvalidData(_)));
    }

    #[test]
    fn test_record_and_cleanup_impl_paths() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        let err = record_notification_impl(&db, "".to_string(), None, 5).unwrap_err();
        assert!(matches!(err, DbError::InvalidData(_)));

        let err = record_notification_impl(&db, "abc".to_string(), None, -1).unwrap_err();
        assert!(matches!(err, DbError::InvalidData(_)));

        record_notification_impl(
            &db,
            "stream1".to_string(),
            Some(Utc::now() + Duration::hours(1)),
            5,
        )
        .expect("Failed to record notification");

        assert!(was_notified_impl(&db, "stream1".to_string(), 5).expect("was_notified failed"));

        let err = cleanup_old_notifications_impl(&db, Some(0)).unwrap_err();
        assert!(matches!(err, DbError::InvalidData(_)));

        let affected = cleanup_old_notifications_impl(&db, None).expect("cleanup failed");
        assert_eq!(affected, 0);
    }
}
