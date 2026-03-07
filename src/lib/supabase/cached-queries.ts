import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient } from './server'
import { getServiceClient } from './service'

/**
 * 캐싱 전략:
 * - React.cache(): 동일 요청 내 중복 방지 (단일 요청 스코프)
 * - unstable_cache(): 크로스-요청 캐싱 (서버사이드, revalidateTag로 무효화)
 * - Service client: RLS 우회 (unstable_cache 내부에서 사용, 세션 쿠키 불필요)
 *
 * 태그 체계:
 * - project:{id}:meta — statuses, trackers, project 설정 (5분 TTL)
 * - project:{id}:members — 멤버 목록 (5분 TTL)
 * - project:{id}:items — work items (1분 TTL)
 * - project:{id}:links — link counts, linked issue status (1분 TTL)
 * - project:{id}:audit — audit logs (1분 TTL)
 * - user:{id}:my-work — 내 작업 (1분 TTL)
 *
 * 보안:
 * - getProjectByKey()는 세션 클라이언트 유지 (RLS 접근 제어)
 * - getCurrentUser()는 세션 클라이언트 유지 (cookies 필요)
 * - 프로젝트 데이터는 Layout의 auth gate 통과 후에만 접근
 */

// ============ 세션 클라이언트 쿼리 (캐시 불가, 인증 필요) ============

// 현재 사용자 조회 (React.cache만 — cookies 필요)
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

// 사용자 프로필 조회 (React.cache만 — 사용자별 데이터)
export const getUserProfile = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, app_role')
    .eq('id', userId)
    .single()
  return profile
})

// 사용자 앱 역할 조회 (React.cache만)
export const getUserAppRole = cache(async (userId: string): Promise<'admin' | 'user' | 'guest'> => {
  const profile = await getUserProfile(userId)
  return (profile?.app_role as 'admin' | 'user' | 'guest') ?? 'guest'
})

// 프로젝트 key 기반 조회 (세션 클라이언트 — RLS 접근 제어)
export const getProjectByKey = cache(async (projectKey: string) => {
  const supabase = await createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('key', projectKey)
    .single()
  return project
})

// 프로젝트 조회 시각 업데이트 (캐시 X — 매번 실행)
export async function touchProjectView(projectId: string) {
  const supabase = await createClient()
  await supabase.rpc('touch_project_view', { p_project_id: projectId })
}

// ============ unstable_cache 적용 쿼리 (Service client, 크로스-요청 캐싱) ============

// 프로젝트 조회 (unstable_cache)
export const getProject = cache(async (projectId: string) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()
      return project
    },
    [`project-${projectId}`],
    { tags: [`project:${projectId}:meta`], revalidate: 300 }
  )()
})

// 프로젝트 상태 목록 조회 (unstable_cache — 5분 TTL)
export const getProjectStatuses = cache(async (projectId: string) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const { data: statuses } = await supabase
        .from('statuses')
        .select('*')
        .eq('project_id', projectId)
        .order('position')
      return statuses ?? []
    },
    [`statuses-${projectId}`],
    { tags: [`project:${projectId}:meta`], revalidate: 300 }
  )()
})

// 프로젝트 트래커 목록 조회 (unstable_cache — 5분 TTL)
export const getProjectTrackers = cache(async (projectId: string) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const { data: trackers } = await supabase
        .from('trackers')
        .select('*')
        .eq('project_id', projectId)
        .order('position')
      return trackers ?? []
    },
    [`trackers-${projectId}`],
    { tags: [`project:${projectId}:meta`], revalidate: 300 }
  )()
})

// 프로젝트 멤버 목록 조회 (unstable_cache — 5분 TTL)
export const getProjectMembers = cache(async (projectId: string) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const { data: projectMembers } = await supabase
        .from('project_members')
        .select(`
          user:profiles(id, full_name, avatar_url)
        `)
        .eq('project_id', projectId)

      return (projectMembers?.map(pm => pm.user).filter(Boolean) ?? []).flat() as {
        id: string
        full_name: string | null
        avatar_url: string | null
      }[]
    },
    [`members-${projectId}`],
    { tags: [`project:${projectId}:members`], revalidate: 300 }
  )()
})

// 프로젝트 멤버 상세 조회 (역할 포함, 설정 페이지용 — unstable_cache)
export const getProjectMembersWithRoles = cache(async (projectId: string) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const { data } = await supabase
        .from('project_members')
        .select(`
          id,
          role,
          user_id,
          created_at,
          user:profiles(id, email, full_name, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('created_at')

      return (data ?? []).map(item => ({
        id: item.id,
        role: item.role,
        user_id: item.user_id,
        created_at: item.created_at,
        user: Array.isArray(item.user) ? item.user[0] ?? null : item.user,
      })) as {
        id: string
        role: string
        user_id: string
        created_at: string
        user: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
        } | null
      }[]
    },
    [`members-with-roles-${projectId}`],
    { tags: [`project:${projectId}:members`], revalidate: 300 }
  )()
})

// 프로젝트 작업 목록 조회 (unstable_cache — 1분 TTL)
export const getProjectWorkItems = cache(async (projectId: string) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const { data: workItems } = await supabase
        .from('work_items')
        .select(`
          *,
          tracker:trackers(*),
          status:statuses(*),
          assignee:profiles!work_items_assignee_id_fkey(id, full_name, avatar_url),
          reporter:profiles!work_items_reporter_id_fkey(id, full_name, avatar_url)
        `)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('position')
      return workItems ?? []
    },
    [`work-items-${projectId}`],
    { tags: [`project:${projectId}:items`], revalidate: 60 }
  )()
})

// 삭제된 작업 목록 조회 (unstable_cache — 1분 TTL)
export const getDeletedWorkItems = cache(async (projectId: string) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const { data: workItems } = await supabase
        .from('work_items')
        .select(`
          *,
          tracker:trackers(*),
          status:statuses(*)
        `)
        .eq('project_id', projectId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
      return workItems ?? []
    },
    [`deleted-items-${projectId}`],
    { tags: [`project:${projectId}:items`], revalidate: 60 }
  )()
})

// 작업 아이템 변경 이력 조회 (unstable_cache — 1분 TTL)
export const getWorkItemAuditLog = cache(async (workItemId: string, limit = 50) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const { data: auditLogs } = await supabase
        .from('work_item_audit_logs')
        .select(`
          *,
          changed_by:profiles(id, full_name, avatar_url)
        `)
        .eq('work_item_id', workItemId)
        .order('changed_at', { ascending: false })
        .limit(limit)
      return auditLogs ?? []
    },
    [`audit-item-${workItemId}-${limit}`],
    { tags: [`audit:item:${workItemId}`], revalidate: 60 }
  )()
})

// 프로젝트 변경 이력 조회 (unstable_cache — 1분 TTL)
export const getProjectAuditLog = cache(async (projectId: string, limit = 50) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const { data: auditLogs } = await supabase
        .from('project_audit_logs')
        .select(`
          *,
          changed_by:profiles(id, full_name, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('changed_at', { ascending: false })
        .limit(limit)
      return auditLogs ?? []
    },
    [`audit-project-${projectId}-${limit}`],
    { tags: [`project:${projectId}:audit`], revalidate: 60 }
  )()
})

// 내 작업 목록 조회 (unstable_cache — 1분 TTL)
// 담당자(assignee) + description에 이름이 언급된 항목 모두 포함
export const getMyWorkItems = cache(async (userId: string, fullName?: string | null) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      let query = supabase
        .from('work_items')
        .select(`
          *,
          project:projects(id, name, key, project_type),
          tracker:trackers(id, name, color),
          status:statuses(id, name, color, position, is_closed),
          assignee:profiles!work_items_assignee_id_fkey(id, full_name, avatar_url),
          reporter:profiles!work_items_reporter_id_fkey(id, full_name, avatar_url)
        `)
        .is('deleted_at', null)

      if (fullName) {
        const escaped = fullName.replace(/[%_]/g, '\\$&')
        query = query.or(`assignee_id.eq.${userId},reporter_id.eq.${userId},description.ilike.%${escaped}%`)
      } else {
        query = query.or(`assignee_id.eq.${userId},reporter_id.eq.${userId}`)
      }

      const { data } = await query.order('updated_at', { ascending: false })
      return data ?? []
    },
    [`my-work-${userId}-${fullName ?? ''}`],
    { tags: [`user:${userId}:my-work`], revalidate: 60 }
  )()
})

// 내가 멘션된 댓글 조회 (unstable_cache — 1분 TTL)
export const getMyMentionedComments = cache(async (userId: string) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data } = await supabase
        .from('comments')
        .select(`
          id, content, created_at,
          author:profiles!comments_author_id_fkey(id, full_name, avatar_url),
          work_item:work_items!inner(id, number, title, project_id,
            project:projects!inner(id, name, key)
          )
        `)
        .is('deleted_at', null)
        .is('work_item.deleted_at', null)
        .ilike('content', `%user_id:${userId}%`)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20)

      // Supabase FK join 정규화 (배열 → 단일 객체)
      return (data ?? []).map(row => {
        const rawWi = Array.isArray(row.work_item) ? row.work_item[0] : row.work_item
        const rawProject = rawWi?.project
        return {
          ...row,
          author: Array.isArray(row.author) ? row.author[0] ?? null : row.author,
          work_item: {
            ...rawWi,
            project: Array.isArray(rawProject) ? rawProject[0] : rawProject,
          },
        }
      }) as unknown as {
        id: string
        content: string
        created_at: string
        author: { id: string; full_name: string | null; avatar_url: string | null } | null
        work_item: {
          id: string
          number: number
          title: string
          project_id: string
          project: { id: string; name: string; key: string }
        }
      }[]
    },
    [`my-mentioned-comments-${userId}`],
    { tags: [`user:${userId}:my-work`], revalidate: 60 }
  )()
})

// 내가 읽은 댓글 ID 조회 (React.cache만 — 사용자별 데이터, 변경 빈도 높음)
export const getMyReadCommentIds = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('comment_reads')
    .select('comment_id')
    .eq('user_id', userId)
  return new Set((data ?? []).map(d => d.comment_id))
})

// 내 핀 고정 작업 ID 조회 (React.cache만 — 사용자별 데이터)
export const getMyPinnedItemIds = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_pinned_items')
    .select('work_item_id')
    .eq('user_id', userId)
    .order('pinned_at')
  return new Set((data ?? []).map(d => d.work_item_id))
})

// 고정된 프로젝트 목록 조회 (React.cache만 — 사용자별 데이터)
export const getPinnedProjects = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('project_members')
    .select('project:projects(id, name, key, project_type, is_demo)')
    .eq('user_id', userId)
    .eq('is_pinned', true)

  return (data?.map(pm => pm.project).filter(Boolean) ?? []).flat() as {
    id: string
    name: string
    key: string
    project_type: string
    is_demo: boolean
  }[]
})

// 사용자 참여 프로젝트 목록 조회 (React.cache만 — 사용자별 데이터)
export const getUserProjects = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('project_members')
    .select(`
      is_pinned,
      project:projects(id, name, key, project_type)
    `)
    .eq('user_id', userId)

  return (data ?? []).map(item => {
    const project = Array.isArray(item.project) ? item.project[0] : item.project
    return {
      id: project.id,
      name: project.name,
      key: project.key,
      project_type: project.project_type,
      is_pinned: item.is_pinned,
    }
  }) as {
    id: string
    name: string
    key: string
    project_type: string
    is_pinned: boolean
  }[]
})

// 프로젝트별 링크 카운트 조회 (unstable_cache — 1분 TTL)
export const getWorkItemLinkCounts = cache(async (projectId: string) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const { data } = await supabase
        .rpc('get_work_item_link_counts', { p_project_id: projectId })

      return (data ?? []) as { work_item_id: string; link_count: number; has_suspect: boolean }[]
    },
    [`link-counts-${projectId}`],
    { tags: [`project:${projectId}:links`], revalidate: 60 }
  )()
})

// 프로젝트별 연결된 이슈의 worst status 조회 (unstable_cache — 1분 TTL)
export const getLinkedIssueWorstStatus = cache(async (projectId: string) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const { data } = await supabase
        .rpc('get_linked_issue_worst_status', { p_project_id: projectId })

      return (data ?? []) as { work_item_id: string; worst_status_name: string; worst_status_color: string }[]
    },
    [`linked-issue-status-${projectId}`],
    { tags: [`project:${projectId}:links`], revalidate: 60 }
  )()
})

// 프로젝트 카드 요약 정보 배치 조회 (unstable_cache — 5분 TTL)
export type ProjectCardSummary = {
  project_id: string
  owner_name: string | null
  owner_avatar_url: string | null
  member_count: number
  item_count: number
  closed_count: number
  members: { name: string | null; avatar_url: string | null }[]
}

export const getProjectCardSummaries = cache(async (projectIds: string[]) => {
  if (projectIds.length === 0) return new Map<string, ProjectCardSummary>()

  const key = projectIds.toSorted().join(',')
  const record = await unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const { data } = await supabase.rpc('get_project_card_summaries', {
        p_project_ids: projectIds,
      })

      // unstable_cache는 JSON 직렬화하므로 Map 대신 Record 반환
      const result: Record<string, ProjectCardSummary> = {}
      for (const row of (data ?? []) as ProjectCardSummary[]) {
        result[row.project_id] = row
      }
      return result
    },
    [`project-card-summaries-${key}`],
    {
      tags: projectIds.flatMap(id => [
        `project:${id}:members`,
        `project:${id}:items`,
      ]),
      revalidate: 300,
    }
  )()

  // Record → Map 변환 (호출자 호환성 유지)
  return new Map(Object.entries(record))
})

// 프로젝트 전체 데이터 병렬 조회 (합성 함수 — 내부 함수가 각각 캐시)
export const getProjectData = cache(async (projectId: string) => {
  const [statuses, trackers, members, workItems, user, linkCounts, linkedIssueStatuses] = await Promise.all([
    getProjectStatuses(projectId),
    getProjectTrackers(projectId),
    getProjectMembers(projectId),
    getProjectWorkItems(projectId),
    getCurrentUser(),
    getWorkItemLinkCounts(projectId),
    getLinkedIssueWorstStatus(projectId),
  ])

  return {
    statuses,
    trackers,
    members,
    workItems,
    currentUserId: user?.id,
    linkCounts,
    linkedIssueStatuses,
  }
})

// 프로젝트 최근 30일 audit logs (unstable_cache — 1분 TTL)
export const getProjectRecentAuditLogs = cache(async (projectId: string) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: auditLogs } = await supabase
        .from('work_item_audit_logs')
        .select(`
          id,
          work_item_id,
          operation,
          old_values,
          new_values,
          changed_fields,
          changed_by,
          changed_at
        `)
        .eq('project_id', projectId)
        .gte('changed_at', thirtyDaysAgo.toISOString())
        .order('changed_at', { ascending: false })
      return auditLogs ?? []
    },
    [`recent-audit-${projectId}`],
    { tags: [`project:${projectId}:audit`], revalidate: 60 }
  )()
})

// 크로스 프로젝트 링크 집계 조회 (unstable_cache — 1분 TTL)
export const getCrossProjectLinks = cache(async (projectIds: string[]) => {
  if (projectIds.length === 0) return new Map<string, import('@/types/database').CrossProjectLink[]>()

  const key = projectIds.toSorted().join(',')
  const record = await unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const { data } = await supabase.rpc('get_cross_project_links', {
        p_project_ids: projectIds,
      })

      // unstable_cache는 JSON 직렬화하므로 Record 반환
      const result: Record<string, import('@/types/database').CrossProjectLink[]> = {}
      for (const row of (data ?? []) as import('@/types/database').CrossProjectLink[]) {
        const existing = result[row.source_project_id] ?? []
        existing.push(row)
        result[row.source_project_id] = existing
      }
      return result
    },
    [`cross-project-links-${key}`],
    {
      tags: projectIds.map(id => `project:${id}:links`),
      revalidate: 60,
    }
  )()

  // Record → Map 변환 (호출자 호환성 유지)
  return new Map(Object.entries(record))
})

// 프로젝트 활동 피드용 audit logs (7일, 의미 있는 변경만 — 1분 TTL)
export const getProjectActivityLogs = cache(async (projectId: string, limit = 30) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data } = await supabase
        .from('work_item_audit_logs')
        .select(`
          id, work_item_id, operation, old_values, new_values, changed_fields, changed_at,
          user:profiles!work_item_audit_logs_changed_by_fkey(id, full_name, avatar_url)
        `)
        .eq('project_id', projectId)
        .overlaps('changed_fields', ['title', 'description', 'status_id', 'assignee_id'])
        .gte('changed_at', sevenDaysAgo.toISOString())
        .order('changed_at', { ascending: false })
        .limit(limit)

      // Supabase FK join은 배열로 반환될 수 있으므로 단일 객체로 정규화
      return (data ?? []).map(row => ({
        ...row,
        user: Array.isArray(row.user) ? row.user[0] ?? null : row.user,
      })) as {
        id: string
        work_item_id: string
        operation: string
        old_values: Record<string, unknown> | null
        new_values: Record<string, unknown> | null
        changed_fields: string[]
        changed_at: string
        user: { id: string; full_name: string | null; avatar_url: string | null } | null
      }[]
    },
    [`activity-logs-${projectId}-${limit}`],
    { tags: [`project:${projectId}:audit`], revalidate: 60 }
  )()
})

// 프로젝트 최근 댓글 (7일 — 1분 TTL)
export const getProjectRecentComments = cache(async (projectId: string, limit = 30) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data } = await supabase
        .from('comments')
        .select(`
          id, content, created_at,
          author:profiles!comments_author_id_fkey(id, full_name, avatar_url),
          work_item:work_items!inner(id, number, title, project_id)
        `)
        .eq('work_item.project_id', projectId)
        .is('work_item.deleted_at', null)
        .is('deleted_at', null)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit)

      // Supabase FK join 정규화
      return (data ?? []).map(row => ({
        ...row,
        author: Array.isArray(row.author) ? row.author[0] ?? null : row.author,
        work_item: Array.isArray(row.work_item) ? row.work_item[0] : row.work_item,
      })) as {
        id: string
        content: string
        created_at: string
        author: { id: string; full_name: string | null; avatar_url: string | null } | null
        work_item: { id: string; number: number; title: string; project_id: string }
      }[]
    },
    [`recent-comments-${projectId}-${limit}`],
    { tags: [`project:${projectId}:items`], revalidate: 60 }
  )()
})

// ============ 알림 쿼리 (React.cache만 — 실시간성 중요) ============

// 최근 알림 20개 조회 (actor JOIN)
export const getRecentNotifications = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notifications')
    .select('id, type, project_key, work_item_id, work_item_number, title, body, read_at, created_at, actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  return (data ?? []).map(row => ({
    ...row,
    actor: Array.isArray(row.actor) ? row.actor[0] ?? null : row.actor,
  })) as {
    id: string
    type: string
    project_key: string
    work_item_id: string | null
    work_item_number: number
    title: string
    body: string | null
    actor: { id: string; full_name: string | null; avatar_url: string | null } | null
    read_at: string | null
    created_at: string
  }[]
})

// 안 읽은 알림 수 조회
export const getUnreadNotificationCount = cache(async (userId: string) => {
  const supabase = await createClient()
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  return count ?? 0
})

// 프로젝트 현황 데이터 병렬 조회 (합성 함수)
// 프로젝트 내 외부 링크가 설정된 작업 항목 (자료 탭용, 경량)
export const getProjectExternalLinkItems = cache(async (projectId: string) => {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const { data } = await supabase
        .from('work_items')
        .select('id, number, title, external_links')
        .eq('project_id', projectId)
        .not('external_links', 'eq', '[]')
        .is('deleted_at', null)
        .order('number')
      return (data ?? []) as { id: string; number: number; title: string; external_links: { url: string; label?: string }[] }[]
    },
    [`external-link-items-${projectId}`],
    { tags: [`project:${projectId}:items`], revalidate: 60 }
  )()
})

export const getProjectOverview = cache(async (projectId: string) => {
  const [workItems, statuses, members, auditLogs, activityLogs, recentComments] = await Promise.all([
    getProjectWorkItems(projectId),
    getProjectStatuses(projectId),
    getProjectMembers(projectId),
    getProjectRecentAuditLogs(projectId),
    getProjectActivityLogs(projectId),
    getProjectRecentComments(projectId),
  ])

  return { workItems, statuses, members, auditLogs, activityLogs, recentComments }
})
