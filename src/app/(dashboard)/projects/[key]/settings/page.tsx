import { notFound } from 'next/navigation'
import { getProjectByKey, getProjectData, getProjectMembersWithRoles, getCurrentUser } from '@/lib/supabase/cached-queries'
import { Separator } from '@/components/ui/separator'
import { GeneralSettings } from './general-settings'
import { MembersSettings } from './members-settings'
import { ProjectSettingsForm } from './project-settings-form'
import { ProjectExportSection } from './project-export-section'
import { SlackSettings } from './slack-settings'
import { DriveSettings } from './drive-settings'
import { DangerZone } from './danger-zone'
import { AgentsSettings } from './agents-settings'
import { createClient } from '@/lib/supabase/server'

interface SettingsPageProps {
  params: Promise<{ key: string }>
}

const sections = [
  { id: 'general', label: 'General' },
  { id: 'members', label: 'Members' },
  { id: 'agents', label: 'AI Agents' },
  { id: 'display', label: 'Display' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'export', label: 'Export' },
  { id: 'danger-zone', label: 'Danger Zone', destructive: true },
]

export default async function ProjectSettingsPage({ params }: SettingsPageProps) {
  const { key } = await params

  const [project, user] = await Promise.all([
    getProjectByKey(key),
    getCurrentUser(),
  ])

  if (!project) {
    notFound()
  }

  const supabase = await createClient()

  const [{ workItems }, membersWithRoles, agentsResult] = await Promise.all([
    getProjectData(project.id),
    getProjectMembersWithRoles(project.id),
    supabase.from('agents').select('*').eq('project_id', project.id).order('created_at', { ascending: true }),
  ])

  const agents = agentsResult.data ?? []

  // Export 섹션에 전달할 workItems 변환
  const exportWorkItems = workItems.map((wi: Record<string, unknown>) => ({
    id: wi.id as string,
    number: wi.number as number,
    title: wi.title as string,
    description: wi.description as string | null,
    parent_id: wi.parent_id as string | null,
    position: wi.position as number | undefined,
    priority: (wi.priority as number) ?? 0,
    visibility: (wi.visibility as string) ?? 'internal',
    due_date: wi.due_date as string | null,
    start_date: wi.start_date as string | null,
    estimated_hours: wi.estimated_hours as number | null,
    actual_hours: wi.actual_hours as number | null,
    external_url: wi.external_url as string | null,
    created_at: wi.created_at as string,
    updated_at: wi.updated_at as string,
    status: (wi.status ?? { id: '', name: '', color: null, is_closed: false }) as { id: string; name: string; color: string | null; is_closed: boolean },
    tracker: (wi.tracker ?? { id: '', name: '' }) as { id: string; name: string },
    assignee: wi.assignee as { id: string; full_name: string | null } | null,
    reporter: wi.reporter as { id: string; full_name: string | null } | null,
  }))

  return (
    <div className="h-full overflow-auto">
        <div className="max-w-3xl mx-auto flex gap-8 p-6">
          {/* Side navigation */}
          <nav className="hidden md:block w-40 shrink-0 sticky top-6 self-start">
            <ul className="space-y-1">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className={`block px-3 py-1.5 text-sm rounded-md transition-colors hover:bg-muted ${
                      s.destructive
                        ? 'text-destructive hover:text-destructive'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-8">
            <GeneralSettings project={project} />
            <Separator />
            <MembersSettings
              projectId={project.id}
              ownerId={project.owner_id}
              members={membersWithRoles}
              currentUserId={user?.id}
            />
            <Separator />
            <AgentsSettings projectId={project.id} initialAgents={agents} />
            <Separator />
            <ProjectSettingsForm
              projectId={project.id}
              settings={project.settings ?? {}}
            />
            <Separator />
            <SlackSettings
              projectId={project.id}
              settings={project.settings ?? {}}
            />
            <DriveSettings
              projectId={project.id}
              settings={project.settings ?? {}}
            />
            <Separator />
            <ProjectExportSection
              projectId={project.id}
              projectName={project.name}
              projectKey={project.key}
              projectCreatedAt={project.created_at}
              workItems={exportWorkItems}
            />
            <Separator />
            <DangerZone
              projectId={project.id}
              projectName={project.name}
            />
          </div>
        </div>
      </div>
  )
}
