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
