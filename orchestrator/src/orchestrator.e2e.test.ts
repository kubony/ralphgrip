import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createTestSupabase,
  createTestProject,
  createTestAgent,
  cleanupTestProject,
  type TestProject,
  type TestAgent,
} from './test/helpers.js'
import { WorkflowLoader } from './workflow-loader.js'
import { Orchestrator } from './orchestrator.js'
import { SelfTrackerClient } from './tracker/self-client.js'
import { WorkspaceManager } from './workspace/manager.js'
import type { SupabaseClient } from '@supabase/supabase-js'

let supabase: SupabaseClient
let project: TestProject
let agent: TestAgent
let tmpDir: string
let workflowPath: string
let testWorkItemId: string

beforeAll(async () => {
  supabase = createTestSupabase()
  project = await createTestProject(supabase, { projectType: 'issue' })
  agent = await createTestAgent(supabase, project.id)

  // Create "Open" work item
  const openStatusId = project.statusIds.get('Open')
  if (!openStatusId) throw new Error('Open status not found')

  const { data, error } = await supabase
    .from('work_items')
    .insert({
      project_id: project.id,
      tracker_id: project.trackerId,
      status_id: openStatusId,
      title: 'E2E orchestrator test: write done',
      description: 'Simply respond with the word done.',
      priority: 1,
      position: 0,
      reporter_id: project.ownerId,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Failed to create work item: ${error?.message}`)
  testWorkItemId = data.id

  // Create temp WORKFLOW.md
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-e2e-'))
  const workspacesDir = path.join(tmpDir, 'workspaces')
  fs.mkdirSync(workspacesDir, { recursive: true })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  workflowPath = path.join(tmpDir, 'WORKFLOW.md')
  fs.writeFileSync(workflowPath, `---
tracker:
  kind: self
  supabase_url: "${url}"
  supabase_key: "${key}"
  project_id: "${project.id}"
  agent_id: "${agent.id}"
  active_states: ["Open", "In Progress"]
  terminal_states: ["Resolved", "Closed"]
polling:
  interval_ms: 60000
workspace:
  root: "${workspacesDir}"
agent:
  max_concurrent_agents: 1
  max_retry_backoff_ms: 10000
claude:
  model: "claude-sonnet-4-20250514"
  max_turns: 2
  turn_timeout_ms: 60000
  stall_timeout_ms: 30000
  allowed_tools: []
---
You are working on issue {{ issue.identifier }}: {{ issue.title }}.

{{ issue.description }}

Simply say "done" and stop.
`, 'utf-8')
})

afterAll(async () => {
  if (project?.id) {
    await cleanupTestProject(supabase, project.id)
  }
  if (tmpDir) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
})

describe('Orchestrator — E2E 전체 파이프라인', () => {
  // ── Test 23: 전체 파이프라인 ──
  it('WORKFLOW.md → poll → dispatch → Claude 실행 → 코멘트 → 상태 업데이트', async () => {
    const loader = new WorkflowLoader(workflowPath)
    const config = loader.getConfig()

    const tracker = new SelfTrackerClient({
      supabaseUrl: config.tracker.supabase_url,
      supabaseKey: config.tracker.supabase_key,
      projectId: config.tracker.project_id,
      agentId: config.tracker.agent_id,
      activeStates: config.tracker.active_states,
      terminalStates: config.tracker.terminal_states,
    })

    const wsManager = new WorkspaceManager({
      root: config.workspace.root,
      hooks: config.hooks,
    })

    const orchestrator = new Orchestrator(loader, tracker, wsManager)

    // Run a single poll cycle
    await orchestrator.poll()

    // Wait for dispatch to complete (it fires and forgets)
    // Give it enough time for Claude to respond
    await new Promise(r => setTimeout(r, 30_000))

    // Stop orchestrator
    await orchestrator.stop()

    // Verify: work item should have been picked up
    // Check for comments (orchestrator adds completion/failure comments)
    const { data: comments } = await supabase
      .from('comments')
      .select('content, agent_id')
      .eq('work_item_id', testWorkItemId)
      .order('created_at', { ascending: false })
      .limit(5)

    // There should be at least one comment from the orchestrator
    expect(comments).toBeDefined()
    expect(comments!.length).toBeGreaterThanOrEqual(1)

    // Verify status was updated to "In Progress" (or beyond)
    const { data: workItem } = await supabase
      .from('work_items')
      .select('status:statuses!inner(name)')
      .eq('id', testWorkItemId)
      .single()

    const statusName = (workItem as { status?: { name?: string } } | null)?.status?.name
    expect(['In Progress', 'Resolved', 'Closed']).toContain(statusName)
  }, 90_000) // extended timeout for Claude CLI
})
