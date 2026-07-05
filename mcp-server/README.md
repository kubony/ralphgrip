# @ralphgrip/mcp-server

MCP (Model Context Protocol) server for [RalphGrip](https://github.com/kubony/ralphgrip) — AI 에이전트가 실제로 일하는 실행형 프로젝트 관리 도구.

AI 에이전트(Claude Code, Claude Desktop 등)가 RalphGrip의 프로젝트와 작업 항목을 **조회·생성·수정하고, 진행 상황을 사람에게 실시간으로 보고**할 수 있는 MCP 도구를 제공합니다.

> **이 문서의 목적**: 처음 보는 개발자가 문서만으로 _에이전트 등록 → MCP 연결 → 태스크 조회 → 보고 루프_ 를 끝까지 수행할 수 있게 하는 것.

## 목차

- [빠른 시작 (5분)](#빠른-시작-5분)
- [연결 방법: 원격 vs 로컬](#연결-방법-원격-vs-로컬)
- [.mcp.json 설정과 변수 확장 함정](#mcpjson-설정과-변수-확장-함정)
- [MCP 툴 카탈로그](#mcp-툴-카탈로그)
- [이슈 워크플로우 상태](#이슈-워크플로우-상태)
- [에이전트 보고 3단계 규칙](#에이전트-보고-3단계-규칙)
- [Claude Code 보고 강제 훅 설정](#claude-code-보고-강제-훅-설정)
- [환경 변수](#환경-변수)
- [개발](#개발)
- [아키텍처](#아키텍처)

## 빠른 시작 (5분)

```text
1) 웹 UI에서 에이전트 생성 → API Key(ag_xxx) 발급 (한 번만 표시)
2) API Key를 안전한 곳에 저장  (~/.ralphgrip/api-key 또는 env)
3) MCP 클라이언트(.mcp.json)에 RalphGrip 서버 연결
4) whoami 호출로 정체성/접근 가능 프로젝트 확인
5) list_tasks로 할당된 작업 조회 → report_progress로 보고 루프 시작
```

### 1) 에이전트 생성 + API Key 발급

RalphGrip 웹 UI(https://ralphgrip.com)에서 에이전트를 만들면 API Key가 발급됩니다.

- 헤더의 **에이전트** 버튼 → `/agents` 페이지에서 **에이전트 생성**
  (또는 프로젝트 **Settings → Agents** 에서 프로젝트 전용 에이전트 생성)
- 생성 직후 `ag_`로 시작하는 API Key가 **한 번만** 표시됩니다. 복사 버튼으로 저장하세요.
  > 키는 서버에 SHA-256 해시(`agents.api_key_hash`)로만 저장되므로, 창을 닫으면 다시 볼 수 없습니다. 분실 시 재발급해야 합니다.

**API Key 형식**: `ag_` + 32자리 hex (예: `ag_3f9a2b7c8d1e4056a1b2c3d4e5f60718`)

### 2) 접근 권한 모델

발급된 키가 접근할 수 있는 프로젝트는 에이전트의 `category`로 결정됩니다.

| category | 접근 범위 |
|----------|-----------|
| 프로젝트 전용 (`project_id` 지정) | 해당 프로젝트 1개 |
| `global` / `owned` | 소유자(owner)가 멤버로 있는 모든 프로젝트 |
| `restricted` | `agent_permissions`에 등록된 사용자들의 프로젝트 |

여러 프로젝트에 접근 가능한 에이전트는 대부분의 툴에서 `project_key`를 **명시**해야 합니다(미지정 시 오류). 단일 프로젝트 에이전트는 생략 가능합니다.

## 연결 방법: 원격 vs 로컬

RalphGrip MCP 서버는 두 가지 전송(transport)을 지원합니다.

### A. 원격 (권장) — HTTP transport

프로덕션 서버(`https://ralphgrip.com`)에 붙습니다. 별도 빌드·DB 접속 정보가 필요 없고 API Key만 있으면 됩니다.

- **엔드포인트**: `POST https://ralphgrip.com/mcp` (nginx가 `/mcp` → 내부 포트 3001로 프록시)
- **헬스체크**: `GET https://ralphgrip.com/health`
- **인증 헤더**: `Authorization: Bearer ag_xxx` — **매 세션 첫 요청에 필수**. 없으면 401.
- **전송 규격**: MCP Streamable HTTP. 세션은 응답 헤더 `mcp-session-id`로 유지되며, 이후 요청은 같은 헤더를 재전송합니다.

로컬 MCP 클라이언트에서 원격에 붙을 때는 stdio→HTTP **프록시 모드**를 사용합니다. 이 저장소의 `mcp-server`가 `RALPHGRIP_URL`이 설정된 stdio 실행 시 자동으로 원격 `/mcp`에 `Authorization: Bearer` 헤더를 붙여 프록시합니다.

curl로 직접 확인:

```bash
curl -s https://ralphgrip.com/health
# {"status":"ok","sessions":N,"uptime":...}
```

> HTTP 서버 제한: 세션 최대 50개(TTL 30분), 클라이언트 IP당 60 req/min, CORS 전체 허용.

### B. 로컬 — stdio transport

이 저장소를 클론해 로컬에서 직접 실행합니다. MCP 서버가 **Supabase에 직접 접속**하므로 Service Role Key가 필요합니다(개발/디버깅용).

```bash
pnpm --filter @ralphgrip/mcp-server build   # dist/index.js 생성
# 실행 래퍼:  mcp-server/start-local.sh
```

`start-local.sh`는 다음을 자동 처리합니다.

- 접속 정보: `RALPHGRIP_SUPABASE_URL` / `RALPHGRIP_SERVICE_KEY` env가 없으면 레포 루트 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`를 읽음
- API Key: `RALPHGRIP_API_KEY` env가 없으면 `~/.ralphgrip/api-key` 파일에서 읽음
- 스크립트 위치 기준으로 동작하므로 cwd와 무관

```bash
# API Key를 파일로 공급하는 방법 (권장)
mkdir -p ~/.ralphgrip
printf '%s' 'ag_your_api_key' > ~/.ralphgrip/api-key
chmod 600 ~/.ralphgrip/api-key
```

HTTP 모드로 직접 띄우려면:

```bash
node mcp-server/dist/index.js --transport http --port 3001
#  Endpoint: http://localhost:3001/mcp
#  Health:   http://localhost:3001/health
#  Auth:     Authorization: Bearer ag_xxx (per-session)
```

## .mcp.json 설정과 변수 확장 함정

> ⚠️ **함정**: Claude Code의 `.mcp.json`은 `env` 블록에서 `${VAR}` 변수 확장이 되지 않는 경우가 많습니다. API Key를 `${RALPHGRIP_API_KEY}`처럼 넣으면 리터럴 문자열로 전달돼 인증에 실패할 수 있습니다. 아래 두 방식은 이 문제를 피합니다.

### 방식 1 — 로컬 stdio (이 저장소의 실동작 예시)

이 레포의 `.mcp.json`은 래퍼 스크립트를 호출하고, **키는 파일/env에서** 읽어 변수 확장 문제를 회피합니다.

```json
{
  "mcpServers": {
    "ralphgrip": {
      "command": "bash",
      "args": ["mcp-server/start-local.sh"]
    }
  }
}
```

키는 `~/.ralphgrip/api-key` 파일 또는 셸 env(`RALPHGRIP_API_KEY`)로 공급합니다(위 [로컬 연결](#b-로컬--stdio-transport) 참고). `.mcp.json`에 평문 키를 넣지 않아도 됩니다.

### 방식 2 — 원격 HTTP 프록시 (다른 레포/PC에서 프로덕션에 붙기)

이 저장소 없이는 쓸 수 없습니다(래퍼가 `dist`를 실행). 원격만 필요하면, 키를 `env`에 **평문으로 직접** 적어 변수 확장을 우회합니다.

```json
{
  "mcpServers": {
    "ralphgrip": {
      "command": "node",
      "args": ["/absolute/path/to/ralphgrip/mcp-server/dist/index.js"],
      "env": {
        "RALPHGRIP_URL": "https://ralphgrip.com",
        "RALPHGRIP_API_KEY": "ag_your_api_key"
      }
    }
  }
}
```

`RALPHGRIP_URL`이 설정되면 서버는 프록시 모드로 동작해 `https://ralphgrip.com/mcp`에 `Authorization: Bearer ag_your_api_key`를 붙여 붙습니다. 이 모드에서는 Supabase 접속 정보가 필요 없습니다.

### 참고 — Claude Desktop stdio (직접 Supabase 접속)

Supabase에 직접 붙는 로컬 stdio 방식(개발용). `env`에 접속 정보를 평문으로 넣습니다.

```json
{
  "mcpServers": {
    "ralphgrip": {
      "command": "node",
      "args": ["/absolute/path/to/ralphgrip/mcp-server/dist/index.js"],
      "env": {
        "RALPHGRIP_API_KEY": "ag_your_api_key",
        "RALPHGRIP_SUPABASE_URL": "https://xxx.supabase.co",
        "RALPHGRIP_SERVICE_KEY": "eyJhbG..."
      }
    }
  }
}
```

## MCP 툴 카탈로그

모든 툴은 UUID 대신 **이름/번호 기반**으로 동작합니다. 상태·트래커는 이름(`"In Progress"`, `"Task"`)으로, 작업 항목은 번호(`#42`의 `42`)로 지정하면 서버가 UUID를 해석합니다. 여러 프로젝트에 접근 가능한 에이전트는 `project_key`를 명시하세요.

> 먼저 `get_project_meta`를 호출해 그 프로젝트에서 사용 가능한 상태·트래커 이름을 확인하는 것을 권장합니다.

### 에이전트 정보 · 보고

| 툴 | 용도 | 주요 파라미터 | 상태 전이 |
|----|------|---------------|-----------|
| `whoami` | 에이전트 정체성 + 접근 가능 프로젝트(`accessibleProjects`) 조회 | (없음) | — |
| `report_progress` | 진행 보고 + 댓글(`**진행 보고**: …`) | `number`, `message`, `project_key?`, `set_in_progress=true` | → **In Progress** (기본) |
| `report_blocker` | 블로커 보고 + 댓글(`**블로커 보고**: …`) | `number`, `blocker`, `project_key?` | → **Issue** |
| `mark_resolved` | 완료 보고 + 댓글(`**완료 보고**: …`) | `number`, `summary`, `project_key?` | → **Resolved** |

### 프로젝트

| 툴 | 용도 | 주요 파라미터 | 상태 전이 |
|----|------|---------------|-----------|
| `list_projects` | 접근 가능한 프로젝트 목록 | (없음) | — |
| `get_project_meta` | 프로젝트 메타(상태·트래커·멤버) 조회 | `project_key?` | — |

### 작업 항목 (Work Items)

| 툴 | 용도 | 주요 파라미터 | 상태 전이 |
|----|------|---------------|-----------|
| `list_tasks` | 작업 목록(필터) | `status?`, `tracker?`, `assignee_id?`, `parent_number?`, `limit=50`, `project_key?` | — |
| `get_task` | 작업 상세 조회 | `number`, `project_key?` | — |
| `get_task_tree` | 전체 트리 구조 | `max_depth=5`, `project_key?` | — |
| `create_task` | 작업 생성(이름 기반 해석) | `title`, `description?`, `tracker="Task"`, `status="Open"`, `priority=0`, `assign_to_self=false`, `assignee_id?`, `parent_number?`, `project_key?` | 생성 시 지정 `status` |
| `update_task` | 작업 수정(번호 기반) | `number`, `status?`, `title?`, `description?`, `priority?`, `assignee_id?`, `project_key?` | 지정 시 해당 `status`로 |
| `batch_update_status` | 여러 작업 상태 일괄 변경 | `numbers[]`, `status`, `project_key?` | 지정 `status`로 |
| `delete_task` | 소프트 삭제 | `number`, `project_key?` | — |
| `add_comment` | 댓글 추가 | `number`, `content`, `project_key?` | — |

`priority`: `0=none, 1=low, 2=medium, 3=high, 4=critical`. `assign_to_self=true`면 현재 에이전트를 담당자로 지정합니다.

### 링크 · 검색

| 툴 | 용도 | 주요 파라미터 | 상태 전이 |
|----|------|---------------|-----------|
| `list_links` | 의존성(depends_on / blocks) 조회 | `number`, `project_key?` | — |
| `create_link` | 의존성 생성(소스가 타겟에 depends_on) | `source_number`, `target_number`, `project_key?`, `target_project_key?`(크로스 프로젝트) | — |
| `delete_link` | 의존성 삭제 | `link_id`(UUID) | — |
| `search` | 프로젝트/작업 검색(접근 범위 한정) | `query`(텍스트 또는 `KEY-123` 패턴) | — |

### 프롬프트 (Prompts)

| 프롬프트 | 용도 |
|----------|------|
| `issue_workflow` | 이슈 프로젝트 상태 전이 규칙 |
| `requirement_workflow` | 요구사항 프로젝트 워크플로우 |

## 이슈 워크플로우 상태

이슈(issue) 타입 프로젝트의 작업 항목은 다음 상태를 따릅니다. 각 상태는 **누가 언제** 만드는지가 정해져 있습니다.

```text
Open ──▶ Todo ──▶ In Progress ──▶ Resolved ──▶ Closed
                       │
                       └──▶ Issue ──(해소)──▶ In Progress
```

| 상태 | 의미 | 만드는 주체 |
|------|------|-------------|
| **Open** | 계획 단계에서 생성된 초기 상태 | 오케스트레이터(계획 시) |
| **Todo** | 에이전트가 할당된 상태 | 오케스트레이터/관리자 |
| **In Progress** | 에이전트가 실제 작업을 시작 | 에이전트 (`report_progress`) |
| **Issue** | 진행 중 문제/블로커 발생 | 에이전트 (`report_blocker`) |
| **Resolved** | 에이전트가 작업 완료로 판단 | 에이전트 (`mark_resolved`) |
| **Closed** | 점검 후 최종 완료 처리 | 오케스트레이터(검수 후) |

> 요구사항(requirement) 프로젝트는 `Draft → New → Verified → Confirmed` 상태를 사용합니다.

## 에이전트 보고 3단계 규칙

RalphGrip은 사람이 웹 UI에서 에이전트의 진행을 **실시간으로 지켜보는** 시스템입니다. 보고는 "종료 시 한 번"이 아니라 **시작 → 진행 중 → 종료**의 3단계로 계속 이뤄집니다.

1. **작업 시작 시** — `report_progress`로 무엇을 어떻게 할지 먼저 선언 (→ **In Progress**).
   해당 work item이 없으면 `create_task`로 먼저 만들고 시작.
2. **진행 중** — 의미 있는 마일스톤(설계 확정, 핵심 파일 수정, 테스트 통과 등)마다 `report_progress`로 중간 보고.
3. **블로커 발생 시** — `report_blocker`로 무엇이 왜 막혔는지 기록 (→ **Issue**).
4. **종료 시** — 완료면 `mark_resolved`(→ **Resolved**), 미완이면 `report_progress`로 현재 상태를 남김.

### 완료 보고 summary — 러닝 로그 스타일

`mark_resolved`의 `summary`(및 진행 보고)는 날짜 기반 러닝 로그 스타일로 작성합니다.

- 날짜는 `**YYYY.MM.DD**` 볼드로 시작, 인물/에이전트 명시
- 무엇을(변경 내용) · 왜(배경/목적) · 어떻게(방법/결과)를 `-` 불릿으로
- 중요 키워드는 `**볼드**`, plain text 나열 금지

```markdown
**2026.07.06** Claude Code 에이전트
- **배경**: 로그인 시 Drive 스코프로 인한 미인증 앱 경고 발생
- **조치**: 로그인 OAuth 요청에서 Drive 스코프 제거, 필요 시 재인증 플로우로 분리
- **결과**: 로그인 경고 해소, Drive 연동은 별도 스코프 요청으로 동작 확인
```

## Claude Code 보고 강제 훅 설정

Claude Code로 이 저장소에서 작업할 때는 **훅(hook)이 보고 없는 종료를 차단**합니다. 파일을 수정(Edit/Write/MultiEdit/NotebookEdit)했는데 보고 툴을 호출하지 않으면 Stop/SubagentStop 훅이 종료를 막고 재작업을 요구합니다.

이 저장소에는 이미 훅이 구성돼 있습니다. **다른 저장소에서 같은 강제 시스템을 쓰려면** 아래를 복사·연결하세요.

### 1) 훅 스크립트 3개

`.claude/hooks/`에 다음 스크립트가 있습니다.

| 스크립트 | 이벤트 | 동작 |
|----------|--------|------|
| `mark-dirty.sh` | PostToolUse (`Edit\|Write\|MultiEdit\|NotebookEdit`) | 세션을 "미보고 수정" 상태로 표시. 5회 누적마다 중간 보고 요구 컨텍스트 주입 |
| `mark-reported.sh` | PostToolUse (보고 툴 호출) | 보고가 이뤄지면 dirty 마커 제거 |
| `require-report.sh` | Stop / SubagentStop | dirty 상태로 종료 시도 시 `{"decision":"block"}`로 차단하고 보고 지시 |

### 2) `.claude/settings.json` 연결

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit|NotebookEdit",
        "hooks": [{"type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/mark-dirty.sh", "timeout": 10}]
      },
      {
        "matcher": "mcp__ralphgrip__(report_progress|report_blocker|mark_resolved|add_comment|update_task|create_task|batch_update_status)",
        "hooks": [{"type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/mark-reported.sh", "timeout": 10}]
      }
    ],
    "Stop": [
      {"hooks": [{"type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/require-report.sh", "timeout": 30}]}
    ],
    "SubagentStop": [
      {"hooks": [{"type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/require-report.sh", "timeout": 30}]}
    ]
  }
}
```

- 훅은 `${CLAUDE_PROJECT_DIR}`(Claude Code가 채워줌) 기준으로 스크립트를 찾습니다.
- 상태 마커는 `.claude/state/dirty-<session_id>` / `edits-<session_id>`에 기록됩니다.
- `mark-reported.sh`의 matcher는 서버 이름 접두사가 `mcp__ralphgrip__`입니다. `.mcp.json`의 서버 키를 다르게 지정하면 이 접두사도 맞춰야 합니다.
- 보고 절차의 문체·체크리스트는 `.claude/skills/ralphgrip-reporting/SKILL.md`를 따릅니다.

> MCP 서버가 연결돼 있지 않아 실제 보고가 불가능한 경우에만 보고 없이 종료합니다.

## 환경 변수

| 변수 | 설명 | 필수 |
|------|------|------|
| `RALPHGRIP_API_KEY` | 에이전트 API 키(`agents.api_key_hash` SHA-256로 검증) | 항상 |
| `RALPHGRIP_URL` | 설정 시 원격 HTTP 프록시 모드(`{URL}/mcp`로 Bearer 인증 프록시) | 원격 프록시 모드 |
| `RALPHGRIP_SUPABASE_URL` | Supabase 프로젝트 URL | 직접 접속(로컬) 모드 |
| `RALPHGRIP_SERVICE_KEY` | Supabase Service Role Key | 직접 접속(로컬) 모드 |
| `SUPABASE_URL` | (레거시) Supabase URL | `RALPHGRIP_*` 미설정 시 |
| `SUPABASE_SERVICE_ROLE_KEY` | (레거시) Supabase Service Key | `RALPHGRIP_*` 미설정 시 |
| `MADSPEED_PROJECT_ID` | (레거시) 단일 프로젝트 UUID | 레거시 모드 |
| `MADSPEED_AGENT_ID` | (레거시) 에이전트 UUID | 레거시 모드 |

전송 모드는 실행 인자로 결정합니다: `--transport stdio|http`(기본 `stdio`), `--port <n>`(기본 `3001`). `RALPHGRIP_URL`이 설정된 stdio 실행은 자동으로 원격 프록시가 됩니다.

## 개발

```bash
# Build
pnpm --filter @ralphgrip/mcp-server build   # 또는 mcp-server에서 npm run build

# Watch
npm run dev

# Unit tests
npm test

# Integration tests (requires Supabase)
npm run test:integration

# E2E tests
npm run test:e2e
```

## 아키텍처

```text
mcp-server/src/
├── index.ts          # 진입점 (stdio / http / 원격 프록시 transport)
├── server.ts         # MCP 서버 셋업 + 툴 등록
├── auth.ts           # API Key 검증 + 프로젝트 접근 권한 해석
├── supabase.ts       # Supabase 클라이언트 싱글턴
├── types.ts          # MCP 타입 + 에러 헬퍼(toolSuccess/toolError)
├── tools/
│   ├── work-items.ts     # CRUD + 트리 + batch
│   ├── project-meta.ts   # 프로젝트 메타 + 목록
│   ├── agent-info.ts     # whoami + 보고 툴(progress/blocker/resolved)
│   ├── links.ts          # 의존성 링크
│   └── search.ts         # 크로스 프로젝트 검색
└── prompts/
    └── workflows.ts      # 이슈/요구사항 워크플로우 프롬프트
```

동작 요약:

- **stdio(직접)**: 시작 시 `RALPHGRIP_API_KEY`를 검증해 `AgentContext`를 만들고 Supabase에 직접 접속.
- **http**: `POST /mcp` 요청마다 `Authorization: Bearer` 헤더로 세션별 인증. `GET /health`로 상태 확인.
- **원격 프록시(stdio + `RALPHGRIP_URL`)**: 로컬 stdio 서버가 원격 `/mcp`에 Bearer 인증으로 프록시.
</content>
</invoke>
