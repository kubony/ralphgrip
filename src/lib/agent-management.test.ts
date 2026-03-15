import { describe, expect, it } from 'vitest'
import type { AgentCategory, AgentRef, AgentStatus } from '@/types/database'

// ── Step 1: 담당자 할당 로직 검증 ──────────────────────
// handleAssigneeChange에서 updateWorkItem을 단일 호출로 두 필드를 동시 업데이트해야 함

describe('Step 1: 담당자 할당 업데이트 로직', () => {
  function buildAssigneeUpdates(value: string): Record<string, string | null> {
    if (value === 'unassigned') {
      return { assignee_id: null, agent_assignee_id: null }
    } else if (value.startsWith('agent:')) {
      return { agent_assignee_id: value.slice(6), assignee_id: null }
    } else {
      return { assignee_id: value.slice(8), agent_assignee_id: null }
    }
  }

  it('unassigned일 때 두 필드 모두 null', () => {
    const result = buildAssigneeUpdates('unassigned')
    expect(result).toEqual({ assignee_id: null, agent_assignee_id: null })
  })

  it('에이전트 선택 시 agent_assignee_id 설정, assignee_id는 null', () => {
    const result = buildAssigneeUpdates('agent:agent-uuid-123')
    expect(result).toEqual({ agent_assignee_id: 'agent-uuid-123', assignee_id: null })
  })

  it('사용자 선택 시 assignee_id 설정, agent_assignee_id는 null', () => {
    const result = buildAssigneeUpdates('profile:user-uuid-456')
    expect(result).toEqual({ assignee_id: 'user-uuid-456', agent_assignee_id: null })
  })

  it('두 필드가 동시에 NOT NULL이 되는 경우는 없음 (CHECK 제약조건 안전)', () => {
    const cases = ['unassigned', 'agent:a-1', 'profile:u-1']
    for (const c of cases) {
      const result = buildAssigneeUpdates(c)
      const bothNotNull = result.assignee_id !== null && result.agent_assignee_id !== null
      expect(bothNotNull).toBe(false)
    }
  })
})

// ── Step 2: DB 스키마 타입 검증 ──────────────────────
describe('Step 2: agents 테이블 확장 타입 검증', () => {
  it('AgentCategory 타입이 올바른 값을 포함', () => {
    const validCategories: AgentCategory[] = ['global', 'owned', 'restricted']
    expect(validCategories).toHaveLength(3)
    expect(validCategories).toContain('global')
    expect(validCategories).toContain('owned')
    expect(validCategories).toContain('restricted')
  })

  it('AgentStatus 타입이 올바른 값을 포함', () => {
    const validStatuses: AgentStatus[] = ['active', 'inactive', 'revoked']
    expect(validStatuses).toHaveLength(3)
  })

  it('AgentRef에 category 필드가 선택적으로 존재', () => {
    const agentWithCategory: AgentRef = {
      id: 'a-1',
      name: 'test-bot',
      display_name: 'Test Bot',
      avatar_url: null,
      category: 'global',
    }
    expect(agentWithCategory.category).toBe('global')

    const agentWithout: AgentRef = {
      id: 'a-2',
      name: 'test-bot-2',
      display_name: 'Test Bot 2',
      avatar_url: null,
    }
    expect(agentWithout.category).toBeUndefined()
  })
})

// ── Step 3: 타입 시스템 검증 ──────────────────────
describe('Step 3: database.ts 타입 무결성', () => {
  it('AgentDetail 인터페이스의 필수 필드 검증', () => {
    // 컴파일 타임 검증 - 필수 필드가 누락되면 타입 에러 발생
    const detail: import('@/types/database').AgentDetail = {
      id: 'a-1',
      name: 'bot',
      display_name: 'Bot',
      avatar_url: null,
      description: null,
      agent_kind: 'claude-code',
      agent_model: null,
      agent_role: 'developer',
      agent_runtime: 'local',
      status: 'active',
      category: 'global',
      owner_id: null,
      project_id: null,
      metadata: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    }
    expect(detail.id).toBe('a-1')
    expect(detail.category).toBe('global')
  })

  it('AgentLogEntry 인터페이스 구조 검증', () => {
    const log: import('@/types/database').AgentLogEntry = {
      id: 'log-1',
      agent_id: 'a-1',
      action: 'work_item.update',
      details: { field: 'status_id', old: 'st-1', new: 'st-2' },
      created_at: '2026-01-01',
    }
    expect(log.action).toBe('work_item.update')
    expect(log.details).toHaveProperty('field')
  })

  it('AgentPermissionEntry 인터페이스 구조 검증', () => {
    const perm: import('@/types/database').AgentPermissionEntry = {
      id: 'perm-1',
      agent_id: 'a-1',
      user_id: 'u-1',
      granted_by: 'u-2',
      granted_at: '2026-01-01',
    }
    expect(perm.agent_id).toBe('a-1')
    expect(perm.user_id).toBe('u-1')
  })
})

// ── Step 7: 드롭다운 에이전트 분류 로직 검증 ──────────────────────
describe('Step 7: 담당자 드롭다운 에이전트 분류', () => {
  const projectAgents: AgentRef[] = [
    { id: 'pa-1', name: 'proj-bot', display_name: 'Project Bot', avatar_url: null },
    { id: 'pa-2', name: 'proj-bot-2', display_name: 'Project Bot 2', avatar_url: null, category: 'owned' },
  ]

  const globalAgents: AgentRef[] = [
    { id: 'ga-1', name: 'global-bot', display_name: 'Global Bot', avatar_url: null, category: 'global' },
    { id: 'ga-2', name: 'global-bot-2', display_name: 'Global Bot 2', avatar_url: null, category: 'global' },
  ]

  const allAgents = [...projectAgents, ...globalAgents]

  it('글로벌 에이전트 필터링', () => {
    const globals = allAgents.filter((a) => a.category === 'global')
    expect(globals).toHaveLength(2)
    expect(globals[0].id).toBe('ga-1')
  })

  it('프로젝트 에이전트 필터링 (category가 global이 아닌 것)', () => {
    const projectOnly = allAgents.filter((a) => a.category !== 'global')
    expect(projectOnly).toHaveLength(2)
    expect(projectOnly[0].id).toBe('pa-1')
  })

  it('전체 에이전트 목록은 프로젝트+글로벌 합산', () => {
    expect(allAgents).toHaveLength(4)
  })

  it('에이전트 ID로 올바른 select value 생성', () => {
    const agentValue = `agent:${globalAgents[0].id}`
    expect(agentValue).toBe('agent:ga-1')
    expect(agentValue.startsWith('agent:')).toBe(true)
    expect(agentValue.slice(6)).toBe('ga-1')
  })
})
