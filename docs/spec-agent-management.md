# Agent Management System Spec

> 생성일: 2026-03-15
> 인터뷰 기반 자동 생성

## Background

AgentGrip에서 AI 에이전트를 이슈(Work Item)의 담당자로 할당하려 하면 "저장에 실패했습니다" 에러가 발생한다. 현재 `work_items.assignee_id`는 `profiles` 테이블을 FK로 참조하고 있어, 사람이 아닌 에이전트를 담당자로 저장할 수 없다.

에이전트는 AgentGrip의 핵심 기능으로, Claude/GPT 등 LLM을 사용자의 구독 정보(API 키)로 CLI 세션을 열어 컨텍스트를 전달하고 업무를 수행하는 봇이다. OpenClaw(오픈소스 에이전트 플랫폼)를 런타임으로 활용할 수도 있다.

## Goals

1. **에이전트 엔티티 도입**: DB에 `agents` 테이블을 추가하여 에이전트를 1급 엔티티로 관리
2. **담당자 할당 에러 해결**: `work_items`에 `assignee_agent_id` 필드를 추가하여 에이전트를 담당자로 할당 가능하게 함
3. **에이전트 관리 UI**: 헤더에 에이전트 현황 버튼 추가, `/agents` 전체 페이지에서 CRUD + 상태 + 설정 + 로그 관리
4. **카테고리 분류**: 글로벌 / 내가 생성 / 권한 필요 — 3가지 카테고리로 구분

## Users

- **프로젝트 관리자**: 에이전트를 생성하고 이슈에 할당하는 주체
- **팀원**: 글로벌 에이전트 또는 권한을 부여받은 에이전트를 사용
- **에이전트 자체**: (2차 스코프) 할당된 이슈를 자동으로 처리

## Requirements

### Must Have

- **이슈 프로젝트 상태 워크플로우 문서화**
  - issue 타입 프로젝트의 기본 상태는 `Open → Todo → In Progress → Issue → Resolved → Closed`
  - `Open`: 계획 단계에서 오케스트레이터가 생성
  - `Todo`: 에이전트가 할당됨
  - `In Progress`: 에이전트가 작업 시작
  - `Issue`: 진행 중 문제/블로커 발생
  - `Resolved`: 에이전트가 작업 완료로 판단
  - `Closed`: 오케스트레이터가 점검 후 최종 완료 처리
  - 상세 운영 규칙은 `docs/spec-agent-issue-workflow.md`에 기록

- **AgentGrip / RalphGrip E2E 실행 원칙 문서화**
  - 프로젝트 생성 → 태스크 구조화 → 에이전트 스폰 → 작업 할당 → 실제 작업 수행 → 검수 → 최종 산출물 완성까지 전체 흐름을 지원해야 함
  - 대표 시나리오는 **영상 제작 프로젝트를 생성하고 최종 영상까지 만드는 E2E 운영**

- **`agents` 테이블 생성**
  - `id` (UUID, PK)
  - `name` (TEXT, NOT NULL) — 에이전트 이름
  - `llm_provider` (TEXT, NOT NULL) — 사용할 LLM (claude, gpt, etc.)
  - `environment` (TEXT, NOT NULL) — 실행 환경 (local, worktree, vm)
  - `api_key_encrypted` (TEXT) — AES 암호화된 API 키/구독 정보
  - `category` (TEXT, NOT NULL) — global, owned, restricted
  - `status` (TEXT) — online, offline, busy, error
  - `owner_id` (UUID, FK → profiles.id) — 생성자
  - `vm_connection_info` (JSONB) — VM 연결 정보 (환경이 vm일 때)
  - `openclaw_config` (JSONB) — OpenClaw 설정 (사용 시)
  - `created_at`, `updated_at`

- **`agent_permissions` 테이블 생성** (restricted 카테고리용)
  - `agent_id` (FK → agents.id)
  - `user_id` (FK → profiles.id)
  - `granted_by` (FK → profiles.id)
  - `granted_at`

- **`agent_logs` 테이블 생성**
  - `id`, `agent_id`, `action`, `details` (JSONB), `created_at`

- **`work_items` 테이블 수정**
  - `assignee_agent_id` (UUID, FK → agents.id, NULLABLE) 필드 추가
  - 기존 `assignee_id`(사람)와 공존 — 둘 중 하나만 설정 가능 (CHECK constraint)

- **헤더에 에이전트 현황 버튼 추가**
  - 알람 버튼 왼쪽에 배치
  - 클릭 시 `/agents` 페이지로 이동
  - 활성 에이전트 수 배지 표시

- **`/agents` 페이지**
  - 에이전트 목록 (카테고리별 필터)
  - 에이전트 상태 표시 (online/offline/busy/error)
  - 에이전트 생성 폼 (이름, LLM, 환경, 구독 정보)
  - 에이전트 설정 편집
  - 실행 로그 조회
  - VM 연결 설정 UI
  - OpenClaw 설치 가이드/버튼

- **담당자 드롭다운 수정**
  - 기존 사람 목록에 에이전트 목록 추가 (구분선/그룹으로 분리)
  - 에이전트 선택 시 `assignee_agent_id`에 저장

- **RLS 정책**
  - 글로벌 에이전트: 모든 인증된 사용자 조회 가능
  - 내가 생성한 에이전트: owner_id = auth.uid()
  - 권한 필요 에이전트: agent_permissions에 등록된 사용자만

### Nice to Have

- 에이전트 아바타/아이콘 커스터마이징
- 에이전트 활동 통계 대시보드
- API 사용량/비용 추적
- 에이전트 템플릿 (사전 설정된 에이전트 프리셋)
- 에이전트에 할당된 작업 목록 뷰

### Not Doing (이번 스코프에서 제외)

- **자동 실행**: 에이전트에게 이슈 할당 시 실제 CLI 세션을 열어 작업 수행 → 2차
- **에이전트 마켓플레이스**: 외부 에이전트 스토어
- **에이전트 간 협업**: 여러 에이전트가 하나의 이슈를 함께 처리
- **과금 시스템**: 에이전트 사용량 기반 과금

## Technical Constraints

- **DB**: Supabase (PostgreSQL) — 기존 마이그레이션 체계 따름
- **API 키 보안**: AES 암호화 저장 (pgcrypto 확장 또는 앱 레벨 암호화)
- **FK 구조**: `work_items.assignee_agent_id` → `agents.id` (별도 필드, 기존 assignee_id와 공존)
- **CHECK 제약**: `assignee_id`와 `assignee_agent_id` 중 최대 하나만 NOT NULL
- **프론트엔드**: Next.js 16, shadcn/ui, framer-motion 패턴 준수
- **실행 환경 종류**: 로컬(VM 없음), Worktree(git worktree 격리), VM(외부 서버 연결)
- **OpenClaw**: `curl -fsSL https://openclaw.ai/install.sh | bash`로 VM에 설치

## Open Questions

1. API 키 암호화를 pgcrypto(DB 레벨)로 할지, 앱 레벨(Node.js crypto)로 할지?
2. 에이전트 상태(online/offline 등)를 어떻게 실시간 감지할지? (heartbeat? webhook?)
3. OpenClaw 설치를 AgentGrip UI에서 원클릭으로 할 수 있는지, 아니면 가이드만 제공할지?
4. VM 연결 시 SSH 키 관리 방식?
5. `assignee_agent_id` 추가 시 기존 담당자 관련 쿼리/뷰(칸반, 리스트, 타임라인, My Work)에 미치는 영향 범위?

## Key Decisions

| 결정 사항 | 선택 | 이유 |
|-----------|------|------|
| 에이전트 정체 | LLM CLI 봇 + OpenClaw | 사용자 구독으로 CLI 세션 열어 작업 수행 |
| 카테고리 | 글로벌/소유/제한 3가지 | 단순하면서 필요한 구분 충족 |
| 실행 환경 | 로컬/Worktree/VM | 격리 수준별 3가지 선택지 |
| DB 설계 | 별도 agent_id 필드 | profiles에 가상 사용자 넣는 것보다 깔끔 |
| API 키 보안 | 암호화 저장 | MVP부터 보안 기본 적용 |
| UI 진입점 | 헤더 버튼 → /agents 페이지 | 핵심 기능이므로 헤더에 상시 노출 |
| /agents 페이지 정보 | 상태 + 설정 + 로그 | 비용 추적은 나중에 |
| MVP 범위 | 관리/추적만 | 자동 실행은 2차 |
