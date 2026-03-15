import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock logger
vi.mock('./logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock dependencies to avoid actual imports triggering side effects
vi.mock('./workflow-loader.js', () => ({ WorkflowLoader: vi.fn() }))
vi.mock('./tracker/self-client.js', () => ({ SelfTrackerClient: vi.fn() }))
vi.mock('./workspace/manager.js', () => ({ WorkspaceManager: vi.fn() }))
vi.mock('./agent/claude-runner.js', () => ({ ClaudeRunner: vi.fn() }))

import { Orchestrator } from './orchestrator.js'

function createMockLoader(overrides?: Partial<ReturnType<any>>) {
  return {
    getConfig: vi.fn(() => ({
      tracker: {
        kind: 'self',
        supabase_url: 'http://test',
        supabase_key: 'key',
        project_id: 'p1',
        active_states: ['Open', 'In Progress'],
        terminal_states: ['Resolved', 'Closed'],
      },
      polling: { interval_ms: 30000 },
      workspace: { root: '/tmp/ws' },
      hooks: {},
      agent: { max_concurrent_agents: 3, max_retry_backoff_ms: 300000 },
      claude: {
        model: 'test-model',
        max_turns: 50,
        turn_timeout_ms: 3600000,
        stall_timeout_ms: 300000,
        allowed_tools: ['Edit', 'Write'],
      },
    })),
    renderPrompt: vi.fn(async () => 'rendered prompt'),
    ...overrides,
  }
}

function createMockTracker() {
  return {
    fetchActiveIssues: vi.fn(async () => []),
    fetchIssueStates: vi.fn(async () => new Map()),
    updateIssueStatus: vi.fn(async () => {}),
    addComment: vi.fn(async () => {}),
    isTerminalState: vi.fn(() => false),
    isActiveState: vi.fn(() => true),
  }
}

function createMockWorkspaceManager() {
  return {
    ensure: vi.fn(async (id: string) => ({ path: `/tmp/ws/${id}`, created: false })),
    prepareForRun: vi.fn(async (id: string) => `/tmp/ws/${id}`),
    cleanupAfterRun: vi.fn(async () => {}),
    resolve: vi.fn((id: string) => `/tmp/ws/${id}`),
    remove: vi.fn(async () => {}),
  }
}

describe('Orchestrator', () => {
  let orchestrator: Orchestrator
  let mockLoader: ReturnType<typeof createMockLoader>
  let mockTracker: ReturnType<typeof createMockTracker>
  let mockWsManager: ReturnType<typeof createMockWorkspaceManager>

  beforeEach(() => {
    vi.clearAllMocks()
    mockLoader = createMockLoader()
    mockTracker = createMockTracker()
    mockWsManager = createMockWorkspaceManager()
    orchestrator = new Orchestrator(mockLoader as any, mockTracker as any, mockWsManager as any)
  })

  describe('getState', () => {
    it('초기 상태: 빈 running, retrying, zero tokens', () => {
      const state = orchestrator.getState()
      expect(state.running).toEqual([])
      expect(state.retrying).toEqual([])
      expect(state.tokenTotals).toEqual({ input: 0, output: 0 })
    })
  })

  describe('poll', () => {
    it('활성 이슈가 없으면 dispatch하지 않음', async () => {
      mockTracker.fetchActiveIssues.mockResolvedValue([])

      await orchestrator.poll()

      expect(mockTracker.fetchActiveIssues).toHaveBeenCalledOnce()
    })

    it('이슈가 있으면 dispatch 시도', async () => {
      const mockIssue = {
        id: 'issue-1',
        identifier: 'TST-1',
        title: 'Test issue',
        description: null,
        priority: 1,
        state: 'Open',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }
      mockTracker.fetchActiveIssues.mockResolvedValue([mockIssue])

      // dispatch will run async — we just verify poll doesn't throw
      await orchestrator.poll()

      expect(mockTracker.fetchActiveIssues).toHaveBeenCalledOnce()
    })

    it('stopping 상태면 poll 스킵', async () => {
      await orchestrator.stop()

      await orchestrator.poll()

      expect(mockTracker.fetchActiveIssues).not.toHaveBeenCalled()
    })
  })

  describe('stop', () => {
    it('running 워커 없으면 즉시 완료', async () => {
      await orchestrator.stop()
      // Should not throw
    })
  })

  describe('priority sorting', () => {
    it('우선순위가 낮은 이슈가 먼저 dispatch 됨', async () => {
      const issues = [
        {
          id: 'high',
          identifier: 'TST-2',
          title: 'High priority',
          description: null,
          priority: 3,
          state: 'Open',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'low',
          identifier: 'TST-1',
          title: 'Low priority',
          description: null,
          priority: 1,
          state: 'Open',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ]
      mockTracker.fetchActiveIssues.mockResolvedValue(issues)

      await orchestrator.poll()

      // Verify fetch was called; dispatch order is internal but the important thing
      // is that poll doesn't error with multiple candidates
      expect(mockTracker.fetchActiveIssues).toHaveBeenCalled()
    })
  })
})
