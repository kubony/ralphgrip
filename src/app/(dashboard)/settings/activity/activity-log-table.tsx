'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import { cn } from '@/lib/utils'

interface ActivityRow {
  id: string
  event_name: string
  event_label: string
  user_name: string
  user_avatar: string | null
  project_key: string | null
  project_name: string | null
  properties: Record<string, unknown>
  created_at: string
}

interface Props {
  rows: ActivityRow[]
  page: number
  totalPages: number
  eventFilter: string | null
  uniqueEvents: string[]
  eventLabels: Record<string, string>
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`

  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}일 전`

  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function PropertyBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
      <span className="font-medium">{label}:</span>
      <span>{value}</span>
    </span>
  )
}

function formatProperties(props: Record<string, unknown>): React.ReactNode[] {
  const badges: React.ReactNode[] = []

  if (props.title) {
    badges.push(<PropertyBadge key="title" label="제목" value={String(props.title)} />)
  }
  if (props.count) {
    badges.push(<PropertyBadge key="count" label="건수" value={String(props.count)} />)
  }
  if (props.changed_fields && Array.isArray(props.changed_fields)) {
    badges.push(
      <PropertyBadge
        key="fields"
        label="변경"
        value={(props.changed_fields as string[]).join(', ')}
      />
    )
  }
  if (props.role || props.new_role) {
    badges.push(<PropertyBadge key="role" label="역할" value={String(props.role || props.new_role)} />)
  }
  if (props.invited_email) {
    badges.push(<PropertyBadge key="email" label="이메일" value={String(props.invited_email)} />)
  }

  return badges
}

const EVENT_CATEGORY_COLORS: Record<string, string> = {
  project: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  work_item: 'bg-green-500/10 text-green-600 dark:text-green-400',
  comment: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  link: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  member: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}

function EventBadge({ eventName, label }: { eventName: string; label: string }) {
  const category = eventName.split('.')[0]
  const color = EVENT_CATEGORY_COLORS[category] || 'bg-muted text-muted-foreground'

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', color)}>
      {label}
    </span>
  )
}

export function ActivityLogTable({ rows, page, totalPages, eventFilter, uniqueEvents, eventLabels }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function buildUrl(params: Record<string, string | null>) {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(params)) {
      if (v === null) sp.delete(k)
      else sp.set(k, v)
    }
    return `/settings/activity?${sp.toString()}`
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => router.push(buildUrl({ event: null, page: null }))}
            className={cn(
              'px-2.5 py-1 text-xs rounded-md border transition-colors',
              !eventFilter
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            전체
          </button>
          {uniqueEvents.map((ev) => (
            <button
              key={ev}
              onClick={() => router.push(buildUrl({ event: ev === eventFilter ? null : ev, page: null }))}
              className={cn(
                'px-2.5 py-1 text-xs rounded-md border transition-colors',
                ev === eventFilter
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {eventLabels[ev] || ev}
            </button>
          ))}
        </div>

        {/* Table */}
        {rows.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">시간</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">사용자</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">이벤트</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">프로젝트</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                        <span title={new Date(row.created_at).toLocaleString('ko-KR')}>
                          {formatTime(row.created_at)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          {row.user_avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.user_avatar}
                              alt=""
                              className="h-5 w-5 rounded-full"
                            />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                              {row.user_name[0]}
                            </div>
                          )}
                          <span className="truncate max-w-[120px]">{row.user_name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <EventBadge eventName={row.event_name} label={row.event_label} />
                      </td>
                      <td className="py-2.5 px-4">
                        {row.project_key ? (
                          <Link
                            href={`/projects/${row.project_key}`}
                            className="inline-flex items-center gap-1 text-xs font-mono bg-muted px-1.5 py-0.5 rounded hover:bg-muted/80 transition-colors"
                          >
                            {row.project_key}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {formatProperties(row.properties)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">기록된 활동이 없습니다.</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => router.push(buildUrl({ page: String(page - 1) }))}
              disabled={page <= 1}
              className="p-1.5 rounded-md border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-muted-foreground px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => router.push(buildUrl({ page: String(page + 1) }))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-md border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
