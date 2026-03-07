import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import { ActivityLogTable } from './activity-log-table'

const EVENT_LABELS: Record<string, string> = {
  'project.created': '프로젝트 생성',
  'project.updated': '프로젝트 수정',
  'project.settings_updated': '프로젝트 설정 변경',
  'project.deleted': '프로젝트 삭제',
  'project.exported': '프로젝트 내보내기',
  'work_item.created': '작업 생성',
  'work_item.updated': '작업 수정',
  'work_item.deleted': '작업 삭제',
  'work_item.moved': '작업 이동',
  'work_item.copied': '작업 복사',
  'work_item.status_changed': '상태 변경',
  'work_item.batch_status_changed': '일괄 상태 변경',
  'work_item.batch_deleted': '일괄 삭제',
  'work_item.batch_updated': '일괄 수정',
  'comment.created': '댓글 작성',
  'comment.updated': '댓글 수정',
  'comment.deleted': '댓글 삭제',
  'link.created': '링크 생성',
  'link.deleted': '링크 삭제',
  'member.invited': '멤버 초대',
  'member.removed': '멤버 제거',
  'member.role_changed': '멤버 역할 변경',
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; event?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1'))
  const eventFilter = params.event || null
  const pageSize = 50
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('user_events')
    .select(`
      id, event_name, project_id, properties, created_at,
      user:profiles!user_id(id, full_name, email, avatar_url),
      project:projects!project_id(key, name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (eventFilter) {
    query = query.eq('event_name', eventFilter)
  }

  // 병렬 조회: 이벤트 목록과 필터용 타입은 독립적
  const [{ data: events, count }, { data: eventTypes }] = await Promise.all([
    query,
    supabase.from('user_events').select('event_name').limit(1000),
  ])

  const totalPages = Math.ceil((count || 0) / pageSize)

  const rows = (events || []).map((e) => {
    const u = (Array.isArray(e.user) ? e.user[0] : e.user) as Record<string, string> | null
    const p = (Array.isArray(e.project) ? e.project[0] : e.project) as Record<string, string> | null
    return {
      id: e.id,
      event_name: e.event_name,
      event_label: EVENT_LABELS[e.event_name] || e.event_name,
      user_name: u?.full_name || u?.email || '알 수 없음',
      user_avatar: u?.avatar_url || null,
      project_key: p?.key || null,
      project_name: p?.name || null,
      properties: e.properties as Record<string, unknown>,
      created_at: e.created_at,
    }
  })

  const uniqueEvents = [...new Set((eventTypes || []).map(e => e.event_name))].toSorted()

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-none flex items-center gap-3 px-4 py-3 border-b">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold">활동 로그</h1>
        <span className="text-sm text-muted-foreground">
          총 {count || 0}건
        </span>
      </div>

      <ActivityLogTable
        rows={rows}
        page={page}
        totalPages={totalPages}
        eventFilter={eventFilter}
        uniqueEvents={uniqueEvents}
        eventLabels={EVENT_LABELS}
      />
    </div>
  )
}
