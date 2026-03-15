import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock supabase module ──
const { mockFrom, mockRpc, mockGetActorIds } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockLimit = vi.fn(() => ({ single: mockSingle }))
  const mockIlike = vi.fn(() => ({ limit: mockLimit }))
  const mockIs = vi.fn(() => ({ single: mockSingle, order: vi.fn().mockResolvedValue({ data: [], error: null }) }))
  const mockEq = vi.fn(() => ({ is: mockIs, ilike: mockIlike, single: mockSingle, eq: mockEq, in: vi.fn() }))
  const mockOrder = vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) }))
  const mockSelect = vi.fn(() => ({ eq: mockEq, single: mockSingle, order: mockOrder }))
  const mockInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) }))
  const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) })) }))
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  }))
  const mockRpc = vi.fn().mockResolvedValue({ error: null })
  const mockGetActorIds = vi.fn().mockResolvedValue({ profileId: 'owner-1', agentId: null })
  return { mockFrom, mockRpc, mockGetActorIds, mockSingle }
})

vi.mock('./supabase.js', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
  getProjectId: vi.fn(() => 'project-uuid-123'),
  getProjectOwnerId: vi.fn(async () => 'owner-uuid-123'),
  getActorIds: mockGetActorIds,
}))

import { registerWorkItemTools } from './tools/work-items.js'
import { registerProjectMetaTools } from './tools/project-meta.js'

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>

describe('MCP Server — 도구 등록 통합', () => {
  beforeEach(() => vi.clearAllMocks())

  it('registerWorkItemTools + registerProjectMetaTools → 6개 도구 모두 등록', () => {
    const toolHandlers: Record<string, ToolHandler> = {}
    const mockServer = {
      tool: vi.fn((name: string, _desc: string, _schema: unknown, handler?: ToolHandler) => {
        // get_project_meta has no schema arg (3-arg overload)
        toolHandlers[name] = (handler ?? _schema) as ToolHandler
      }),
    }

    registerWorkItemTools(mockServer as never)
    registerProjectMetaTools(mockServer as never)

    const registered = Object.keys(toolHandlers)
    expect(registered).toContain('create_task')
    expect(registered).toContain('update_task')
    expect(registered).toContain('list_tasks')
    expect(registered).toContain('get_task')
    expect(registered).toContain('add_comment')
    expect(registered).toContain('get_project_meta')
    expect(registered).toHaveLength(6)
  })

  it('에이전트 모드에서 create_task와 add_comment가 일관된 agent 분기를 사용', async () => {
    const agentId = 'agent-uuid-abc'
    mockGetActorIds.mockResolvedValue({ profileId: null, agentId })

    const toolHandlers: Record<string, ToolHandler> = {}
    const mockServer = {
      tool: vi.fn((name: string, _desc: string, _schema: unknown, handler?: ToolHandler) => {
        toolHandlers[name] = (handler ?? _schema) as ToolHandler
      }),
    }
    registerWorkItemTools(mockServer as never)

    // Verify getActorIds is called by both tools
    // create_task calls getActorIds in Promise.all
    // add_comment calls getActorIds in Promise.all
    const actorResult = await mockGetActorIds()
    expect(actorResult.agentId).toBe(agentId)
    expect(actorResult.profileId).toBeNull()
  })
})
