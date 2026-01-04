# Hololive Stream Notifier

[![Tauri](https://img.shields.io/badge/Tauri-2.x-blue?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-1.91+-orange?logo=rust)](https://www.rust-lang.org/)
[![License](https://img.shields.io/badge/License-Private-red)]()

> **홀로라이브 스트림 알림 데스크톱 & 모바일 앱**  
> 실시간 라이브 방송 모니터링과 예정된 스트림 알림을 제공하는 크로스플랫폼 애플리케이션

---

## 목차

- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [설치 방법](#설치-방법)
- [개발 환경 설정](#개발-환경-설정)
- [빌드](#빌드)
- [프로젝트 구조](#프로젝트-구조)
- [라이선스 및 고지](#라이선스-및-고지)

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **실시간 스트림 모니터링** | 라이브 중인 홀로라이브 멤버 방송을 실시간으로 확인 |
| **예정 스트림 알림** | 예정된 방송 시간에 맞춰 시스템 알림 전송 |
| **멤버 디렉토리** | 전체 홀로라이브 멤버 목록 및 프로필 확인 |
| **커스텀 알람 설정** | 관심 멤버/채널별 개별 알림 설정 |
| **다국어 지원** | 한국어, English, 日本語 |
| **다크 모드** | 다크 테마 기본 제공 |
| **크로스플랫폼** | Windows 데스크톱 & Android 지원 |
| **Google 로그인** | OAuth 2.0 기반 Google 계정 연동 |

---

## 기술 스택

### Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| [React](https://react.dev/) | 19 | UI 프레임워크 |
| [Vite](https://vitejs.dev/) | 7 | 빌드 도구 |
| [TypeScript](https://www.typescriptlang.org/) | 5.9 | 타입 안전성 |
| [Tailwind CSS](https://tailwindcss.com/) | 4 | 스타일링 |
| [TanStack Query](https://tanstack.com/query) | 5 | 서버 상태 관리 |
| [Zustand](https://zustand-demo.pmnd.rs/) | 5 | 클라이언트 상태 관리 |
| [React Router](https://reactrouter.com/) | 7 | 라우팅 |
| [Framer Motion](https://www.framer.com/motion/) | 12 | 애니메이션 |
| [React Compiler](https://react.dev/learn/react-compiler) | 1.0 | 자동 최적화 |

### Backend (Tauri)
| 기술 | 버전 | 용도 |
|------|------|------|
| [Tauri](https://tauri.app/) | 2.x | 네이티브 브릿지 |
| [Rust](https://www.rust-lang.org/) | 1.91+ | 백엔드 로직 |
| [SQLite](https://sqlite.org/) | (rusqlite) | 로컬 데이터베이스 |
| [Tokio](https://tokio.rs/) | 1.x | 비동기 런타임 |

### Tauri Plugins
- `tauri-plugin-http` - HTTP 요청
- `tauri-plugin-notification` - 시스템 알림
- `tauri-plugin-opener` - 외부 URL/파일 열기
- `tauri-plugin-store` - 영구 키-값 저장소
- `tauri-plugin-dialog` - 파일 선택 다이얼로그

---

## 설치 방법

### Windows
1. [Releases](https://github.com/your-repo/releases) 페이지에서 최신 `.exe` 다운로드
2. 설치 마법사 실행

### Android
1. [Releases](https://github.com/your-repo/releases) 페이지에서 `.apk` 다운로드
2. 알 수 없는 출처 앱 설치 허용 후 설치

---

## 개발 환경 설정

### 필수 요구사항

| 요구사항 | 버전 | 설치 방법 |
|----------|------|-----------|
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org/) |
| **Rust** | 1.91+ | [rustup.rs](https://rustup.rs/) |
| **Tauri CLI** | 2.x | `npm install -g @tauri-apps/cli` |

### Windows 개발 환경
```powershell
# Microsoft Visual Studio C++ Build Tools 필요
# https://visualstudio.microsoft.com/visual-cpp-build-tools/

# Rust 설치
winget install Rustlang.Rustup

# Node.js 설치
winget install OpenJS.NodeJS.LTS
```

### Android 개발 환경 (선택)
```powershell
# Android Studio 설치 필요
# https://developer.android.com/studio

# 환경 변수 설정
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
```

### 프로젝트 설정

```bash
# 저장소 클론
git clone https://github.com/your-repo/hololive-notifier.git
cd hololive-notifier

# 의존성 설치
npm install

# 환경 변수 설정 (src-tauri/.env)
cp src-tauri/.env.example src-tauri/.env
# .env 파일 편집하여 API 키 설정

# 개발 서버 실행
npm run tauri dev
```

---

## 빌드

### Windows 빌드
```bash
# 프로덕션 빌드 (NSIS 설치 파일)
npm run tauri build

# 출력: src-tauri/target/release/bundle/nsis/
```

### Android 빌드
```bash
# APK 빌드
npm run tauri android build

# 출력: src-tauri/gen/android/app/build/outputs/apk/
```

### Makefile 명령어
```bash
# 린트 검사
make lint

# 전체 빌드
make build

# 개발 서버
make dev
```

---

## 프로젝트 구조

```
hololive-notifier/
|-- src/                       # React 프론트엔드
|   |-- components/            # UI 컴포넌트
|   |-- pages/                 # 페이지 컴포넌트
|   |-- hooks/                 # 커스텀 훅
|   |-- stores/                # Zustand 스토어
|   |-- lib/                   # 유틸리티
|   +-- locales/               # i18n 번역 파일
|
|-- src-tauri/                 # Rust 백엔드
|   |-- src/
|   |   |-- commands/          # Tauri 커맨드
|   |   |-- db/                # SQLite 데이터베이스
|   |   |-- models/            # 데이터 모델
|   |   +-- scheduler/         # 알림 스케줄러
|   |-- icons/                 # 앱 아이콘
|   +-- tauri.conf.json        # Tauri 설정
|
|-- docs/                      # 프로젝트 문서 (중요!)
|   |-- ARCHITECTURE.MD        # 아키텍처 설계
|   |-- IMPLEMENTAION_PLAN.MD  # 구현 계획
|   |-- BOT_FEATURES.MD        # 봇 기능 명세
|   |-- http spec.md           # API 스펙
|   +-- TODO.md                # 할일 목록
|
|-- public/                    # 정적 에셋
|-- .agent/                    # 에이전트 워크플로우
|-- Makefile                   # 빌드 자동화 스크립트
|-- NOTICE.md                  # 법적 고지
+-- package.json               # Node.js 의존성
```

---

## 라이선스 및 고지

### 데이터 제공
이 애플리케이션은 **[Holodex API](https://holodex.net/)** 를 사용하여 스트림 데이터를 제공받습니다.

> **Powered by Holodex**

### 법적 고지
- 이 프로젝트는 Cover Corp. 또는 홀로라이브 프로덕션과 관련이 없습니다.
- 모든 홀로라이브 관련 상표 및 저작물은 해당 소유자의 재산입니다.
- 자세한 내용은 [NOTICE.md](./NOTICE.md)를 참조하세요.

### 라이선스
이 프로젝트는 개인 사용 목적으로 개발되었습니다.

---

## 기여

버그 리포트, 기능 제안, PR을 환영합니다!

1. 이슈 생성
2. 브랜치 생성 (`feature/amazing-feature`)
3. 커밋 (`git commit -m 'Add amazing feature'`)
4. 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 생성

---

<div align="center">

**Made with care for VTuber Fans**

`v0.1.0 Alpha` | 2026

</div>
