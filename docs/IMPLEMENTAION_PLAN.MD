# Hololive Tauri App - 세부 구현 계획서

> **프로젝트**: 홀로라이브 스트림 알림 데스크톱 앱
> **아키텍처**: Tauri v2 (Rust Backend + React Frontend)
> **작성일**: 2026-01-03

---

## 1. 프로젝트 개요

### 1.1 목표
기존 `hololive-kakao-bot-go`의 핵심 기능들을 완전 독립형 데스크톱 앱으로 재구현:
- 서버 의존성 없이 로컬에서 동작
- Holodex API 직접 호출
- 네이티브 OS 알림
- SQLite 로컬 저장소

### 1.2 기능 범위

| 기능 | 설명 | 우선순위 |
|:---|:---|:---:|
| 라이브 스트림 조회 | 현재 진행 중인 홀로라이브 방송 목록 | P0 |
| 예정 스트림 조회 | 향후 24시간 내 예정된 방송 목록 | P0 |
| 멤버 검색 | 이름/별명으로 멤버 검색 | P0 |
| 알람 관리 | 특정 멤버 방송 알림 설정/해제 | P0 |
| 네이티브 알림 | 방송 시작 N분 전 OS 알림 | P0 |
| 설정 관리 | 알림 시간, 테마 등 사용자 설정 | P1 |
| 멤버 상세 정보 | 프로필, 통계, 최근 방송 | P1 |
| 다크 모드 | 시스템 테마 연동 | P2 |

---

## 2. 기술 스택

### 2.1 Backend (Rust)
```toml
[dependencies]
tauri = { version = "2", features = ["devtools"] }
tauri-plugin-notification = "2"
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-store = "2"
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde"] }
thiserror = "2"
tracing = "0.1"
tracing-subscriber = "0.3"
```

### 2.2 Frontend (React)
```json
{
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-notification": "^2",
    "@tauri-apps/plugin-sql": "^2",
    "@tanstack/react-query": "^5",
    "framer-motion": "^12",
    "lucide-react": "^0.500",
    "clsx": "^2",
    "tailwind-merge": "^3"
  },
  "devDependencies": {
    "vite": "^7",
    "@vitejs/plugin-react": "^5",
    "tailwindcss": "^4",
    "typescript": "~5.9"
  }
}
```

---

## 3. 프로젝트 구조

```
hololive-app/
├── src-tauri/                      # Rust 백엔드
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json            # 권한 설정
│   └── src/
│       ├── main.rs                 # 진입점
│       ├── lib.rs                  # Tauri 설정 & 커맨드 등록
│       ├── error.rs                # 통합 에러 타입
│       ├── commands/               # IPC 커맨드
│       │   ├── mod.rs
│       │   ├── streams.rs          # 스트림 조회
│       │   ├── members.rs          # 멤버 조회/검색
│       │   ├── alarms.rs           # 알람 CRUD
│       │   └── settings.rs         # 설정 관리
│       ├── api/                    # 외부 API 클라이언트
│       │   ├── mod.rs
│       │   └── holodex.rs          # Holodex API (Rate Limit, Cache)
│       ├── models/                 # 데이터 모델
│       │   ├── mod.rs
│       │   ├── stream.rs
│       │   ├── channel.rs
│       │   ├── member.rs
│       │   └── alarm.rs
│       ├── storage/                # 저장소 추상화
│       │   ├── mod.rs
│       │   ├── database.rs         # SQLite 스키마 & 쿼리
│       │   └── cache.rs            # 인메모리 캐시
│       ├── scheduler/              # 백그라운드 작업
│       │   ├── mod.rs
│       │   └── polling.rs          # 스트림 폴링 & 알림 트리거
│       └── data/                   # 정적 데이터
│           └── members.json        # 임베드된 멤버 데이터
│
├── src/                            # React 프론트엔드
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css                   # TailwindCSS v4 (admin-dashboard 스타일)
│   ├── components/
│   │   ├── ui/                     # 공통 UI 컴포넌트
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── Badge.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── streams/
│   │   │   ├── StreamCard.tsx
│   │   │   ├── LiveStreamList.tsx
│   │   │   └── UpcomingStreamList.tsx
│   │   ├── members/
│   │   │   ├── MemberCard.tsx
│   │   │   ├── MemberSearch.tsx
│   │   │   └── MemberDetail.tsx
│   │   └── alarms/
│   │       ├── AlarmList.tsx
│   │       └── AlarmToggle.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx           # 메인 (라이브 + 예정)
│   │   ├── Members.tsx             # 멤버 목록/검색
│   │   ├── Alarms.tsx              # 알람 관리
│   │   └── Settings.tsx            # 설정
│   ├── hooks/
│   │   ├── useStreams.ts
│   │   ├── useMembers.ts
│   │   ├── useAlarms.ts
│   │   └── useTauriCommand.ts
│   ├── api/
│   │   └── tauri.ts                # invoke 래퍼
│   └── lib/
│       ├── utils.ts
│       └── constants.ts
│
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## 4. 데이터 모델 (Go → Rust 포팅)

### 4.1 Stream (방송)
```rust
// src-tauri/src/models/stream.rs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum StreamStatus {
    Live,
    Upcoming,
    Past,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stream {
    pub id: String,
    pub title: String,
    pub channel_id: String,
    pub channel_name: String,
    pub status: StreamStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_scheduled: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_actual: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel: Option<Channel>,
}

impl Stream {
    pub fn is_live(&self) -> bool {
        self.status == StreamStatus::Live
    }

    pub fn youtube_url(&self) -> String {
        format!("https://youtube.com/watch?v={}", self.id)
    }

    pub fn minutes_until_start(&self) -> Option<i64> {
        self.start_scheduled.map(|scheduled| {
            let now = Utc::now();
            (scheduled - now).num_minutes().max(0)
        })
    }
}
```

### 4.2 Channel (채널)
```rust
// src-tauri/src/models/channel.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Channel {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub english_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub photo: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscriber_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub org: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
}

impl Channel {
    pub fn display_name(&self) -> &str {
        self.english_name.as_deref().unwrap_or(&self.name)
    }

    pub fn is_hololive(&self) -> bool {
        self.org.as_deref() == Some("Hololive")
    }
}
```

### 4.3 Member (멤버)
```rust
// src-tauri/src/models/member.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Aliases {
    #[serde(default)]
    pub ko: Vec<String>,
    #[serde(default)]
    pub ja: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    pub id: i32,
    pub channel_id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aliases: Option<Aliases>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name_ja: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name_ko: Option<String>,
    #[serde(default)]
    pub is_graduated: bool,
}

impl Member {
    pub fn all_aliases(&self) -> Vec<&str> {
        let mut result = Vec::new();
        if let Some(aliases) = &self.aliases {
            result.extend(aliases.ko.iter().map(String::as_str));
            result.extend(aliases.ja.iter().map(String::as_str));
        }
        result
    }

    pub fn matches_query(&self, query: &str) -> bool {
        let query_lower = query.to_lowercase();
        self.name.to_lowercase().contains(&query_lower)
            || self.name_ko.as_ref().map_or(false, |n| n.to_lowercase().contains(&query_lower))
            || self.name_ja.as_ref().map_or(false, |n| n.to_lowercase().contains(&query_lower))
            || self.all_aliases().iter().any(|a| a.to_lowercase().contains(&query_lower))
    }
}
```

### 4.4 Alarm (알람)
```rust
// src-tauri/src/models/alarm.rs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Alarm {
    pub id: i64,
    pub channel_id: String,
    pub member_name: String,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
}

impl Alarm {
    pub fn new(channel_id: String, member_name: String) -> Self {
        Self {
            id: 0, // DB에서 자동 생성
            channel_id,
            member_name,
            enabled: true,
            created_at: Utc::now(),
        }
    }
}
```

---

## 5. Holodex API 클라이언트

### 5.1 핵심 기능 (Go에서 포팅)
```rust
// src-tauri/src/api/holodex.rs

use std::sync::Arc;
use std::time::Duration;
use reqwest::Client;
use tokio::sync::RwLock;
use crate::models::{Stream, Channel};
use crate::error::AppError;

const BASE_URL: &str = "https://holodex.net/api/v2";
const RATE_LIMIT_PER_SECOND: u32 = 10;

pub struct HolodexClient {
    client: Client,
    api_key: String,
    cache: Arc<RwLock<Cache>>,
}

struct Cache {
    live_streams: Option<(Vec<Stream>, std::time::Instant)>,
    upcoming_streams: Option<(Vec<Stream>, std::time::Instant)>,
}

impl HolodexClient {
    pub fn new(api_key: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            api_key,
            cache: Arc::new(RwLock::new(Cache {
                live_streams: None,
                upcoming_streams: None,
            })),
        }
    }

    /// 현재 라이브 중인 홀로라이브 스트림 조회
    pub async fn get_live_streams(&self) -> Result<Vec<Stream>, AppError> {
        // 캐시 확인 (30초 TTL)
        {
            let cache = self.cache.read().await;
            if let Some((streams, cached_at)) = &cache.live_streams {
                if cached_at.elapsed() < Duration::from_secs(30) {
                    return Ok(streams.clone());
                }
            }
        }

        let url = format!("{}/live", BASE_URL);
        let response = self.client
            .get(&url)
            .header("X-APIKEY", &self.api_key)
            .query(&[("org", "Hololive"), ("type", "stream")])
            .send()
            .await?
            .json::<Vec<HolodexStreamRaw>>()
            .await?;

        let streams: Vec<Stream> = response.into_iter()
            .map(|raw| raw.into())
            .collect();

        // 캐시 업데이트
        {
            let mut cache = self.cache.write().await;
            cache.live_streams = Some((streams.clone(), std::time::Instant::now()));
        }

        Ok(streams)
    }

    /// 예정된 스트림 조회 (hours 시간 이내)
    pub async fn get_upcoming_streams(&self, hours: u32) -> Result<Vec<Stream>, AppError> {
        // 캐시 확인 (60초 TTL)
        {
            let cache = self.cache.read().await;
            if let Some((streams, cached_at)) = &cache.upcoming_streams {
                if cached_at.elapsed() < Duration::from_secs(60) {
                    return Ok(streams.clone());
                }
            }
        }

        let url = format!("{}/live", BASE_URL);
        let max_upcoming = format!("{}", hours * 3600); // 초 단위

        let response = self.client
            .get(&url)
            .header("X-APIKEY", &self.api_key)
            .query(&[
                ("org", "Hololive"),
                ("status", "upcoming"),
                ("max_upcoming_hours", &hours.to_string()),
            ])
            .send()
            .await?
            .json::<Vec<HolodexStreamRaw>>()
            .await?;

        let streams: Vec<Stream> = response.into_iter()
            .map(|raw| raw.into())
            .collect();

        // 캐시 업데이트
        {
            let mut cache = self.cache.write().await;
            cache.upcoming_streams = Some((streams.clone(), std::time::Instant::now()));
        }

        Ok(streams)
    }
}

/// Holodex API 응답 Raw 구조체
#[derive(Debug, Deserialize)]
struct HolodexStreamRaw {
    id: String,
    title: String,
    status: String,
    #[serde(rename = "start_scheduled")]
    start_scheduled: Option<String>,
    #[serde(rename = "start_actual")]
    start_actual: Option<String>,
    channel: Option<HolodexChannelRaw>,
}

#[derive(Debug, Deserialize)]
struct HolodexChannelRaw {
    id: String,
    name: String,
    english_name: Option<String>,
    photo: Option<String>,
    org: Option<String>,
}

impl From<HolodexStreamRaw> for Stream {
    fn from(raw: HolodexStreamRaw) -> Self {
        // 변환 로직...
        todo!()
    }
}
```

---

## 6. SQLite 스키마

```sql
-- src-tauri/migrations/001_init.sql

-- 알람 테이블
CREATE TABLE IF NOT EXISTS alarms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL UNIQUE,
    member_name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_alarms_channel ON alarms(channel_id);

-- 설정 테이블
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 알림 히스토리 (중복 알림 방지)
CREATE TABLE IF NOT EXISTS notification_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stream_id TEXT NOT NULL,
    notified_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_notification_stream ON notification_history(stream_id);
```

---

## 7. IPC 커맨드

### 7.1 스트림 커맨드
```rust
// src-tauri/src/commands/streams.rs

use tauri::State;
use crate::api::HolodexClient;
use crate::models::Stream;
use crate::error::AppError;

#[tauri::command]
pub async fn get_live_streams(
    holodex: State<'_, HolodexClient>,
) -> Result<Vec<Stream>, String> {
    holodex.get_live_streams()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_upcoming_streams(
    holodex: State<'_, HolodexClient>,
    hours: Option<u32>,
) -> Result<Vec<Stream>, String> {
    let hours = hours.unwrap_or(24);
    holodex.get_upcoming_streams(hours)
        .await
        .map_err(|e| e.to_string())
}
```

### 7.2 알람 커맨드
```rust
// src-tauri/src/commands/alarms.rs

use tauri::State;
use crate::storage::Database;
use crate::models::Alarm;

#[tauri::command]
pub async fn get_alarms(db: State<'_, Database>) -> Result<Vec<Alarm>, String> {
    db.get_all_alarms().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_alarm(
    db: State<'_, Database>,
    channel_id: String,
    member_name: String,
) -> Result<Alarm, String> {
    db.insert_alarm(channel_id, member_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_alarm(
    db: State<'_, Database>,
    alarm_id: i64,
) -> Result<(), String> {
    db.delete_alarm(alarm_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_alarm(
    db: State<'_, Database>,
    alarm_id: i64,
    enabled: bool,
) -> Result<(), String> {
    db.update_alarm_enabled(alarm_id, enabled)
        .await
        .map_err(|e| e.to_string())
}
```

---

## 8. 백그라운드 스케줄러

```rust
// src-tauri/src/scheduler/polling.rs

use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;
use tokio::time::interval;
use crate::api::HolodexClient;
use crate::storage::Database;

pub async fn start_polling(
    app: AppHandle,
    holodex: Arc<HolodexClient>,
    db: Arc<Database>,
) {
    let mut interval = interval(Duration::from_secs(60)); // 1분마다 폴링

    loop {
        interval.tick().await;

        if let Err(e) = check_and_notify(&app, &holodex, &db).await {
            tracing::error!("Polling error: {}", e);
        }
    }
}

async fn check_and_notify(
    app: &AppHandle,
    holodex: &HolodexClient,
    db: &Database,
) -> Result<(), Box<dyn std::error::Error>> {
    // 1. 활성화된 알람 조회
    let alarms = db.get_enabled_alarms().await?;
    if alarms.is_empty() {
        return Ok(());
    }

    let alarm_channels: std::collections::HashSet<_> =
        alarms.iter().map(|a| a.channel_id.as_str()).collect();

    // 2. 라이브 + 예정 스트림 조회
    let live_streams = holodex.get_live_streams().await.unwrap_or_default();
    let upcoming_streams = holodex.get_upcoming_streams(1).await.unwrap_or_default(); // 1시간 이내

    // 3. 알람 대상 스트림 필터링
    for stream in live_streams.iter().chain(upcoming_streams.iter()) {
        if !alarm_channels.contains(stream.channel_id.as_str()) {
            continue;
        }

        // 4. 중복 알림 체크
        if db.was_notified(&stream.id).await? {
            continue;
        }

        // 5. 네이티브 알림 발송
        let title = if stream.is_live() {
            format!("🔴 {} 방송 시작!", stream.channel_name)
        } else {
            let mins = stream.minutes_until_start().unwrap_or(0);
            format!("⏰ {} {}분 후 방송 시작", stream.channel_name, mins)
        };

        app.notification()
            .builder()
            .title(&title)
            .body(&stream.title)
            .show()?;

        // 6. 알림 기록
        db.record_notification(&stream.id).await?;
    }

    Ok(())
}
```

---

## 9. Frontend 구현

### 9.1 Tauri API 래퍼
```typescript
// src/api/tauri.ts

import { invoke } from '@tauri-apps/api/core';

export interface Stream {
  id: string;
  title: string;
  channelId: string;
  channelName: string;
  status: 'live' | 'upcoming' | 'past';
  startScheduled?: string;
  thumbnail?: string;
  channel?: Channel;
}

export interface Channel {
  id: string;
  name: string;
  englishName?: string;
  photo?: string;
  subscriberCount?: number;
}

export interface Member {
  id: number;
  channelId: string;
  name: string;
  nameKo?: string;
  nameJa?: string;
  isGraduated: boolean;
}

export interface Alarm {
  id: number;
  channelId: string;
  memberName: string;
  enabled: boolean;
  createdAt: string;
}

// 스트림 API
export const streamApi = {
  getLive: () => invoke<Stream[]>('get_live_streams'),
  getUpcoming: (hours?: number) => invoke<Stream[]>('get_upcoming_streams', { hours }),
};

// 멤버 API
export const memberApi = {
  getAll: () => invoke<Member[]>('get_members'),
  search: (query: string) => invoke<Member[]>('search_members', { query }),
};

// 알람 API
export const alarmApi = {
  getAll: () => invoke<Alarm[]>('get_alarms'),
  add: (channelId: string, memberName: string) =>
    invoke<Alarm>('add_alarm', { channelId, memberName }),
  remove: (alarmId: number) => invoke<void>('remove_alarm', { alarmId }),
  toggle: (alarmId: number, enabled: boolean) =>
    invoke<void>('toggle_alarm', { alarmId, enabled }),
};
```

### 9.2 Dashboard 페이지
```tsx
// src/pages/Dashboard.tsx

import { useQuery } from '@tanstack/react-query';
import { streamApi } from '../api/tauri';
import { StreamCard } from '../components/streams/StreamCard';
import { Skeleton } from '../components/ui/Skeleton';

export function Dashboard() {
  const { data: liveStreams, isLoading: liveLoading } = useQuery({
    queryKey: ['streams', 'live'],
    queryFn: streamApi.getLive,
    refetchInterval: 30_000, // 30초마다 갱신
  });

  const { data: upcomingStreams, isLoading: upcomingLoading } = useQuery({
    queryKey: ['streams', 'upcoming'],
    queryFn: () => streamApi.getUpcoming(24),
    refetchInterval: 60_000, // 1분마다 갱신
  });

  return (
    <div className="space-y-8 p-6">
      {/* 라이브 스트림 */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          라이브 중
        </h2>

        {liveLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : liveStreams?.length === 0 ? (
          <p className="text-muted-foreground">현재 진행 중인 방송이 없습니다</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveStreams?.map((stream) => (
              <StreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        )}
      </section>

      {/* 예정 스트림 */}
      <section>
        <h2 className="text-xl font-bold mb-4">📅 예정된 방송 (24시간)</h2>

        {upcomingLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : upcomingStreams?.length === 0 ? (
          <p className="text-muted-foreground">예정된 방송이 없습니다</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingStreams?.map((stream) => (
              <StreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

---

## 10. 구현 일정

### Phase 1: 프로젝트 초기화 (1일)
- [ ] Tauri v2 프로젝트 생성 (React + TypeScript + Vite)
- [ ] 플러그인 설치 (notification, sql, store)
- [ ] TailwindCSS v4 설정 (admin-dashboard 스타일 복사)
- [ ] 기본 레이아웃 구성

### Phase 2: Rust 백엔드 (2-3일)
- [ ] 데이터 모델 구현 (Stream, Channel, Member, Alarm)
- [ ] Holodex API 클라이언트 구현
- [ ] SQLite 스토리지 구현
- [ ] IPC 커맨드 등록

### Phase 3: Frontend UI (2일)
- [ ] UI 컴포넌트 구현 (Card, Button, Input 등)
- [ ] Dashboard 페이지 구현
- [ ] Members 페이지 구현
- [ ] Alarms 페이지 구현
- [ ] Settings 페이지 구현

### Phase 4: 알림 시스템 (1일)
- [ ] 백그라운드 폴링 스케줄러 구현
- [ ] 네이티브 알림 연동
- [ ] 중복 알림 방지 로직

### Phase 5: 마무리 (1일)
- [ ] 에러 핸들링 개선
- [ ] 로딩/에러 상태 UI
- [ ] 앱 아이콘 및 스플래시 스크린
- [ ] 빌드 및 패키징 테스트

---

## 11. 환경 설정

### 11.1 Holodex API 키
```bash
# .env (개발용)
HOLODEX_API_KEY=your_api_key_here
```

### 11.2 Tauri 설정
```json
// src-tauri/tauri.conf.json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Hololive Stream Notifier",
  "identifier": "com.kapu.hololive-app",
  "version": "0.1.0",
  "build": {
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Hololive Stream Notifier",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["deb", "appimage", "msi"],
    "icon": ["icons/icon.png"]
  }
}
```

---

## 12. 참고 자료

- [Tauri v2 공식 문서](https://v2.tauri.app/)
- [Holodex API 문서](https://docs.holodex.net//)
- 기존 Go 구현: `/home/kapu/gemini/llm/hololive-kakao-bot-go/`
- 프론트엔드 스타일: `/home/kapu/gemini/llm/admin-dashboard/frontend/`
