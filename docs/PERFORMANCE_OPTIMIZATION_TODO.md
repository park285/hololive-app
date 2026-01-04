# Performance Optimization TODO

> **작성일**: 2026-01-04  
> **목적**: 모바일(Android WebView) 및 전반적 렌더링 성능 개선  
> **우선순위**: Level 1 → Level 2 → Level 3

---

## 📊 개요

| Level | Risk | 예상 작업량 | 주요 영역 |
|-------|------|------------|----------|
| Level 1 | Low | 1-2시간 | CSS, 이미지, 단순 컴포넌트 |
| Level 2 | Medium | 4-8시간 | 가상화, 폴링, 번들 최적화 |
| Level 3 | High | 2-3일 | 아키텍처 변경, 라이브러리 교체 |

---

## ✅ Level 1: 즉시 적용 가능 (Low Risk)

### 1.1 MemberCard Hover 효과 제거
- **파일**: `src/components/MemberCard.tsx`
- **문제점**: `hover:scale-105` CSS transition이 모든 카드에 적용
- **해결책**: 모바일에서 hover 효과 제거 (`@media (hover: hover)` 조건부 적용)
- **예상 효과**: 터치 렌더링 개선
- **상태**: [x] 완료 (2026-01-04)

```css
/* 예시 수정안 */
@media (hover: hover) {
  .member-card:hover {
    transform: scale(1.05);
  }
}
```

---

### 1.2 이미지 품질 최적화
- **파일**: 이미지 로딩 관련 컴포넌트들
- **문제점**: `decoding="async"` 적용되었으나 모바일에서 여전히 로드 부담
- **해결책**: 이미지 품질 파라미터 하향 조정 (`q=90` → `q=70`)
- **예상 효과**: 네트워크/렌더 절약 (~20% 이미지 사이즈 감소)
- **상태**: [x] 완료 (2026-01-04)

```typescript
// 예시: Holodex 이미지 URL 최적화
const optimizedUrl = `${baseUrl}?w=160&h=160&q=70`;
```

---

### 1.3 StreamCard/StreamListItem 애니메이션 제거
- **파일**: 
  - `src/components/StreamCard.tsx`
  - `src/components/StreamListItem.tsx`
- **문제점**: 모든 카드에 `motion.div` 사용
- **해결책**: 순수 `div`로 전환 (Framer Motion 애니메이션 완전 제거)
- **예상 효과**: 최대 렌더링 성능
- **상태**: [x] 완료 (2026-01-04)

```tsx
// Before
<motion.div whileHover={{ scale: 1.02 }}>...</motion.div>

// After
<div className="stream-card">...</div>
```

---

## ⚠️ Level 2: 중간 규모 변경 (Medium Risk)

### 2.1 가상화 (Virtualization) 적용
- **파일**: `src/pages/DashboardPage.tsx`
- **패키지**: `@tanstack/react-virtual`
- **해결책**: 스크롤 영역에 가상 리스트 적용
- **예상 효과**: 100개+ 스트림 시 DOM 노드 90% 감소
- **상태**: [ ] 미완료
- **참고**: [TanStack Virtual Docs](https://tanstack.com/virtual/latest)

```bash
npm install @tanstack/react-virtual
```

```tsx
// 예시 구현
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: streams.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 120, // 카드 예상 높이
});
```

---

### 2.2 Delta Polling 주기 확장
- **파일**: 폴링 로직 관련 파일
- **문제점**: `setInterval` 60초 주기
- **해결책**: 120초로 확장 (또는 visibility 기반 적응형 폴링)
- **예상 효과**: 백그라운드 CPU 50% 감소
- **상태**: [ ] 미완료

```typescript
// Before
const POLL_INTERVAL = 60 * 1000; // 60초

// After
const POLL_INTERVAL = 120 * 1000; // 120초

// Optional: Visibility API 기반 적응형
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // 300초로 확장
  } else {
    // 120초로 복원
  }
});
```

---

### 2.3 lucide-react 아이콘 최적화
- **파일**: 전체 프로젝트 임포트
- **문제점**: Tree-shaking 미최적화로 번들 크기 증가
- **해결책**:
  - Option A: Named import로 변경 (`import { Icon } from 'lucide-react'`)
  - Option B: 자주 사용하는 아이콘을 SVG inline으로 교체
- **예상 효과**: 번들 크기 감소 (lucide 전체 ~400KB → 필요 아이콘만 ~50KB)
- **상태**: [ ] 미완료

```tsx
// Before (잠재적 비효율)
import * as Icons from 'lucide-react';

// After (Tree-shaking 최적화)
import { Play, Pause, Settings } from 'lucide-react';
```

---

## 🔥 Level 3: 근본적 변경 (High Risk)

### 3.1 Framer Motion 완전 제거
- **영향 범위**: 전체 애니메이션 시스템
- **해결책**: 모든 `motion.*` 컴포넌트를 CSS `@keyframes`로 전환
- **예상 효과**: 가장 큰 성능 개선 (JS 번들 ~45KB 감소, 런타임 오버헤드 제거)
- **비고**: 대규모 리팩토링 완료
- **상태**: [x] 완료 (2026-01-04)

#### 영향받는 파일:
- [x] `src/pages/DashboardPage.tsx`
- [x] `src/pages/MembersPage.tsx`
- [x] `src/pages/SettingsPage.tsx`
- [x] `src/components/Layout.tsx`
- [x] `src/components/layout/PageTransition.tsx`
- [x] `src/components/ui/StatCard.tsx`
- [x] `package.json` (framer-motion 의존성 제거)

#### CSS 대체 예시:
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.stream-card {
  animation: fadeIn 0.2s ease-out;
}
```

---

### 3.2 React 18 Concurrent Mode 적용
- **영향 범위**: React 아키텍처
- **해결책**: `startTransition`으로 목록 렌더링 우선순위 낮춤
- **예상 효과**: 대규모 목록 렌더링 시 UI 반응성 유지
- **비고**: DashboardPage에 startTransition, MembersPage에 useDeferredValue 적용
- **상태**: [x] 완료 (2026-01-04)

```tsx
import { startTransition, useState } from 'react';

const [streams, setStreams] = useState([]);

// 무거운 목록 업데이트를 낮은 우선순위로
const handleDataUpdate = (newData) => {
  startTransition(() => {
    setStreams(newData);
  });
};
```

#### 추가 고려사항:
- `useDeferredValue` 활용 검토
- Suspense 경계 추가
- 로딩 상태 개선

---

## 📈 진행 현황

| 항목 | 상태 | 완료일 | 담당 |
|------|------|--------|------|
| 1.1 MemberCard Hover | ✅ | 2026-01-04 | AGNET |
| 1.2 이미지 품질 | ✅ | 2026-01-04 | AGNET |
| 1.3 StreamCard 애니메이션 | ✅ | 2026-01-04 | AGNET |
| 2.1 가상화 | ⬜ | - | - |
| 2.2 Delta Polling | ⬜ | - | - |
| 2.3 lucide-react | ⬜ | - | - |
| 3.1 Framer Motion 제거 | ✅ | 2026-01-04 | AGNET |
| 3.2 Concurrent Mode | ✅ | 2026-01-04 | AGNET |

**범례**: ⬜ 미완료 | 🔄 진행중 | ✅ 완료

---

## 🔗 관련 문서

- [ARCHITECTURE.MD](./ARCHITECTURE.MD)
- [Mobile Performance Optimization KI](../knowledge/hololive_notifier_project_overview/artifacts/implementation/performance_and_ux_patterns.md)
- [TanStack Virtual](https://tanstack.com/virtual/latest)
- [React 18 Concurrent Features](https://react.dev/reference/react/startTransition)

---

## 📝 변경 이력

| 날짜 | 내용 | 작성자 |
|------|------|--------|
| 2026-01-04 | 초안 작성 | AGNET |
| 2026-01-04 | Level 1 전체 완료 (1.1, 1.2, 1.3) | AGNET |
| 2026-01-04 | Level 3 전체 완료 (3.1 Framer Motion 제거, 3.2 Concurrent Mode) | AGNET |
