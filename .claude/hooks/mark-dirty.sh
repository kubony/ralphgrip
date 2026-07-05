#!/usr/bin/env bash
# PostToolUse hook (Edit|Write|MultiEdit|NotebookEdit): mark session as having
# unreported file modifications, and remind the agent to send an interim
# progress report every REMIND_EVERY unreported modifications.
set -euo pipefail

REMIND_EVERY=5

input="$(cat)"

if command -v jq >/dev/null 2>&1; then
  session_id="$(printf '%s' "$input" | jq -r '.session_id // empty')"
else
  session_id="$(printf '%s' "$input" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed 's/.*:[[:space:]]*"\([^"]*\)".*/\1/')"
fi

[ -z "${session_id:-}" ] && exit 0

dir="${CLAUDE_PROJECT_DIR:-.}/.claude/state"
mkdir -p "$dir"
: > "$dir/dirty-${session_id}"

# 미보고 수정 횟수 카운트 (보고 툴 호출 시 mark-reported.sh가 리셋)
count_file="$dir/edits-${session_id}"
count=0
[ -f "$count_file" ] && count="$(cat "$count_file" 2>/dev/null || echo 0)"
case "$count" in (*[!0-9]*|'') count=0;; esac
count=$((count + 1))
printf '%s' "$count" > "$count_file"

# 임계치 도달 시 중간 보고 리마인드 주입 (5, 10, 15... 회마다)
if [ $((count % REMIND_EVERY)) -eq 0 ]; then
  ctx="[RalphGrip 보고] 파일 수정이 ${count}회 누적됐지만 아직 RalphGrip에 보고되지 않았습니다. 지금 mcp__ralphgrip__report_progress로 현재까지의 진행 상황을 중간 보고하세요 (블로커 상태면 report_blocker). 작업을 멈추지 말고 보고 후 계속 진행하면 됩니다."
  if command -v jq >/dev/null 2>&1; then
    jq -nc --arg ctx "$ctx" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$ctx}}'
  else
    printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' "$ctx"
  fi
fi

exit 0
