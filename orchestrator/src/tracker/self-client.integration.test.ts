import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestSupabase,
  createTestProject,
  createTestAgent,
  cleanupTestProject,
  type TestProject,
  type TestAgent,
} from '../test/helpers.js'
import { SelfTrackerClient } from './self-client.js'
import type { SupabaseClient } from '@supabase/supabase-js'

let supabase: SupabaseClient
let project: TestProject
let agent: TestAgent
let trackerWithAgent: SelfTrackerClient
let trackerWithoutAgent: SelfTrackerClient
let testWorkItemId: string

beforeAll(async () => {
  supabase = createTestSupabase()
  project = await createTestProject(supabase, { projectType: 'issue' })
  agent = await createTestAgent(supabase, project.id)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  trackerWithAgent = new SelfTrackerClient({
    supabaseUrl: url,
    supabaseKey: key,
    projectId: project.id,
    agentId: agent.id,
    activeStates: ['Open', 'In Progress'],
    terminalStates: ['Resolved', 'Closed'],
  })

  trackerWithoutAgent = new SelfTrackerClient({
    supabaseUrl: url,
    supabaseKey: key,
    projectId: project.id,
    activeStates: ['Open', 'In Progress'],
    terminalStates: ['Resolved', 'Closed'],
  })

  // Create a test work item with "Open" status
  const openStatusId = project.statusIds.get('Open')
  if (!openStatusId) throw new Error('Open status not found')

  const { data, error } = await supabase
    .from('work_items')
    .insert({
      project_id: project.id,
      tracker_id: project.trackerId,
      status_id: openStatusId,
      title: 'Tracker integration test item',
      priority: 1,
      position: 0,
      reporter_id: project.ownerId,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Failed to create test work item: ${error?.message}`)
  testWorkItemId = data.id
})

afterAll(async () => {
  if (project?.id) {
    await cleanupTestProject(supabase, project.id)
  }
})

describe('SelfTrackerClient — Supabase DB 연동', () => {
  // ── Test 16: fetchActiveIssues() ──
  it('fetchActiveIssues: active_states 기반 필터 + identifier 형식', async () => {
    const issues = await trackerWithAgent.fetchActiveIssues()

    expect(issues.length).toBeGreaterThanOrEqual(1)

    const found = issues.find(i => i.id === testWorkItemId)
    expect(found).toBeDefined()
    expect(found!.identifier).toMatch(/^[A-Z]+-\d+$/) // e.g., "TEST123-1"
    expect(found!.state).toBe('Open')
    expect(found!.title).toBe('Tracker integration test item')
    expect(found!.priority).toBe(1)
  })

  // ── Test 17: updateIssueStatus() ──
  it('updateIssueStatus: status 이름 resolve → work_items.status_id 변경', async () => {
    await trackerWithAgent.updateIssueStatus(testWorkItemId, 'In Progress')

    // Verify via direct DB query
    const { data } = await supabase
      .from('work_items')
      .select('status:statuses!inner(name)')
      .eq('id', testWorkItemId)
      .single()

    expect((data as any)?.status?.name).toBe('In Progress')
  })

  // ── Test 18: addComment() — 에이전트 모드 ──
  it('addComment: 에이전트 모드에서 agent_id로 INSERT', async () => {
    await trackerWithAgent.addComment(testWorkItemId, 'Agent comment via tracker')

    const { data } = await supabase
      .from('comments')
      .select('content, agent_id, author_id')
      .eq('work_item_id', testWorkItemId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    expect(data?.content).toBe('Agent comment via tracker')
    expect(data?.agent_id).toBe(agent.id)
    expect(data?.author_id).toBeNull()
  })

  // ── Test 19: addComment() — 프로필 모드 ──
  it('addComment: 프로필 모드에서 author_id = project owner로 INSERT', async () => {
    await trackerWithoutAgent.addComment(testWorkItemId, 'Profile comment via tracker')

    const { data } = await supabase
      .from('comments')
      .select('content, agent_id, author_id')
      .eq('work_item_id', testWorkItemId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    expect(data?.content).toBe('Profile comment via tracker')
    expect(data?.author_id).toBe(project.ownerId)
    expect(data?.agent_id).toBeNull()
  })

  // ── Test 20: fetchIssueStates() ──
  it('fetchIssueStates: 상태 Map 정확성', async () => {
    const states = await trackerWithAgent.fetchIssueStates([testWorkItemId])

    expect(states.size).toBe(1)
    expect(states.get(testWorkItemId)).toBe('In Progress') // updated in test 17
  })
})
