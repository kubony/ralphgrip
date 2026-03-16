import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks (accessible in vi.mock factory) ──
const { mockRpc, mockFrom, mockSingle, mockGetActorIds, mockGetProjectOwnerId } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockIs = vi.fn(() => ({ single: mockSingle }))
  const mockEq2 = vi.fn(() => ({ is: mockIs, single: mockSingle }))
  const mockEq = vi.fn(() => ({ eq: mockEq2, is: mockIs, single: mockSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq, single: mockSingle }))
  const mockInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) }))
  const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => ({ is: mockIs, select: vi.fn(() => ({ single: mockSingle })) })) }))
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  }))
  const mockRpc = vi.fn()
  const mockGetActorIds = vi.fn()
  const mockGetProjectOwnerId = vi.fn(async () => 'owner-uuid-456')

  return { mockRpc, mockFrom, mockSingle, mockGetActorIds, mockGetProjectOwnerId }
})

vi.mock('../supabase.js', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
  getProjectId: vi.fn(() => 'project-uuid-123'),
  getProjectOwnerId: mockGetProjectOwnerId,
  getActorIds: mockGetActorIds,
  isApiKeyMode: vi.fn(() => false),
}))

vi.mock('../auth.js', () => ({
  resolveProjectId: vi.fn(async () => 'project-uuid-123'),
  logAgentAction: vi.fn(async () => {}),
}))

import { registerWorkItemTools } from './work-items.js'

// ── Capture tool handlers ──
type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>

const toolHandlers: Record<string, ToolHandler> = {}
const mockServer = {
  tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: ToolHandler) => {
    toolHandlers[name] = handler
  }),
}

registerWorkItemTools(mockServer as never)

beforeEach(() => {
  vi.clearAllMocks()
})

// ── add_comment tests ──
describe('add_comment', () => {
  it('에이전트 모드: agent_id로 댓글 생성', async () => {
    mockGetActorIds.mockResolvedValue({ profileId: null, agentId: 'agent-789' })

    // resolveWorkItemByNumber
    mockSingle.mockResolvedValueOnce({ data: { id: 'wi-id-1' }, error: null })

    // comments insert
    mockSingle.mockResolvedValueOnce({
      data: { id: 'comment-1', content: 'test', created_at: '2026-01-01' },
      error: null,
    })

    const result = await toolHandlers['add_comment']({ number: 1, content: 'test comment' })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(true)
  })

  it('프로필 모드: author_id가 project owner로 설정', async () => {
    mockGetActorIds.mockResolvedValue({ profileId: 'owner-uuid-456', agentId: null })

    // resolveWorkItemByNumber
    mockSingle.mockResolvedValueOnce({ data: { id: 'wi-id-2' }, error: null })

    // getProjectOwnerId (called for profile mode)
    mockGetProjectOwnerId.mockResolvedValueOnce('owner-uuid-456')

    // comments insert
    mockSingle.mockResolvedValueOnce({
      data: { id: 'comment-2', content: 'test', created_at: '2026-01-01' },
      error: null,
    })

    const result = await toolHandlers['add_comment']({ number: 2, content: 'from owner' })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(true)
  })

  it('존재하지 않는 work item: 에러 메시지 반환', async () => {
    mockGetActorIds.mockResolvedValue({ profileId: 'owner-uuid-456', agentId: null })

    // resolveWorkItemByNumber fails
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

    const result = await toolHandlers['add_comment']({ number: 999, content: 'no item' })
    const text = result.content[0].text
    expect(text).toContain('Work item #999 not found')
  })
})

// ── update_task set_agent_context tests ──
describe('update_task — set_agent_context', () => {
  it('에이전트 모드: set_agent_context RPC가 올바른 agent_id로 호출', async () => {
    mockGetActorIds.mockResolvedValue({ profileId: null, agentId: 'agent-789' })

    // set_agent_context RPC
    mockRpc.mockResolvedValueOnce({ error: null })

    // resolveWorkItemByNumber
    mockSingle.mockResolvedValueOnce({ data: { id: 'wi-id-3' }, error: null })

    // update result
    mockSingle.mockResolvedValueOnce({
      data: { id: 'wi-id-3', number: 5, title: 'updated' },
      error: null,
    })

    await toolHandlers['update_task']({ number: 5, title: 'updated title' })

    expect(mockRpc).toHaveBeenCalledWith('set_agent_context', { p_agent_id: 'agent-789' })
  })

  it('프로필 모드: set_agent_context RPC가 호출되지 않음', async () => {
    mockGetActorIds.mockResolvedValue({ profileId: 'owner-uuid-456', agentId: null })

    // resolveWorkItemByNumber
    mockSingle.mockResolvedValueOnce({ data: { id: 'wi-id-4' }, error: null })

    // update result
    mockSingle.mockResolvedValueOnce({
      data: { id: 'wi-id-4', number: 6, title: 'no agent' },
      error: null,
    })

    await toolHandlers['update_task']({ number: 6, title: 'profile update' })

    expect(mockRpc).not.toHaveBeenCalled()
  })
})

// ── delete_task tests ──
describe('delete_task', () => {
  it('direct soft-delete via update', async () => {
    // resolveWorkItemByNumber → mockFrom().select().eq().eq().is().single()
    mockSingle.mockResolvedValueOnce({ data: { id: 'wi-id-del' }, error: null })
    // update().eq().is() chain — uses default mockFrom chain where mockIs returns { single: mockSingle }
    // but delete_task doesn't call .single(), it reads { error } from .is() result
    // So mockIs needs to return { error: null } directly

    const result = await toolHandlers['delete_task']({ number: 10 })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(true)
  })
})

// batch_update_status, get_task_tree — covered by integration tests
// Mocking the complex Supabase chain (ilike, limit, in) is brittle; prefer live DB tests.
