# Hololive API 명세서

> **Base URL**: `https://api.capu.blog`  
> **Version**: 2.0.2  
> **인증 방식**: API Key (Header)

---

## 🔐 인증 (Authentication)

모든 `/api/holo/*` 엔드포인트는 API Key 인증이 필요합니다.

### 요청 헤더

```http
X-API-Key: YOUR_SECRET_KEY
```

### 예시 (JavaScript/TypeScript)

```javascript
const API_BASE = 'https://api.capu.blog';
const API_KEY = 'w3bAhMIQR8JrHVkGq4kIOaGj7xhVQ+Xdvohy+XjPyeM=';

async function fetchAPI(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  return response.json();
}

// 사용 예시
const streams = await fetchAPI('/api/holo/streams/live');
```

### 예시 (cURL)

```bash
curl -H "X-API-Key: YOUR_SECRET_KEY" https://api.capu.blog/api/holo/streams/live
```

### 에러 응답

| Status | 설명 |
|--------|------|
| 401 Unauthorized | API Key 누락 |
| 403 Forbidden | 잘못된 API Key |

```json
{
  "error": "unauthorized",
  "message": "API key required"
}
```

---

## 📺 스트림 API

### GET /api/holo/streams/live

현재 진행 중인 라이브 스트림 목록을 반환합니다.

**Response**:
```json
{
  "status": "ok",
  "streams": [
    {
      "id": "video_id",
      "title": "방송 제목",
      "channel_id": "UC...",
      "channel_name": "채널명",
      "status": "live",
      "start_scheduled": "2026-01-03T11:00:00Z",
      "start_actual": "2026-01-03T11:02:54Z",
      "duration": 3600,
      "thumbnail": "https://..."
    }
  ]
}
```

### GET /api/holo/streams/upcoming

예정된 스트림 목록을 반환합니다 (24시간 이내).

**Response**: 동일한 스트림 배열 형식

---

## 👤 멤버 API

### GET /api/holo/members

등록된 홀로라이브 멤버 목록을 반환합니다.

**Response**:
```json
{
  "members": [
    {
      "id": 130,
      "channelId": "UC...",
      "name": "AZKi",
      "aliases": {
        "ko": ["아즈키", "아즈짱"],
        "ja": ["AZKi"]
      },
      "nameJa": "AZKi",
      "nameKo": "아즈키",
      "group": "gen0",
      "graduated": false
    }
  ]
}
```

### POST /api/holo/members

새 멤버를 추가합니다.

**Request Body**:
```json
{
  "channelId": "UC...",
  "name": "멤버명",
  "group": "gen0"
}
```

### PATCH /api/holo/members/:id/name

멤버 이름을 수정합니다.

**Request Body**:
```json
{
  "name": "새 이름"
}
```

### PATCH /api/holo/members/:id/graduation

졸업 상태를 변경합니다.

**Request Body**:
```json
{
  "graduated": true
}
```

### POST /api/holo/members/:id/aliases

별칭을 추가합니다.

**Request Body**:
```json
{
  "alias": "새 별칭",
  "lang": "ko"
}
```

### DELETE /api/holo/members/:id/aliases

별칭을 삭제합니다.

**Query Parameters**: `?alias=삭제할별칭&lang=ko`

---

## 📊 통계 API

### GET /api/holo/stats

전체 통계 정보를 반환합니다.

### GET /api/holo/stats/channels

채널별 구독자 통계를 반환합니다.

**Response**:
```json
{
  "channels": [
    {
      "channelId": "UC...",
      "name": "멤버명",
      "subscriberCount": 1500000,
      "viewCount": 500000000
    }
  ]
}
```

---

## 🏆 마일스톤 API

### GET /api/holo/milestones

모든 마일스톤 정보를 반환합니다.

### GET /api/holo/milestones/near

다음 마일스톤에 근접한 멤버 목록을 반환합니다.

**Response**:
```json
{
  "members": [
    {
      "name": "멤버명",
      "currentSubs": 990000,
      "nextMilestone": 1000000,
      "remaining": 10000,
      "progress": 99.0
    }
  ]
}
```

### GET /api/holo/milestones/stats

마일스톤 통계를 반환합니다.

---

## ⏰ 알람 API

### GET /api/holo/alarms

등록된 알람 목록을 반환합니다.

### DELETE /api/holo/alarms

알람을 삭제합니다.

**Query Parameters**: `?channelId=UC...&roomId=123`

---

## 💬 채팅방 관리 API

### GET /api/holo/rooms

허용된 채팅방 목록을 반환합니다.

### POST /api/holo/rooms

채팅방을 추가합니다.

**Request Body**:
```json
{
  "roomId": "123456"
}
```

### DELETE /api/holo/rooms

채팅방을 삭제합니다.

**Query Parameters**: `?roomId=123456`

### POST /api/holo/rooms/acl

ACL 설정을 변경합니다.

**Request Body**:
```json
{
  "enabled": true
}
```

---

## 👤 프로필 API (Tauri 앱 전용)

### GET /api/holo/profiles

멤버 프로필을 조회합니다.

**Query Parameters**: `?channelId=UC...`

### GET /api/holo/profiles/name

이름으로 프로필을 검색합니다.

**Query Parameters**: `?name=아즈키`

---

## ⚙️ 설정 API

### GET /api/holo/settings

현재 설정을 반환합니다.

### POST /api/holo/settings

설정을 업데이트합니다.

**Request Body**:
```json
{
  "key": "setting_name",
  "value": "setting_value"
}
```

---

## 🏥 헬스체크 (인증 불필요)

### GET /health

서버 상태를 반환합니다. **인증 없이 접근 가능합니다.**

**Response**:
```json
{
  "status": "ok",
  "version": "2.0.2",
  "uptime": "6h31m45s",
  "goroutines": 59
}
```

### GET /metrics

Prometheus 메트릭을 반환합니다. **인증 없이 접근 가능합니다.**

---

## 📝 TypeScript 클라이언트 예시

```typescript
const API_BASE = 'https://api.capu.blog';
const API_KEY = 'YOUR_SECRET_KEY';

interface Stream {
  id: string;
  title: string;
  channel_id: string;
  channel_name: string;
  status: 'live' | 'upcoming' | 'past';
  start_scheduled?: string;
  start_actual?: string;
}

interface Member {
  id: number;
  channelId: string;
  name: string;
  nameKo?: string;
  nameJa?: string;
  group?: string;
  graduated?: boolean;
}

class HoloAPI {
  private headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json',
  };

  async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  }

  async post<T>(endpoint: string, body: object): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  }

  // 스트림 API
  getLiveStreams = () => this.get<{status: string; streams: Stream[]}>('/api/holo/streams/live');
  getUpcomingStreams = () => this.get<{status: string; streams: Stream[]}>('/api/holo/streams/upcoming');

  // 멤버 API
  getMembers = () => this.get<{members: Member[]}>('/api/holo/members');

  // 마일스톤 API
  getNearMilestones = () => this.get<{members: any[]}>('/api/holo/milestones/near');
}

// 사용 예시
const api = new HoloAPI();
const { streams } = await api.getLiveStreams();
const { members } = await api.getMembers();
```

---

## ⚠️ 주의사항

1. **API Key는 절대 클라이언트 코드(프론트엔드)에 노출하지 마세요**
2. 브라우저에서 직접 호출하는 경우 백엔드 프록시를 사용하세요
3. 데스크탑 앱(Tauri)에서는 Rust 백엔드에서 호출하세요
4. Rate limiting: 초당 10 요청 제한 (추후 적용 예정)
