'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { detectLinkDomain, truncateUrl } from '@/lib/external-link-utils'
import { LinkDomainIcon } from './link-domain-icon'
import { addExternalLink, removeExternalLink } from '@/app/(dashboard)/projects/[key]/actions'
import Plus from 'lucide-react/dist/esm/icons/plus'
import X from 'lucide-react/dist/esm/icons/x'
import ExternalLinkIcon from 'lucide-react/dist/esm/icons/external-link'
import LinkIcon from 'lucide-react/dist/esm/icons/link'
import type { ExternalLinkEntry } from '@/types/database'

interface WorkItemLink {
  id: string
  number: number
  title: string
  external_links: { url: string; label?: string }[]
}

interface ExternalLinksListProps {
  workItemLinks: WorkItemLink[]
  manualLinks: ExternalLinkEntry[]
  projectId: string
  projectKey: string
}

function AddLinkForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [isPending, startTransition] = useTransition()

  const urlDomain = url ? detectLinkDomain(url) : null

  const handleSubmit = () => {
    if (!label.trim() || !url.trim()) return
    try {
      new URL(url)
    } catch {
      toast.error('유효한 URL을 입력하세요.')
      return
    }

    startTransition(async () => {
      const result = await addExternalLink(projectId, { label: label.trim(), url: url.trim() })
      if (result.error) {
        toast.error(result.error)
      } else {
        setLabel('')
        setUrl('')
        onClose()
      }
    })
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <input
        type="text"
        placeholder="링크 이름"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="w-full text-sm bg-background border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
        autoFocus
      />
      <div className="flex items-center gap-2">
        {urlDomain && (
          <LinkDomainIcon domain={urlDomain} className="h-4 w-4 flex-shrink-0" />
        )}
        <input
          type="url"
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          className="flex-1 text-sm bg-background border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isPending || !label.trim() || !url.trim()}
          className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? '추가 중...' : '추가'}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs border rounded-md hover:bg-muted"
        >
          취소
        </button>
      </div>
    </div>
  )
}

function ManualLinkRow({ link, projectId }: { link: ExternalLinkEntry; projectId: string }) {
  const [isPending, startTransition] = useTransition()
  const domain = detectLinkDomain(link.url)

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeExternalLink(projectId, link.id)
      if (result.error) toast.error(result.error)
    })
  }

  return (
    <div className={cn(
      'group flex items-center gap-2.5 rounded-lg border p-3 hover:bg-muted/50 transition-colors',
      isPending && 'opacity-50'
    )}>
      <LinkDomainIcon domain={domain} className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{link.label}</p>
        <p className="text-xs text-muted-foreground truncate">{truncateUrl(link.url)}</p>
      </div>
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="새 탭에서 열기"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLinkIcon className="h-3.5 w-3.5" />
      </a>
      <button
        onClick={handleRemove}
        disabled={isPending}
        className="relative p-1 rounded text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all after:absolute after:-inset-2 after:content-['']"
        title="삭제"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function WorkItemLinkRow({ item, projectKey }: { item: WorkItemLink; projectKey: string }) {
  const links = item.external_links ?? []

  return (
    <div className="rounded-lg border p-3 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
          {projectKey}-{item.number}
        </span>
        <p className="text-sm font-medium truncate">{item.title}</p>
      </div>
      {links.map((link, idx) => {
        const domain = detectLinkDomain(link.url)
        return (
          <a
            key={idx}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 pl-1 hover:bg-muted/50 rounded py-0.5 transition-colors"
          >
            <LinkDomainIcon domain={domain} className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate flex-1">
              {link.label || truncateUrl(link.url)}
            </span>
            <ExternalLinkIcon className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </a>
        )
      })}
    </div>
  )
}

export function ExternalLinksList({ workItemLinks, manualLinks, projectId, projectKey }: ExternalLinksListProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const hasLinks = manualLinks.length > 0 || workItemLinks.length > 0

  return (
    <div className="rounded-lg border p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-violet-50 dark:bg-violet-950 flex items-center justify-center">
          <LinkIcon className="h-5 w-5 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm">외부 링크</h2>
          <p className="text-xs text-muted-foreground">
            {hasLinks
              ? `수동 ${manualLinks.length}개 · 작업 항목 ${workItemLinks.length}개`
              : '프로젝트 관련 외부 링크를 추가하세요'}
          </p>
        </div>
      </div>

      {/* Add link button / form */}
      {showAddForm ? (
        <AddLinkForm projectId={projectId} onClose={() => setShowAddForm(false)} />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Plus className="h-4 w-4" />
          링크 추가
        </button>
      )}

      {/* Manual links */}
      {manualLinks.length > 0 && (
        <div className="space-y-2">
          {manualLinks.map((link, i) => (
            <div
              key={link.id}
              className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-200"
              style={{ animationDelay: `${Math.min(i * 30, 500)}ms` }}
            >
              <ManualLinkRow link={link} projectId={projectId} />
            </div>
          ))}
        </div>
      )}

      {/* Work item links */}
      {workItemLinks.length > 0 && (
        <div className="space-y-2">
          {manualLinks.length > 0 && (
            <p className="text-xs text-muted-foreground pt-2">작업 항목 링크</p>
          )}
          {workItemLinks.map((item, i) => (
            <div
              key={item.id}
              className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-200"
              style={{ animationDelay: `${Math.min((manualLinks.length + i) * 30, 500)}ms` }}
            >
              <WorkItemLinkRow item={item} projectKey={projectKey} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!hasLinks && !showAddForm && (
        <div className="text-center py-6">
          <p className="text-xs text-muted-foreground">
            Notion, Confluence, Jira 등 외부 서비스 링크를 등록하면 한 곳에서 관리할 수 있습니다.
          </p>
        </div>
      )}
    </div>
  )
}
