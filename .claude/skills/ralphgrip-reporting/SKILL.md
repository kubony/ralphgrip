---
name: ralphgrip-reporting
description: "RalphGrip work item에 작업 진행을 보고하는 절차. 작업을 시작하거나, 블로커를 만나거나, 작업을 완료했을 때, 또는 Stop hook이 보고 누락을 지적했을 때 사용."
---

# RalphGrip 작업 보고

파일을 수정하는 작업을 했다면, 응답을 끝내기 전에 반드시 RalphGrip work item에 보고한다.
Stop hook이 "보고되지 않았습니다"라고 차단하면, 아래 절차를 따라 보고한 뒤 다시 종료한다.

## 체크리스트

1. **현재 work item 확인**
   - `mcp__ralphgrip__whoami`로 내 정체성/권한 확인
   - `mcp__ralphgrip__list_tasks`로 나에게 할당된 열린 work item을 찾는다
   - 이번 작업에 해당하는 work item이 있으면 그 ID를 사용한다

2. **없으면 새로 만든다**
   - `mcp__ralphgrip__create_task`로 이번 작업을 나타내는 work item을 생성한다
   - 제목은 작업 내용을 한 줄로 요약한다

3. **상황에 맞는 툴로 보고한다** (이슈 워크플로우: Open → Todo → In Progress → Issue → Resolved → Closed)
   - **작업 시작 / 진행 중**: `mcp__ralphgrip__report_progress` (→ In Progress 전이)
   - **블로커 발생**: `mcp__ralphgrip__report_blocker` (→ Issue 전이). 무엇이 왜 막혔는지 기록
   - **작업 완료**: `mcp__ralphgrip__mark_resolved` (→ Resolved 전이)

4. **완료 보고 summary는 러닝 로그 스타일로 작성한다**
   - CLAUDE.md의 "이슈 프로젝트: 러닝 로그 스타일" 가이드를 따른다
   - 날짜는 `**YYYY.MM.DD**` 볼드 형식으로 시작
   - 무엇을(변경 내용), 왜(배경/목적), 어떻게(방법/결과)를 불릿으로 기술
   - `-` 불릿 리스트 사용, 중요 키워드는 `**볼드**`, plain text 나열 금지

   예시:
   ```
   **2026.07.05** Claude Code 에이전트
   - **배경**: 로그인 시 Drive 스코프로 인한 미인증 앱 경고 발생
   - **조치**: 로그인 OAuth 요청에서 Drive 스코프 제거, 필요 시 재인증 플로우로 분리
   - **결과**: 로그인 경고 해소, Drive 연동은 별도 스코프 요청으로 동작 확인
   ```

## 주의

- RalphGrip MCP 서버가 연결돼 있지 않아 실제로 보고가 불가능한 경우에만 보고 없이 종료한다.
- 보고 툴을 호출해야만 dirty 마커가 지워지고 Stop hook을 통과한다.
