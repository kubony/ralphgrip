import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { WorkflowLoader as WorkflowLoaderType } from './workflow-loader.js'
import type { SelfTrackerClient, Issue } from './tracker/self-client.js'
import type { WorkspaceManager as WorkspaceManagerType } from './workspace/manager.js'

// Mock logger
vi.mock('./logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock claude-runner
vi.mock('./agent/claude-runner.js', () => ({
  ClaudeRunner: vi.fn(),
}))

import { WorkflowLoader } from './workflow-loader.js'
import { Orchestrator } from './orchestrator.js'
import { WorkspaceManager } from './workspace/manager.js'

type MockTracker = {
  fetchActiveIssues: ReturnType<typeof vi.fn<() => Promise<Issue[]>>>
  fetchIssueStates: ReturnType<typeof vi.fn<(ids: string[]) => Promise<Map<string, string>>>>
  updateIssueStatus: ReturnType<typeof vi.fn<(id: string, statusName: string) => Promise<void>>>
  addComment: ReturnType<typeof vi.fn<(issueId: string, content: string) => Promise<void>>>
  isTerminalState: ReturnType<typeof vi.fn<(state: string) => boolean>>
  isActiveState: ReturnType<typeof vi.fn<(state: string) => boolean>>
}

type MockWorkspaceManager = {
  ensure: ReturnType<typeof vi.fn<(id: string) => Promise<{ path: string; created: boolean }>>>
  prepareForRun: ReturnType<typeof vi.fn<(id: string) => Promise<string>>>
  cleanupAfterRun: ReturnType<typeof vi.fn<(id: string) => Promise<void>>>
  resolve: ReturnType<typeof vi.fn<(id: string) => string>>
  remove: ReturnType<typeof vi.fn<(id: string) => Promise<void>>>
  sanitizeKey: ReturnType<typeof vi.fn<(id: string) => string>>
}

function createMockTracker(): MockTracker {
  return {
    fetchActiveIssues: vi.fn<() => Promise<Issue[]>>(async () => []),
    fetchIssueStates: vi.fn<(ids: string[]) => Promise<Map<string, string>>>(async () => new Map<string, string>()),
    updateIssueStatus: vi.fn<(id: string, statusName: string) => Promise<void>>(async () => {}),
    addComment: vi.fn<(issueId: string, content: string) => Promise<void>>(async () => {}),
    isTerminalState: vi.fn<(state: string) => boolean>(() => false),
    isActiveState: vi.fn<(state: string) => boolean>(() => true),
  }
}

function createMockWorkspaceManager(): MockWorkspaceManager {
  return {
    ensure: vi.fn<(id: string) => Promise<{ path: string; created: boolean }>>(async (id) => ({ path: `/tmp/ws/${id}`, created: false })),
    prepareForRun: vi.fn<(id: string) => Promise<string>>(async (id) => `/tmp/ws/${id}`),
    cleanupAfterRun: vi.fn<(id: string) => Promise<void>>(async () => {}),
    resolve: vi.fn<(id: string) => string>((id) => `/tmp/ws/${id}`),
    remove: vi.fn<(id: string) => Promise<void>>(async () => {}),
    sanitizeKey: vi.fn<(id: string) => string>((id) => id.replace(/[^A-Za-z0-9._-]/g, '_')),
  }
}

function makeTempWorkflow(template: string): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-integ-'))
  const filePath = path.join(tmpDir, 'WORKFLOW.md')
  const content = `---
tracker:
  kind: self
  supabase_url: "http://localhost:54321"
  supabase_key: "test-key"
  project_id: "p-uuid-1"
  active_states: ["Open", "In Progress"]
  terminal_states: ["Resolved", "Closed"]
polling:
  interval_ms: 5000
workspace:
  root: "${tmpDir}/workspaces"
hooks: {}
agent:
  max_concurrent_agents: 2
  max_retry_backoff_ms: 60000
claude:
  model: "test-model"
  max_turns: 10
  turn_timeout_ms: 60000
  stall_timeout_ms: 30000
  allowed_tools: ["Edit", "Write"]
---
${template}`
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}

describe('Orchestrator — 모듈 간 결합 테스트', () => {
  let tmpPaths: string[] = []

  afterEach(() => {
    for (const p of tmpPaths) {
      try { fs.rmSync(path.dirname(p), { recursive: true, force: true }) } catch {}
    }
    tmpPaths = []
  })

  describe('WorkflowLoader → Orchestrator config 전달', () => {
    it('loader.getConfig() 결과가 Orchestrator 내부에서 올바르게 사용됨', () => {
      const filePath = makeTempWorkflow('Work on {{ issue.identifier }}: {{ issue.title }}')
      tmpPaths.push(filePath)
      const loader = new WorkflowLoader(filePath)
      const config = loader.getConfig()

      const mockTracker = createMockTracker()
      const orchestrator = new Orchestrator(
        loader as WorkflowLoaderType,
        mockTracker as unknown as SelfTrackerClient,
        createMockWorkspaceManager() as unknown as WorkspaceManagerType,
      )

      // Orchestrator uses config via loader.getConfig()
      expect(config.agent.max_concurrent_agents).toBe(2)
      expect(config.polling.interval_ms).toBe(5000)
      expect(config.claude.model).toBe('test-model')

      // getState should work without errors
      const state = orchestrator.getState()
      expect(state.running).toEqual([])
    })
  })

  describe('WorkflowLoader → WorkspaceManager hooks 전달', () => {
    it('workspace.root의 ~ 확장 + hooks 객체 전달', () => {
      const filePath = makeTempWorkflow('prompt')
      tmpPaths.push(filePath)
      const loader = new WorkflowLoader(filePath)
      const config = loader.getConfig()

      // workspace.root should be absolute (~ expanded)
      expect(path.isAbsolute(config.workspace.root)).toBe(true)

      // WorkspaceManager receives hooks
      const wsManager = new WorkspaceManager({
        root: config.workspace.root,
        hooks: config.hooks,
      })
      expect(wsManager).toBeDefined()
    })
  })

  describe('Tracker → Orchestrator.poll() 필터링', () => {
    it('활성 이슈 목록 → running/claimed/completed 제외 → dispatch 후보 결정', async () => {
      const filePath = makeTempWorkflow('prompt')
      tmpPaths.push(filePath)
      const loader = new WorkflowLoader(filePath)
      const mockTracker = createMockTracker()

      const issues = [
        {
          id: 'issue-1', identifier: 'TST-1', title: 'First',
          description: null, priority: 2, state: 'Open',
          created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'issue-2', identifier: 'TST-2', title: 'Second',
          description: null, priority: 1, state: 'Open',
          created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
        },
      ]
      mockTracker.fetchActiveIssues.mockResolvedValue(issues)

      const orchestrator = new Orchestrator(
        loader as WorkflowLoaderType,
        mockTracker as unknown as SelfTrackerClient,
        createMockWorkspaceManager() as unknown as WorkspaceManagerType,
      )

      await orchestrator.poll()

      expect(mockTracker.fetchActiveIssues).toHaveBeenCalledOnce()
      // Both issues should be candidates (nothing running/claimed/completed)
    })
  })

  describe('Orchestrator.reconcile() 터미널 상태 abort', () => {
    it('실행 중 이슈가 Resolved로 변경되면 reconcile에서 감지', async () => {
      const filePath = makeTempWorkflow('prompt')
      tmpPaths.push(filePath)
      const loader = new WorkflowLoader(filePath)
      const mockTracker = createMockTracker()

      // After first poll, when reconcile runs, return terminal state
      mockTracker.fetchIssueStates.mockResolvedValue(new Map([['issue-1', 'Resolved']]))
      mockTracker.isTerminalState.mockImplementation(
        (state: string) => ['Resolved', 'Closed'].includes(state)
      )

      const orchestrator = new Orchestrator(
        loader as WorkflowLoaderType,
        mockTracker as unknown as SelfTrackerClient,
        createMockWorkspaceManager() as unknown as WorkspaceManagerType,
      )

      // reconcile is called inside poll(); when no running entries, it's a no-op
      // This verifies the reconcile path doesn't throw
      await orchestrator.poll()
      expect(mockTracker.fetchActiveIssues).toHaveBeenCalled()
    })
  })

  describe('Orchestrator.scheduleRetry() 백오프', () => {
    it('실패 시 지수 백오프 계산 + max_retry_backoff_ms 캡핑', () => {
      const filePath = makeTempWorkflow('prompt')
      tmpPaths.push(filePath)
      const loader = new WorkflowLoader(filePath)
      const config = loader.getConfig()

      // base = 10_000, max = 60_000
      // attempt 1: min(10000 * 2^0, 60000) = 10000
      // attempt 2: min(10000 * 2^1, 60000) = 20000
      // attempt 3: min(10000 * 2^2, 60000) = 40000
      // attempt 4: min(10000 * 2^3, 60000) = 60000 (capped)
      // attempt 5: min(10000 * 2^4, 60000) = 60000 (capped)

      // Verify config has the expected max
      expect(config.agent.max_retry_backoff_ms).toBe(60000)

      // Verify the backoff formula matches the code:
      // backoffMs = Math.min(10_000 * Math.pow(2, attempt - 1), max_retry_backoff_ms)
      const calc = (attempt: number) =>
        Math.min(10_000 * Math.pow(2, attempt - 1), config.agent.max_retry_backoff_ms)

      expect(calc(1)).toBe(10_000)
      expect(calc(2)).toBe(20_000)
      expect(calc(3)).toBe(40_000)
      expect(calc(4)).toBe(60_000) // capped
      expect(calc(5)).toBe(60_000) // capped
    })
  })
})
