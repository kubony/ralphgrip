'use server'

import { createClient } from '@/lib/supabase/server'
import { exportToGoogleSheet, type GSheetWorkItem } from '@/lib/gsheet-export'
import { requireAuthenticatedUser } from '@/lib/server-actions/auth'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validateExportInput(
  accessToken: string,
  projectId: string,
  options?: { external?: boolean }
): {
  error: string | null
  normalizedAccessToken: string
  normalizedOptions: { external?: boolean }
} {
  const token = accessToken?.trim()
  if (!token) {
    return {
      error: 'Google 인증 토큰이 유효하지 않습니다.',
      normalizedAccessToken: '',
      normalizedOptions: {},
    }
  }

  if (!UUID_REGEX.test(projectId)) {
    return {
      error: '유효하지 않은 프로젝트 ID입니다.',
      normalizedAccessToken: '',
      normalizedOptions: {},
    }
  }

  if (options && typeof options.external !== 'undefined' && typeof options.external !== 'boolean') {
    return {
      error: '잘못된 export 옵션입니다.',
      normalizedAccessToken: '',
      normalizedOptions: {},
    }
  }

  return {
    error: null,
    normalizedAccessToken: token,
    normalizedOptions: options ?? {},
  }
}

export async function exportWorkItemsToGoogleSheet(
  accessToken: string,
  projectId: string,
  options?: { external?: boolean },
) {
  const {
    error: inputError,
    normalizedAccessToken,
    normalizedOptions,
  } = validateExportInput(accessToken, projectId, options)
  if (inputError) return { error: inputError }

  const supabase = await createClient()
  const auth = await requireAuthenticatedUser(supabase)
  if (!auth.user) return { error: auth.error ?? '로그인이 필요합니다.' }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, key')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return { error: '프로젝트 접근 권한이 없습니다.' }
  }

  const { data: workItems, error: workItemsError } = await supabase
    .from('work_items')
    .select(`
      id,
      number,
      title,
      description,
      parent_id,
      position,
      priority,
      visibility,
      due_date,
      start_date,
      actual_start_date,
      actual_end_date,
      estimated_hours,
      actual_hours,
      external_url,
      created_at,
      updated_at,
      status:statuses(id, name),
      tracker:trackers(id, name),
      assignee:profiles!work_items_assignee_id_fkey(id, full_name),
      reporter:profiles!work_items_reporter_id_fkey(id, full_name)
    `)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('position')

  if (workItemsError) {
    return { error: workItemsError.message }
  }

  const normalizedItems: GSheetWorkItem[] = (workItems ?? []).map((item) => {
    const status = Array.isArray(item.status) ? item.status[0] : item.status
    const tracker = Array.isArray(item.tracker) ? item.tracker[0] : item.tracker
    const assignee = Array.isArray(item.assignee) ? item.assignee[0] : item.assignee
    const reporter = Array.isArray(item.reporter) ? item.reporter[0] : item.reporter

    return {
      id: item.id,
      number: item.number,
      title: item.title,
      description: item.description,
      parent_id: item.parent_id,
      position: item.position,
      priority: item.priority,
      visibility: item.visibility,
      due_date: item.due_date,
      start_date: item.start_date,
      actual_start_date: item.actual_start_date,
      actual_end_date: item.actual_end_date,
      estimated_hours: item.estimated_hours,
      actual_hours: item.actual_hours,
      external_url: item.external_url,
      created_at: item.created_at,
      updated_at: item.updated_at,
      status: {
        id: status?.id ?? '',
        name: status?.name ?? '',
      },
      tracker: {
        id: tracker?.id ?? '',
        name: tracker?.name ?? '',
      },
      assignee: assignee
        ? {
            id: assignee.id,
            full_name: assignee.full_name,
          }
        : null,
      reporter: reporter
        ? {
            id: reporter.id,
            full_name: reporter.full_name,
          }
        : null,
    }
  })

  try {
    const result = await exportToGoogleSheet(normalizedAccessToken, normalizedItems, project.name, project.key, normalizedOptions)
    return { data: result }
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류'
    console.error('Google Sheets export 실패:', message)
    return { error: message }
  }
}
