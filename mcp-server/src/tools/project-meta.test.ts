import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockGetProjectId } = vi.hoisted(() => {
  const mockOrder = vi.fn()
  const mockSingle = vi.fn()
  const mockEq = vi.fn(() => ({ order: mockOrder, single: mockSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ select: mockSelect }))

  // Store references for assertions
  ;(mockFrom as any)._mockSelect = mockSelect
  ;(mockFrom as any)._mockEq = mockEq
  ;(mockFrom as any)._mockOrder = mockOrder
  ;(mockFrom as any)._mockSingle = mockSingle

  const mockGetProjectId = vi.fn(() => 'project-uuid-123')
  return { mockFrom, mockGetProjectId }
})

vi.mock('../supabase.js', () => ({
  supabase: { from: mockFrom },
  getProjectId: mockGetProjectId,
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
  it('statuses, trackers, project 정보를 반환', async () => {
    const statusesData = [{ id: 's1', name: 'Open', color: '#fff', position: 0, is_closed: false }]
    const trackersData = [{ id: 't1', name: 'Issue', color: '#000', position: 0 }]
    const projectData = { id: 'project-uuid-123', name: 'Test', key: 'TST', description: null }

    // mockFrom returns chained calls for 3 parallel queries
    // We need to mock Promise.all behavior
    const mockOrder = vi.fn()
    const mockSingle = vi.fn()
    const mockEq = vi.fn()

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

    const result = await toolHandlers['get_project_meta']({})
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed.project).toEqual(projectData)
    expect(parsed.statuses).toEqual(statusesData)
    expect(parsed.trackers).toEqual(trackersData)
  })

  it('statuses 에러 시 에러 메시지 반환', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'statuses error' } }),
        }),
      }),
    })
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    })
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      }),
    })

    const result = await toolHandlers['get_project_meta']({})
    expect(result.content[0].text).toContain('statuses error')
  })
})
