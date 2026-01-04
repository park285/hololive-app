# Hololive Tauri App - 구현 TODO

> **생성일**: 2026-01-03  
> **기반 문서**: `BOT_FEATURES.MD`, `ARCHITECTURE.MD`  
> **전략**: 로컬 알람 + API 검증 (기존 hololive-kakao-bot-go API 활용)

---

## 🎯 프로젝트 개요

기존 `hololive-kakao-bot-go`의 핵심 기능을 독립형 Tauri 데스크탑/모바일 앱으로 이식.
- **서버**: 기존 `hololive-kakao-bot-go` API 활용 (필요시 엔드포인트 추가)
- **앱**: 알람 관리/체크/발송 전부 로컬에서 처리 (Kakao 봇과 완전 분리)

---

## 📋 Phase 1: 기존 API 확인 및 확장 (예상: 0.5일)

> 목표: `hololive-kakao-bot-go`의 기존 API 활용, 필요시만 추가

### 1.1 기존 API 확인 (이미 존재)

| 엔드포인트 | 상태 | 용도 |
|:---|:---|:---|
| `GET /api/holo/streams/live` | ✅ 존재 | 라이브 스트림 |
| `GET /api/holo/streams/upcoming` | ✅ 존재 | 예정 스트림 |
| `GET /api/holo/members` | ✅ 존재 | 멤버 목록 |
| `GET /api/holo/stats/channels` | ✅ 존재 | 채널 통계 |
| `GET /api/holo/stats` | ✅ 존재 | 봇 통계(요약) |
| `GET /api/holo/milestones` | ✅ 존재 | 마일스톤 히스토리 |
| `GET /api/holo/milestones/near` | ✅ 존재 | 마일스톤 임박 멤버 |
| `GET /api/holo/milestones/stats` | ✅ 존재 | 마일스톤 통계 |
| `/health` | ✅ 존재 | 헬스체크 |

### 1.2 필요시 추가할 API (hololive-kakao-bot-go 수정)
- [ ] `GET /api/holo/members/search?q=xxx` - 멤버 검색 (앱 로컬 필터링으로 대체 가능)
- [ ] `GET /api/holo/members/:channelId` - 개별 멤버 상세 (Optional)
- [ ] `GET /api/holo/profiles?channelId=xxx&locale=ko` - 멤버 상세 프로필 (공식 프로필 + 번역, 백엔드 ProfileService 기반)
- [ ] `GET /api/holo/stats/subscribers?channelId=xxx&since=...` - 구독자 히스토리 (그래프용, 백엔드 StatsRepo 기반)

### 1.3 API 노출 확인
- [ ] Cloudflare Tunnel 설정 확인 (기존 admin API 경로 재사용 또는 별도 엔드포인트)
- [ ] CORS 설정 확인 (Tauri 앱에서 호출 가능 여부)

---

## 📋 Phase 2: Tauri 클라이언트 코어 (예상: 2-3일) ← **현재 진행 중**

> 목표: API 호출 + 로컬 DB + 백그라운드 스케줄러

### 2.1 프로젝트 생성
- [x] Tauri v2 프로젝트 초기화 (`hololive-app/`)
- [x] Vite + React + TypeScript 설정
- [x] `tauri.conf.json` 구성 (앱 이름, 창 크기 등)
- [x] Capabilities 설정 (notification, sql, http)
- [x] 필요한 Tauri 플러그인 설치
- [x] admin-dashboard 스타일 시스템 복사 (TailwindCSS v4, UI 컴포넌트)


### 2.2 Rust Backend - 데이터 모델
- [x] `src-tauri/src/models/stream.rs` - Stream 구조체
- [x] `src-tauri/src/models/channel.rs` - Channel 구조체
- [x] `src-tauri/src/models/member.rs` - Member 구조체
- [x] `src-tauri/src/models/alarm.rs` - Alarm 구조체
- [x] `src-tauri/src/models/settings.rs` - Settings 구조체

### 2.3 Rust Backend - SQLite (rusqlite 직접 사용)
- [x] `src-tauri/src/db/mod.rs` - 데이터베이스 연결 + 에러 타입
- [x] `src-tauri/src/db/connection.rs` - Thread-safe 연결 관리 (WAL 모드)
- [x] `src-tauri/src/db/migrations.rs` - 버전 기반 스키마 마이그레이션
  - `alarms` 테이블
  - `settings` 테이블 (Key-Value)
  - `notification_history` 테이블
  - `offline_cache` 테이블
- [x] `src-tauri/src/db/alarms.rs` - 알람 CRUD (UPSERT 지원)
- [x] `src-tauri/src/db/settings.rs` - 설정 CRUD
- [x] `src-tauri/src/db/history.rs` - 알림 히스토리 CRUD + 일정 변경 감지

### 2.4 Rust Backend - API 클라이언트
- [x] `src-tauri/src/api/client.rs` - HTTP 클라이언트 (reqwest)
- [x] `src-tauri/src/api/streams.rs` - 스트림 API 호출
- [x] `src-tauri/src/api/members.rs` - 멤버 API 호출

### 2.5 Rust Backend - IPC 커맨드
- [x] `fetch_live_streams` - 라이브 스트림 조회
- [x] `fetch_upcoming_streams` - 예정 스트림 조회
- [x] `fetch_members` - 멤버 목록 조회
- [x] `search_members` - 멤버 검색
- [x] `get_alarms` / `add_alarm` / `remove_alarm` / `toggle_alarm`
- [x] `get_settings` / `update_setting`
- [x] `was_notified` / `record_notification` / `cleanup_old_notifications`

### 2.6 Rust Backend - 백그라운드 스케줄러
- [x] `src-tauri/src/scheduler/mod.rs` - 스케줄러 메인
- [x] 폴링 주기 설정 (기본 60초)
- [x] 알람 체크 로직 구현:
  1. 등록된 알람 목록 조회 (SQLite)
  2. 서버 API로 예정 스트림 조회
  3. 알람 시간 도달 확인 (notify_minutes_before)
  4. notification_history 중복 체크
  5. 네이티브 알림 발송
  6. 히스토리 기록
- [x] **일정 변경 감지 구현**:
  - notification_history에 `start_scheduled_at` 저장
  - 다음 체크에서 API 데이터와 비교
  - 변경 시 "N분 앞당겨짐/늦춰짐" 알림 발송

---

## 📋 Phase 3: React UI (예상: 2일)

> 목표: admin-dashboard 를 재사용한 모던 UI

### 3.1 프론트엔드 설정
- [x] TailwindCSS v4 설정
- [x] 다크 모드 지원
- [x] 공통 컴포넌트 스타일 정의

### 3.2 페이지 구현
- [x] **Dashboard** (`/`)
  - 현재 라이브 스트림 카드
  - 예정 스트림 타임라인
  - 빠른 알람 토글
- [x] **Members** (`/members`)
  - 그룹별 멤버 디렉터리 (Advent, Justice, Myth, Promise, holoX...)
  - 멤버 검색
  - 멤버 카드 (프로필 사진, 이름, 구독자 수)
- [x] **Alarms** (`/alarms`)
  - 알람 목록 (활성/비활성 토글)
  - 멤버별 알람 추가/삭제
  - 알림 시간 설정 (5분, 10분, 15분 전...)
- [x] **Settings** (`/settings`)
  - 테마 (시스템/라이트/다크)
  - 언어 (한국어/일본어/영어)
  - 폴링 주기
  - 오프라인 캐시 토글

### 3.3 컴포넌트
- [x] `StreamCard` - 스트림 카드 (썸네일, 제목, 채널, 시간)
- [x] `MemberCard` - 멤버 카드 (프로필, 이름, 그룹)
- [x] `AlarmToggle` - 알람 온/오프 토글
- [x] `Navigation` - 사이드바/탭 네비게이션

---

## 📋 Phase 4: 알림 + 마무리 (예상: 1일) ← **현재 진행 중**

### 4.1 네이티브 알림
- [x] `tauri-plugin-notification` 연동 (스케줄러 + 알림 발송)
- [ ] 알림 클릭 시 앱으로 이동 (Tauri v2 기본 동작에 의존)
- [x] 알림 아이콘 (admin-dashboard favicon.svg 재사용)

### 4.2 최적화
- [x] 오프라인 캐시 구현 (마지막 성공 데이터 보관) - `db/cache.rs`
- [x] notification_history 정리 (7일 이상 삭제) - 스케줄러 자동 정리
- [x] 에러 핸들링 개선 (API 실패 시 캐시 fallback)

### 4.3 빌드 & 배포
- [x] 앱 아이콘 생성 (`tauri icon` 명령어로 전체 플랫폼 아이콘 생성)
- [ ] Windows 빌드 (.msi, .exe)
- [ ] macOS 빌드 (.dmg)
- [ ] Linux 빌드 (.deb, .AppImage)
- [ ] (선택) iOS/Android 빌드 테스트

---

## 📋 미래 확장 (Optional, UI만 추가)

> **참고**: 아래 1~3번 기능은 카카오봇에서 이미 제공 중 (`member`, `subscriber`, `stats`, 마일스톤 스케줄러)
> API도 이미 노출되어 있으므로, **Tauri 앱에서는 UI만 구현하면 됨**

- [ ] 멤버 상세 프로필 UI (✅ 백엔드 존재: `member` 커맨드)
  - API: `GET /api/holo/profiles?channelId=xxx` (신규 노출 필요)
  - 앱: 프로필 조회 IPC + `Members` 상세 모달 UI
- [ ] 구독자 통계 그래프 UI (✅ 백엔드 존재: `subscriber`, `stats gainers` 커맨드)
  - API: `GET /api/holo/stats/channels` (현재값, ✅ 존재)
  - API: `GET /api/holo/stats/history?channelId=xxx` (히스토리, 신규 노출 필요)
  - 앱: 통계 조회 IPC + 차트 UI (recharts 등)
- [ ] 마일스톤 UI (✅ 백엔드 존재: `checkMilestones()` 스케줄러)
  - API: `GET /api/holo/milestones`, `/near`, `/stats` (✅ 모두 존재)
  - 앱: 마일스톤 목록/임박 멤버 UI + (선택) 로컬 알림
- [ ] 위젯 지원 (Windows/macOS)
- [ ] 시스템 트레이 상주

---

## ✅ 완료 기준

1. **기존 API 활용**: `hololive-kakao-bot-go` API로 라이브/예정 스트림, 멤버 데이터 조회 가능
2. **앱 기능**: 멤버별 알람 등록/해제, 방송 임박 시 네이티브 알림 발송
3. **일정 변경**: 방송 시간 변경 시 자동 감지 및 알림
4. **오프라인**: 네트워크 끊김 시 마지막 캐시 데이터 표시
5. **크로스 플랫폼**: Windows, macOS, Linux 빌드 성공

---

## 📝 일정 변경 감지 로직

```
[앱 스케줄러 (1분마다)]
       │
       ▼
[서버 API 호출: GET /api/holo/streams/upcoming]
       │
       ▼
[로컬 notification_history 조회]
       │
       ├── 기록 없음 → 새 알림
       │
       ├── 기록 있고 start_scheduled_at 동일 → 스킵 (중복)
       │
       └── 기록 있고 start_scheduled_at 다름 → 변경 감지!
              ├── diff 계산 ("N분 늦춰짐/앞당겨짐")
              ├── DB 업데이트
              └── 변경 알림 발송
```
