# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**RalphGrip**는 AI 기반 프로젝트 관리 도구로, Jira의 구조화된 관리와 AI 기능을 결합한다.

핵심 특징:
- 자유로운 작업 계층 구조 (parent_id 기반)
- 프로젝트 타입별 워크플로우 (요구사항 / 이슈)
- 칸반/리스트/타임라인/그래프/Mine 뷰 지원
- 크로스 프로젝트 추적성 매트릭스 (의존성 그래프)
- Slack, Google Drive 연동
- 코드비머 ALM 스타일의 UI

## 설계 철학

### 1. codebeamer ALM 스타일 UI

**3컬럼 레이아웃**:
- **왼쪽 트리 패널** (272px): 작업 항목의 계층 구조
- **중앙 문서 뷰**: 선택된 항목의 상세 내용 (마크다운 지원)
- **오른쪽 속성 패널**: 메타데이터 편집 (상태, 담당자, 기한 등)

**헤더 네비게이션**: 사이드바 대신 헤더에 네비게이션 배치 (My Work, Projects, Settings)

### 2. 프로젝트 타입별 워크플로우

프로젝트 생성 시 타입을 선택한다 (`projects.project_type`):

**요구사항 프로젝트** (`requirement`):
- 트래커: `Folder` + `요구사항`
- 상태: Draft(#94a3b8) → New(#3b82f6) → Verified(#22c55e) → Confirmed(#64748b)

**이슈 프로젝트** (`issue`):
- 트래커: `Folder` + `Issue`
- 상태: Open(#94a3b8) → Todo(#64748b) → In Progress(#3b82f6) → Issue(#f59e0b) → Resolved(#22c55e) → Closed(#475569)

**이슈 프로젝트 상태 의미**:
- `Open`: 오케스트레이터가 계획 단계에서 생성한 상태
- `Todo`: 에이전트가 할당된 상태
- `In Progress`: 에이전트가 실제 작업을 시작한 상태
- `Issue`: 진행 중 문제/블로커가 발생한 상태
- `Resolved`: 에이전트가 작업 완료로 판단한 상태
- `Closed`: 오케스트레이터가 점검 후 최종 완료한 상태

**RalphGrip E2E 원칙**:
- RalphGrip은 프로젝트 생성부터 최종 산출물 완료까지 전체 실행 흐름을 다룬다.
- 대표 시나리오는 영상 제작 프로젝트를 만들고, AI 에이전트를 스폰/할당해 실제 작업을 수행시켜 최종 영상을 완성하는 것이다.
- 즉, 단순 관리 툴이 아니라 오케스트레이터와 에이전트가 실제로 일하는 실행형 시스템을 지향한다.

**핵심 원칙**:
- 프로젝트 타입은 생성 후 변경 불가
- 트래커는 `Folder` + 타입별 1개로 단순화 (DB 트리거가 자동 생성)
- Folder는 별도 엔티티가 아니라 트래커 타입 중 하나
- 모든 트래커 타입은 동일한 `work_items` 테이블 사용
- 계층 구조는 `parent_id`로 관리 (트래커 타입과 무관하게 자유롭게 중첩 가능)

### 3. 트리 구조 원칙

**트리는 작업 항목의 실제 계층을 반영한다**:
- 트래커 타입별 그룹핑 없음 (Feature, Bug 등으로 묶지 않음)
- parent_id가 null인 항목 = 최상위 (루트)
- parent_id가 있는 항목 = 부모 아래에 표시
- position 필드로 같은 레벨 내 순서 결정

### 4. 드래그 앤 드롭 규칙

**드롭 위치 인디케이터**:
- **줄(Line)**: 항목의 상단 15% 또는 하단 15% → 앞/뒤에 삽입
- **박스(Box)**: 항목의 중앙 70% → 해당 항목의 하위로 이동

**지원 기능**: 순서 변경, 계층 변경, 최상위로 이동, 복사 (컨텍스트 메뉴)

### 5. 컨텍스트 메뉴 액션

모든 작업 항목에서 우클릭 또는 ... 버튼으로 접근:
- 하위 폴더 추가 / 하위 아이템 추가
- 최상위로 이동 (하위 항목만 표시)
- 복사 / 삭제

## 개발 명령어

```bash
pnpm dev          # 개발 서버 (http://localhost:3000)
pnpm build        # 프로덕션 빌드 (prebuild: 한글 폰트 다운로드)
pnpm start        # 프로덕션 서버
pnpm lint         # ESLint 검사
```

## 기술 스택

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Styling**: Tailwind CSS 4 + shadcn/ui (radix-ui)
- **Animation**: framer-motion 11 (공통 variants: `src/lib/motion.ts`)
- **Rich Text**: TipTap 3 (멘션 에디터), @uiw/react-md-editor (설명 편집)
- **Drag-and-Drop**: @dnd-kit
- **Charts**: Recharts 3 (프로젝트 Overview)
- **Date Utilities**: date-fns 4.1.0 (타임라인 날짜 계산, 로케일 한국어)
- **Virtualization**: @tanstack/react-virtual 3.13 (타임라인 대량 항목 가상화)
- **Command Palette**: cmdk 1 (Cmd+K 글로벌 검색)
- **PDF**: jsPDF 4 (한글 폰트 지원 PDF 내보내기)
- **Google**: googleapis (Drive API), Google Identity Services (OAuth)
- **Package Manager**: pnpm

## 아키텍처

### 디렉토리 구조

```
src/
├── app/
│   ├── (auth)/login/                # 로그인 (Google OAuth)
│   ├── (dashboard)/
│   │   ├── actions.ts               # 글로벌 검색 Server Action
│   │   ├── my-work/                 # 개인 작업 통합 뷰
│   │   │   ├── page.tsx             # 내 작업/멘션/고정 항목 조회
│   │   │   └── actions.ts           # 핀 토글, 날짜/상태 변경
│   │   ├── projects/
│   │   │   ├── actions.ts           # 프로젝트 CRUD
│   │   │   └── [key]/
│   │   │       ├── page.tsx         # Overview 리다이렉트
│   │   │       ├── alm/page.tsx     # ALM 뷰 (?view=kanban|list|graph|timeline)
│   │   │       ├── resources/page.tsx # 리소스 (Drive + 외부링크)
│   │   │       ├── actions.ts       # Work Item CRUD + 링크 + 설정
│   │   │       ├── export-actions.ts # CSV/Sheets/PDF 내보내기
│   │   │       └── settings/        # 프로젝트 설정 (6개 섹션)
│   │   ├── settings/                # 전체 설정 (Profile, Appearance, Account, Admin, Activity)
│   │   └── design-system/           # 디자인 토큰 쇼케이스
│   ├── api/
│   │   ├── auth/reauth/             # Google OAuth 재인증 (Drive 스코프)
│   │   ├── drive/files/             # Google Drive 파일 조회
│   │   ├── slack/interactions/      # Slack Interactive Components
│   │   └── work-items/              # 작업 항목 API (외부 통합용)
│   └── auth/callback/               # OAuth 콜백
├── components/
│   ├── ui/                          # shadcn/ui + animated-* (framer-motion)
│   ├── layout/                      # header, sidebar, user-menu
│   ├── command-palette.tsx          # Cmd+K 글로벌 검색
│   ├── my-work/                     # My Work 뷰 (리스트, 칸반, 타임라인, 필터, 통계)
│   └── projects/
│       ├── alm-layout.tsx           # 3단 레이아웃 (트리|문서|속성)
│       ├── alm-tree-panel*.tsx      # 트리 패널 (dnd-kit, 동적로드)
│       ├── alm-document-view.tsx    # 문서 뷰 (마크다운)
│       ├── alm-property-panel.tsx   # 속성 패널
│       ├── kanban-view.tsx          # 칸반보드
│       ├── list-view.tsx            # 리스트뷰
│       ├── graph-view.tsx           # 추적성 매트릭스 (SVG 레인 그래프)
│       ├── dependency-section.tsx   # 의존성 관리 (depends_on/blocks)
│       ├── timeline-*.tsx           # 타임라인/간트차트 (6개 파일)
│       ├── comments-section.tsx     # 댓글 (이미지 첨부, 멘션)
│       ├── mention-textarea.tsx     # TipTap 멘션 에디터
│       ├── overview/                # 프로젝트 대시보드 (차트, 통계, 활동)
│       ├── drive-file-list.tsx      # Google Drive 파일 브라우저
│       ├── external-links-list.tsx  # 외부 링크 목록
│       └── project-graph-view.tsx   # 크로스 프로젝트 관계 그래프
├── hooks/
│   ├── use-alm-selection.ts         # 다중 선택 (Cmd/Shift+클릭)
│   ├── use-google-token.ts          # GIS OAuth 토큰 요청
│   ├── use-realtime-work-items.ts   # 작업 항목 실시간 동기화
│   ├── use-realtime-links.ts        # 링크 카운트 실시간 동기화
│   ├── use-realtime-linked-issue-status.ts
│   ├── use-theme.tsx                # 테마 Provider
│   ├── use-timeline-state.ts        # 타임라인 줌/날짜-픽셀 변환
│   └── use-work-item-filters.ts     # 필터링 (상태, 담당자, 계층)
├── lib/
│   ├── motion.ts                    # framer-motion 공통 easing/variants
│   ├── csv-export.ts                # CSV 내보내기 (RFC 4180)
│   ├── gsheet-export.ts             # Google Sheets 내보내기
│   ├── pdf-export.ts                # PDF 내보내기 (jsPDF, 한글 폰트)
│   ├── export-utils.ts              # 공통 export 헬퍼
│   ├── slack-notify.ts              # Slack 알림 (Block Kit)
│   ├── external-link-utils.ts       # 외부 링크 도메인 감지
│   ├── edge-utils.ts                # 그래프 엣지 SVG path
│   ├── track-event.ts               # 유저 행동 이벤트 추적
│   ├── client-actions.ts            # 클라이언트 전용 액션
│   └── supabase/
│       ├── client.ts                # 브라우저용
│       ├── server.ts                # 서버용
│       ├── service.ts               # Service Role (RLS 우회)
│       ├── cached-queries.ts        # React.cache() 서버 쿼리
│       └── upload-image.ts          # 이미지 업로드 (Storage)
├── types/
│   ├── supabase.ts                  # Supabase 자동 생성 타입 (단일 원천)
│   ├── database.ts                  # 앱 레벨 타입 (supabase.ts에서 파생)
│   ├── domain.ts                    # 도메인 엔티티 (User, WorkItemDetail 등)
│   └── components.ts               # 컴포넌트 Props 타입
└── middleware.ts                    # 인증 라우팅
```

### 핵심 도메인 모델

```
Project
└── Work Item (tracker_id로 유형 구분)
    └── Work Item (parent_id 기반 무제한 계층)
        └── Work Item ...

Work Item Link (추적성)
  - depends_on / blocks 관계 (크로스 프로젝트 지원)
  - suspect 플래그 (소스/타겟 변경 시 자동 설정)
```

**타입 계층**:
- `src/types/supabase.ts` — Supabase CLI 자동 생성 (단일 원천)
- `src/types/database.ts` — 앱 레벨 타입 (`WorkItemWithRelations`, `ProjectSettings`, `MatrixLink` 등)
- `src/types/domain.ts` — 도메인 엔티티 (`WorkItemDetail`, `CommentDetail` 등)
- `src/types/components.ts` — 컴포넌트 Props 타입

**ProjectSettings** (JSONB):
- `show_tracker_id`, `show_tracker_id_in_document` — 트래커 ID 표시 제어
- `auto_insert_date` — 설명 편집 시 날짜 자동 삽입
- `slack_channel_id` — Slack 연동 채널
- `google_drive_url` — Google Drive 연동 폴더 URL
- `external_links` — 프로젝트 외부 링크 목록

### 데이터베이스 (Supabase)

핵심 테이블: `profiles`, `projects`, `project_members`, `trackers`, `statuses`, `work_items`, `work_item_links`, `comments`, `work_item_audit_logs`, `project_audit_logs`, `user_pinned_items`, `user_events`

마이그레이션 파일: `supabase/migrations/001_*.sql` ~ `028_*.sql`
- `projects.settings` JSONB 컬럼은 Supabase MCP로 적용됨 (별도 마이그레이션 파일 없음)

### 인증 플로우

1. `/login` → Google OAuth → Supabase Auth
2. `/auth/callback` → 세션 생성
3. `middleware.ts`가 보호된 라우트 접근 제어
4. 최초 로그인 시 `profiles` 테이블에 자동 생성 (DB 트리거)
5. Google Drive 연동 시 `/api/auth/reauth`로 추가 스코프 요청

### 데이터 패턴

- **조회**: Server Component에서 `createClient()` (from `@/lib/supabase/server`)
- **변경**: Server Actions (`'use server'` + `revalidatePath`)
- **Service Role**: `getServiceClient()` (from `@/lib/supabase/service`) — RLS 우회 필요 시
- **캐싱**: `React.cache()` (요청 내 중복 방지) + `unstable_cache` (TTL 캐시)
- **실시간**: Supabase Realtime 구독 (`use-realtime-*.ts` hooks)
- **이벤트 추적**: `trackEvent()` — fire-and-forget으로 `user_events` 테이블 저장

### URL 라우팅: Key vs. UUID

```
URL: /projects/WRV       ← 사용자가 보는 URL (프로젝트 key)
내부: project.id (UUID)   ← DB, Server Actions는 UUID 사용
```

- `[key]/page.tsx`에서 `getProjectByKey(key)` 호출 → `project.id` (UUID) 추출
- 모든 하위 컴포넌트/Server Actions에 `projectId` (UUID) 전달
- `revalidateProject(projectId)` 헬퍼가 key를 조회하여 `revalidatePath` 처리

### Server Actions 위치

- `src/app/(dashboard)/actions.ts` — 글로벌 검색
- `src/app/(dashboard)/projects/actions.ts` — 프로젝트 CRUD
- `src/app/(dashboard)/projects/[key]/actions.ts` — Work Item CRUD, 링크 관리, 댓글, 프로젝트 설정, Slack 연동
- `src/app/(dashboard)/projects/[key]/export-actions.ts` — CSV/Sheets/PDF 내보내기
- `src/app/(dashboard)/my-work/actions.ts` — 핀 토글, 날짜/상태 변경
- `src/app/(dashboard)/settings/actions.ts` — 프로필/계정 설정
- `src/app/(dashboard)/settings/admin-actions.ts` — 관리자 전용 액션

**권한 패턴**: `requireWriteAccess(projectId)` — 멤버십 + viewer 제외 검증

### UI 패턴: ALM 레이아웃

코드비머 ALM 스타일의 3단 레이아웃:
- **왼쪽 (272px)**: 트리 패널 - parent_id 기반 계층, Cmd/Shift+클릭 다중 선택
- **중앙**: 문서 뷰 - 제목, 설명(마크다운), 하위 항목, 댓글, 의존성 섹션
- **오른쪽**: 속성 패널 - 메타데이터 편집

### UI 패턴: 타임라인 뷰

간트차트 스타일. 자체 구현 (외부 간트 라이브러리 미사용).

**레이아웃**: CSS Grid 4분면 (`gridTemplateColumns: 250px + totalWidth`)
- Q1 (좌상단): 코너, `sticky top+left, z-30`
- Q2 (우상단): 2단 시간축 헤더, `sticky top, z-20`
- Q3 (좌하단): 항목 라벨, `sticky left, z-10`
- Q4 (우하단): 간트 바 + 배경 그리드 (스크롤 영역)

**핵심 기능**: 3단 줌 (Day/Week/Month), 가상화, 바 드래그 (Pointer Events + setPointerCapture), 미배정 섹션, 속성 오버레이

### UI 패턴: 추적성 매트릭스 (그래프 뷰)

작업 항목 간 의존성(depends_on/blocks) 시각화:
- SVG 기반 레인 레이아웃
- suspect 링크 표시 (소스/타겟 변경 시 자동 설정)
- 크로스 프로젝트 지원 (`project-graph-view.tsx`)
- 타입: `TraceabilityMatrixData`, `MatrixWorkItem`, `MatrixLink`

### UI 패턴: 프로젝트 Overview

Recharts 기반 프로젝트 대시보드 (`components/projects/overview/`):
- 통계 카드 (전체/진행중/완료/지연)
- 상태 분포, 번다운, 팀원 작업량, 활동 추이 차트
- 최근 활동 목록, 연관 프로젝트 섹션

### UI 패턴: My Work

프로젝트 전체에서 나에게 관련된 작업 통합 뷰 (`/my-work`):
- 리스트/칸반/타임라인 뷰 지원
- 필터: 프로젝트, 상태, 마감일, 역할(담당자/보고자/생성자)
- 통계 카드, 고정 항목, 멘션 댓글 목록

### UI 패턴: 커맨드 팔레트

Cmd+K로 글로벌 검색 (`command-palette.tsx`, cmdk 라이브러리):
- 프로젝트/작업 항목 전역 검색
- 테마 전환, 설정 바로가기

## 성능 최적화

### react-resizable-panels v4.5.9 주의사항

크기 prop은 **반드시 문자열 `"%"`로 전달**해야 한다. 숫자를 전달하면 `px`로 해석됨.

```typescript
// 올바른 방식
<ResizablePanel defaultSize="25%" minSize="15%" maxSize="40%">
```

기타 API 차이:
- `orientation` prop 사용 (`direction` 아님)
- `panelRef` prop으로 imperative handle 전달
- `PanelImperativeHandle` 타입
- `onResize` 콜백에서 `size.asPercentage > 0` 체크 (onCollapse/onExpand 미지원)

### 번들 최적화

**lucide-react 직접 임포트**:
```typescript
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
```

**동적 로딩**: dnd-kit 등 무거운 라이브러리는 `next/dynamic`으로 지연 로드

### 서버 성능

**React.cache()**: 동일 요청 내 중복 쿼리 방지 (`cached-queries.ts`)
**unstable_cache**: TTL 기반 캐시 (프로젝트 key lookup 등)
**Promise.all 병렬화**: 독립적 비동기 작업은 병렬 실행

### 데이터베이스 성능

**인덱싱 원칙**:
- FK 인덱스: 모든 Foreign Key 컬럼에 인덱스 (Postgres 자동 생성 안 함)
- Partial Index: NULL 허용 FK는 `WHERE column IS NOT NULL` 조건
- Composite Index: 등호 컬럼 먼저, 범위 컬럼 나중

**RLS**: `(select auth.uid())` 패턴으로 함수 호출 최소화

### 애니메이션 가이드

공통 motion 설정은 `src/lib/motion.ts`에 정의:
- `EASING`, `DURATION`, `TRANSITION` — 일관된 타이밍
- `cardVariants`, `listItemVariants`, `pageVariants` — 재사용 가능한 variants
- animated-* UI 컴포넌트: `AnimatedButton`, `AnimatedCard`, `AnimatedList`, `AnimatedAccordion`

### date-fns v4 주의

`.filter(isWeekend)` 불가 → `.filter((d) => isWeekend(d))` 사용 (옵션 파라미터 추가됨)

## Work Item Description 작성 가이드라인

프로젝트 타입에 따라 작성 스타일이 다르다.

### 이슈 프로젝트: 러닝 로그 스타일

**날짜 기반 시간순 업무 일지**로 작성:
- 날짜: `**YYYY.MM.DD**` 볼드 형식
- 인물 명시, 회의는 `@미팅명`
- 배경/현상은 맨 위, 진행사항은 날짜순 추가
- 종료 시 `이슈 종료 처리`

```markdown
배경 : 이슈의 배경이나 현상을 간략히 기술

**2026.02.03** 서인근, 최정섭 @TYM 데일리 미팅
논의 내용이나 결정사항
- 세부 사항은 불릿으로

**2026.02.09** 서인근
최종 결론
이슈 종료 처리
```

### 요구사항 프로젝트: 구조화된 마크다운

`##` 헤딩 기반 (개요, 요구사항, 핵심 기술, 완료 조건)

### 공통 원칙

- `-` 불릿 리스트 사용 (줄바꿈만으로 구분 금지)
- 중요 키워드는 `**볼드**`
- plain text 금지 (마크다운 문법 사용)

## 참고 문서

- `PRD.md`: 상세 제품 요구사항 (기능 명세, 데이터 모델, 마일스톤)
- `REQUIREMENTS.md`: 원본 요구사항

## 배포

### 인프라

- **GCP 프로젝트**: `madspeed-ikseo`
- **VM**: `ralphgrip` (asia-northeast3-a, e2-standard-2, Ubuntu 22.04)
- **외부 IP**: `34.64.251.84` (고정 IP)
- **GitHub 레포**: `kubony/ralphgrip`
- **앱 경로**: `/home/inkeun/ralphgrip`
- **프로세스**: PM2 (`ralphgrip` 포트 3000, `ralphgrip-mcp` 포트 3001)
- **리버스 프록시**: nginx (80 → 3000, /mcp → 3001)

### 배포 명령어

```bash
# 원커맨드 배포
gcloud compute ssh ralphgrip --zone=asia-northeast3-a --project=madspeed-ikseo --command="
  sudo -u inkeun bash -c '
    cd /home/inkeun/ralphgrip && \
    git pull && \
    pnpm install --frozen-lockfile && \
    NODE_OPTIONS=\"--max-old-space-size=4096\" pnpm build && \
    cd mcp-server && npx tsc && cd .. && \
    pm2 restart all
  '
"
```

### PM2 관리

```bash
# VM SSH 접속 후 (sudo -u inkeun 필요)
pm2 list                        # 프로세스 상태
pm2 logs ralphgrip --lines 20   # 웹 로그
pm2 logs ralphgrip-mcp          # MCP 서버 로그
pm2 restart all                 # 전체 재시작
```

### 빌드 주의사항

- e2-standard-2 (8GB RAM)에서 TypeScript 체크 시 OOM 발생 가능
- 반드시 `NODE_OPTIONS='--max-old-space-size=4096'` 설정 필요
- PM2 설정이 저장되어 있으므로 VM 재부팅 시 자동 시작됨
- SSH 유저가 `seo_repact_ai_kr`이므로 `sudo -u inkeun` 필요

### CI

GitHub Actions (`.github/workflows/ci.yml`): push/PR 시 lint + typecheck + test + build 검증

## 환경 변수

`.env.local`에 설정:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` — 프로덕션: `http://34.64.251.84`, 개발: `http://localhost:3000`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `INTERNAL_API_KEY`
