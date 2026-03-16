---
tracker:
  kind: self
  supabase_url: $SUPABASE_URL
  supabase_key: $SUPABASE_SERVICE_ROLE_KEY
  project_id: $RALPHGRIP_PROJECT_ID
  active_states: ["Open", "In Progress"]
  terminal_states: ["Resolved", "Closed"]

polling:
  interval_ms: 30000

workspace:
  root: ~/ralphgrip_workspaces

hooks: {}

agent:
  max_concurrent_agents: 3
  max_retry_backoff_ms: 300000

claude:
  model: claude-sonnet-4-20250514
  max_turns: 50
  turn_timeout_ms: 3600000
  stall_timeout_ms: 300000
  allowed_tools: ["Edit", "Write", "Bash", "Read", "Glob", "Grep"]
---

You are working on issue **{{ issue.identifier }}: {{ issue.title }}**.

{{ issue.description }}

{% if attempt %}This is retry attempt {{ attempt }}. Check previous work in the workspace and continue from where the previous attempt left off.{% endif %}

## Instructions

1. Read and understand the issue description carefully.
2. Explore the codebase in your workspace to understand the existing code.
3. Implement the changes described in the issue.
4. Run tests if available to verify your changes.
5. When done, provide a summary of what you changed.
