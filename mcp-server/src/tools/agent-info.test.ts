import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('../supabase.js', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('../auth.js', () => ({
  resolveProjectId: vi.fn(async () => 'project-uuid-123'),
  logAgentAction: vi.fn(async () => {}),
}))

import { registerAgentInfoTools } from './agent-info.js'

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>

const toolHandlers: Record<string, ToolHandler> = {}
const mockServer = {
  tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: ToolHandler) => {
    toolHandlers[name] = handler
  }),
}

// API key mode (agentCtx present) → report_* tools are registered.
const agentCtx = {
  agentId: 'agent-1',
  agentName: 'test-agent',
  accessibleProjectIds: ['project-uuid-123'],
} as never

registerAgentInfoTools(mockServer as never, agentCtx)

beforeEach(() => {
  vi.clearAllMocks()
})

/**
 * Wire mockFrom so that:
 *  - work_items.select(...).eq().eq().is().single() → resolves the work item id
 *  - work_items.update(...).eq() → captures the update payload
 *  - statuses.select(...).eq().ilike().limit().single() → resolves a status id
 *  - comments.insert(...) → resolves ok
 */
function setup() {
  const captured: { updateArg?: Record<string, unknown> } = {}
  mockFrom.mockImplementation((table: string) => {
    if (table === 'work_items') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({ single: async () => ({ data: { id: 'wi-1' }, error: null }) }),
            }),
          }),
        }),
        update: (arg: Record<string, unknown>) => {
          captured.updateArg = arg
          return { eq: async () => ({ error: null }) }
        },
      }
    }
    if (table === 'statuses') {
      return {
        select: () => ({
          eq: () => ({
            ilike: () => ({
              limit: () => ({ single: async () => ({ data: { id: 'status-1' }, error: null }) }),
            }),
          }),
        }),
      }
    }
    if (table === 'comments') {
      return { insert: async () => ({ error: null }) }
    }
    throw new Error(`unexpected table: ${table}`)
  })
  return captured
}

describe('report_progress — git_context', () => {
  it('git 인자 전달 시 git_context가 updated_at과 함께 update됨', async () => {
    const captured = setup()
    const git = { repo_url: 'https://github.com/kubony/ralphgrip', branch: 'feat/x', worktree: '/tmp/wt', commit: 'abc123' }

    const result = await toolHandlers['report_progress']({ number: 1, message: '진행', set_in_progress: true, git })
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed.success).toBe(true)
    expect(captured.updateArg?.git_context).toMatchObject(git)
    expect((captured.updateArg?.git_context as Record<string, unknown>).updated_at).toBeTruthy()
    // status_id도 함께 갱신됨 (In Progress 전이)
    expect(captured.updateArg?.status_id).toBe('status-1')
  })

  it('git 미전달 시 update에 git_context 키 없음 (기존 값 유지)', async () => {
    const captured = setup()

    const result = await toolHandlers['report_progress']({ number: 1, message: '진행', set_in_progress: true })
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed.success).toBe(true)
    expect(captured.updateArg).toBeDefined()
    expect('git_context' in (captured.updateArg ?? {})).toBe(false)
  })
})

describe('mark_resolved — git_context', () => {
  it('git 인자 전달 시 git_context가 update됨', async () => {
    const captured = setup()
    const git = { repo_url: 'https://github.com/kubony/ralphgrip', branch: 'feat/x', commit: 'def456' }

    const result = await toolHandlers['mark_resolved']({ number: 1, summary: '완료', git })
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed.success).toBe(true)
    expect(captured.updateArg?.git_context).toMatchObject(git)
  })
})
