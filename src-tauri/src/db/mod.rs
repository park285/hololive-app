// 데이터베이스 모듈
// SQLite 연결 관리 및 CRUD 작업
// 모든 DB 작업은 Rust 백엔드에서 처리 (프론트엔드는 IPC 커맨드 호출)

pub mod alarms;
pub mod cache;
mod connection;
pub mod history;
mod migrations;
pub mod settings;

pub use connection::Database;
pub use migrations::run_migrations;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("Database error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid data: {0}")]
    InvalidData(String),
}

// Tauri 에러 변환
impl serde::Serialize for DbError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type DbResult<T> = Result<T, DbError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_error_serializes_as_string() {
        let err = DbError::InvalidData("bad".to_string());
        let value = serde_json::to_value(&err).expect("Failed to serialize");
        match value {
            serde_json::Value::String(s) => assert!(s.contains("Invalid data")),
            other => panic!("unexpected json: {other:?}"),
        }
    }
}
