// Multiview 데이터베이스 쿼리
// SQLite를 통한 레이아웃 상태 및 프리셋 저장/조회
//
// **Critical Design Decision**:
// - DB 영속성 저장: layout을 JSON으로 직접 저장 (ID 보존)
// - URL 공유: encode/decode 사용 (새 ID 생성 허용)
//
// **Note**: 테이블 생성은 migrations.rs의 migrate_v3()에서 처리됨

use crate::db::{DbError, DbResult};
use crate::models::multiview::{
    CellContent, LayoutItem, LayoutPreset, MultiviewState, PlayerState,
};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashMap;

/// 현재 멀티뷰 상태 저장
///
/// **Critical Fix**: layout을 JSON으로 직접 저장하여 셀 ID 보존.
/// 인코딩된 문자열은 URL 공유 시에만 사용.
#[allow(clippy::too_many_arguments)]
pub fn save_state(
    conn: &Connection,
    layout: &[LayoutItem],
    content: &HashMap<String, CellContent>,
    player_states: &HashMap<String, PlayerState>,
    mute_others: bool,
    active_preset_id: Option<&str>,
) -> DbResult<()> {
    // layout을 JSON으로 직접 직렬화 (ID 보존)
    let layout_json = serde_json::to_string(layout)
        .map_err(|e| DbError::InvalidData(format!("Failed to serialize layout: {e}")))?;
    let content_json = serde_json::to_string(content)
        .map_err(|e| DbError::InvalidData(format!("Failed to serialize content: {e}")))?;
    let player_states_json = serde_json::to_string(player_states)
        .map_err(|e| DbError::InvalidData(format!("Failed to serialize player states: {e}")))?;
    let now = chrono::Utc::now().to_rfc3339();

    // UPSERT: 이미 있으면 업데이트, 없으면 삽입
    conn.execute(
        "INSERT INTO multiview_state (id, layout_json, content_json, player_states_json, mute_others_enabled, active_preset_id, updated_at)
        VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(id) DO UPDATE SET
            layout_json = excluded.layout_json,
            content_json = excluded.content_json,
            player_states_json = excluded.player_states_json,
            mute_others_enabled = excluded.mute_others_enabled,
            active_preset_id = excluded.active_preset_id,
            updated_at = excluded.updated_at",
        params![
            layout_json,
            content_json,
            player_states_json,
            i32::from(mute_others),
            active_preset_id,
            now
        ],
    )?;

    Ok(())
}

/// 저장된 멀티뷰 상태 로드
///
/// `layout_json`에서 직접 레이아웃을 복원하여 ID 일관성 보장.
#[allow(clippy::type_complexity)]
pub fn load_state(conn: &Connection) -> DbResult<Option<MultiviewState>> {
    let row_data: Option<(String, String, Option<String>, i32, Option<String>)> = conn
        .query_row(
            "SELECT layout_json, content_json, player_states_json, mute_others_enabled, active_preset_id
            FROM multiview_state WHERE id = 1",
            [],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )
        .optional()?;

    match row_data {
        Some((layout_json, content_json, player_states_json, mute_others, active_preset_id)) => {
            // layout JSON 직접 파싱 (ID 보존됨)
            let layout: Vec<LayoutItem> = serde_json::from_str(&layout_json)
                .map_err(|e| DbError::InvalidData(format!("Failed to parse layout: {e}")))?;

            // content JSON 파싱
            let content: HashMap<String, CellContent> = serde_json::from_str(&content_json)
                .map_err(|e| DbError::InvalidData(format!("Failed to parse content: {e}")))?;

            // player_states JSON 파싱
            let player_states: HashMap<String, PlayerState> = player_states_json
                .as_deref()
                .map(serde_json::from_str)
                .transpose()
                .map_err(|e| DbError::InvalidData(format!("Failed to parse player states: {e}")))?
                .unwrap_or_default();

            Ok(Some(MultiviewState {
                layout,
                content,
                player_states,
                mute_others_enabled: mute_others != 0,
                active_preset_id,
            }))
        }
        None => Ok(None),
    }
}

/// 프리셋 저장
///
/// 프리셋은 `encoded_layout` 사용 (적용 시 새 ID 생성 허용)
pub fn save_preset(
    conn: &Connection,
    id: &str,
    name: &str,
    encoded_layout: &str,
    video_cell_count: u8,
) -> DbResult<LayoutPreset> {
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO multiview_presets (id, name, encoded_layout, is_built_in, video_cell_count, created_at)
        VALUES (?1, ?2, ?3, 0, ?4, ?5)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            encoded_layout = excluded.encoded_layout,
            video_cell_count = excluded.video_cell_count",
        params![id, name, encoded_layout, video_cell_count, now],
    )?;

    Ok(LayoutPreset {
        id: id.to_string(),
        name: name.to_string(),
        encoded_layout: encoded_layout.to_string(),
        is_built_in: false,
        video_cell_count,
        created_at: Some(now),
    })
}

/// 사용자 정의 프리셋 목록 조회 (Built-in 제외)
pub fn get_custom_presets(conn: &Connection) -> DbResult<Vec<LayoutPreset>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, encoded_layout, is_built_in, video_cell_count, created_at
        FROM multiview_presets
        WHERE is_built_in = 0
        ORDER BY created_at DESC",
    )?;

    let presets = stmt
        .query_map([], |row| {
            Ok(LayoutPreset {
                id: row.get(0)?,
                name: row.get(1)?,
                encoded_layout: row.get(2)?,
                is_built_in: row.get::<_, i32>(3)? != 0,
                video_cell_count: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(presets)
}

/// 프리셋 삭제 (Built-in은 삭제 불가)
pub fn delete_preset(conn: &Connection, preset_id: &str) -> DbResult<()> {
    // Built-in 프리셋 삭제 방지
    if preset_id.starts_with("builtin_") {
        return Err(DbError::InvalidData(
            "Built-in 프리셋은 삭제할 수 없습니다.".to_string(),
        ));
    }

    let affected = conn.execute(
        "DELETE FROM multiview_presets WHERE id = ?1 AND is_built_in = 0",
        [preset_id],
    )?;

    if affected == 0 {
        return Err(DbError::NotFound(format!(
            "프리셋을 찾을 수 없습니다: {preset_id}"
        )));
    }

    Ok(())
}

/// 특정 프리셋 조회
pub fn get_preset(conn: &Connection, preset_id: &str) -> DbResult<Option<LayoutPreset>> {
    let preset_row = conn
        .query_row(
            "SELECT id, name, encoded_layout, is_built_in, video_cell_count, created_at
            FROM multiview_presets WHERE id = ?1",
            [preset_id],
            |row| {
                Ok(LayoutPreset {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    encoded_layout: row.get(2)?,
                    is_built_in: row.get::<_, i32>(3)? != 0,
                    video_cell_count: row.get(4)?,
                    created_at: row.get(5)?,
                })
            },
        )
        .optional()?;

    Ok(preset_row)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory DB");
        // 멀티뷰 테이블 직접 생성 (migrations.rs의 migrate_v3 로직 복제)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS multiview_state (
                id INTEGER PRIMARY KEY DEFAULT 1,
                layout_json TEXT NOT NULL,
                content_json TEXT NOT NULL,
                player_states_json TEXT,
                mute_others_enabled INTEGER DEFAULT 1,
                active_preset_id TEXT,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .expect("Failed to create multiview_state table");
        conn.execute(
            "CREATE TABLE IF NOT EXISTS multiview_presets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                encoded_layout TEXT NOT NULL,
                is_built_in INTEGER DEFAULT 0,
                video_cell_count INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )",
            [],
        )
        .expect("Failed to create multiview_presets table");
        conn
    }

    fn make_layout_item(id: &str, x: u8, y: u8, w: u8, h: u8) -> LayoutItem {
        LayoutItem {
            i: id.to_string(),
            x,
            y,
            w,
            h,
            is_draggable: true,
            is_resizable: true,
        }
    }

    #[test]
    fn test_save_and_load_state_preserves_ids() {
        let conn = setup_test_db();

        // 고정 ID로 레이아웃 생성
        let layout = vec![
            make_layout_item("my_cell_1", 0, 0, 12, 24),
            make_layout_item("my_cell_2", 12, 0, 12, 24),
        ];

        let mut content = HashMap::new();
        content.insert(
            "my_cell_1".to_string(),
            CellContent {
                id: "my_cell_1".to_string(),
                cell_type: "video".to_string(),
                video_id: Some("abc123".to_string()),
                video_source: Some("youtube".to_string()),
                chat_tab: None,
            },
        );
        content.insert(
            "my_cell_2".to_string(),
            CellContent {
                id: "my_cell_2".to_string(),
                cell_type: "video".to_string(),
                video_id: Some("xyz789".to_string()),
                video_source: Some("youtube".to_string()),
                chat_tab: None,
            },
        );

        save_state(&conn, &layout, &content, &HashMap::new(), true, None)
            .expect("Failed to save state");

        let loaded = load_state(&conn).expect("Failed to load state");
        assert!(loaded.is_some());

        let state = loaded.unwrap();

        // Critical: ID가 보존되어야 함
        assert_eq!(state.layout.len(), 2);
        assert_eq!(state.layout[0].i, "my_cell_1");
        assert_eq!(state.layout[1].i, "my_cell_2");

        // Critical: content의 키와 layout ID가 일치해야 함
        assert!(state.content.contains_key("my_cell_1"));
        assert!(state.content.contains_key("my_cell_2"));

        // content 값 검증
        let cell1 = state.content.get("my_cell_1").unwrap();
        assert_eq!(cell1.video_id, Some("abc123".to_string()));

        let cell2 = state.content.get("my_cell_2").unwrap();
        assert_eq!(cell2.video_id, Some("xyz789".to_string()));
    }

    #[test]
    fn test_save_and_get_preset() {
        let conn = setup_test_db();

        let preset = save_preset(&conn, "test1", "테스트 프리셋", "AAMY,MAMY", 2)
            .expect("Failed to save preset");

        assert_eq!(preset.name, "테스트 프리셋");
        assert!(!preset.is_built_in);

        let presets = get_custom_presets(&conn).expect("Failed to get presets");
        assert_eq!(presets.len(), 1);
    }

    #[test]
    fn test_delete_preset() {
        let conn = setup_test_db();

        save_preset(&conn, "to_delete", "삭제할 프리셋", "AAMY", 1).expect("Failed to save");
        delete_preset(&conn, "to_delete").expect("Failed to delete");

        let presets = get_custom_presets(&conn).expect("Failed to get presets");
        assert!(presets.is_empty());
    }

    #[test]
    fn test_cannot_delete_builtin() {
        let conn = setup_test_db();

        let result = delete_preset(&conn, "builtin_1");
        assert!(result.is_err());
    }
}
