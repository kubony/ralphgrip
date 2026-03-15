import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @supabase/supabase-js
const { mockFrom, mockInsert, mockSingle, mockRpc } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockInsert = vi.fn(() => ({ error: null }))
  const mockLimit = vi.fn(() => ({ single: mockSingle }))
  const mockIlike = vi.fn(() => ({ limit: mockLimit }))
  const mockIs = vi.fn()
  const mockIn = vi.fn()
  const mockOrder = vi.fn()
  const mockUpdate = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
  const mockEq = vi.fn()
  const mockSelect = vi.fn()

  const mockFrom = vi.fn()
  const mockRpc = vi.fn()

  return { mockFrom, mockInsert, mockSingle, mockRpc }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}))

// Suppress log output
vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { SelfTrackerClient } from './self-client.js'

describe('SelfTrackerClient', () => {
  let client: SelfTrackerClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new SelfTrackerClient({
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      projectId: 'proj-1',
      activeStates: ['Open', 'In Progress'],
      terminalStates: ['Resolved', 'Closed'],
    })
  })

  describe('isTerminalState', () => {
    it('터미널 상태 true 반환', () => {
      expect(client.isTerminalState('Resolved')).toBe(true)
      expect(client.isTerminalState('Closed')).toBe(true)
    })

    it('대소문자 무시', () => {
      expect(client.isTerminalState('resolved')).toBe(true)
      expect(client.isTerminalState('CLOSED')).toBe(true)
    })

    it('비터미널 상태 false 반환', () => {
      expect(client.isTerminalState('Open')).toBe(false)
      expect(client.isTerminalState('In Progress')).toBe(false)
    })
  })

  describe('isActiveState', () => {
    it('활성 상태 true 반환', () => {
      expect(client.isActiveState('Open')).toBe(true)
      expect(client.isActiveState('In Progress')).toBe(true)
    })

    it('대소문자 무시', () => {
      expect(client.isActiveState('open')).toBe(true)
      expect(client.isActiveState('IN PROGRESS')).toBe(true)
    })

    it('비활성 상태 false 반환', () => {
      expect(client.isActiveState('Resolved')).toBe(false)
    })
  })

  describe('addComment', () => {
    it('agentId 없을 때 owner를 author_id로 사용', async () => {
      // getProjectOwnerId
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { owner_id: 'owner-1' }, error: null }),
          }),
        }),
      })

      // insert comment
      mockFrom.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      })

      await client.addComment('issue-1', 'hello')

      // Second mockFrom call should be for comments insert
      const insertCall = mockFrom.mock.calls[1]
      expect(insertCall[0]).toBe('comments')
    })

    it('agentId 있을 때 agent_id 필드 사용', async () => {
      const clientWithAgent = new SelfTrackerClient({
        supabaseUrl: 'https://test.supabase.co',
        supabaseKey: 'test-key',
        projectId: 'proj-1',
        agentId: 'agent-1',
        activeStates: ['Open'],
        terminalStates: ['Closed'],
      })

      mockFrom.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      })

      await clientWithAgent.addComment('issue-1', 'from agent')

      // Should only call from('comments') once (no owner lookup)
      expect(mockFrom).toHaveBeenCalledTimes(1)
      expect(mockFrom).toHaveBeenCalledWith('comments')
    })
  })

  describe('fetchIssueStates', () => {
    it('빈 배열이면 빈 Map 반환', async () => {
      const result = await client.fetchIssueStates([])
      expect(result.size).toBe(0)
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })

  describe('updateIssueStatus', () => {
    it('상태 이름으로 resolveStatusId 후 업데이트', async () => {
      // resolveStatusId
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'status-id-1' }, error: null }),
              }),
            }),
          }),
        }),
      })

      // update work_items
      mockFrom.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })

      await client.updateIssueStatus('wi-1', 'In Progress')

      expect(mockFrom).toHaveBeenCalledWith('statuses')
      expect(mockFrom).toHaveBeenCalledWith('work_items')
    })
  })
})
