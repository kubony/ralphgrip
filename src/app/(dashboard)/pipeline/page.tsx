import { createClient } from '@/lib/supabase/server'
import { getProjectCardSummaries } from '@/lib/supabase/cached-queries'
import { getServiceClient } from '@/lib/supabase/service'
import { PipelineClient } from '@/components/pipeline/pipeline-client'

export const metadata = { title: '사업현황' }

export default async function PipelinePage() {
  const supabase = await createClient()
  await supabase.auth.getUser()

  const { data: rawProjects } = await supabase
    .from('projects')
    .select('id, key, name, project_type, settings')
    .order('created_at', { ascending: false })

  const projects = rawProjects ?? []
  const projectIds = projects.map(p => p.id)

  if (projectIds.length === 0) {
    return (
      <div className="h-full p-4 flex flex-col gap-3">
        <PipelineClient projects={[]} summaries={{}} dateRanges={{}} />
      </div>
    )
  }

  // 병렬 조회: 카드 요약 + 프로젝트별 work item 날짜 범위
  const [summaries, dateRangesResult] = await Promise.all([
    getProjectCardSummaries(projectIds),
    getServiceClient()
      .rpc('get_project_date_ranges', { p_project_ids: projectIds })
      .then(({ data }) => data as { project_id: string; min_start: string | null; max_due: string | null }[] | null),
  ]).catch(() => [new Map(), null] as const)

  const dateRanges: Record<string, { minStart: string | null; maxDue: string | null }> = {}
  if (dateRangesResult) {
    for (const row of dateRangesResult) {
      dateRanges[row.project_id] = { minStart: row.min_start, maxDue: row.max_due }
    }
  }

  return (
    <div className="h-full p-4 flex flex-col gap-3">
      <PipelineClient
        projects={projects}
        summaries={Object.fromEntries(summaries)}
        dateRanges={dateRanges}
      />
    </div>
  )
}
