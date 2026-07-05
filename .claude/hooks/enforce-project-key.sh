#!/usr/bin/env bash
# PreToolUse hook (mcp__ralphgrip__*): pin every RalphGrip tool call to the
# single project declared in .ralphgrip.json (repo = 1 project). If a call
# targets a different project_key — or omits it — deny and instruct the agent
# to re-call with the pinned key. This keeps multiple concurrent Claude Code
# sessions in one repo from scattering tasks across projects.
set -euo pipefail

input="$(cat)"

# --- Read the pinned project key from .ralphgrip.json -----------------------
config="${CLAUDE_PROJECT_DIR:-.}/.ralphgrip.json"
[ ! -f "$config" ] && exit 0   # no declaration -> do not pin

if command -v jq >/dev/null 2>&1; then
  pinned="$(jq -r '.project_key // empty' "$config" 2>/dev/null || true)"
else
  pinned="$(grep -o '"project_key"[[:space:]]*:[[:space:]]*"[^"]*"' "$config" | head -n1 | sed 's/.*:[[:space:]]*"\([^"]*\)".*/\1/')"
fi

[ -z "${pinned:-}" ] && exit 0   # unparseable declaration -> do not pin

# --- Parse tool_name and the call's project_key -----------------------------
if command -v jq >/dev/null 2>&1; then
  tool_name="$(printf '%s' "$input" | jq -r '.tool_name // empty')"
  call_key="$(printf '%s' "$input" | jq -r '.tool_input.project_key // empty')"
else
  tool_name="$(printf '%s' "$input" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed 's/.*:[[:space:]]*"\([^"]*\)".*/\1/')"
  call_key="$(printf '%s' "$input" | grep -o '"project_key"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed 's/.*:[[:space:]]*"\([^"]*\)".*/\1/')"
fi

# Only guard RalphGrip MCP tools.
case "$tool_name" in
  mcp__ralphgrip__*) ;;
  *) exit 0 ;;
esac

# Tools that take no project_key (or only a cross-project target) are exempt.
# create_project makes a *new* project, so it does not take an existing key.
case "$tool_name" in
  mcp__ralphgrip__whoami|mcp__ralphgrip__list_projects|mcp__ralphgrip__search|mcp__ralphgrip__delete_link|mcp__ralphgrip__create_project)
    exit 0 ;;
esac

# Passes when the call names exactly the pinned project.
[ "${call_key:-}" = "$pinned" ] && exit 0

# Otherwise deny and tell the agent to re-call with the pinned key.
reason="이 레포의 RalphGrip 프로젝트는 '${pinned}'로 고정되어 있습니다(.ralphgrip.json). project_key: \"${pinned}\"를 명시해 다시 호출하세요."

if command -v jq >/dev/null 2>&1; then
  jq -nc --arg reason "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$reason}}'
else
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$reason"
fi

exit 0
