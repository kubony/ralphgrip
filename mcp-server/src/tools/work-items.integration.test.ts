import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestSupabase,
  createTestProject,
  createTestAgent,
  cleanupTestProject,
  type TestProject,
  type TestAgent,
} from '../test/helpers.js'
import type { SupabaseClient } from '@supabase/supabase-js'

let supabase: SupabaseClient
let project: TestProject
let agent: TestAgent

beforeAll(async () => {
  supabase = createTestSupabase()
  project = await createTestProject(supabase, { projectType: 'issue' })
  agent = await createTestAgent(supabase, project.id)
})

afterAll(async () => {
  if (project?.id) {
    await cleanupTestProject(supabase, project.id)
  }
})

describe('Work Items — Supabase DB 연동', () => {
  let createdWorkItemId: string
  let createdWorkItemNumber: number

  // ── Test 8: create_task → work_items INSERT ──
  it('create_task: work_item이 생성되고 number가 자동 채번됨', async () => {
    const firstStatusName = [...project.statusIds.keys()][0]
    const firstStatusId = project.statusIds.get(firstStatusName)!

    const { data, error } = await supabase
      .from('work_items')
      .insert({
        project_id: project.id,
        tracker_id: project.trackerId,
        status_id: firstStatusId,
        title: 'Integration test task',
        description: '## Test\n\nThis is an integration test.',
        priority: 2,
        position: 0,
        reporter_id: project.ownerId,
        created_by_ai: true,
        ai_metadata: { model: 'integration-test' },
      })
      .select('id, number, title, position')
      .single()

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data!.number).toBeGreaterThan(0)
    expect(data!.title).toBe('Integration test task')
    expect(data!.position).toBe(0)

    createdWorkItemId = data!.id
    createdWorkItemNumber = data!.number
  })

  // ── Test 9: update_task → status 변경 ──
  it('update_task: status 이름으로 resolve → status_id 업데이트 확인', async () => {
    // Find a status to change to (not the first one)
    const statusNames = [...project.statusIds.keys()]
    const targetStatusName = statusNames.length > 1 ? statusNames[1] : statusNames[0]
    const targetStatusId = project.statusIds.get(targetStatusName)!

    const { error } = await supabase
      .from('work_items')
      .update({ status_id: targetStatusId })
      .eq('id', createdWorkItemId)

    expect(error).toBeNull()

    // Verify
    const { data: updated } = await supabase
      .from('work_items')
      .select('status_id')
      .eq('id', createdWorkItemId)
      .single()

    expect(updated?.status_id).toBe(targetStatusId)
  })

  // ── Test 10: update_task 에이전트 모드 → set_agent_session RPC ──
  it('update_task: set_agent_session RPC 호출', async () => {
    const { error } = await supabase.rpc('set_agent_session', { agent_id: agent.id })
    expect(error).toBeNull()

    // After setting agent session, update should work
    const { error: updateErr } = await supabase
      .from('work_items')
      .update({
        ai_metadata: { model: 'test', last_action: 'update', agent_id: agent.id },
      })
      .eq('id', createdWorkItemId)

    expect(updateErr).toBeNull()
  })

  // ── Test 11: add_comment 에이전트 모드 ──
  it('add_comment: 에이전트 모드에서 agent_id로 INSERT', async () => {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        work_item_id: createdWorkItemId,
        content: 'Agent comment test',
        agent_id: agent.id,
      })
      .select('id, content, agent_id, author_id, created_at')
      .single()

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data!.agent_id).toBe(agent.id)
    expect(data!.author_id).toBeNull()
    expect(data!.content).toBe('Agent comment test')
  })

  // ── Test 12: add_comment 프로필 모드 ──
  it('add_comment: 프로필 모드에서 author_id로 INSERT', async () => {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        work_item_id: createdWorkItemId,
        content: 'Profile comment test',
        author_id: project.ownerId,
      })
      .select('id, content, agent_id, author_id')
      .single()

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data!.author_id).toBe(project.ownerId)
    expect(data!.agent_id).toBeNull()
  })

  // ── Test 13: get_project_meta ──
  it('get_project_meta: statuses, trackers, project 정보 정확성', async () => {
    const [statusesRes, trackersRes, projectRes] = await Promise.all([
      supabase
        .from('statuses')
        .select('id, name, color, position, is_closed')
        .eq('project_id', project.id)
        .order('position'),
      supabase
        .from('trackers')
        .select('id, name, color, position')
        .eq('project_id', project.id)
        .order('position'),
      supabase
        .from('projects')
        .select('id, name, key, description')
        .eq('id', project.id)
        .single(),
    ])

    expect(statusesRes.error).toBeNull()
    expect(trackersRes.error).toBeNull()
    expect(projectRes.error).toBeNull()

    // Issue project should have statuses
    expect(statusesRes.data!.length).toBeGreaterThan(0)
    // Should have at least Folder + Issue trackers
    expect(trackersRes.data!.length).toBeGreaterThanOrEqual(2)

    expect(projectRes.data!.key).toBe(project.key)
  })

  // ── Test 14: list_tasks + 필터링 ──
  it('list_tasks: status 필터로 조회', async () => {
    const firstStatusId = [...project.statusIds.values()][0]

    const { data, error } = await supabase
      .from('work_items')
      .select(`
        id, number, title, priority,
        tracker:trackers(id, name),
        status:statuses(id, name)
      `)
      .eq('project_id', project.id)
      .eq('status_id', firstStatusId)
      .is('deleted_at', null)
      .order('number', { ascending: false })
      .limit(50)

    expect(error).toBeNull()
    expect(data).toBeDefined()
    // We may or may not have items with this status depending on our updates above
    expect(Array.isArray(data)).toBe(true)
  })

  // ── Test 15: get_task 상세 조회 ──
  it('get_task: 관계 데이터 (tracker, status, assignee) 포함', async () => {
    const { data, error } = await supabase
      .from('work_items')
      .select(`
        id, number, title, description, priority, position,
        tracker:trackers(id, name, color),
        status:statuses(id, name, color, is_closed),
        assignee:profiles!work_items_assignee_id_fkey(id, full_name)
      `)
      .eq('project_id', project.id)
      .eq('number', createdWorkItemNumber)
      .is('deleted_at', null)
      .single()

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data!.title).toBe('Integration test task')
    expect(data!.tracker).toBeDefined()
    const tracker = data!.tracker as unknown as { name: string } | { name: string }[] | null
    const trackerName = Array.isArray(tracker) ? tracker[0]?.name : tracker?.name
    expect(trackerName).toBe(project.trackerName)
    expect(data!.status).toBeDefined()
  })
})
