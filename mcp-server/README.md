# @ralphgrip/mcp-server

MCP (Model Context Protocol) server for [RalphGrip](https://ralphgrip.com) — AI 기반 프로젝트 관리 도구.

AI 에이전트(Claude Code 등)가 RalphGrip 프로젝트와 작업 항목을 생성/조회/수정하고, 사람이 웹 UI(https://ralphgrip.com)에서 그 진행을 **실시간으로 추적**할 수 있게 해 줍니다.

## Features

- **18개 MCP Tools**: 작업 생성/수정/삭제, 트리 구조, 의존성 링크, 검색, 댓글, 진행 보고
- **이름 기반 해석**: 상태/트래커를 이름으로 지정 (UUID 불필요)
- **번호 기반 참조**: `#42` 형태로 작업 항목 참조
- **다중 프로젝트 지원**: 하나의 API Key로 접근 가능한 여러 프로젝트에 접근
- **이중 전송**: 원격 HTTP(운영) + stdio(셀프호스팅) 지원
- **워크플로우 프롬프트**: 이슈/요구사항 프로젝트 상태 전이 규칙 제공

---

## Quick Start

### 1) 원격 HTTP (권장 — 외부 사용자용)

RalphGrip은 **https://ralphgrip.com/mcp** 에 프로덕션 MCP 엔드포인트를 운영합니다.
Supabase 키나 서버 실행이 필요 없습니다. **에이전트 API 키 하나(`ag_...`)만 있으면 됩니다.**

**준비물**

1. https://ralphgrip.com 가입
2. **Settings > Agents**에서 에이전트를 생성하면 `ag_`로 시작하는 API 키가 발급됩니다. (키는 **생성 시 1회만** 표시되므로 즉시 복사해 두세요.)

**Claude Code / Claude Desktop 설정** — 프로젝트 루트에 `.mcp.json`을 만들거나 기존 파일에 추가:

```json
{
  "mcpServers": {
    "ralphgrip": {
      "type": "http",
      "url": "https://ralphgrip.com/mcp",
      "headers": { "Authorization": "Bearer ag_your_api_key" }
    }
  }
}
```

> ⚠️ **서버 이름은 반드시 `ralphgrip`** 이어야 합니다. 아래 "Claude Code hook으로 보고 강제하기"의
> 훅 matcher(`mcp__ralphgrip__...`)가 이 이름을 기준으로 동작합니다.

> ⚠️ **변수 확장 함정**: Claude Code의 `.mcp.json`은 `headers`/`env` 블록에서 `${VAR}` 변수 확장이
> 되지 않는 경우가 많습니다. 키를 `Bearer ${RALPHGRIP_API_KEY}`처럼 넣으면 리터럴 문자열로 전달돼
> 인증에 실패합니다. 평문으로 직접 넣거나, 아래 프록시 모드/`start-local.sh`처럼 키를 파일·셸 env에서
> 읽는 방식을 사용하세요.

설정 후 Claude Code에서 `whoami` 툴을 호출하면 에이전트 정보와 접근 가능한 프로젝트 목록이 나옵니다.
정상 동작하면 연결 완료입니다.

#### 프록시 모드 — `.mcp.json`에 키를 평문으로 넣고 싶지 않을 때

이 저장소를 클론했다면 stdio → 원격 HTTP **프록시 모드**를 쓸 수 있습니다. `RALPHGRIP_URL`이
설정되면 로컬 프로세스가 `https://ralphgrip.com/mcp`에 `Authorization: Bearer` 헤더를 붙여
중계하며, Supabase 자격 증명은 필요 없습니다.

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

이 저장소 자체의 `.mcp.json`은 래퍼 스크립트 `mcp-server/start-local.sh`를 호출합니다.
래퍼는 API 키를 `RALPHGRIP_API_KEY` env 또는 `~/.ralphgrip/api-key` 파일에서 읽으므로
`.mcp.json`에 평문 키를 넣지 않아도 됩니다.

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

#### curl로 직접 확인하기 (Streamable HTTP)

엔드포인트는 SSE(`event: message` + `data:`) 로 응답하며, 세션은 `mcp-session-id` **응답 헤더**로 발급됩니다.
이후 요청에는 같은 헤더를 실어 보냅니다. `Accept`에는 **반드시** `application/json, text/event-stream`을 지정하세요.

```bash
# ── 1. initialize (응답 헤더에서 mcp-session-id 확인) ──
curl -sN https://ralphgrip.com/mcp \
  -H "Authorization: Bearer ag_your_api_key" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -D - \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'
# 응답 헤더 예: mcp-session-id: 3f2c...  ← 이 값을 아래 SESSION 에 사용

# ── 2. initialized 알림 (세션 헤더 전달) ──
SESSION="<위에서 받은 mcp-session-id>"
curl -sN https://ralphgrip.com/mcp \
  -H "Authorization: Bearer ag_your_api_key" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# ── 3. tools/call — whoami 로 연결 확인 ──
curl -sN https://ralphgrip.com/mcp \
  -H "Authorization: Bearer ag_your_api_key" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"whoami","arguments":{}}}'
```

**접근 가능한 프로젝트 결정 규칙** (에이전트 category, `src/auth.ts` `resolveAccessibleProjects`):
- **project-scoped** (`project_id` 지정): 해당 프로젝트만
- **owned / global**: owner가 멤버인 모든 프로젝트
- **restricted**: `agent_permissions`에 등록된 사용자들의 프로젝트 합집합

### 2) Self-hosted (stdio)

RalphGrip을 직접 셀프호스팅하는 경우에만 사용합니다. Supabase 자격 증명이 필요합니다.
`claude_desktop_config.json` 또는 `.mcp.json`에 추가:

```json
{
  "mcpServers": {
    "ralphgrip": {
      "command": "node",
      "args": ["/path/to/ralphgrip/mcp-server/dist/index.js"],
      "env": {
        "RALPHGRIP_API_KEY": "ag_your_api_key",
        "RALPHGRIP_SUPABASE_URL": "https://xxx.supabase.co",
        "RALPHGRIP_SERVICE_KEY": "eyJhbG..."
      }
    }
  }
}
```

HTTP 서버를 직접 띄우려면:

```bash
cd mcp-server
npm run build
node dist/index.js --transport http --port 3001
```

- **Endpoint**: `POST /mcp` · **Health**: `GET /health`
- **Sessions**: 최대 50개, TTL 30분 · **Rate Limit**: 60 req/min per client IP · **CORS**: 모든 origin 허용

#### Environment Variables (self-hosted)

| 변수 | 설명 | 필수 |
|------|------|------|
| `RALPHGRIP_API_KEY` | 에이전트 API 키 (`agents` 테이블의 `api_key_hash`로 검증) | API Key 모드 |
| `RALPHGRIP_URL` | 설정 시 **프록시 모드** — stdio 요청을 `{URL}/mcp`로 중계 (Supabase 변수 불필요) | 프록시 모드 |
| `RALPHGRIP_SUPABASE_URL` | Supabase 프로젝트 URL | Yes |
| `RALPHGRIP_SERVICE_KEY` | Supabase Service Role Key | Yes |
| `SUPABASE_URL` | (레거시) Supabase URL | `RALPHGRIP_*` 미설정 시 |
| `SUPABASE_SERVICE_ROLE_KEY` | (레거시) Supabase Service Key | `RALPHGRIP_*` 미설정 시 |
| `MADSPEED_PROJECT_ID` | (레거시) 단일 프로젝트 UUID | 레거시 모드 |
| `MADSPEED_AGENT_ID` | (레거시) 에이전트 UUID | 레거시 모드 |

> 원격 HTTP(https://ralphgrip.com/mcp) 사용 시에는 위 환경 변수가 **전혀 필요 없습니다.**
> `Authorization: Bearer ag_...` 헤더 하나면 됩니다.

---

## Available Tools

작업 항목은 프로젝트 내 **번호**(`#42` → `number: 42`)로 참조합니다. 상태/트래커는 **이름**으로 지정하면
서버가 UUID로 해석합니다. 여러 프로젝트에 접근하는 에이전트는 대부분의 툴에 `project_key`를 넘겨야 합니다.

### Agent Info & Reporting

| Tool | 핵심 인자 | Description |
|------|-----------|-------------|
| `whoami` | — | 에이전트 정보 + 접근 가능 프로젝트 목록 |
| `report_progress` | `number`, `message`, `project_key?`, `set_in_progress?`(기본 true) | 진행 보고 → **In Progress** 전이 + 댓글 |
| `report_blocker` | `number`, `blocker`, `project_key?` | 블로커 보고 → **Issue** 전이 + 댓글 |
| `mark_resolved` | `number`, `summary`, `project_key?` | 완료 보고 → **Resolved** 전이 + 댓글 |

> `report_progress` / `report_blocker` / `mark_resolved`는 **API 키 모드에서만** 등록됩니다(원격 HTTP는 항상 API 키 모드).

### Projects

| Tool | 핵심 인자 | Description |
|------|-----------|-------------|
| `list_projects` | — | 접근 가능한 프로젝트 목록 |
| `get_project_meta` | `project_key?` | 프로젝트 메타데이터(상태·트래커·멤버). **작업 전 먼저 호출**해 사용 가능한 status/tracker 이름을 확인 |

### Work Items

| Tool | 핵심 인자 | Description |
|------|-----------|-------------|
| `create_task` | `title`(필수), `description?`, `tracker?`(기본 `"Task"`), `status?`(기본 `"Open"`), `priority?`(0–4), `assignee_id?`, `assign_to_self?`, `parent_number?`, `project_key?` | 작업 생성 (이름 기반 해석) |
| `update_task` | `number`(필수), `status?`, `title?`, `description?`, `priority?`, `assignee_id?`, `project_key?` | 작업 수정 |
| `list_tasks` | `status?`, `tracker?`, `assignee_id?`, `parent_number?`, `limit?`(기본 50), `project_key?` | 작업 목록 (필터) |
| `get_task` | `number`, `project_key?` | 작업 상세 |
| `get_task_tree` | `max_depth?`(기본 5), `project_key?` | 전체 트리 구조 |
| `add_comment` | `number`, `content`, `project_key?` | 댓글 추가 |
| `delete_task` | `number`, `project_key?` | 소프트 삭제 |
| `batch_update_status` | `numbers`(배열), `status`, `project_key?` | 상태 일괄 변경 |

> ⚠️ `create_task`의 기본 tracker는 `"Task"`, 기본 status는 `"Open"`입니다. 하지만 **이슈 프로젝트**의
> 트래커는 `Issue`(+`Folder`), **요구사항 프로젝트**는 `요구사항`(+`Folder`)입니다. 기본값이 프로젝트에 없으면
> 생성이 실패하므로, 먼저 `get_project_meta`로 사용 가능한 이름을 확인하고 `tracker`/`status`를 명시하세요.

### Links & Search

| Tool | 핵심 인자 | Description |
|------|-----------|-------------|
| `list_links` | `number`, `project_key?` | 의존성 관계(depends_on / blocks) 조회 |
| `create_link` | `source_number`, `target_number`, `project_key?`, `target_project_key?` | 의존성 생성 (source가 target에 depends_on, 크로스 프로젝트 지원) |
| `delete_link` | `link_id` | 의존성 삭제 |
| `search` | `query` | 프로젝트/작업 검색 (`텍스트` 또는 `KEY-123` 패턴) |

### Prompts

| Prompt | Description |
|--------|-------------|
| `issue_workflow` | 이슈 프로젝트 상태 전이 규칙 + 툴 사용 가이드 |
| `requirement_workflow` | 요구사항 프로젝트 워크플로우 |

---

## 에이전트 보고 컨벤션

RalphGrip의 핵심은 사람이 웹 UI에서 에이전트 작업을 실시간 추적하는 것입니다.
그래서 에이전트는 작업을 **말없이 수행하지 말고** 아래 3단계로 보고해야 합니다.

### 3단계 보고 규칙

1. **시작 선언** — 작업을 시작하면 `report_progress`로 "무엇을 시작한다"를 남긴다 (→ 상태 **In Progress**).
2. **진행 보고** — 의미 있는 마일스톤마다 `report_progress`로 중간 경과를 남긴다.
3. **완료 보고** — 작업을 끝내면 `mark_resolved`로 요약을 남긴다 (→ 상태 **Resolved**).
   진행 중 막히면 `report_blocker`로 블로커를 남긴다 (→ 상태 **Issue**).

작업에 해당하는 work item이 아직 없으면 먼저 `create_task`로 만들고 시작합니다.

### 상태 전이 의미 (이슈 프로젝트)

| 상태 | 의미 | 전이 트리거 |
|------|------|-------------|
| `Open` | 오케스트레이터가 계획 단계에서 생성 | — |
| `Todo` | 에이전트에게 할당됨 | — |
| `In Progress` | 에이전트가 실제 작업 시작 | `report_progress` |
| `Issue` | 진행 중 블로커 발생 | `report_blocker` |
| `Resolved` | 에이전트가 완료로 판단 | `mark_resolved` |
| `Closed` | 오케스트레이터 최종 확인 | (사람/오케스트레이터) |

### 러닝 로그 스타일 (이슈 프로젝트 description)

이슈 프로젝트의 작업 설명은 **날짜 기반 시간순 업무 일지**로 씁니다. 보고 메시지도 같은 톤을 권장합니다.

- 날짜는 `**YYYY.MM.DD**` 볼드 형식
- 항목은 `-` 불릿 리스트로 구분 (줄바꿈만으로 구분 금지)
- 중요 키워드는 `**볼드**`
- 작업을 끝낼 때는 마지막에 `이슈 종료 처리`

```markdown
배경 : 데모 영상 렌더링 파이프라인 점검 요청

**2026.03.10** 에이전트 착수
- 입력 소스와 타임라인 규격 확인
- 렌더 프리셋 3종 벤치마크 시작

**2026.03.11** 진행
- 1080p/30fps 프리셋으로 확정
- 인코딩 시간 42% 단축 확인

**2026.03.12** 완료
최종 영상 산출물 업로드 완료
이슈 종료 처리
```

> 요구사항 프로젝트는 러닝 로그 대신 `##` 헤딩 기반 구조화 마크다운(개요 / 요구사항 / 핵심 기술 / 완료 조건)을 씁니다.

---

## Claude Code hook으로 보고 강제하기

에이전트가 파일만 고치고 **보고를 잊는 것**을 막기 위해, RalphGrip 레포는 Claude Code hook으로
"파일을 수정했으면 종료 전에 반드시 보고"를 강제합니다. 자신의 레포에도 그대로 복사해 쓸 수 있습니다.

### 동작 원리

1. `Edit`/`Write`/`MultiEdit`/`NotebookEdit`로 파일을 수정하면 세션이 **dirty**로 표시되고, 미보고 수정 횟수가 카운트된다.
2. 미보고 수정이 **5회 누적될 때마다**(5, 10, 15…) 훅이 `additionalContext`로 "지금 `report_progress`로 중간 보고하라"는 리마인드를 주입한다 (작업은 멈추지 않고 계속 진행).
3. RalphGrip 보고 툴(`report_progress`, `report_blocker`, `mark_resolved`, `create_task` 등)을 호출하면 dirty와 카운터가 **함께 해제**된다.
4. 세션 종료(Stop/SubagentStop) 시 dirty가 남아 있으면 훅이 종료를 **차단**하고 보고를 요구한다.

### 설치 방법

1. 이 레포의 `.claude/hooks/` 스크립트 3종을 자기 레포 같은 위치로 복사하고 실행 권한을 준다:

   | 스크립트 | 훅 이벤트 | 역할 |
   |----------|-----------|------|
   | `mark-dirty.sh` | PostToolUse (Edit/Write/…) | 파일 수정 발생 → 세션을 dirty로 표시 + 미보고 수정 5회마다 중간 보고 리마인드 주입 |
   | `mark-reported.sh` | PostToolUse (`mcp__ralphgrip__*` 보고 툴) | 보고 완료 → dirty 마커·수정 카운터 해제 |
   | `require-report.sh` | Stop / SubagentStop | dirty가 남아 있으면 종료 차단 + 보고 지시 |

   ```bash
   chmod +x .claude/hooks/*.sh
   ```

2. 이 레포의 `.claude/settings.json`을 참고해 훅을 등록한다:

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

   > matcher의 `mcp__ralphgrip__...`는 `.mcp.json`의 서버 이름이 **`ralphgrip`** 임을 전제로 합니다. 서버 이름을 바꾸면 matcher도 함께 바꿔야 합니다.

3. `CLAUDE.md`에 아래 규칙 문단을 넣어 에이전트가 규칙을 인지하게 한다:

   ```markdown
   ## 에이전트 작업 보고 규칙 (MUST)

   - **시작**: 작업을 시작하면 `report_progress`로 무엇을 시작하는지 선언한다 (→ In Progress).
     이번 작업에 해당하는 work item이 없으면 `create_task`로 먼저 만들고 시작한다.
   - **진행 중**: 마일스톤마다 `report_progress`로 중간 경과를 남긴다. 파일 수정이 5회 누적되면
     훅이 중간 보고를 리마인드하므로, 그때 `report_progress`(블로커면 `report_blocker`)로 보고하고 계속 진행한다.
   - **종료**: 작업을 끝내면 `mark_resolved`로 요약을 남긴다 (→ Resolved). 진행 중 막히면 `report_blocker` (→ Issue).
   - 파일을 수정했는데 보고 없이 종료하면 Stop hook이 종료를 **차단**하고 재작업을 요구한다. 보고 툴 호출만이 이 차단을 해제한다.
   ```

---

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Unit tests
npm test

# Integration tests (requires Supabase)
npm run test:integration

# E2E tests
npm run test:e2e
```

## Architecture

```
mcp-server/src/
├── index.ts          # Entry point (stdio/http transport)
├── server.ts         # MCP server setup + tool registration (name: "ralphgrip")
├── auth.ts           # API key validation + project access (resolveAccessibleProjects)
├── supabase.ts       # Supabase client singleton
├── types.ts          # MCP server types + error helpers
├── tools/
│   ├── work-items.ts     # create/update/list/get/tree/comment/delete/batch
│   ├── project-meta.ts   # get_project_meta + list_projects
│   ├── agent-info.ts     # whoami + report_progress/report_blocker/mark_resolved
│   ├── links.ts          # list/create/delete dependency links
│   └── search.ts         # cross-project search
└── prompts/
    └── workflows.ts      # issue_workflow / requirement_workflow prompts
```
