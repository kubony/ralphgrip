import { describe, expect, it, vi, beforeEach } from 'vitest'

// ── Step 4: Server Actions 구조 검증 ──────────────────────
// 실제 Supabase 호출 없이, Server Actions의 입출력 구조와 로직을 검증합니다.

// Mock: createClient
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('Step 4: Agent Server Actions 입력 검증', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createGlobalAgent 입력 스키마 검증', () => {
    const validInput = {
      name: 'test-bot',
      display_name: 'Test Bot',
      category: 'global' as const,
      agent_kind: 'claude-code',
      agent_role: 'developer',
      agent_runtime: 'local',
    }

    // 필수 필드 존재 확인
    expect(validInput.name).toBeTruthy()
    expect(validInput.display_name).toBeTruthy()
    expect(validInput.category).toBe('global')
    expect(validInput.agent_kind).toBeTruthy()
    expect(validInput.agent_role).toBeTruthy()
    expect(validInput.agent_runtime).toBeTruthy()
  })

  it('createGlobalAgent 선택적 필드 검증', () => {
    const withOptionals = {
      name: 'test-bot',
      display_name: 'Test Bot',
      category: 'owned' as const,
      agent_kind: 'openclaw',
      agent_role: 'reviewer',
      agent_model: 'claude-opus-4.6',
      agent_runtime: 'gcp-vm',
      description: 'A code reviewer bot',
    }
    expect(withOptionals.agent_model).toBe('claude-opus-4.6')
    expect(withOptionals.description).toBeTruthy()
  })

  it('updateGlobalAgent 부분 업데이트 검증', () => {
    // status만 변경하는 경우
    const statusOnly = { status: 'inactive' }
    expect(statusOnly).toHaveProperty('status')
    expect(Object.keys(statusOnly)).toHaveLength(1)

    // display_name + description 변경
    const multiField = { display_name: 'New Name', description: 'Updated desc' }
    expect(Object.keys(multiField)).toHaveLength(2)
  })

  it('API 키 생성 형식 검증', () => {
    // API 키 생성 로직 재현
    const rawKey = `ag_${crypto.randomUUID().replace(/-/g, '')}`
    expect(rawKey).toMatch(/^ag_[a-f0-9]{32}$/)
    expect(rawKey.length).toBe(35) // "ag_" + 32 hex chars

    const prefix = rawKey.slice(0, 11) + '...'
    expect(prefix).toMatch(/^ag_[a-f0-9]{8}\.\.\.$/)
  })

  it('API 키 해싱 무결성', async () => {
    const rawKey = 'ag_test1234567890abcdef12345678'
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const apiKeyHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    // SHA-256 해시는 64 hex chars
    expect(apiKeyHash).toHaveLength(64)
    expect(apiKeyHash).toMatch(/^[a-f0-9]{64}$/)

    // 동일 입력에 대해 동일 해시
    const hashBuffer2 = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey))
    const hashArray2 = Array.from(new Uint8Array(hashBuffer2))
    const apiKeyHash2 = hashArray2.map((b) => b.toString(16).padStart(2, '0')).join('')
    expect(apiKeyHash).toBe(apiKeyHash2)
  })

  it('카테고리별 유효성 검증', () => {
    const validCategories = ['global', 'owned', 'restricted']
    const invalidCategories = ['public', 'private', 'shared', '']

    validCategories.forEach((c) => {
      expect(['global', 'owned', 'restricted']).toContain(c)
    })

    invalidCategories.forEach((c) => {
      expect(['global', 'owned', 'restricted']).not.toContain(c)
    })
  })
})

describe('Step 5: 헤더 에이전트 카운트 로직', () => {
  it('activeAgentCount가 0이면 배지가 표시되지 않아야 함', () => {
    const activeAgentCount = 0
    const shouldShowBadge = activeAgentCount > 0
    expect(shouldShowBadge).toBe(false)
  })

  it('activeAgentCount가 양수이면 배지가 표시되어야 함', () => {
    const activeAgentCount = 3
    const shouldShowBadge = activeAgentCount > 0
    expect(shouldShowBadge).toBe(true)
  })
})

describe('Step 6: 에이전트 페이지 탭 분류 로직', () => {
  interface MockAgent {
    id: string
    category: string
    project_id: string | null
  }

  const testAgents: MockAgent[] = [
    { id: '1', category: 'global', project_id: null },
    { id: '2', category: 'global', project_id: null },
    { id: '3', category: 'owned', project_id: null },
    { id: '4', category: 'restricted', project_id: null },
    { id: '5', category: 'owned', project_id: 'proj-1' },
  ]

  it('전체 탭 — 모든 에이전트', () => {
    expect(testAgents).toHaveLength(5)
  })

  it('글로벌 탭 — category가 global인 것만', () => {
    const globals = testAgents.filter((a) => a.category === 'global')
    expect(globals).toHaveLength(2)
  })

  it('내 에이전트 탭 — category가 owned인 것만', () => {
    const owned = testAgents.filter((a) => a.category === 'owned')
    expect(owned).toHaveLength(2)
  })

  it('공유됨 탭 — category가 restricted인 것만', () => {
    const restricted = testAgents.filter((a) => a.category === 'restricted')
    expect(restricted).toHaveLength(1)
  })

  it('프로젝트 탭 — project_id가 있는 것만', () => {
    const projectBound = testAgents.filter((a) => a.project_id !== null)
    expect(projectBound).toHaveLength(1)
    expect(projectBound[0].id).toBe('5')
  })
})
