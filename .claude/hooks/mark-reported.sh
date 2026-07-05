#!/usr/bin/env bash
# PostToolUse hook (RalphGrip reporting tools): clear the dirty marker because
# progress has been reported to RalphGrip.
set -euo pipefail

input="$(cat)"

if command -v jq >/dev/null 2>&1; then
  session_id="$(printf '%s' "$input" | jq -r '.session_id // empty')"
else
  session_id="$(printf '%s' "$input" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed 's/.*:[[:space:]]*"\([^"]*\)".*/\1/')"
fi

[ -z "${session_id:-}" ] && exit 0

dir="${CLAUDE_PROJECT_DIR:-.}/.claude/state"
rm -f "$dir/dirty-${session_id}"

exit 0
