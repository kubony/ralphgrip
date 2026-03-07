'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getWorkItemLinks,
  createWorkItemLink,
  deleteWorkItemLink,
  clearSuspect,
} from '@/app/(dashboard)/projects/[key]/actions'
import { LinkSourcePanel } from './link-source-panel'
import type { WorkItemLinkSummary } from '@/types/database'
import Link2 from 'lucide-react/dist/esm/icons/link-2'
import Plus from 'lucide-react/dist/esm/icons/plus'
import X from 'lucide-react/dist/esm/icons/x'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import GitBranch from 'lucide-react/dist/esm/icons/git-branch'

interface DependencySectionProps {
  workItemId: string
  projectId: string
  trackerName?: string
  onViewInGraph?: () => void
}

export function DependencySection({ workItemId, projectId, trackerName, onViewInGraph }: DependencySectionProps) {
  const [links, setLinks] = useState<WorkItemLinkSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showLinkPanel, setShowLinkPanel] = useState(false)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
     
    queueMicrotask(() => setIsLoading(true))

    const load = async () => {
      const result = await getWorkItemLinks(workItemId)
      if (!cancelled && result.data) {
        setLinks(result.data)
      }
      if (!cancelled) {
         
        queueMicrotask(() => setIsLoading(false))
      }
    }
    load()

    return () => { cancelled = true }
  }, [workItemId])

  const reloadLinks = async () => {
    const result = await getWorkItemLinks(workItemId)
    if (result.data) {
      setLinks(result.data)
    }
  }

  const outgoing = links.filter(l => l.direction === 'outgoing')
  const incoming = links.filter(l => l.direction === 'incoming')

  const handleAddLink = async (targetId: string) => {
    setActionInProgress('add')
    const result = await createWorkItemLink(workItemId, targetId, projectId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('링크가 생성되었습니다.')
      await reloadLinks()
    }
    setActionInProgress(null)
    setShowLinkPanel(false)
  }

  const handleDeleteLink = async (linkId: string) => {
    setActionInProgress(linkId)
    const result = await deleteWorkItemLink(linkId, projectId)
    if (result.error) {
      toast.error(result.error)
    } else {
      setLinks(prev => prev.filter(l => l.id !== linkId))
    }
    setActionInProgress(null)
  }

  const handleClearSuspect = async (linkId: string) => {
    setActionInProgress(linkId)
    const result = await clearSuspect(linkId, projectId)
    if (result.error) {
      toast.error(result.error)
    } else {
      setLinks(prev => prev.map(l => l.id === linkId ? { ...l, suspect: false } : l))
    }
    setActionInProgress(null)
  }

  const navigateToItem = (projectKey: string, itemId: string) => {
    window.open(`/projects/${projectKey}/alm?item=${itemId}`, '_blank')
  }

  if (showLinkPanel) {
    return (
      <LinkSourcePanel
        workItemId={workItemId}
        trackerName={trackerName || ''}
        existingLinkIds={new Set(links.map(l => l.linked_item.id))}
        onSelect={handleAddLink}
        onClose={() => setShowLinkPanel(false)}
        isLoading={actionInProgress === 'add'}
      />
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link2 className="h-4 w-4" />
          <span>의존성</span>
        </div>
        <div className="flex items-center gap-1">
          {onViewInGraph && links.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-blue-500"
              onClick={onViewInGraph}
              title="그래프에서 보기"
            >
              <GitBranch className="h-3 w-3 mr-1" />
              그래프
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setShowLinkPanel(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            링크 추가
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1.5">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/30">
              <div className="w-2.5 h-2.5 rounded-full bg-muted animate-pulse flex-shrink-0" />
              <div className="h-3 w-14 bg-muted rounded animate-pulse" />
              <div className="h-3 flex-1 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : links.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">연결된 항목이 없습니다</div>
      ) : (
        <div className="space-y-2">
          {/* 의존 대상 (outgoing) */}
          {outgoing.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowRight className="h-3 w-3" />
                의존 대상
              </div>
              {outgoing.map(link => (
                <LinkItem
                  key={link.id}
                  link={link}
                  canDelete
                  isLoading={actionInProgress === link.id}
                  onNavigate={navigateToItem}
                  onDelete={() => handleDeleteLink(link.id)}
                  onClearSuspect={() => handleClearSuspect(link.id)}
                />
              ))}
            </div>
          )}

          {/* 이 항목에 의존 (incoming) */}
          {incoming.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" />
                이 항목에 의존
              </div>
              {incoming.map(link => (
                <LinkItem
                  key={link.id}
                  link={link}
                  canDelete={false}
                  isLoading={actionInProgress === link.id}
                  onNavigate={navigateToItem}
                  onDelete={() => {}}
                  onClearSuspect={() => handleClearSuspect(link.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LinkItem({
  link,
  canDelete,
  isLoading,
  onNavigate,
  onDelete,
  onClearSuspect,
}: {
  link: WorkItemLinkSummary
  canDelete: boolean
  isLoading: boolean
  onNavigate: (projectKey: string, itemId: string) => void
  onDelete: () => void
  onClearSuspect: () => void
}) {
  const item = link.linked_item

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs group',
        link.suspect ? 'bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800' : 'bg-muted/50',
        item.is_deleted && 'opacity-50'
      )}
    >
      <button
        className={cn(
          'flex-1 flex items-center gap-1.5 text-left hover:underline min-w-0',
          item.is_deleted && 'line-through'
        )}
        onClick={() => onNavigate(item.project_key, item.id)}
        disabled={isLoading}
      >
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: item.status_color || '#94a3b8' }}
          title={item.status_name}
        />
        <span className="font-mono text-muted-foreground flex-shrink-0">
          {item.project_key}-{item.number}
        </span>
        <span className="truncate">{item.title}</span>
      </button>

      {link.suspect && (
        <button
          className="flex items-center gap-0.5 px-1 py-0.5 rounded text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onClearSuspect()
          }}
          disabled={isLoading}
          title="변경 확인"
        >
          {isLoading ? (
            <CheckCircle2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <AlertTriangle className="h-3 w-3" />
              <span>확인</span>
            </>
          )}
        </button>
      )}

      {canDelete && (
        <button
          className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive flex-shrink-0 transition-opacity relative after:absolute after:-inset-2 after:content-['']"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          disabled={isLoading}
          title="링크 삭제"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
