import { describe, expect, it } from 'vitest'
import { getAssigneeDisplay, getReporterDisplay } from '@/lib/assignee-utils'
import type { WorkItemWithRelations, AgentRef, PersonRef } from '@/types/database'

function makeWorkItem(overrides: Partial<WorkItemWithRelations> = {}): WorkItemWithRelations {
  return {
    id: 'wi-1',
    number: 1,
    title: 'Test',
    description: null,
    priority: 1,
    position: 0,
    parent_id: null,
    project_id: 'proj-1',
    tracker_id: 'tr-1',
    status_id: 'st-1',
    reporter_id: 'user-1',
    assignee_id: null,
    agent_assignee_id: null,
    agent_reporter_id: null,
    ai_metadata: null,
    created_by_ai: null,
    deleted_at: null,
    due_date: null,
    start_date: null,
    actual_start_date: null,
    actual_resolved_date: null,
    actual_end_date: null,
    estimated_hours: null,
    actual_hours: null,
    external_url: null,
    folder_id: null,
    level: null,
    visibility: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    tracker: { id: 'tr-1', name: 'Issue', color: null },
    status: { id: 'st-1', name: 'Open', color: null, position: 0, is_closed: false },
    assignee: null,
    reporter: null,
    agent_assignee: null,
    agent_reporter: null,
    ...overrides,
  }
}

const mockPerson: PersonRef = { id: 'user-1', full_name: '홍길동', avatar_url: null }
const mockAgent: AgentRef = { id: 'agent-1', name: 'bot-1', display_name: 'Bot One', avatar_url: null }

describe('assignee-utils', () => {
  describe('getAssigneeDisplay', () => {
    it('returns null when no assignee', () => {
      expect(getAssigneeDisplay(makeWorkItem())).toBeNull()
    })

    it('returns person when human assignee', () => {
      const result = getAssigneeDisplay(makeWorkItem({ assignee: mockPerson }))
      expect(result).toEqual({ name: '홍길동', avatar: null, isAgent: false })
    })

    it('returns agent when agent assignee', () => {
      const result = getAssigneeDisplay(makeWorkItem({ agent_assignee: mockAgent }))
      expect(result).toEqual({ name: 'Bot One', avatar: null, isAgent: true })
    })

    it('prefers human over agent when both present', () => {
      const result = getAssigneeDisplay(makeWorkItem({
        assignee: mockPerson,
        agent_assignee: mockAgent,
      }))
      expect(result?.isAgent).toBe(false)
    })
  })

  describe('getReporterDisplay', () => {
    it('returns null when no reporter', () => {
      expect(getReporterDisplay(makeWorkItem())).toBeNull()
    })

    it('returns person when human reporter', () => {
      const result = getReporterDisplay(makeWorkItem({ reporter: mockPerson }))
      expect(result).toEqual({ name: '홍길동', avatar: null, isAgent: false })
    })

    it('returns agent when agent reporter', () => {
      const result = getReporterDisplay(makeWorkItem({ agent_reporter: mockAgent }))
      expect(result).toEqual({ name: 'Bot One', avatar: null, isAgent: true })
    })
  })
})
