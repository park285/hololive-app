#![allow(clippy::needless_pass_by_value)]

use tauri::State;

use crate::db::{Database, DbError, DbResult};
use crate::models::Alarm;
use crate::AppState;

fn validate_non_empty(value: &str, field: &str) -> DbResult<()> {
    if value.trim().is_empty() {
        return Err(DbError::InvalidData(format!("{field} is required")));
    }
    Ok(())
}

fn get_alarms_impl(db: &Database) -> Result<Vec<Alarm>, DbError> {
    db.get_alarms()
}

#[allow(clippy::too_many_arguments)]
fn add_alarm_impl(
    db: &Database,
    channel_id: String,
    member_name: String,
    member_name_ko: Option<String>,
    member_name_ja: Option<String>,
    notify_minutes_before: Option<i32>,
) -> Result<i64, DbError> {
    validate_non_empty(&channel_id, "channel_id")?;
    validate_non_empty(&member_name, "member_name")?;

    let minutes = notify_minutes_before.unwrap_or(5);
    if minutes <= 0 {
        return Err(DbError::InvalidData(
            "notify_minutes_before must be positive".to_string(),
        ));
    }

    let alarm = Alarm::new(channel_id, member_name)
        .with_multilang_names(member_name_ko, member_name_ja)
        .with_notify_minutes(minutes);
    db.add_alarm(&alarm)
}

fn remove_alarm_impl(db: &Database, channel_id: String) -> Result<bool, DbError> {
    validate_non_empty(&channel_id, "channel_id")?;
    db.remove_alarm(&channel_id)
}

fn toggle_alarm_impl(db: &Database, channel_id: String) -> Result<bool, DbError> {
    validate_non_empty(&channel_id, "channel_id")?;
    db.toggle_alarm(&channel_id)
}

#[tauri::command]
pub fn get_alarms(state: State<'_, AppState>) -> Result<Vec<Alarm>, DbError> {
    get_alarms_impl(&state.db)
}

/// 알람 추가 커맨드
///
/// # Arguments
/// * `channel_id` - YouTube 채널 ID
/// * `member_name` - 영문 이름 (기본값)
/// * `member_name_ko` - 한국어 이름 (선택)
/// * `member_name_ja` - 일본어 이름 (선택)
/// * `notify_minutes_before` - 알림 시간 (분, 기본값: 5)
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn add_alarm(
    state: State<'_, AppState>,
    channel_id: String,
    member_name: String,
    member_name_ko: Option<String>,
    member_name_ja: Option<String>,
    notify_minutes_before: Option<i32>,
) -> Result<i64, DbError> {
    add_alarm_impl(
        &state.db,
        channel_id,
        member_name,
        member_name_ko,
        member_name_ja,
        notify_minutes_before,
    )
}

#[tauri::command]
pub fn remove_alarm(state: State<'_, AppState>, channel_id: String) -> Result<bool, DbError> {
    remove_alarm_impl(&state.db, channel_id)
}

#[tauri::command]
pub fn toggle_alarm(state: State<'_, AppState>, channel_id: String) -> Result<bool, DbError> {
    toggle_alarm_impl(&state.db, channel_id)
}

#[cfg(test)]
#[allow(clippy::manual_string_new)]
mod tests {
    use super::*;

    #[test]
    fn test_add_alarm_impl_validates_inputs_and_defaults() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        // 기본값 테스트 (다국어 이름 None)
        let id = add_alarm_impl(
            &db,
            "UC123".to_string(),
            "Member".to_string(),
            None,
            None,
            None,
        )
        .expect("Failed to add alarm");
        assert!(id > 0);

        let alarms = get_alarms_impl(&db).expect("Failed to get alarms");
        assert_eq!(alarms.len(), 1);
        assert_eq!(alarms[0].notify_minutes_before, 5);

        // 빈 channel_id 에러
        let err = add_alarm_impl(&db, "".to_string(), "Member".to_string(), None, None, None)
            .unwrap_err();
        assert!(matches!(err, DbError::InvalidData(_)));

        // 빈 member_name 에러
        let err =
            add_alarm_impl(&db, "UC123".to_string(), "".to_string(), None, None, None).unwrap_err();
        assert!(matches!(err, DbError::InvalidData(_)));

        // 잘못된 notify_minutes_before 에러
        let err = add_alarm_impl(
            &db,
            "UC123".to_string(),
            "Member".to_string(),
            None,
            None,
            Some(0),
        )
        .unwrap_err();
        assert!(matches!(err, DbError::InvalidData(_)));
    }

    #[test]
    fn test_add_alarm_with_multilang_names() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        // 다국어 이름 포함 테스트
        let id = add_alarm_impl(
            &db,
            "UC456".to_string(),
            "English Name".to_string(),
            Some("한국어 이름".to_string()),
            Some("日本語名".to_string()),
            Some(10),
        )
        .expect("Failed to add alarm");
        assert!(id > 0);

        let alarm = db
            .get_alarm_by_channel("UC456")
            .expect("Failed to get alarm")
            .expect("Alarm not found");

        assert_eq!(alarm.member_name, "English Name");
        assert_eq!(alarm.member_name_ko, Some("한국어 이름".to_string()));
        assert_eq!(alarm.member_name_ja, Some("日本語名".to_string()));
        assert_eq!(alarm.notify_minutes_before, 10);
    }

    #[test]
    fn test_remove_and_toggle_impl_validation() {
        let db = Database::open_in_memory().expect("Failed to create DB");

        assert!(!remove_alarm_impl(&db, "UC_NOT_EXISTS".to_string()).expect("remove failed"));

        let err = remove_alarm_impl(&db, " ".to_string()).unwrap_err();
        assert!(matches!(err, DbError::InvalidData(_)));

        let err = toggle_alarm_impl(&db, "".to_string()).unwrap_err();
        assert!(matches!(err, DbError::InvalidData(_)));

        add_alarm_impl(
            &db,
            "UC123".to_string(),
            "Member".to_string(),
            None,
            None,
            Some(5),
        )
        .expect("Failed to add alarm");
        let enabled = toggle_alarm_impl(&db, "UC123".to_string()).expect("toggle failed");
        assert!(!enabled);
    }
}
