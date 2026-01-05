// Multiview 레이아웃 유효성 검증
// 셀 충돌, 범위 초과, 최소 크기 등 검증

use crate::models::multiview::{LayoutItem, ValidationResult};

/// 최대 그리드 크기 (24x24)
const GRID_SIZE: u8 = 24;
/// 최소 셀 크기
const MIN_CELL_SIZE: u8 = 2;
/// 최대 셀 개수
const MAX_CELLS: usize = 16;

/// 레이아웃 유효성 검증
///
/// 검증 항목:
/// 1. 셀 개수 제한 (최대 16개)
/// 2. 그리드 범위 초과 검사
/// 3. 최소 셀 크기 검사
/// 4. 셀 간 충돌 검사
///
/// # Arguments
/// * `layout` - 검증할 레이아웃 아이템 배열
///
/// # Returns
/// 유효성 검증 결과 (valid, errors, warnings)
pub fn validate_layout(layout: &[LayoutItem]) -> ValidationResult {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // 1. 셀 개수 제한
    if layout.len() > MAX_CELLS {
        errors.push(format!(
            "셀 개수가 최대 허용치({MAX_CELLS}개)를 초과했습니다: {}개",
            layout.len()
        ));
    }

    // 빈 레이아웃 경고
    if layout.is_empty() {
        warnings.push("레이아웃이 비어있습니다.".to_string());
        return ValidationResult {
            valid: true,
            errors,
            warnings,
        };
    }

    for (i, item) in layout.iter().enumerate() {
        let cell_label = format!("셀 '{}'", item.i);

        // 2. 그리드 범위 검사
        if item.x >= GRID_SIZE {
            errors.push(format!(
                "{cell_label}: x 위치({})가 그리드 범위를 벗어났습니다.",
                item.x
            ));
        }
        if item.y >= GRID_SIZE {
            errors.push(format!(
                "{cell_label}: y 위치({})가 그리드 범위를 벗어났습니다.",
                item.y
            ));
        }
        if item.x + item.w > GRID_SIZE {
            errors.push(format!(
                "{cell_label}: 너비가 그리드를 벗어났습니다 (x={}, w={})",
                item.x, item.w
            ));
        }
        if item.y + item.h > GRID_SIZE {
            errors.push(format!(
                "{cell_label}: 높이가 그리드를 벗어났습니다 (y={}, h={})",
                item.y, item.h
            ));
        }

        // 3. 최소 크기 검사
        if item.w < MIN_CELL_SIZE {
            warnings.push(format!(
                "{cell_label}: 너비({})가 최소 크기({MIN_CELL_SIZE})보다 작습니다.",
                item.w
            ));
        }
        if item.h < MIN_CELL_SIZE {
            warnings.push(format!(
                "{cell_label}: 높이({})가 최소 크기({MIN_CELL_SIZE})보다 작습니다.",
                item.h
            ));
        }

        // 4. 셀 간 충돌 검사
        for (j, other) in layout.iter().enumerate() {
            if i >= j {
                continue; // 이미 검사한 쌍 건너뛰기
            }

            if cells_overlap(item, other) {
                errors.push(format!(
                    "셀 '{}'와(과) 셀 '{}'이(가) 겹칩니다.",
                    item.i, other.i
                ));
            }
        }
    }

    ValidationResult {
        valid: errors.is_empty(),
        errors,
        warnings,
    }
}

/// 두 셀이 겹치는지 확인
const fn cells_overlap(a: &LayoutItem, b: &LayoutItem) -> bool {
    let a_left = a.x;
    let a_right = a.x + a.w;
    let a_top = a.y;
    let a_bottom = a.y + a.h;

    let b_left = b.x;
    let b_right = b.x + b.w;
    let b_top = b.y;
    let b_bottom = b.y + b.h;

    // 겹치지 않는 경우의 반대
    !(a_right <= b_left || b_right <= a_left || a_bottom <= b_top || b_bottom <= a_top)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[allow(clippy::many_single_char_names)]
    fn make_cell(i: &str, x: u8, y: u8, w: u8, h: u8) -> LayoutItem {
        LayoutItem {
            i: i.to_string(),
            x,
            y,
            w,
            h,
            is_draggable: true,
            is_resizable: true,
        }
    }

    #[test]
    fn test_valid_layout() {
        let layout = vec![make_cell("a", 0, 0, 12, 24), make_cell("b", 12, 0, 12, 24)];

        let result = validate_layout(&layout);
        assert!(result.valid);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_overlapping_cells() {
        let layout = vec![
            make_cell("a", 0, 0, 12, 12),
            make_cell("b", 6, 6, 12, 12), // 겹침
        ];

        let result = validate_layout(&layout);
        assert!(!result.valid);
        assert!(!result.errors.is_empty());
    }

    #[test]
    fn test_out_of_bounds() {
        let layout = vec![make_cell("a", 20, 0, 10, 24)]; // x + w = 30 > 24

        let result = validate_layout(&layout);
        assert!(!result.valid);
    }

    #[test]
    fn test_small_cell_warning() {
        let layout = vec![make_cell("a", 0, 0, 1, 1)]; // 최소 크기 미만

        let result = validate_layout(&layout);
        assert!(result.valid); // 경고만, 에러 아님
        assert!(!result.warnings.is_empty());
    }

    #[test]
    fn test_empty_layout() {
        let result = validate_layout(&[]);
        assert!(result.valid);
        assert!(!result.warnings.is_empty()); // 빈 레이아웃 경고
    }

    #[test]
    fn test_too_many_cells() {
        let layout: Vec<LayoutItem> = (0..20)
            .map(|i| make_cell(&format!("cell{i}"), 0, 0, 2, 2))
            .collect();

        let result = validate_layout(&layout);
        assert!(!result.valid);
    }
}
