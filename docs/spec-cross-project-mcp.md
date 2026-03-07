# Cross-Project Supabase MCP 조회 Spec

> 생성일: 2026-03-02
> 인터뷰 기반 자동 생성

## Background

worvk와 worvs는 동일한 기술 스택(Supabase + Next.js)을 사용하는 별개의 프로젝트다. 두 프로젝트 간 데이터를 참조하여 각자의 DB를 업데이트해야 하는 니즈가 있으나, Supabase 프로젝트 간 직접 DB 연결 방법이 없다. Claude Code의 MCP를 활용하여 크로스 프로젝트 DB 조회를 구현한다.

## Goals

- worvs 개발 중 Claude Code에서 worvk DB를 조회할 수 있다
- worvk 개발 중 Claude Code에서 worvs DB를 조회할 수 있다
- 읽기 전용으로 안전하게 상대 프로젝트 데이터에 접근한다
- 조회한 데이터를 기반으로 각자의 DB를 업데이트하는 워크플로우를 지원한다

## Users

- 개발자 (서인근): Claude Code에서 두 프로젝트를 오가며 작업할 때 사용

## Requirements

### Must Have

- worvs에서 worvk의 전체 테이블을 읽기 전용으로 조회 가능
- worvk에서 worvs의 전체 테이블을 읽기 전용으로 조회 가능
- 도구 이름이 충돌하지 않아 Claude가 어느 DB인지 명확히 구분

### Nice to Have

- 설정이 간단하고 유지보수 부담이 적음
- 기존 Supabase MCP의 기능(테이블 목록, 타입 생성 등)을 활용 가능

### Not Doing

- 상대 DB에 쓰기 (INSERT/UPDATE/DELETE)
- 마이그레이션 적용
- Edge Function 배포
- 앱 런타임에서의 크로스 프로젝트 API (Claude Code 세션 전용)

## Technical Constraints

- 양쪽 모두 Supabase (PostgreSQL) + Next.js + TypeScript
- MCP 등록은 프로젝트별 `.claude/settings.json`에 배치
- 인증은 Supabase `service_role` 키 사용 (로컬 전용, Git에 커밋하지 않음)
- `.claude/settings.json`은 `.gitignore`에 포함되어야 함

## 접근법

### 접근법 1: Supabase MCP 이중 등록 (우선 테스트)

기존 `@anthropic-ai/supabase-mcp`를 서로 다른 이름으로 두 번 등록한다.

**가설**: Claude Code는 MCP 도구에 `mcp__{서버이름}__{도구이름}` prefix를 붙이므로 충돌하지 않을 것이다.

**설정 예시 (worvs 프로젝트의 `.claude/settings.json`)**:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic-ai/supabase-mcp"],
      "env": {
        "SUPABASE_PROJECT_REF": "<worvs-project-ref>",
        "SUPABASE_API_KEY": "<worvs-service-role-key>"
      }
    },
    "supabase-worvk": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic-ai/supabase-mcp"],
      "env": {
        "SUPABASE_PROJECT_REF": "<worvk-project-ref>",
        "SUPABASE_API_KEY": "<worvk-service-role-key>"
      }
    }
  }
}
```

**검증 항목**:

- 두 MCP가 동시에 로드되는지
- 도구 이름에 서버 이름 prefix가 붙는지 (`mcp__supabase__execute_sql` vs `mcp__supabase-worvk__execute_sql`)
- Claude가 두 DB를 구분하여 올바르게 호출하는지

**장점**: 개발 비용 0, 기존 MCP의 모든 기능(테이블 목록, 타입 생성, SQL 실행 등) 활용

**단점**: 동작 여부가 불확실, Supabase MCP가 다중 인스턴스를 지원하지 않을 가능성

### 접근법 2: 커스텀 MCP 서버 (Fallback)

접근법 1이 실패할 경우, worvk 전용 읽기 전용 MCP 서버를 직접 구축한다.

**구현 범위**:

- `worvk_list_tables` — 테이블 목록 조회
- `worvk_execute_sql` — SELECT 전용 SQL 실행
- `worvk_get_schema` — 테이블 스키마 조회

**기술 선택**:

- TypeScript + `@modelcontextprotocol/sdk`
- Supabase JS Client (`@supabase/supabase-js`)로 worvk DB 연결
- stdio 전송 방식 (로컬 전용)

**장점**: 완전한 제어, 도구 이름 충돌 없음, 필요한 기능만 노출

**단점**: 개발/유지보수 비용, worvs용도 별도 제작 필요

## Open Questions

- Supabase MCP가 동일 패키지의 다중 인스턴스를 지원하는지 (접근법 1의 핵심 검증 사항)
- `.claude/settings.json`에서 같은 command의 MCP를 다른 이름으로 등록할 때 충돌 여부

## Key Decisions

- **읽기 전용**: 상대 DB에는 절대 쓰지 않는다. 업데이트는 각자 자기 DB의 Server Action으로 처리
- **프로젝트별 등록**: 전역이 아닌 프로젝트별 `.claude/settings.json`에 등록하여 scope 제한
- **접근법 1 우선**: 개발 비용 없이 테스트 가능한 이중 등록을 먼저 시도
- **worvk 전용 MCP**: 커스텀 MCP 제작 시 범용이 아닌 프로젝트 전용으로 단순하게 구현
