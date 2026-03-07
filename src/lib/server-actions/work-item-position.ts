import 'server-only'

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

export const MAX_POSITION_INSERT_ATTEMPTS = 5

export async function getNextWorkItemPosition(
  supabase: SupabaseClient,
  projectId: string,
  parentId: string | null
): Promise<number> {
  const query = supabase
    .from('work_items')
    .select('position')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)

  if (parentId) {
    query.eq('parent_id', parentId)
  } else {
    query.is('parent_id', null)
  }

  const { data: siblings, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return siblings && siblings.length > 0 ? siblings[0].position + 1 : 0
}

export function isWorkItemPositionConflict(error: PostgrestError | null | undefined): boolean {
  if (!error || error.code !== '23505') return false

  const message = `${error.message} ${error.details ?? ''}`
  return (
    message.includes('work_items_project_parent_position_unique') ||
    message.includes('work_items_project_root_position_unique')
  )
}
