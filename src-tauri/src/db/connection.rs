// SQLite 연결 관리
// 스레드 안전 싱글톤 패턴 (parking_lot::Mutex)

use parking_lot::Mutex;
use rusqlite::Connection;
use std::path::Path;
use std::sync::Arc;

use super::{run_migrations, DbError, DbResult};

/// 스레드 안전 DB 연결 래퍼
#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// 앱 데이터 디렉터리에 DB 생성/열기
    pub fn open(app_data_dir: &Path) -> DbResult<Self> {
        // 디렉터리 생성
        std::fs::create_dir_all(app_data_dir)
            .map_err(|e| DbError::InvalidData(format!("Failed to create app data dir: {e}")))?;

        let db_path = app_data_dir.join("hololive.db");
        let conn = Connection::open(&db_path)?;

        // SQLite 성능 최적화
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA foreign_keys=ON;
             PRAGMA cache_size=-16384;
             PRAGMA temp_store=MEMORY;
             PRAGMA mmap_size=268435456;",
        )?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };

        // 마이그레이션 실행
        run_migrations(&db)?;

        Ok(db)
    }

    /// 테스트용 인메모리 DB
    #[cfg(test)]
    pub fn open_in_memory() -> DbResult<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        run_migrations(&db)?;
        Ok(db)
    }

    /// 연결 락 획득 후 작업 실행
    pub fn with_conn<F, T>(&self, f: F) -> DbResult<T>
    where
        F: FnOnce(&Connection) -> DbResult<T>,
    {
        let conn = self.conn.lock();
        f(&conn)
    }

    /// 쓰기 작업용 (트랜잭션 포함)
    pub fn with_conn_mut<F, T>(&self, f: F) -> DbResult<T>
    where
        F: FnOnce(&mut Connection) -> DbResult<T>,
    {
        let mut conn = self.conn.lock();
        f(&mut conn)
    }
}
