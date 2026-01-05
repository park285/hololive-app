// Multiview 레이아웃 인코딩/디코딩
// Holodex 호환 Base64-like 문자열로 레이아웃 압축
// x, y, w, h 각각을 1문자로 인코딩 (0-63 범위)

use crate::models::multiview::{CellContent, DecodedLayout, EncodedLayout, LayoutItem};
use rand::Rng;
use std::collections::HashMap;

/// Base64-like 문자셋 (URL-safe)
const B64_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.";

/// 레이아웃 인코딩 (Frontend -> Backend 위임)
///
/// 24x24 그리드의 각 셀을 Base64-like 문자로 압축하여 URL-safe 문자열 생성
///
/// # Arguments
/// * `layout` - 현재 레이아웃 아이템 배열
/// * `content` - 셀 콘텐츠 맵
/// * `include_videos` - 비디오 ID 포함 여부 (공유 링크용)
///
/// # Returns
/// 인코딩된 문자열 (예: "AAMY,MAMY" = 2분할 레이아웃)
///
/// # Errors
/// 그리드 위치가 범위를 벗어난 경우
pub fn encode_layout(
    layout: &[LayoutItem],
    content: &HashMap<String, CellContent>,
    include_videos: bool,
) -> Result<EncodedLayout, String> {
    let mut parts = Vec::new();
    let mut video_count: u8 = 0;

    for item in layout {
        // 범위 검증 (0-63)
        if item.x >= 64 || item.y >= 64 || item.w >= 64 || item.h >= 64 {
            return Err("Grid position out of range (0-63)".to_string());
        }

        // xywh 인코딩
        let mut encoded = String::new();
        encoded.push(B64_CHARS[item.x as usize] as char);
        encoded.push(B64_CHARS[item.y as usize] as char);
        encoded.push(B64_CHARS[item.w as usize] as char);
        encoded.push(B64_CHARS[item.h as usize] as char);

        // 콘텐츠 인코딩
        if let Some(cell) = content.get(&item.i) {
            match cell.cell_type.as_str() {
                "chat" => {
                    encoded.push_str("chat");
                    if let Some(tab) = cell.chat_tab {
                        encoded.push_str(&tab.to_string());
                    }
                }
                "video" if include_videos => {
                    if let Some(ref video_id) = cell.video_id {
                        if cell.video_source.as_deref() == Some("twitch") {
                            encoded.push_str("twitch");
                        }
                        encoded.push_str(video_id);
                    }
                    video_count = video_count.saturating_add(1);
                }
                "video" => video_count = video_count.saturating_add(1),
                _ => {}
            }
        } else {
            // 빈 셀은 비디오 셀로 카운트
            video_count = video_count.saturating_add(1);
        }

        parts.push(encoded);
    }

    Ok(EncodedLayout {
        encoded: parts.join(","),
        video_cell_count: video_count,
    })
}

/// 인코딩된 문자열을 레이아웃으로 디코딩
///
/// # Arguments
/// * `encoded` - 인코딩된 레이아웃 문자열
///
/// # Returns
/// 디코딩된 레이아웃과 콘텐츠
///
/// # Errors
/// 잘못된 인코딩 형식인 경우
pub fn decode_layout(encoded: &str) -> Result<DecodedLayout, String> {
    let mut layout = Vec::new();
    let mut content = HashMap::new();
    let mut video_count: u8 = 0;

    // 빈 문자열 처리
    if encoded.trim().is_empty() {
        return Ok(DecodedLayout {
            layout,
            content,
            video_cell_count: 0,
        });
    }

    let parts: Vec<&str> = encoded.split(',').collect();

    for part in parts {
        if part.len() < 4 {
            return Err(format!("Invalid layout part: {part}"));
        }

        let id = generate_cell_id();
        let xywh = &part[..4];
        let extra = &part[4..];

        // xywh 디코딩
        let chars: Vec<char> = xywh.chars().collect();
        let x = decode_char(chars[0])?;
        let y = decode_char(chars[1])?;
        let w = decode_char(chars[2])?;
        let h = decode_char(chars[3])?;

        layout.push(LayoutItem {
            i: id.clone(),
            x,
            y,
            w,
            h,
            is_draggable: true,
            is_resizable: true,
        });

        // 콘텐츠 디코딩
        if let Some(tab_str) = extra.strip_prefix("chat") {
            let tab = tab_str.parse::<u8>().unwrap_or(0);
            content.insert(
                id.clone(),
                CellContent {
                    id: id.clone(),
                    cell_type: "chat".to_string(),
                    video_id: None,
                    video_source: None,
                    chat_tab: Some(tab),
                },
            );
        } else if let Some(channel) = extra.strip_prefix("twitch") {
            content.insert(
                id.clone(),
                CellContent {
                    id: id.clone(),
                    cell_type: "video".to_string(),
                    video_id: Some(channel.to_string()),
                    video_source: Some("twitch".to_string()),
                    chat_tab: None,
                },
            );
            video_count = video_count.saturating_add(1);
        } else if extra.len() == 11 {
            // YouTube video ID (11 characters)
            content.insert(
                id.clone(),
                CellContent {
                    id: id.clone(),
                    cell_type: "video".to_string(),
                    video_id: Some(extra.to_string()),
                    video_source: Some("youtube".to_string()),
                    chat_tab: None,
                },
            );
            video_count = video_count.saturating_add(1);
        } else {
            // 빈 셀 (empty)
            content.insert(
                id.clone(),
                CellContent {
                    id: id.clone(),
                    cell_type: "empty".to_string(),
                    video_id: None,
                    video_source: None,
                    chat_tab: None,
                },
            );
            video_count = video_count.saturating_add(1);
        }
    }

    Ok(DecodedLayout {
        layout,
        content,
        video_cell_count: video_count,
    })
}

/// Base64 문자를 숫자로 디코딩
#[allow(clippy::cast_possible_truncation)]
fn decode_char(c: char) -> Result<u8, String> {
    // B64_CHARS는 64개이므로 position은 항상 u8 범위 내
    B64_CHARS
        .iter()
        .position(|&b| b as char == c)
        .map(|p| p as u8)
        .ok_or_else(|| format!("Invalid character: {c}"))
}

/// 랜덤 셀 ID 생성 (8자)
fn generate_cell_id() -> String {
    let mut rng = rand::thread_rng();
    (0..8)
        .map(|_| B64_CHARS[rng.gen_range(0..B64_CHARS.len())] as char)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_decode_roundtrip() {
        let layout = vec![
            LayoutItem {
                i: "cell1".to_string(),
                x: 0,
                y: 0,
                w: 12,
                h: 24,
                is_draggable: true,
                is_resizable: true,
            },
            LayoutItem {
                i: "cell2".to_string(),
                x: 12,
                y: 0,
                w: 12,
                h: 24,
                is_draggable: true,
                is_resizable: true,
            },
        ];
        let content = HashMap::new();

        let encoded = encode_layout(&layout, &content, false).expect("encode failed");
        assert_eq!(encoded.encoded, "AAMY,MAMY");
        assert_eq!(encoded.video_cell_count, 2);

        let decoded = decode_layout(&encoded.encoded).expect("decode failed");
        assert_eq!(decoded.layout.len(), 2);
        assert_eq!(decoded.video_cell_count, 2);
    }

    #[test]
    fn test_decode_with_chat() {
        let encoded = "AAUY,UAEYchat0";
        let decoded = decode_layout(encoded).expect("decode failed");

        assert_eq!(decoded.layout.len(), 2);

        // 두 번째 셀은 chat 타입이어야 함
        let chat_cell = decoded.content.values().find(|c| c.cell_type == "chat");
        assert!(chat_cell.is_some());
        assert_eq!(chat_cell.unwrap().chat_tab, Some(0));
    }

    #[test]
    fn test_empty_encoded_string() {
        let decoded = decode_layout("").expect("decode failed");
        assert!(decoded.layout.is_empty());
        assert_eq!(decoded.video_cell_count, 0);
    }
}
