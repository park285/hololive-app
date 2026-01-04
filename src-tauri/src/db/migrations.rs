// 데이터베이스 마이그레이션
// 버전 기반 스키마 관리

use rusqlite::params;

use super::{Database, DbResult};

/// 현재 스키마 버전 (향후 마이그레이션 추가 시 참조용)
#[allow(dead_code)]
const SCHEMA_VERSION: i32 = 2;

/// 마이그레이션 실행
pub fn run_migrations(db: &Database) -> DbResult<()> {
    db.with_conn_mut(|conn| {
        // 버전 테이블 생성
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY
            )",
            [],
        )?;

        // 현재 버전 확인
        let current_version: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_version",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        // 순차적 마이그레이션 실행
        if current_version < 1 {
            migrate_v1(conn)?;
        }
        if current_version < 2 {
            migrate_v2(conn)?;
        }

        Ok(())
    })
}

/// V1: 초기 스키마
fn migrate_v1(conn: &rusqlite::Connection) -> DbResult<()> {
    // 알람 테이블
    conn.execute(
        "CREATE TABLE IF NOT EXISTS alarms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT NOT NULL UNIQUE,
            member_name TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            notify_minutes_before INTEGER NOT NULL DEFAULT 5,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    // 알람 인덱스
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_alarms_channel ON alarms(channel_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_alarms_enabled ON alarms(enabled)",
        [],
    )?;

    // 설정 테이블 (Key-Value)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // 알림 히스토리 테이블 (중복 발송 방지 + 일정 변경 감지)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS notification_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stream_id TEXT NOT NULL,
            start_scheduled_at TEXT,
            notified_at TEXT NOT NULL DEFAULT (datetime('now')),
            minutes_until INTEGER NOT NULL,
            notification_type TEXT NOT NULL DEFAULT 'upcoming'
        )",
        [],
    )?;

    // 히스토리 인덱스
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_history_stream ON notification_history(stream_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_history_notified_at ON notification_history(notified_at)",
        [],
    )?;

    // 오프라인 캐시 테이블
    conn.execute(
        "CREATE TABLE IF NOT EXISTS offline_cache (
            key TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            cached_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    // 버전 기록
    conn.execute(
        "INSERT INTO schema_version (version) VALUES (?1)",
        params![1],
    )?;

    Ok(())
}

/// V2: 알람 테이블에 다국어 이름 컨럼 추가
fn migrate_v2(conn: &rusqlite::Connection) -> DbResult<()> {
    // 한국어 이름 컨럼 추가
    conn.execute("ALTER TABLE alarms ADD COLUMN member_name_ko TEXT", [])?;

    // 일본어 이름 컨럼 추가
    conn.execute("ALTER TABLE alarms ADD COLUMN member_name_ja TEXT", [])?;

    // 버전 기록
    conn.execute(
        "INSERT INTO schema_version (version) VALUES (?1)",
        params![2],
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrations() {
        let db = Database::open_in_memory().expect("Failed to create in-memory DB");

        // 테이블 존재 확인
        db.with_conn(|conn| {
            let count: i32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='alarms'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(count, 1);
            Ok(())
        })
        .unwrap();
    }
}
