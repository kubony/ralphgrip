'use client'

import { useState, useMemo, useEffect, useRef, useOptimistic, useTransition, memo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { updateWorkItem, deleteWorkItem, copyWorkItem, createWorkItem } from '@/app/(dashboard)/projects/[key]/actions'
import { type Selection } from './alm-layout'
import type { WorkItemWithRelations, StatusRef, TrackerRef, LinkedIssueStatus } from '@/types/database'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useTheme } from '@/hooks/use-theme'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { uploadImage, getSignedUrl } from '@/lib/supabase/upload-image'
import { StatusIcon } from './tree-item-node'
import { Button } from '@/components/ui/button'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import MoreVertical from 'lucide-react/dist/esm/icons/more-vertical'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Copy from 'lucide-react/dist/esm/icons/copy'
import FilePlus from 'lucide-react/dist/esm/icons/file-plus'
import Link2 from 'lucide-react/dist/esm/icons/link-2'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import { scrollMaskBoth } from '@/lib/motion'

/** 이미 볼드가 아닌 날짜(YYYY.MM.DD / YYYY-MM-DD)를 **볼드**로 변환 */
const DATE_BOLD_REGEX = /(?<!\*\*)\b(\d{4}[.\-]\d{2}[.\-]\d{2})\b(?!\*\*)/g
function autoBoldDates(text: string): string {
  if (!text) return text
  return text.replace(DATE_BOLD_REGEX, '**$1**')
}

// ReactMarkdown remarkPlugins 상수 (매 렌더마다 새 배열 생성 방지)
const REMARK_PLUGINS = [remarkBreaks]

// 마크다운 내 링크를 새 탭에서 열고, 부모 클릭 이벤트 전파 방지
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
  img: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === 'string' ? src : undefined}
      alt={alt || ''}
      className="max-w-full rounded-md my-2"
      loading="lazy"
      onClick={(e) => {
        e.stopPropagation()
        if (typeof src === 'string' && src) window.open(src, '_blank')
      }}
      style={{ cursor: 'pointer' }}
      {...props}
    />
  ),
}

// 마크다운 에디터 동적 로드 (SSR 비활성화)
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface ALMDocumentViewProps {
  projectId: string
  projectKey: string
  workItems: WorkItemWithRelations[]
  trackers: TrackerRef[]
  statuses: StatusRef[]
  selection: Selection
  onSelectionChange: (selection: Selection) => void
  showTrackerId?: boolean
  autoInsertDate?: boolean
  linkedIssueStatuses?: LinkedIssueStatus[]
}

function StatusDropdown({
  status,
  statuses,
  onStatusChange,
}: {
  status: StatusRef | null
  statuses: StatusRef[]
  onStatusChange: (statusId: string) => void
}) {
  if (!status) return null

  const sorted = statuses.toSorted((a, b) => (a.position ?? 0) - (b.position ?? 0))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-0.5 rounded hover:bg-muted transition-colors"
          title={`상태: ${status.name} (클릭하여 변경)`}
        >
          <StatusIcon status={status} className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {sorted.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onClick={() => onStatusChange(s.id)}
            className={cn(s.id === status.id && 'bg-accent')}
          >
            <StatusIcon status={s} className="h-5 w-5" />
            <span className="ml-2">{s.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ALMDocumentView({
  projectId,
  projectKey,
  workItems,
  trackers,
  statuses,
  selection,
  onSelectionChange,
  showTrackerId,
  autoInsertDate,
  linkedIssueStatuses,
}: ALMDocumentViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // childrenMap으로 O(1) 자식 조회 (O(n^2) → O(n) 최적화)
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, WorkItemWithRelations[]>()
    for (const item of workItems) {
      const key = item.parent_id ?? null
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    for (const [key, children] of map.entries()) {
      map.set(key, children.toSorted((a, b) => a.position - b.position))
    }
    return map
  }, [workItems])

  // 계층 구조로 평탄화 (들여쓰기 레벨 포함)
  // orphan root 처리: parent가 현재 세트에 없는 항목도 루트로 표시
  const flatItems = useMemo(() => {
    const result: Array<{ item: WorkItemWithRelations; level: number }> = []
    const itemIdSet = new Set(workItems.map(w => w.id))
    const visited = new Set<string>()

    const flatten = (parentId: string | null, level: number) => {
      const children = childrenMap.get(parentId) ?? []
      for (const item of children) {
        if (visited.has(item.id)) continue
        visited.add(item.id)
        result.push({ item, level })
        flatten(item.id, level + 1)
      }
    }

    // 자연 루트 (parent_id === null)
    flatten(null, 0)

    // orphan 루트 (parent가 현재 세트에 없는 항목)
    for (const item of workItems) {
      if (!visited.has(item.id) && item.parent_id !== null && !itemIdSet.has(item.parent_id)) {
        visited.add(item.id)
        result.push({ item, level: 0 })
        flatten(item.id, 1)
      }
    }

    return result
  }, [childrenMap, workItems])

  // 연결된 이슈/요구사항 worst status Map
  const linkedIssueStatusMap = useMemo(
    () => new Map((linkedIssueStatuses ?? []).map(s => [s.work_item_id, s])),
    [linkedIssueStatuses]
  )

  // 선택 변경 시 해당 섹션으로 스크롤
  useEffect(() => {
    if (!selection.id || selection.type !== 'workitem' || !containerRef.current) return

    const targetId = selection.id
    const container = containerRef.current
    let cancelled = false
    let attempts = 0
    const maxAttempts = 8

    const tryScroll = () => {
      if (cancelled) return
      const element = container.querySelector(`[data-item-id="${targetId}"]`) as HTMLElement | null
      if (element) {
        const containerRect = container.getBoundingClientRect()
        const elementRect = element.getBoundingClientRect()
        const scrollTop = container.scrollTop + (elementRect.top - containerRect.top) - containerRect.height / 2 + elementRect.height / 2
        container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' })
        return
      }
      attempts++
      if (attempts < maxAttempts) {
        requestAnimationFrame(tryScroll)
      }
    }

    // Double RAF: wait for React render + layout settle
    requestAnimationFrame(() => {
      requestAnimationFrame(tryScroll)
    })

    return () => { cancelled = true }
  }, [selection.id, selection.type])

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto bg-background" style={{ WebkitMaskImage: scrollMaskBoth, maskImage: scrollMaskBoth }}>
      <div className="mx-auto py-4">
        {flatItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <p className="text-sm">아직 작업 항목이 없습니다</p>
            <p className="text-xs">왼쪽 트리 패널에서 항목을 추가하거나, 상단의 + 버튼을 눌러 시작하세요</p>
          </div>
        ) : (
          flatItems.map(({ item, level }) => (
            <DocumentSection
              key={item.id}
              item={item}
              level={level}
              projectId={projectId}
              projectKey={projectKey}
              trackers={trackers}
              statuses={statuses}
              isSelected={selection.type === 'workitem' && selection.id === item.id}
              onSelect={() => onSelectionChange({ type: 'workitem', id: item.id })}
              showTrackerId={showTrackerId}
              autoInsertDate={autoInsertDate}
              linkedIssueStatus={linkedIssueStatusMap.get(item.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface DocumentSectionProps {
  item: WorkItemWithRelations
  level: number
  projectId: string
  projectKey: string
  trackers: TrackerRef[]
  statuses: StatusRef[]
  isSelected: boolean
  onSelect: () => void
  showTrackerId?: boolean
  autoInsertDate?: boolean
  linkedIssueStatus?: LinkedIssueStatus
}

const DocumentSection = memo(function DocumentSection({
  item,
  level,
  projectId,
  projectKey,
  trackers,
  statuses,
  isSelected,
  onSelect,
  showTrackerId,
  autoInsertDate,
  linkedIssueStatus,
}: DocumentSectionProps) {
  const { resolvedTheme } = useTheme()
  const [isExpanded, setIsExpanded] = useState(true)
  const [description, setDescription] = useState(item.description || '')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState(item.title)

  // 외부에서 item 데이터 변경 시 로컬 상태 동기화 (편집 중이 아닐 때만)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isEditing) setDescription(item.description || '')
  }, [item.description, isEditing])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isEditingTitle) setEditedTitle(item.title)
  }, [item.title, isEditingTitle])

  // Optimistic UI for status change
  const [optimisticStatus, setOptimisticStatus] = useOptimistic<StatusRef | null, string>(
    item.status,
    (_current, newStatusId) => {
      const newStatus = statuses.find((s) => s.id === newStatusId)
      return newStatus || _current
    }
  )
  const [, startTransition] = useTransition()

  const handleStatusChange = (statusId: string) => {
    if (statusId === item.status?.id) return
    startTransition(async () => {
      setOptimisticStatus(statusId)
      await updateWorkItem(item.id, { status_id: statusId }, projectId)
    })
  }

  const handleDescriptionSave = useCallback(async () => {
    const formatted = autoBoldDates(description)
    if (formatted !== description) setDescription(formatted)
    if (formatted !== (item.description || '')) {
      setIsSaving(true)
      const result = await updateWorkItem(item.id, { description: formatted || null }, projectId)
      setIsSaving(false)
      if (result?.error) {
        toast.error('설명 저장에 실패했습니다.')
        return
      }
    }
    setIsEditing(false)
  }, [description, item.description, item.id, projectId])

  const handleTitleSave = async () => {
    if (editedTitle.trim() && editedTitle !== item.title) {
      setIsSaving(true)
      const result = await updateWorkItem(item.id, { title: editedTitle.trim() }, projectId)
      setIsSaving(false)
      if (result?.error) {
        toast.error('제목 저장에 실패했습니다.')
        setEditedTitle(item.title)
        return
      }
    }
    setIsEditingTitle(false)
  }

  const handleAddChildItem = async () => {
    const defaultTracker = trackers.find((t) => t.name !== 'Folder') || trackers[0]
    const defaultStatus = statuses.find((s) => !s.is_closed) || statuses[0]

    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('title', '새 아이템')
    formData.set('trackerId', defaultTracker.id)
    formData.set('statusId', defaultStatus.id)
    formData.set('priority', '0')
    formData.set('parentId', item.id)

    const result = await createWorkItem(formData)
    if (result?.error) {
      toast.error('하위 아이템 추가에 실패했습니다.')
    }
  }

  const handleDelete = async () => {
    const confirmAsync = (
      window as Window & {
        __confirmAsync?: (options: {
          title: string
          description: string
          actionLabel: string
          cancelLabel: string
          variant: 'destructive'
        }) => Promise<boolean>
      }
    ).__confirmAsync

    const confirmed = await confirmAsync?.({
      title: '항목 삭제',
      description: '이 항목을 삭제하시겠습니까?',
      actionLabel: '삭제',
      cancelLabel: '취소',
      variant: 'destructive',
    }) ?? Promise.resolve(window.confirm('정말 삭제하시겠습니까?'))

    if (confirmed) {
      await deleteWorkItem(item.id, projectId)
    }
  }

  const handleCopy = async () => {
    await copyWorkItem(item.id, projectId)
  }

  const handleShareLink = async () => {
    const url = `${window.location.origin}/projects/${projectKey}/alm?item=${item.id}`
    await navigator.clipboard.writeText(url)
    toast.success('링크가 복사되었습니다')
  }

  const startEditing = () => {
    if (autoInsertDate !== false && !description) {
      const now = new Date()
      const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
      const today = `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, '0')}.${String(kst.getUTCDate()).padStart(2, '0')}`
      setDescription(`${today}\n\n`)
    }
    setIsEditing(true)
  }

  const handleEditorPaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const clipItem of Array.from(items)) {
      if (clipItem.type.startsWith('image/')) {
        e.preventDefault()
        const file = clipItem.getAsFile()
        if (file) {
          const placeholder = `![업로드 중...]()`
          setDescription(prev => prev + placeholder)

          try {
            const attachment = await uploadImage(file, projectId, item.id)
            const url = await getSignedUrl(attachment.storage_path)
            if (url) {
              setDescription(prev => prev.replace(placeholder, `![${attachment.file_name}](${url})`))
            } else {
              setDescription(prev => prev.replace(placeholder, ''))
              toast.error('이미지 URL 생성에 실패했습니다.')
            }
          } catch (err) {
            setDescription(prev => prev.replace(placeholder, ''))
            toast.error(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.')
          }
        }
        return
      }
    }
  }

  const handleEditorDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  const handleEditorDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    const imageFile = Array.from(files).find(f => f.type.startsWith('image/'))
    if (!imageFile) return

    e.preventDefault()

    const placeholder = `![업로드 중...]()`
    setDescription(prev => prev + '\n' + placeholder)

    try {
      const attachment = await uploadImage(imageFile, projectId, item.id)
      const url = await getSignedUrl(attachment.storage_path)
      if (url) {
        setDescription(prev => prev.replace(placeholder, `![${attachment.file_name}](${url})`))
      } else {
        setDescription(prev => prev.replace(placeholder, ''))
      }
    } catch (err) {
      setDescription(prev => prev.replace(placeholder, ''))
      toast.error(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.')
    }
  }

  // handleDescriptionSave를 ref로 저장해 useEffect에서 안정적으로 참조
  const handleDescriptionSaveRef = useRef(handleDescriptionSave)
  useEffect(() => {
    handleDescriptionSaveRef.current = handleDescriptionSave
  }, [handleDescriptionSave])

  // Ctrl+S 단축키로 저장
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (isEditing) {
          handleDescriptionSaveRef.current()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isEditing])

  // Tab 키 들여쓰기 핸들러
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      const target = e.target as HTMLTextAreaElement
      if (target.tagName !== 'TEXTAREA') return

      e.preventDefault()
      const start = target.selectionStart
      const end = target.selectionEnd
      const value = description
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const lineContent = value.substring(lineStart, end)

      // 불릿 라인인지 확인 (-, *, 숫자. 로 시작)
      const bulletRegex = /^(\s*)([-*]|\d+\.)\s/
      const isBulletLine = bulletRegex.test(lineContent)

      if (isBulletLine) {
        if (e.shiftKey) {
          // Shift+Tab: 내어쓰기 (앞의 2칸 공백 제거)
          if (value.substring(lineStart, lineStart + 2) === '  ') {
            const newValue = value.substring(0, lineStart) + value.substring(lineStart + 2)
            setDescription(newValue)
            setTimeout(() => {
              target.selectionStart = target.selectionEnd = Math.max(start - 2, lineStart)
            }, 0)
          }
        } else {
          // Tab: 들여쓰기 (2칸 공백 추가)
          const newValue = value.substring(0, lineStart) + '  ' + value.substring(lineStart)
          setDescription(newValue)
          setTimeout(() => {
            target.selectionStart = target.selectionEnd = start + 2
          }, 0)
        }
      } else if (!e.shiftKey) {
        // 일반 라인에서 Tab: 2칸 공백 삽입
        const newValue = value.substring(0, start) + '  ' + value.substring(end)
        setDescription(newValue)
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 2
        }, 0)
      }
    }
  }

  // 레벨에 따른 헤딩 크기
  const headingSize = level === 0 ? 'text-xl' : level === 1 ? 'text-lg' : 'text-base'

  return (
    <div
      data-item-id={item.id}
      className={cn(
        'border-b last:border-b-0',
        isSelected && 'bg-primary/5 border-l-2 border-l-primary'
      )}
      style={{ paddingLeft: `${level * 24}px` }}
    >
      {/* 헤더 */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 group"
        onClick={() => {
          onSelect()
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
          className="p-1 hover:bg-muted rounded"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {item.tracker.name === 'Folder' ? (
          <StatusIcon status={item.status} tracker={item.tracker} className="h-5 w-5" />
        ) : (
          <StatusDropdown
            status={optimisticStatus}
            statuses={statuses}
            onStatusChange={handleStatusChange}
          />
        )}

        {showTrackerId !== false && (
          <span className="text-muted-foreground font-mono mr-2 text-sm">
            {projectKey}-{item.number}
          </span>
        )}

        {isEditingTitle ? (
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSave()
              if (e.key === 'Escape') {
                setEditedTitle(item.title)
                setIsEditingTitle(false)
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'font-semibold bg-transparent border-b-2 border-primary outline-none flex-1',
              headingSize
            )}
            autoFocus
          />
        ) : (
          <>
            <span
              className={cn('font-semibold flex-1 cursor-text', headingSize)}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditedTitle(item.title)
                setIsEditingTitle(true)
              }}
            >
              {item.title}
            </span>
            {!isEditingTitle && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditedTitle(item.title)
                  setIsEditingTitle(true)
                }}
                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-muted rounded transition-opacity relative after:absolute after:-inset-1.5 after:content-['']"
                title="제목 편집"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </>
        )}

        {/* 연결된 항목 상태 색상 점 */}
        {linkedIssueStatus && (
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: linkedIssueStatus.worst_status_color }}
            title={`연결 상태: ${linkedIssueStatus.worst_status_name}`}
          />
        )}

        {/* 더보기 메뉴 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-muted rounded transition-opacity"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleShareLink}>
              <Link2 className="h-4 w-4 mr-2" />
              링크 복사
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleAddChildItem}>
              <FilePlus className="h-4 w-4 mr-2" />
              하위 아이템 추가
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" />
              복사
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 내용 */}
      {isExpanded && (
        <div className="px-4 pb-4 pl-14">
          {isEditing ? (
            <div data-color-mode={resolvedTheme} onKeyDown={handleEditorKeyDown} onPaste={handleEditorPaste} onDrop={handleEditorDrop} onDragOver={handleEditorDragOver}>
              <MDEditor
                value={description}
                onChange={(val) => setDescription(val || '')}
                height={Math.min(Math.max((description.split('\n').length + 2) * 22, 200), 600)}
                preview="edit"
              />
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  onClick={handleDescriptionSave}
                  disabled={isSaving}
                >
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDescription(item.description || '')
                    setIsEditing(false)
                  }}
                >
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <div className="group/desc relative">
              <div
                onClick={onSelect}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  startEditing()
                }}
                className="min-h-[40px] p-2 rounded-md cursor-text prose prose-sm dark:prose-invert max-w-none"
              >
                {description ? (
                  <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>{description}</ReactMarkdown>
                ) : (
                  <span className="text-muted-foreground italic">
                    설명이 없습니다.
                  </span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  startEditing()
                }}
                className="absolute top-1 right-1 p-1.5 opacity-0 group-hover/desc:opacity-100 hover:bg-muted rounded transition-opacity after:absolute after:-inset-1.5 after:content-['']"
                title="설명 편집"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
