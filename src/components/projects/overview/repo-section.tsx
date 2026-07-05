'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Github from 'lucide-react/dist/esm/icons/github'
import GitBranch from 'lucide-react/dist/esm/icons/git-branch'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import type { RepoSettings } from '@/types/database'

interface RepoSectionProps {
  repo: RepoSettings
}

// URL 마지막 두 세그먼트를 "owner/repo" 형태로 추출
function extractRepoName(url: string): string {
  try {
    const cleaned = url.replace(/\.git$/, '').replace(/\/+$/, '')
    const segments = cleaned.split('/').filter(Boolean)
    if (segments.length >= 2) {
      return segments.slice(-2).join('/')
    }
    return segments[segments.length - 1] ?? url
  } catch {
    return url
  }
}

export function RepoSection({ repo }: RepoSectionProps) {
  if (!repo?.url) return null

  const repoName = extractRepoName(repo.url)

  return (
    <Card className="p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <h2 className="text-lg font-semibold mb-4">연결된 레포</h2>

      <a
        href={repo.url}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
      >
        <Github className="h-5 w-5 shrink-0 text-muted-foreground" />

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-mono font-medium truncate">{repoName}</span>
          {repo.default_branch && (
            <Badge variant="secondary" className="shrink-0 gap-1 font-mono">
              <GitBranch className="h-3 w-3" />
              {repo.default_branch}
            </Badge>
          )}
        </div>

        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
      </a>
    </Card>
  )
}
