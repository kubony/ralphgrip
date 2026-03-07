import { notFound } from 'next/navigation'
import { getProjectByKey } from '@/lib/supabase/cached-queries'
import { ProjectTabs } from '@/components/projects/project-tabs'

interface ProjectLayoutProps {
  children: React.ReactNode
  params: Promise<{ key: string }>
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { key } = await params

  const project = await getProjectByKey(key)

  if (!project) {
    notFound()
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Project header + Tab navigation (한 줄) */}
      <div data-project-header className="flex-none flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded flex-shrink-0">
            {project.key}
          </span>
          <h1 className="text-lg font-semibold truncate">{project.name}</h1>
          <ProjectTabs projectKey={project.key} position="left" />
        </div>
        <ProjectTabs projectKey={project.key} position="right" />
      </div>

      {/* Page content */}
      <div className="flex-1 min-h-0 w-full overflow-hidden">
        {children}
      </div>
    </div>
  )
}
