import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function createTestSupabase(): SupabaseClient {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Ensure .env.local is configured.'
    )
  }

  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}

export interface TestProject {
  id: string
  key: string
  ownerId: string
  trackerId: string
  trackerName: string
  statusIds: Map<string, string>
}

export async function createTestProject(
  supabase: SupabaseClient,
  opts?: { projectType?: 'issue' | 'requirement' }
): Promise<TestProject> {
  const type = opts?.projectType ?? 'issue'
  // Key must match ^[A-Z]{2,10}$
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const rand = Array.from({ length: 4 }, () => alpha[Math.floor(Math.random() * 26)]).join('')
  const uniqueKey = `TS${rand}`

  // Get the first profile as owner
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .single()
  if (profileErr || !profile) {
    throw new Error(`No profile found for test: ${profileErr?.message}`)
  }

  // Create project
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .insert({
      name: `Integration Test ${uniqueKey}`,
      key: uniqueKey,
      owner_id: profile.id,
      project_type: type,
    })
    .select('id, key, owner_id')
    .single()
  if (projErr || !project) {
    throw new Error(`Failed to create test project: ${projErr?.message}`)
  }

  // Fetch auto-created trackers
  const { data: trackers, error: trackerErr } = await supabase
    .from('trackers')
    .select('id, name')
    .eq('project_id', project.id)
    .order('position')
  if (trackerErr || !trackers?.length) {
    throw new Error(`No trackers found: ${trackerErr?.message}`)
  }

  // Find the non-Folder tracker
  const mainTracker = trackers.find(t => t.name !== 'Folder') ?? trackers[0]

  // Fetch auto-created statuses
  const { data: statuses, error: statusErr } = await supabase
    .from('statuses')
    .select('id, name')
    .eq('project_id', project.id)
    .order('position')
  if (statusErr || !statuses?.length) {
    throw new Error(`No statuses found: ${statusErr?.message}`)
  }

  const statusIds = new Map<string, string>()
  for (const s of statuses) {
    statusIds.set(s.name, s.id)
  }

  return {
    id: project.id,
    key: project.key,
    ownerId: project.owner_id,
    trackerId: mainTracker.id,
    trackerName: mainTracker.name,
    statusIds,
  }
}

export interface TestAgent {
  id: string
  name: string
}

export async function createTestAgent(
  supabase: SupabaseClient,
  projectId: string,
): Promise<TestAgent> {
  const name = `test-agent-${Date.now().toString(36)}`

  const { data, error } = await supabase
    .from('agents')
    .insert({
      project_id: projectId,
      name,
      display_name: `Test Agent ${name}`,
      agent_kind: 'claude-code',
      status: 'active',
    })
    .select('id, name')
    .single()
  if (error || !data) {
    throw new Error(`Failed to create test agent: ${error?.message}`)
  }

  return data
}

export async function cleanupTestProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<void> {
  // Delete in dependency order
  // 1. comments (depend on work_items)
  const { data: workItems } = await supabase
    .from('work_items')
    .select('id')
    .eq('project_id', projectId)
  const workItemIds = (workItems ?? []).map(w => w.id)

  if (workItemIds.length > 0) {
    await supabase.from('comments').delete().in('work_item_id', workItemIds)
    await supabase.from('work_item_links').delete().in('source_id', workItemIds)
    await supabase.from('work_item_links').delete().in('target_id', workItemIds)
    await supabase.from('work_item_audit_logs').delete().in('work_item_id', workItemIds)
  }

  // 2. work_items
  await supabase.from('work_items').delete().eq('project_id', projectId)

  // 3. agents
  await supabase.from('agents').delete().eq('project_id', projectId)

  // 4. statuses, trackers
  await supabase.from('statuses').delete().eq('project_id', projectId)
  await supabase.from('trackers').delete().eq('project_id', projectId)

  // 5. project_members
  await supabase.from('project_members').delete().eq('project_id', projectId)

  // 6. project audit logs
  await supabase.from('project_audit_logs').delete().eq('project_id', projectId)

  // 7. project
  await supabase.from('projects').delete().eq('id', projectId)
}
