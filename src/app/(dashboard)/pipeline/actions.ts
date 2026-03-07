'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ProjectSettings, PipelinePhase, PipelineCategory } from '@/types/database'

export interface PipelineUpdate {
  pipeline_start_date?: string
  pipeline_end_date?: string
  pipeline_budget?: string
  pipeline_phase?: PipelinePhase
  pipeline_note?: string
  pipeline_category?: PipelineCategory
}

async function requireWriteAccess(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '로그인이 필요합니다.', supabase: null, user: null } as const
  }

  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return { error: '프로젝트 멤버가 아닙니다.', supabase: null, user: null } as const
  }

  if (member.role === 'viewer') {
    return { error: '보기 전용 권한으로는 이 작업을 수행할 수 없습니다.', supabase: null, user: null } as const
  }

  return { error: null, supabase, user } as const
}

export async function updatePipelineInfo(
  projectId: string,
  currentSettings: ProjectSettings | null,
  updates: PipelineUpdate
) {
  const { error: authError, supabase } = await requireWriteAccess(projectId)
  if (authError || !supabase) return { error: authError || '권한 확인 실패' }

  const merged: ProjectSettings = {
    ...(currentSettings ?? {}),
    ...updates,
  }

  const { error } = await supabase
    .from('projects')
    .update({ settings: merged })
    .eq('id', projectId)

  if (error) {
    console.error('[pipeline] updatePipelineInfo error:', error.message)
    return { error: error.message }
  }

  revalidatePath('/pipeline')
  return { success: true }
}
