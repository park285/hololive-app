// Multiview Built-in 프리셋
// Holodex 호환 기본 제공 레이아웃 템플릿

use crate::models::multiview::LayoutPreset;

/// 기본 제공 프리셋 목록 (Holodex 호환)
///
/// 프리셋 인코딩 규칙:
/// - 각 셀은 "XYWH" 4문자로 표현 (Base64-like)
/// - 쉼표로 구분
/// - 24x24 그리드 기준 (A=0, M=12, Y=24)
pub fn get_builtin_presets() -> Vec<LayoutPreset> {
    vec![
        // === 기본 레이아웃 (24x24 그리드, Y=24) ===
        LayoutPreset {
            id: "builtin_1".into(),
            name: "1🎞️ (전체화면)".into(),
            encoded_layout: "AAYY".into(), // x=0, y=0, w=24, h=24
            is_built_in: true,
            video_cell_count: 1,
            created_at: None,
        },
        LayoutPreset {
            id: "builtin_2".into(),
            name: "2🎞️ (좌우 분할)".into(),
            encoded_layout: "AAMY,MAMY".into(), // 12+12
            is_built_in: true,
            video_cell_count: 2,
            created_at: None,
        },
        LayoutPreset {
            id: "builtin_2v".into(),
            name: "2🎞️ (상하 분할)".into(),
            encoded_layout: "AAYM,AMYM".into(), // 24x12 + 24x12
            is_built_in: true,
            video_cell_count: 2,
            created_at: None,
        },
        LayoutPreset {
            id: "builtin_2x2".into(),
            name: "2x2🎞️".into(),
            encoded_layout: "AAMM,AMMM,MAMM,MMMM".into(), // 4개 셀, 각 12x12
            is_built_in: true,
            video_cell_count: 4,
            created_at: None,
        },
        LayoutPreset {
            id: "builtin_3".into(),
            name: "3🎞️ (1+2)".into(),
            encoded_layout: "AAOY,OAKM,OMKM".into(), // 큰 것 1개(14x24) + 작은 것 2개(10x12)
            is_built_in: true,
            video_cell_count: 3,
            created_at: None,
        },
        LayoutPreset {
            id: "builtin_3x2".into(),
            name: "3x2🎞️".into(),
            encoded_layout: "AAIM,IAIM,QAIM,AMIM,IMIM,QMIM".into(), // 6개 셀, 3열 x 2행 (8x12)
            is_built_in: true,
            video_cell_count: 6,
            created_at: None,
        },
        LayoutPreset {
            id: "builtin_3x3".into(),
            name: "3x3🎞️".into(),
            encoded_layout: "AAII,IAII,QAII,AIII,IIII,QIII,AQII,IQII,QQII".into(), // 9개 셀 (8x8)
            is_built_in: true,
            video_cell_count: 9,
            created_at: None,
        },
        LayoutPreset {
            id: "builtin_4x4".into(),
            name: "4x4🎞️".into(),
            encoded_layout:
                "AAGG,GAGG,MAGG,SAGG,AGGG,GGGG,MGGG,SGGG,AMGG,GMGG,MMGG,SMGG,ASGG,GSGG,MSGG,SSGG"
                    .into(), // 16개 셀, 각 6x6
            is_built_in: true,
            video_cell_count: 16,
            created_at: None,
        },
        // === 채팅 포함 레이아웃 ===
        LayoutPreset {
            id: "builtin_side_chat".into(),
            name: "1🎞️ + 💬 (사이드)".into(),
            encoded_layout: "AASY,SAGYchat0".into(), // 영상(18x24) + 사이드 채팅(6x24)
            is_built_in: true,
            video_cell_count: 1,
            created_at: None,
        },
        LayoutPreset {
            id: "builtin_2_1chat".into(),
            name: "2🎞️ + 1💬".into(),
            encoded_layout: "AASM,AMSM,SAGYchat0".into(), // 2개 영상(18x12) + 1개 채팅(6x24)
            is_built_in: true,
            video_cell_count: 2,
            created_at: None,
        },
        LayoutPreset {
            id: "builtin_1_bottom_chat".into(),
            name: "1🎞️ + 💬 (하단)".into(),
            encoded_layout: "AAYS,ASYG chat0".into(), // 영상(24x18) + 하단 채팅(24x6)
            is_built_in: true,
            video_cell_count: 1,
            created_at: None,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_presets_not_empty() {
        let presets = get_builtin_presets();
        assert!(!presets.is_empty());
    }

    #[test]
    fn test_builtin_presets_have_valid_ids() {
        let presets = get_builtin_presets();
        for preset in presets {
            assert!(preset.id.starts_with("builtin_"));
            assert!(preset.is_built_in);
            assert!(!preset.name.is_empty());
            assert!(!preset.encoded_layout.is_empty());
        }
    }

    #[test]
    fn test_preset_video_counts() {
        let presets = get_builtin_presets();

        let single = presets.iter().find(|p| p.id == "builtin_1").unwrap();
        assert_eq!(single.video_cell_count, 1);

        let quad = presets.iter().find(|p| p.id == "builtin_2x2").unwrap();
        assert_eq!(quad.video_cell_count, 4);
    }
}
