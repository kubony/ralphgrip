'use server'

import { createClient } from '@/lib/supabase/server'

interface SearchResultProject {
  id: string
  name: string
  key: string
  project_type: string
}

interface SearchResultWorkItem {
  id: string
  number: number
  title: string
  project_key: string
  project_name: string
  tracker_name: string
  tracker_color: string
  status_name: string
  status_color: string
}

export interface SearchResult {
  projects: SearchResultProject[]
  workItems: SearchResultWorkItem[]
}

export async function globalSearch(query: string): Promise<SearchResult> {
  const trimmed = query.trim()
  if (!trimmed) {
    return { projects: [], workItems: [] }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { projects: [], workItems: [] }

  // KEY-123 패턴 감지 (예: WRV-12)
  const keyNumberMatch = trimmed.match(/^([A-Za-z]+)-(\d+)$/i)
  // 숫자만 입력
  const numberOnly = /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : null

  // Sanitize search input to prevent PostgREST filter injection
  const sanitized = trimmed.replace(/[%,.*()\\]/g, '')

  const projectsPromise = supabase
    .from('projects')
    .select('id, name, key, project_type')
    .is('deleted_at', null)
    .or(`name.ilike.%${sanitized}%,key.ilike.%${sanitized}%`)
    .limit(5)

  let workItemsQuery = supabase
    .from('work_items')
    .select(`
      id, number, title,
      project:projects!inner(key, name),
      tracker:trackers!inner(name, color),
      status:statuses!inner(name, color)
    `)
    .is('deleted_at', null)

  if (keyNumberMatch) {
    const [, projectKey, numberStr] = keyNumberMatch
    workItemsQuery = workItemsQuery
      .eq('project.key', projectKey.toUpperCase())
      .eq('number', parseInt(numberStr, 10))
      .limit(10)
  } else if (numberOnly !== null) {
    workItemsQuery = workItemsQuery
      .eq('number', numberOnly)
      .limit(10)
  } else {
    workItemsQuery = workItemsQuery
      .or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
      .limit(10)
  }

  const [projectsResult, workItemsResult] = await Promise.all([
    projectsPromise,
    workItemsQuery,
  ])

  const projects: SearchResultProject[] = (projectsResult.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    key: p.key,
    project_type: p.project_type,
  }))

  const workItems: SearchResultWorkItem[] = (workItemsResult.data || []).map((w: Record<string, unknown>) => {
    const project = w.project as Record<string, string>
    const tracker = w.tracker as Record<string, string>
    const status = w.status as Record<string, string>
    return {
      id: w.id as string,
      number: w.number as number,
      title: w.title as string,
      project_key: project.key,
      project_name: project.name,
      tracker_name: tracker.name,
      tracker_color: tracker.color,
      status_name: status.name,
      status_color: status.color,
    }
  })

  return { projects, workItems }
}
