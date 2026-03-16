import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerPrompts(server: McpServer) {
  server.prompt(
    'issue_workflow',
    'AgentGrip issue project workflow rules and tool usage guide',
    () => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `# AgentGrip Issue Workflow

## Status Transitions
- **Open** → Todo: Agent is assigned to the task
- **Todo** → In Progress: Agent starts actual work (use report_progress)
- **In Progress** → Issue: Blocker encountered (use report_blocker)
- **In Progress** → Resolved: Work complete (use mark_resolved)
- **Issue** → In Progress: Blocker resolved (use report_progress)
- **Resolved** → Closed: Orchestrator final verification

## Tool Usage Guide
1. Call \`whoami\` first to see your accessible projects
2. Call \`get_project_meta\` to see available statuses and tracker names
3. Use \`create_task\` with tracker/status **names** (e.g., "Task", "Open") — UUIDs are resolved automatically
4. Reference tasks by **number** (e.g., #42), not UUID
5. For status transitions, prefer \`report_progress\`, \`report_blocker\`, \`mark_resolved\` over raw \`update_task\`
6. Use \`list_tasks\` to check current state before making changes

## Naming Conventions
- Trackers: Folder, Feature, Bug, Task, Issue, Improvement, Documentation
- Statuses: Open, Todo, In Progress, Issue, Resolved, Closed
- Priority: 0=none, 1=low, 2=medium, 3=high, 4=critical`,
        },
      }],
    })
  )

  server.prompt(
    'requirement_workflow',
    'AgentGrip requirement project workflow rules',
    () => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `# AgentGrip Requirement Workflow

## Status Transitions
- **Draft** → New: Requirement drafted and ready for review
- **New** → Verified: Requirement verified by stakeholders
- **Verified** → Confirmed: Requirement confirmed and locked

## Trackers
- Folder: Group related requirements
- Requirement: Individual requirement item`,
        },
      }],
    })
  )
}
