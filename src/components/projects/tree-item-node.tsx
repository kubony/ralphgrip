'use client'

import { memo, useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import Circle from 'lucide-react/dist/esm/icons/circle'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import FolderIcon from 'lucide-react/dist/esm/icons/folder'
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import FilePlus from 'lucide-react/dist/esm/icons/file-plus'
import CornerLeftUp from 'lucide-react/dist/esm/icons/corner-left-up'
import Link2 from 'lucide-react/dist/esm/icons/link-2'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import Eye from 'lucide-react/dist/esm/icons/eye'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import { useTreeContext } from '@/hooks/use-tree-context'
import {
  deleteWorkItem,
  copyWorkItem,
  updateWorkItem,
} from '@/app/(dashboard)/projects/[key]/actions'
import type { TreeWorkItem, StatusRef, TrackerRef } from '@/types/database'
import type { Selection } from '@/hooks/use-alm-selection'

// 드롭 위치 타입
export type DropPosition = 'before' | 'after' | 'inside' | null

export interface DropIndicator {
  itemId: string
  position: DropPosition
}

export function StatusIcon({ status, tracker, className: sizeClass }: { status: StatusRef | null; tracker?: TrackerRef; className?: string }) {
  const iconClass = sizeClass || 'h-4 w-4'
  if (tracker?.name === 'Folder') {
    return <FolderIcon className={cn(iconClass, 'text-amber-500 flex-shrink-0')} />
  }

  if (!status) {
    return <Circle className={cn(iconClass, 'flex-shrink-0 text-muted-foreground')} />
  }

  if (status.is_closed) {
    const isRejected = status.name === 'Rejected'
    return <CheckCircle2 className={cn(iconClass, 'flex-shrink-0')} style={{ color: isRejected ? '#ef4444' : '#22c55e' }} />
  }

  const color = status.color || '#94a3b8'
  return <Circle className={cn(iconClass, 'flex-shrink-0')} style={{ color, fill: color }} />
}

// ── TreeItemNode (outer wrapper) ──────────────────────────────────────
// 부모 state에서 primitive props를 사전 계산하여 Inner에 전달
// 자식 재귀 렌더링도 여기서 담당

export interface TreeItemNodeProps {
  item: TreeWorkItem
  level: number
  // 부모에서 사전 계산된 primitive props
  isSelected: boolean
  isExpanded: boolean
  isFocused: boolean
  isEditing: boolean
  dropPosition: DropPosition
  hasChildren: boolean
  // 재귀 시 부모 state 접근용
  selection: Selection
  expandedItems: Set<string>
  dropIndicator: DropIndicator | null
  editingItemId: string | null
  focusedItemId: string | null
}

export function TreeItemNode({
  item,
  level,
  isSelected,
  isExpanded,
  isFocused,
  isEditing,
  dropPosition,
  hasChildren,
  selection,
  expandedItems,
  dropIndicator,
  editingItemId,
  focusedItemId,
}: TreeItemNodeProps) {
  const { getChildren, getFilteredChildren } = useTreeContext()

  const children = getFilteredChildren(item.id)
  const hasVisibleChildren = children.length > 0

  return (
    <>
      <TreeItemNodeInner
        item={item}
        level={level}
        isSelected={isSelected}
        isExpanded={isExpanded}
        isFocused={isFocused}
        isEditing={isEditing}
        dropPosition={dropPosition}
        hasChildren={hasChildren}
        hasVisibleChildren={hasVisibleChildren}
      />

      {isExpanded && hasVisibleChildren && (
        <div role="group">
          <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {children.map((child) => (
              <TreeItemNode
                key={child.id}
                item={child}
                level={level + 1}
                isSelected={selection.type === 'workitem' && (selection.id === child.id || (selection.ids?.has(child.id) ?? false))}
                isExpanded={expandedItems.has(child.id)}
                isFocused={focusedItemId === child.id}
                isEditing={editingItemId === child.id}
                dropPosition={dropIndicator?.itemId === child.id ? dropIndicator.position : null}
                hasChildren={getChildren(child.id).length > 0}
                selection={selection}
                expandedItems={expandedItems}
                dropIndicator={dropIndicator}
                editingItemId={editingItemId}
                focusedItemId={focusedItemId}
              />
            ))}
          </SortableContext>
        </div>
      )}

      {/* 자식이 있고 펼쳐진 상태에서 after 드롭 시 자식 맨 아래에 줄 표시 */}
      {dropPosition === 'after' && hasVisibleChildren && isExpanded && (
        <div
          className="h-0.5 bg-primary rounded-full mx-2 mt-0.5"
          style={{ marginLeft: `${(level + 1) * 16 + 8}px` }}
        />
      )}
    </>
  )
}

// ── TreeItemNodeInner (memo) ──────────────────────────────────────
// 실제 UI를 렌더링하는 핵심 컴포넌트. 모든 props가 primitive이므로
// React.memo의 shallow compare가 완벽하게 동작.
// 클릭 시 이전 선택 노드 + 새 선택 노드 = 2개만 리렌더.

interface TreeItemNodeInnerProps {
  item: TreeWorkItem
  level: number
  isSelected: boolean
  isExpanded: boolean
  isFocused: boolean
  isEditing: boolean
  dropPosition: DropPosition
  hasChildren: boolean
  hasVisibleChildren: boolean
}

const TreeItemNodeInner = memo(function TreeItemNodeInner({
  item,
  level,
  isSelected,
  isExpanded,
  isFocused,
  isEditing,
  dropPosition,
  hasChildren,
  hasVisibleChildren,
}: TreeItemNodeInnerProps) {
  const {
    projectId,
    projectKey,
    showTrackerId,
    linkCountMap,
    onToggle,
    onSelect,
    onCreateItem,
    onMoveToRoot,
    registerRef,
    setEditingItemId,
    setFocusedItemId,
  } = useTreeContext()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: isDragging ? CSS.Transform.toString(transform) : undefined,
    transition: isDragging ? transition : undefined,
  }

  // Inline editing state
  const [editValue, setEditValue] = useState(item.title)

  // item.title 변경 시 editValue 동기화
  useEffect(() => {
     
    queueMicrotask(() => setEditValue(item.title))
  }, [item.title])

  const handleDelete = async () => {
    const confirmAsync = window.__confirmAsync
    const confirmed = await confirmAsync?.({
      title: '항목 삭제',
      description: '이 항목을 삭제하시겠습니까?',
      actionLabel: '삭제',
      cancelLabel: '취소',
      variant: 'destructive',
    }) ?? Promise.resolve(window.confirm('정말 삭제하시겠습니까?'))

    if (confirmed) {
      const result = await deleteWorkItem(item.id, projectId)
      if (result?.error) {
        toast.error('삭제에 실패했습니다.')
      } else {
        toast.success('삭제되었습니다.')
      }
    }
  }

  const handleCopy = async () => {
    const result = await copyWorkItem(item.id, projectId)
    if (result?.error) {
      toast.error('복사에 실패했습니다.')
    } else {
      toast.success('복사되었습니다.')
    }
  }

  const handleShareLink = async () => {
    const url = `${window.location.origin}/projects/${projectKey}/alm?item=${item.id}`
    await navigator.clipboard.writeText(url)
    toast.success('링크가 복사되었습니다')
  }

  const handleSaveEdit = async (value: string) => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== item.title) {
      await updateWorkItem(item.id, { title: trimmed }, projectId)
    }
    setEditingItemId(null)
  }

  const handleCancelEdit = () => {
    setEditValue(item.title)
    setEditingItemId(null)
  }

  // ref 콜백
  const setRefs = useCallback((element: HTMLElement | null) => {
    setNodeRef(element)
    registerRef(item.id, element)
  }, [setNodeRef, registerRef, item.id])

  const lc = linkCountMap.get(item.id)

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Shift+클릭: 범위 선택
    if (e.shiftKey) {
      onSelect({
        type: 'workitem',
        id: item.id,
        ids: new Set([item.id]),
        lastSelectedId: item.id,
        _shift: true,
      } as Selection & { _shift: boolean })
      return
    }

    // Ctrl/Cmd+클릭: 개별 토글
    if (e.metaKey || e.ctrlKey) {
      onSelect({
        type: 'workitem',
        id: item.id,
        ids: new Set([item.id]),
        lastSelectedId: item.id,
        _ctrl: true,
      } as Selection & { _ctrl: boolean })
      return
    }

    // 일반 클릭: 단일 선택 + focus
    setFocusedItemId(item.id)
    onSelect({
      type: 'workitem',
      id: item.id,
      ids: new Set([item.id]),
      lastSelectedId: item.id,
    })
  }, [item.id, onSelect, setFocusedItemId])

  return (
    <div ref={setRefs} style={style}>
      {/* 위쪽 드롭 인디케이터 (줄) */}
      {dropPosition === 'before' && (
        <div
          className="h-0.5 bg-primary rounded-full mx-2 -mt-0.5 mb-0.5"
          style={{ marginLeft: `${level * 16 + 8}px` }}
        />
      )}

      <ContextMenu>
        <ContextMenuTrigger>
          <div
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-selected={isSelected}
            aria-level={level + 1}
            className={cn(
              'flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-muted cursor-grab group transition-colors duration-100',
              level === 1 && 'bg-foreground/[0.02]',
              level === 2 && 'bg-foreground/[0.035]',
              level >= 3 && 'bg-foreground/[0.05]',
              isSelected && 'bg-primary/10 text-primary',
              isDragging && 'opacity-50',
              dropPosition === 'inside' && 'ring-2 ring-primary bg-primary/5',
              isFocused && 'outline outline-2 outline-primary/50 outline-offset-[-2px]'
            )}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={handleClick}
            {...attributes}
            {...listeners}
          >
            {hasVisibleChildren || hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggle(item.id)
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="relative p-0.5 hover:bg-muted rounded after:absolute after:-inset-2 after:content-['']"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            ) : (
              <span className="w-4" />
            )}

            <StatusIcon status={item.status} tracker={item.tracker} />

            {/* Inline editing */}
            {isEditing ? (
              <input
                ref={(el) => {
                  if (el) {
                    el.focus()
                    el.select()
                  }
                }}
                className="flex-1 text-sm bg-background border border-input rounded px-1 py-0 outline-none focus:ring-1 focus:ring-primary min-w-0"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    handleSaveEdit(editValue)
                  } else if (e.key === 'Escape') {
                    handleCancelEdit()
                  }
                }}
                onBlur={() => handleSaveEdit(editValue)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="flex-1 text-sm truncate"
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  setEditValue(item.title)
                  setEditingItemId(item.id)
                }}
              >
                {showTrackerId !== false && (
                  <span className="text-muted-foreground font-mono text-xs mr-1">
                    {projectKey}-{item.number}
                  </span>
                )}
                {item.title}
              </span>
            )}

            {/* AI 생성 아이콘 */}
            {item.created_by_ai && (
              <span title="AI 생성" className="flex-shrink-0">
                <Sparkles className="h-3 w-3 text-violet-500" />
              </span>
            )}

            {/* 공개 수준 아이콘 */}
            {item.visibility === 'public' && (
              <span title="고객 공개" className="flex-shrink-0">
                <Eye className="h-3 w-3 text-green-500" />
              </span>
            )}

            {/* 링크 배지 */}
            {lc && (lc.hasSuspect ? (
              <span className="flex items-center gap-0.5 text-[10px] text-yellow-600 dark:text-yellow-400 flex-shrink-0" title="suspect 링크 있음">
                <AlertTriangle className="h-3 w-3" />
                {lc.count}
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground flex-shrink-0" title={`${lc.count}개 링크`}>
                <Link2 className="h-3 w-3" />
                {lc.count}
              </span>
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="relative p-1 opacity-0 group-hover:opacity-100 hover:bg-muted rounded transition-opacity duration-150 after:absolute after:-inset-2 after:content-['']"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleShareLink}>
                  <Link2 className="h-4 w-4 mr-2" />
                  링크 복사
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onCreateItem(item.id, false)}>
                  <FilePlus className="h-4 w-4 mr-2" />
                  하위 아이템 추가
                </DropdownMenuItem>
                {item.parent_id && (
                  <DropdownMenuItem onClick={() => onMoveToRoot(item.id)}>
                    <CornerLeftUp className="h-4 w-4 mr-2" />
                    최상위로 이동
                  </DropdownMenuItem>
                )}
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
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleShareLink}>
            <Link2 className="h-4 w-4 mr-2" />
            링크 복사
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onCreateItem(item.id, false)}>
            <FilePlus className="h-4 w-4 mr-2" />
            하위 아이템 추가
          </ContextMenuItem>
          {item.parent_id && (
            <ContextMenuItem onClick={() => onMoveToRoot(item.id)}>
              <CornerLeftUp className="h-4 w-4 mr-2" />
              최상위로 이동
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            복사
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            삭제
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* 아래쪽 드롭 인디케이터 (줄) */}
      {dropPosition === 'after' && !hasVisibleChildren && (
        <div
          className="h-0.5 bg-primary rounded-full mx-2 mt-0.5 -mb-0.5"
          style={{ marginLeft: `${level * 16 + 8}px` }}
        />
      )}
    </div>
  )
})
