import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getServiceClient } from '@/lib/supabase/service'
import { getNextWorkItemPosition, isWorkItemPositionConflict, MAX_POSITION_INSERT_ATTEMPTS } from '@/lib/server-actions/work-item-position'
import { normalizeWorkItemDateTimeForStorage } from '@/lib/work-item-datetime'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function POST(request: NextRequest) {
  // Bearer 토큰 인증
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token || token !== process.env.INTERNAL_API_KEY) {
    return unauthorized()
  }

  const body = await request.json()
  const { projectId, items } = body as {
    projectId: string
    items: Array<{
      title: string
      trackerId: string
      statusId: string
      parentId?: string | null
      assigneeId?: string | null
      reporterId: string
      description?: string | null
      startDate?: string | null
      dueDate?: string | null
    }>
  }

  if (!projectId || !items?.length) {
    return badRequest('projectId와 items 배열이 필요합니다.')
  }

  const supabase = getServiceClient()

  let data: Array<{ id: string; number: number; title: string }> | null = null
  let error: { message: string } | null = null

  for (let attempt = 1; attempt <= MAX_POSITION_INSERT_ATTEMPTS; attempt += 1) {
    const parentIds = [...new Set(items.map((i) => i.parentId ?? null))]
    const positionMap = new Map<string | null, number>()

    const positionResults = await Promise.all(
      parentIds.map(async (parentId) => ({
        parentId,
        nextPosition: await getNextWorkItemPosition(supabase, projectId, parentId) - 1,
      }))
    )

    for (const { parentId, nextPosition } of positionResults) {
      positionMap.set(parentId, nextPosition)
    }

    const insertData = items.map((item) => {
      const parentId = item.parentId ?? null
      const currentMax = positionMap.get(parentId) ?? -1
      const newPosition = currentMax + 1
      positionMap.set(parentId, newPosition)

      return {
        project_id: projectId,
        title: item.title.trim(),
        tracker_id: item.trackerId,
        status_id: item.statusId,
        parent_id: parentId,
        assignee_id: item.assigneeId || null,
        reporter_id: item.reporterId,
        description: item.description?.trim() || null,
        start_date: normalizeWorkItemDateTimeForStorage(item.startDate),
        due_date: normalizeWorkItemDateTimeForStorage(item.dueDate),
        position: newPosition,
      }
    })

    const result = await supabase
      .from('work_items')
      .insert(insertData)
      .select('id, number, title')

    if (!result.error) {
      data = result.data
      error = null
      break
    }

    error = result.error
    if (!isWorkItemPositionConflict(result.error) || attempt === MAX_POSITION_INSERT_ATTEMPTS) {
      break
    }
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Failed to create work items' }, { status: 500 })
  }

  // 캐시 무효화
  revalidateTag(`project:${projectId}:items`, 'max')
  revalidateTag(`project:${projectId}:links`, 'max')

  const { data: project } = await supabase
    .from('projects')
    .select('key')
    .eq('id', projectId)
    .single()

  if (project?.key) {
    revalidatePath(`/projects/${project.key}`)
  }

  return NextResponse.json({ data })
}
