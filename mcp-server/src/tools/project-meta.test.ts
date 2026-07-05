import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  return { mockFrom }
})

vi.mock('../supabase.js', () => ({
  supabase: { from: mockFrom },
  getProjectId: vi.fn(() => 'project-uuid-123'),
  isApiKeyMode: vi.fn(() => false),
}))

vi.mock('../auth.js', () => ({
  resolveProjectId: vi.fn(async () => 'project-uuid-123'),
  logAgentAction: vi.fn(async () => {}),
}))

import { registerProjectMetaTools } from './project-meta.js'

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>
const toolHandlers: Record<string, ToolHandler> = {}
const mockServer = {
  tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: ToolHandler) => {
    toolHandlers[name] = handler
  }),
}

registerProjectMetaTools(mockServer as never)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('get_project_meta', () => {
  it('statuses, trackers, project, members 정보를 반환', async () => {
    const statusesData = [{ id: 's1', name: 'Open', color: '#fff', position: 0, is_closed: false }]
    const trackersData = [{ id: 't1', name: 'Issue', color: '#000', position: 0 }]
    const projectData = { id: 'project-uuid-123', name: 'Test', key: 'TST', description: null, project_type: 'issue' }
    const membersData = [
      { user_id: 'u1', role: 'admin', profile: { id: 'u1', full_name: 'User 1', avatar_url: null } },
    ]

    // First call: statuses
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: statusesData, error: null }),
        }),
      }),
    })
    // Second call: trackers
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: trackersData, error: null }),
        }),
      }),
    })
    // Third call: projects
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: projectData, error: null }),
        }),
      }),
    })
    // Fourth call: project_members
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: membersData, error: null }),
      }),
    })

    const result = await toolHandlers['get_project_meta']({})
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed.project).toEqual(projectData)
    expect(parsed.statuses).toEqual(statusesData)
    expect(parsed.trackers).toEqual(trackersData)
    expect(parsed.members).toHaveLength(1)
    expect(parsed.members[0].full_name).toBe('User 1')
  })

  it('project 조회 에러 시 에러 메시지 반환', async () => {
    // statuses
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    })
    // trackers
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    })
    // projects — error
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'project not found' } }),
        }),
      }),
    })
    // members
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })

    const result = await toolHandlers['get_project_meta']({})
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.error).toBe('NOT_FOUND')
  })
})

describe('list_projects', () => {
  it('레거시 모드에서 단일 프로젝트 반환', async () => {
    const projectData = { id: 'p1', key: 'TST', name: 'Test', description: null, project_type: 'issue', created_at: '2026-01-01' }

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: projectData, error: null }),
        }),
      }),
    })

    const result = await toolHandlers['list_projects']({})
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.projects).toHaveLength(1)
    expect(parsed.projects[0].key).toBe('TST')
  })
})

describe('create_project', () => {
  type AgentCtx = {
    agentId: string
    category: 'global' | 'owned' | 'restricted'
    ownerId: string | null
    projectId: string | null
    accessibleProjectIds: string[]
  }

  // Register a fresh instance with the given agent context and return its create_project handler.
  function handlerFor(ctx: AgentCtx): ToolHandler {
    const handlers: Record<string, ToolHandler> = {}
    const srv = {
      tool: vi.fn((name: string, _d: string, _s: unknown, handler: ToolHandler) => {
        handlers[name] = handler
      }),
    }
    registerProjectMetaTools(srv as never, ctx as never)
    return handlers['create_project']
  }

  const ownedCtx = (): AgentCtx => ({
    agentId: 'agent-1',
    category: 'owned',
    ownerId: 'owner-1',
    projectId: null,
    accessibleProjectIds: [],
  })

  it('레거시 모드(agentCtx 없음)에서는 등록되지 않음', () => {
    // toolHandlers는 파일 상단에서 agentCtx 없이 등록됨 → create_project 미등록
    expect(toolHandlers['create_project']).toBeUndefined()
  })

  it('restricted 에이전트는 PERMISSION_DENIED', async () => {
    const handler = handlerFor({
      agentId: 'agent-1',
      category: 'restricted',
      ownerId: 'owner-1',
      projectId: null,
      accessibleProjectIds: [],
    })
    const result = await handler({ name: 'X', key: 'ABC', project_type: 'issue' })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.error).toBe('PERMISSION_DENIED')
  })

  it('project-scoped 에이전트는 PERMISSION_DENIED', async () => {
    const handler = handlerFor({
      agentId: 'agent-1',
      category: 'owned',
      ownerId: 'owner-1',
      projectId: 'proj-scoped',
      accessibleProjectIds: ['proj-scoped'],
    })
    const result = await handler({ name: 'X', key: 'ABC', project_type: 'issue' })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.error).toBe('PERMISSION_DENIED')
  })

  it('잘못된 key는 VALIDATION_ERROR', async () => {
    const handler = handlerFor(ownedCtx())
    const result = await handler({ name: 'X', key: 'a1', project_type: 'issue' })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.error).toBe('VALIDATION_ERROR')
  })

  it('정상 생성 시 project 반환 + accessibleProjectIds에 추가', async () => {
    const created = { id: 'new-proj-uuid', key: 'DEMO', name: 'Demo', project_type: 'issue' }
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: created, error: null }),
        }),
      }),
    })

    const ctx = ownedCtx()
    const handler = handlerFor(ctx)
    const result = await handler({ name: '  Demo  ', key: 'demo', project_type: 'issue' })
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed.success).toBe(true)
    expect(parsed.project).toEqual({ id: 'new-proj-uuid', key: 'DEMO', name: 'Demo', project_type: 'issue' })
    // 같은 세션에서 create_task가 되도록 접근 캐시에 push
    expect(ctx.accessibleProjectIds).toContain('new-proj-uuid')
  })

  it('repo_url 전달 시 settings.repo.url로 insert', async () => {
    const created = { id: 'new-proj-uuid', key: 'DEMO', name: 'Demo', project_type: 'issue' }
    let insertArg: Record<string, unknown> | undefined
    mockFrom.mockReturnValueOnce({
      insert: vi.fn((arg: Record<string, unknown>) => {
        insertArg = arg
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: created, error: null }),
          }),
        }
      }),
    })

    const handler = handlerFor(ownedCtx())
    const result = await handler({
      name: 'Demo',
      key: 'DEMO',
      project_type: 'issue',
      repo_url: 'https://github.com/kubony/ralphgrip',
    })
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed.success).toBe(true)
    expect(insertArg?.settings).toEqual({ repo: { url: 'https://github.com/kubony/ralphgrip' } })
  })

  it('repo_url 미전달 시 settings 키 없음', async () => {
    const created = { id: 'new-proj-uuid', key: 'DEMO', name: 'Demo', project_type: 'issue' }
    let insertArg: Record<string, unknown> | undefined
    mockFrom.mockReturnValueOnce({
      insert: vi.fn((arg: Record<string, unknown>) => {
        insertArg = arg
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: created, error: null }),
          }),
        }
      }),
    })

    const handler = handlerFor(ownedCtx())
    await handler({ name: 'Demo', key: 'DEMO', project_type: 'issue' })

    expect('settings' in (insertArg ?? {})).toBe(false)
  })

  it('중복 key(23505)는 CONFLICT', async () => {
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } }),
        }),
      }),
    })

    const handler = handlerFor(ownedCtx())
    const result = await handler({ name: 'Demo', key: 'DUP', project_type: 'issue' })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.error).toBe('CONFLICT')
  })
})
