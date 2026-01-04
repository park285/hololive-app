---
description: 코드 주석 작성 규칙 - 한국어 응답 및 주석 스타일 가이드
---

# 주석 작성 규칙

## 1. 언어 규칙
- **응답 언어:** 모든 응답은 **한국어**로 작성
- **주석 언어:** 코드 주석은 **한국어**로 작성
- **변수/함수명:** 영어 유지 (코드 표준 준수)

## 2. 주석 스타일

### TypeScript / JavaScript
```typescript
// 단일 라인 주석: 간단한 설명
const value = 123;

/**
 * 함수/클래스 설명 (JSDoc 형식)
 * @param paramName - 파라미터 설명
 * @returns 반환값 설명
 */
function example(paramName: string): string {
  return paramName;
}

// TODO: 추후 구현 필요한 항목
// FIXME: 수정이 필요한 버그
// NOTE: 중요한 참고사항
```

### Rust
```rust
// 단일 라인 주석: 간단한 설명
let value = 123;

/// 함수/구조체 문서화 주석 (rustdoc)
/// 
/// # Arguments
/// * `param_name` - 파라미터 설명
/// 
/// # Returns
/// 반환값 설명
fn example(param_name: &str) -> String {
    param_name.to_string()
}

// TODO: 추후 구현 필요한 항목
// FIXME: 수정이 필요한 버그
// NOTE: 중요한 참고사항
```

## 3. 주석 작성 원칙
1. **명확성:** 코드의 "왜(Why)"를 설명, "무엇(What)"은 코드 자체로 표현
2. **간결성:** 불필요한 주석 지양, 핵심만 작성
3. **최신성:** 코드 변경 시 주석도 함께 갱신
4. **일관성:** 프로젝트 전체에서 동일한 스타일 유지

## 4. 주석이 필요한 경우
- 복잡한 비즈니스 로직
- 비직관적인 해결책 (workaround)
- 외부 API/라이브러리 사용 시 주의사항
- 성능 최적화 관련 코드
- 임시 코드 (TODO/FIXME 태그 사용)

## 5. 주석이 불필요한 경우
- 코드 자체로 명확한 경우
- 변수명/함수명이 충분히 설명적인 경우
- 단순한 getter/setter
