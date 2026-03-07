'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import Circle from 'lucide-react/dist/esm/icons/circle'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import Folder from 'lucide-react/dist/esm/icons/folder'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import Link2 from 'lucide-react/dist/esm/icons/link-2'
import { toast } from 'sonner'
import { useTheme } from '@/hooks/use-theme'
import { updateWorkItem } from '@/app/(dashboard)/projects/[key]/actions'
import type { WorkItemWithRelations, StatusRef, TrackerRef } from '@/types/database'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

/** 이미 볼드가 아닌 날짜(YYYY.MM.DD / YYYY-MM-DD)를 **볼드**로 변환 */
const DATE_BOLD_REGEX = /(?<!\*\*)\b(\d{4}[.\-]\d{2}[.\-]\d{2})\b(?!\*\*)/g
function autoBoldDates(text: string): string {
  if (!text) return text
  return text.replace(DATE_BOLD_REGEX, '**$1**')
}

const REMARK_PLUGINS = [remarkBreaks]

// 마크다운 내 링크를 새 탭에서 열기
const MARKDOWN_COMPONENTS = {
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </a>
  ),
}

function TrackerIcon({ tracker, status }: { tracker: TrackerRef; status: StatusRef | null }) {
  if (tracker.name === 'Folder') {
    return <Folder className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
  }
  if (!status) {
    return <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
  }
  if (status.is_closed) {
    const isRejected = status.name === 'Rejected'
    return <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: isRejected ? '#ef4444' : '#22c55e' }} />
  }
  const color = status.color || '#94a3b8'
  return <Circle className="h-3.5 w-3.5 flex-shrink-0" style={{ color, fill: color }} />
}

interface WorkItemDetailDialogProps {
  item: WorkItemWithRelations
  projectId: string
  projectKey: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WorkItemDetailDialog({
  item,
  projectId,
  projectKey,
  open,
  onOpenChange,
}: WorkItemDetailDialogProps) {
  const { resolvedTheme } = useTheme()
  const [isEditing, setIsEditing] = useState(false)
  const [description, setDescription] = useState(item.description || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [title, setTitle] = useState(item.title)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
     
    queueMicrotask(() => {
      setDescription(item.description || '')
      setTitle(item.title)
      setIsEditing(false)
      setIsEditingTitle(false)
    })
  }, [item.id, item.description, item.title])

  const handleSave = async () => {
    const formatted = autoBoldDates(description)
    if (formatted !== description) setDescription(formatted)
    setIsSaving(true)
    await updateWorkItem(item.id, { description: formatted || null }, projectId)
    setIsSaving(false)
    setIsEditing(false)
  }

  const handleShareLink = async () => {
    const url = `${window.location.origin}/projects/${projectKey}/alm?item=${item.id}`
    await navigator.clipboard.writeText(url)
    toast.success('링크가 복사되었습니다')
  }

  const handleCancel = () => {
    setDescription(item.description || '')
    setIsEditing(false)
  }

  const handleTitleSave = async () => {
    const trimmed = title.trim()
    if (!trimmed || trimmed === item.title) {
      setTitle(item.title)
      setIsEditingTitle(false)
      return
    }
    await updateWorkItem(item.id, { title: trimmed }, projectId)
    setIsEditingTitle(false)
  }

  return (
    <Dialog open={open} modal={false} onOpenChange={(v) => {
      if (!v) {
        setIsEditing(false)
        setIsEditingTitle(false)
        setDescription(item.description || '')
        setTitle(item.title)
      }
      onOpenChange(v)
    }}>
      <DialogContent
        className="sm:max-w-2xl max-h-[80vh] overflow-y-auto"
        onPointerDownOutside={() => onOpenChange(false)}
        onInteractOutside={() => onOpenChange(false)}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrackerIcon tracker={item.tracker} status={item.status} />
            <span className="text-muted-foreground font-mono text-sm">
              {projectKey}-{item.number}
            </span>
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave()
                  if (e.key === 'Escape') {
                    setTitle(item.title)
                    setIsEditingTitle(false)
                  }
                }}
                autoFocus
                className="flex-1 text-lg font-semibold bg-transparent border-b-2 border-primary outline-none"
              />
            ) : (
              <span
                className="cursor-pointer hover:text-primary transition-colors"
                onClick={() => setIsEditingTitle(true)}
                title="클릭하여 제목 수정"
              >
                {item.title}
              </span>
            )}
            <button
              onClick={handleShareLink}
              className="ml-auto p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
              title="링크 복사"
            >
              <Link2 className="h-4 w-4 text-muted-foreground" />
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">설명</span>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 rounded hover:bg-muted transition-colors"
                title="편집"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {isEditing ? (
            <div data-color-mode={resolvedTheme}>
              <MDEditor
                value={description}
                onChange={(val) => setDescription(val || '')}
                height={250}
                preview="edit"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSaving ? '저장 중...' : '저장'}
                </button>
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 text-sm border rounded-md hover:bg-muted"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div
              className="min-h-[80px] p-3 rounded-md border border-dashed border-muted-foreground/20 prose prose-sm dark:prose-invert max-w-none"
            >
              {item.description ? (
                <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
                  {autoBoldDates(item.description)}
                </ReactMarkdown>
              ) : (
                <span className="text-muted-foreground italic">
                  설명 없음
                </span>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
