#!/usr/bin/env bash
# PostToolUse hook (Edit|Write|MultiEdit|NotebookEdit): mark session as having
# unreported file modifications.
set -euo pipefail

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

exit 0
