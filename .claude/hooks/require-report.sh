#!/usr/bin/env bash
# Stop / SubagentStop hook: block termination if this session modified files but
# did not report progress to RalphGrip.
set -euo pipefail

input="$(cat)"

if command -v jq >/dev/null 2>&1; then
  session_id="$(printf '%s' "$input" | jq -r '.session_id // empty')"
  stop_hook_active="$(printf '%s' "$input" | jq -r '.stop_hook_active // false')"
else
  session_id="$(printf '%s' "$input" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed 's/.*:[[:space:]]*"\([^"]*\)".*/\1/')"
  if printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
    stop_hook_active="true"
  else
    stop_hook_active="false"
  fi
fi

# Avoid infinite loop: if this hook already blocked once this turn, let it pass.
[ "${stop_hook_active:-false}" = "true" ] && exit 0

[ -z "${session_id:-}" ] && exit 0

dir="${CLAUDE_PROJECT_DIR:-.}/.claude/state"
dirty_file="$dir/dirty-${session_id}"

# No file modifications this session -> nothing to report -> pass.
[ ! -f "$dirty_file" ] && exit 0

# Files were modified but not reported. Block and instruct the agent.
# NOTE: do NOT delete the dirty file here — only the reporting tools clear it.
reason="이 세션에서 파일 수정 작업이 있었지만 RalphGrip에 보고되지 않았습니다. 진행 중이면 mcp__ralphgrip__report_progress, 블로커면 mcp__ralphgrip__report_blocker, 완료면 mcp__ralphgrip__mark_resolved를 호출해 해당 work item에 기록하세요. 해당하는 work item이 없으면 mcp__ralphgrip__create_task로 먼저 만들고 보고하세요. RalphGrip MCP 서버가 연결돼 있지 않아 보고가 불가능한 경우에만 그대로 종료하세요."

if command -v jq >/dev/null 2>&1; then
  jq -nc --arg reason "$reason" '{decision:"block", reason:$reason}'
else
  # Manual JSON escaping fallback (reason contains no quotes/backslashes/newlines).
  printf '{"decision":"block","reason":"%s"}\n' "$reason"
fi

exit 0
