# @ralphgrip/mcp-server

MCP (Model Context Protocol) server for [RalphGrip](https://github.com/kubony/ralphgrip) — AI 기반 프로젝트 관리 도구.

AI 에이전트가 프로젝트와 작업 항목을 생성/조회/수정할 수 있는 MCP 도구를 제공합니다.

## Features

- **18+ MCP Tools**: 작업 생성/수정/삭제, 트리 구조, 의존성 링크, 검색, 댓글
- **이름 기반 해석**: 상태/트래커를 이름으로 지정 (UUID 불필요)
- **번호 기반 참조**: `#42` 형태로 작업 항목 참조
- **다중 프로젝트 지원**: API Key로 여러 프로젝트에 접근
- **이중 전송**: stdio (로컬) + HTTP (서버) 지원
- **워크플로우 프롬프트**: 이슈/요구사항 프로젝트 상태 전이 규칙 제공

## Quick Start

### Claude Desktop / Claude Code (stdio)

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

### HTTP Server 모드

```bash
cd mcp-server
npm run build
node dist/index.js --transport http --port 3001
```

## Environment Variables

| 변수 | 설명 | 필수 |
|------|------|------|
| `RALPHGRIP_API_KEY` | 에이전트 API 키 (`agents` 테이블의 `api_key_hash`로 검증) | API Key 모드 |
| `RALPHGRIP_SUPABASE_URL` | Supabase 프로젝트 URL | Yes |
| `RALPHGRIP_SERVICE_KEY` | Supabase Service Role Key | Yes |
| `SUPABASE_URL` | (레거시) Supabase URL | `RALPHGRIP_*` 미설정 시 |
| `SUPABASE_SERVICE_ROLE_KEY` | (레거시) Supabase Service Key | `RALPHGRIP_*` 미설정 시 |
| `MADSPEED_PROJECT_ID` | (레거시) 단일 프로젝트 UUID | 레거시 모드 |
| `MADSPEED_AGENT_ID` | (레거시) 에이전트 UUID | 레거시 모드 |

## API Key 발급

RalphGrip 웹 UI에서 에이전트를 생성하면 API 키가 발급됩니다:

1. Settings > Agents에서 에이전트 생성
2. `api_key_hash`가 자동 설정됨
3. 발급된 `ag_xxx` 키를 `RALPHGRIP_API_KEY`로 설정

## Available Tools

### Agent Info
| Tool | Description |
|------|-------------|
| `whoami` | 에이전트 정보 + 접근 가능 프로젝트 |
| `report_progress` | 진행 보고 (→ In Progress + 댓글) |
| `report_blocker` | 블로커 보고 (→ Issue + 댓글) |
| `mark_resolved` | 완료 보고 (→ Resolved + 댓글) |

### Projects
| Tool | Description |
|------|-------------|
| `list_projects` | 접근 가능 프로젝트 목록 |
| `get_project_meta` | 프로젝트 메타데이터 (상태, 트래커, 멤버) |

### Work Items
| Tool | Description |
|------|-------------|
| `create_task` | 작업 생성 (이름 기반 해석) |
| `update_task` | 작업 수정 (번호 기반) |
| `list_tasks` | 작업 목록 (필터) |
| `get_task` | 작업 상세 |
| `get_task_tree` | 전체 트리 구조 |
| `delete_task` | 소프트 삭제 |
| `add_comment` | 댓글 추가 |
| `batch_update_status` | 상태 일괄 변경 |

### Links & Search
| Tool | Description |
|------|-------------|
| `list_links` | 의존성 관계 (depends_on/blocks) |
| `create_link` | 의존성 생성 (크로스 프로젝트 지원) |
| `delete_link` | 의존성 삭제 |
| `search` | 프로젝트/작업 검색 |

### Prompts
| Prompt | Description |
|--------|-------------|
| `issue_workflow` | 이슈 프로젝트 상태 전이 규칙 |
| `requirement_workflow` | 요구사항 프로젝트 워크플로우 |

## HTTP Server

```bash
node dist/index.js --transport http --port 3001
```

- **Endpoint**: `POST /mcp` (MCP messages)
- **Health**: `GET /health`
- **Sessions**: 최대 50개, TTL 30분
- **Rate Limit**: 60 req/min per client IP
- **CORS**: 모든 origin 허용

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
├── server.ts         # MCP server setup + tool registration
├── auth.ts           # API key validation + project access
├── supabase.ts       # Supabase client singleton
├── types.ts          # MCP server types + error helpers
├── tools/
│   ├── work-items.ts     # CRUD + tree + batch
│   ├── project-meta.ts   # Project metadata + list
│   ├── agent-info.ts     # Agent identity + workflow
│   ├── links.ts          # Dependency links
│   └── search.ts         # Cross-project search
└── prompts/
    └── workflows.ts      # Issue/requirement workflow prompts
```
