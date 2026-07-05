#!/usr/bin/env bash
# RalphGrip MCP 서버 로컬 실행 래퍼 (stdio).
# .mcp.json에서 호출된다. cwd와 무관하게 스크립트 위치 기준으로 동작하며,
# 접속 정보는 env 우선, 없으면 레포 루트의 .env.local에서 읽는다.
# API 키는 env(RALPHGRIP_API_KEY) 또는 ~/.ralphgrip/api-key 파일로 공급한다.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

env_from_file() {
  grep "^$1=" "$ROOT/.env.local" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '"'
}

export RALPHGRIP_SUPABASE_URL="${RALPHGRIP_SUPABASE_URL:-$(env_from_file NEXT_PUBLIC_SUPABASE_URL)}"
export RALPHGRIP_SERVICE_KEY="${RALPHGRIP_SERVICE_KEY:-$(env_from_file SUPABASE_SERVICE_ROLE_KEY)}"

if [ -z "${RALPHGRIP_API_KEY:-}" ] && [ -f "$HOME/.ralphgrip/api-key" ]; then
  RALPHGRIP_API_KEY="$(cat "$HOME/.ralphgrip/api-key")"
  export RALPHGRIP_API_KEY
fi

if [ -z "${RALPHGRIP_API_KEY:-}" ] || [ -z "${RALPHGRIP_SUPABASE_URL:-}" ]; then
  echo "RALPHGRIP_API_KEY 또는 접속 정보가 없습니다. ~/.ralphgrip/api-key 파일 또는 env를 설정하세요." >&2
  exit 1
fi

exec node "$ROOT/mcp-server/dist/index.js" "$@"
