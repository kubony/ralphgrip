import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProjectByKey, getProjectExternalLinkItems } from '@/lib/supabase/cached-queries'
import { Button } from '@/components/ui/button'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open'
import Settings from 'lucide-react/dist/esm/icons/settings'
import { DriveFileList } from '@/components/projects/drive-file-list'
import { ExternalLinksList } from '@/components/projects/external-links-list'
import type { ProjectSettings } from '@/types/database'

function extractFolderId(url: string): string | null {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return match?.[1] ?? null
}

interface ResourcesPageProps {
  params: Promise<{ key: string }>
}

export default async function ResourcesPage({ params }: ResourcesPageProps) {
  const { key } = await params
  const project = await getProjectByKey(key)

  if (!project) {
    notFound()
  }

  const settings = (project.settings as ProjectSettings | null) ?? {}
  const driveUrl = settings.google_drive_url
  const folderId = driveUrl ? extractFolderId(driveUrl) : null
  const manualLinks = settings.external_links ?? []

  const externalLinkItems = await getProjectExternalLinkItems(project.id)

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Google Drive */}
        <div className="space-y-6">
          {driveUrl ? (
            <>
              <div className="rounded-lg border p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                      <path d="M7.71 3.5L1.15 15l3.43 5.97h6.56L7.71 3.5z" fill="#0066DA" />
                      <path d="M16.29 3.5H7.71l3.43 17.47h12.01L16.29 3.5z" fill="#00AC47" />
                      <path d="M1.15 15l3.43 5.97h18.57L16.29 3.5 1.15 15z" fill="#EA4335" />
                      <path d="M16.29 3.5L7.71 3.5l3.43 5.97L16.29 3.5z" fill="#00832D" />
                      <path d="M7.71 3.5l3.43 5.97 5.15 11.5h6.86L16.29 3.5H7.71z" fill="#2684FC" />
                      <path d="M1.15 15l3.43 5.97h6.56l-5.15-8.47L1.15 15z" fill="#FFBA00" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-sm">Google Drive</h2>
                    <p className="text-xs text-muted-foreground truncate">{driveUrl}</p>
                  </div>
                </div>

                <a
                  href={driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Drive에서 열기
                </a>
              </div>

              {folderId ? (
                <DriveFileList rootFolderId={folderId} />
              ) : (
                <p className="text-xs text-muted-foreground text-center">
                  유효한 Drive 폴더 URL이 아닙니다. 설정에서 폴더 URL을 확인해주세요.
                </p>
              )}
            </>
          ) : (
            <div className="rounded-lg border p-5">
              <div className="text-center space-y-4 py-6">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <FolderOpen className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold">Google Drive</h2>
                  <p className="text-sm text-muted-foreground">
                    프로젝트 관련 문서가 보관된 Drive 폴더를 연결하면 여기서 바로 접근할 수 있습니다.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/projects/${key}/settings#integrations`}>
                    <Settings className="h-4 w-4 mr-1.5" />
                    설정으로 이동
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right column: External Links */}
        <div>
          <ExternalLinksList
            workItemLinks={externalLinkItems}
            manualLinks={manualLinks}
            projectId={project.id}
            projectKey={key}
          />
        </div>
      </div>
    </div>
  )
}
