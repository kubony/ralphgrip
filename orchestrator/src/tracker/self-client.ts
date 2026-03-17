import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '../logger.js'

const log = createLogger('self-tracker')

export interface Issue {
  id: string
  identifier: string
  title: string
  description: string | null
  priority: number | null
  state: string
  created_at: string
  updated_at: string
}

interface ActiveIssueRow {
  id: string
  number: number
  title: string
  description: string | null
  priority: number | null
  created_at: string
  updated_at: string
  status: { name: string }
  project: { key: string }
}

interface IssueStateRow {
  id: string
  status: { name: string }
}

interface SelfTrackerConfig {
  supabaseUrl: string
  supabaseKey: string
  projectId: string
  agentId?: string   // if set, comments are attributed to this agent
  activeStates: string[]
  terminalStates: string[]
}

export class SelfTrackerClient {
  private supabase: SupabaseClient
  private projectId: string
  private agentId: string | null
  private activeStates: string[]
  private terminalStates: string[]
  private cachedOwnerId: string | null = null

  constructor(config: SelfTrackerConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: false },
    })
    this.projectId = config.projectId
    this.agentId = config.agentId ?? null
    this.activeStates = config.activeStates
    this.terminalStates = config.terminalStates
  }

  private async getProjectOwnerId(): Promise<string> {
    if (this.cachedOwnerId) return this.cachedOwnerId
    const { data, error } = await this.supabase
      .from('projects')
      .select('owner_id')
      .eq('id', this.projectId)
      .single()
    if (error || !data) throw new Error(`Could not resolve project owner: ${error?.message}`)
    this.cachedOwnerId = data.owner_id
    return data.owner_id
  }

  private async resolveStatusId(statusName: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('statuses')
      .select('id')
      .eq('project_id', this.projectId)
      .ilike('name', statusName)
      .limit(1)
      .single()
    if (error || !data) throw new Error(`Status "${statusName}" not found in project`)
    return data.id
  }

  async fetchActiveIssues(): Promise<Issue[]> {
    const { data, error } = await this.supabase
      .from('work_items')
      .select(`
        id, number, title, description, priority, created_at, updated_at,
        status:statuses!inner(name),
        project:projects!inner(key)
      `)
      .eq('project_id', this.projectId)
      .in('statuses.name', this.activeStates)
      .is('deleted_at', null)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      log.error('Failed to fetch active issues', { error: error.message })
      throw error
    }

    const rows = (data ?? []) as unknown as ActiveIssueRow[]

    return rows.map((item) => ({
      id: item.id,
      identifier: `${item.project.key}-${item.number}`,
      title: item.title,
      description: item.description,
      priority: item.priority,
      state: item.status.name,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }))
  }

  async fetchIssueStates(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map()
    const { data, error } = await this.supabase
      .from('work_items')
      .select('id, status:statuses!inner(name)')
      .in('id', ids)
      .is('deleted_at', null)

    if (error) {
      log.error('Failed to fetch issue states', { error: error.message })
      throw error
    }

    const result = new Map<string, string>()
    const rows = (data ?? []) as unknown as IssueStateRow[]
    for (const item of rows) {
      result.set(item.id, item.status.name)
    }
    return result
  }

  async updateIssueStatus(id: string, statusName: string): Promise<void> {
    const statusId = await this.resolveStatusId(statusName)
    const { error } = await this.supabase
      .from('work_items')
      .update({ status_id: statusId })
      .eq('id', id)

    if (error) {
      log.error('Failed to update issue status', { id, statusName, error: error.message })
      throw error
    }
    log.info('Issue status updated', { id, statusName })
  }

  async addComment(issueId: string, content: string): Promise<void> {
    const insertData: Record<string, unknown> = {
      work_item_id: issueId,
      content,
    }

    if (this.agentId) {
      insertData.agent_id = this.agentId
    } else {
      insertData.author_id = await this.getProjectOwnerId()
    }

    const { error } = await this.supabase
      .from('comments')
      .insert(insertData)

    if (error) {
      log.error('Failed to add comment', { issueId, error: error.message })
      throw error
    }
    log.info('Comment added to issue', { issueId })
  }

  isTerminalState(state: string): boolean {
    return this.terminalStates.some(s => s.toLowerCase() === state.toLowerCase())
  }

  isActiveState(state: string): boolean {
    return this.activeStates.some(s => s.toLowerCase() === state.toLowerCase())
  }
}
