'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { getTraceabilityMatrixData } from '@/app/(dashboard)/projects/[key]/actions'
import type { TraceabilityMatrixData, MatrixWorkItem, WorkItemWithRelations, TrackerRef } from '@/types/database'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import GitBranch from 'lucide-react/dist/esm/icons/git-branch'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Minus from 'lucide-react/dist/esm/icons/minus'
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2'
import X from 'lucide-react/dist/esm/icons/x'
import Focus from 'lucide-react/dist/esm/icons/focus'

// ── Layout constants ────────────────────────────
const NODE_W = 260
const NODE_H = 84
const NODE_GAP = 6
const GRP_PX = 16
const GRP_PT = 36
const GRP_PB = 12
const GROUP_GAP = 24
const LANE_GAP = 300
const PAD = 48

// ── Types ───────────────────────────────────────
interface GNode {
  id: string
  key: string
  pkey: string
  title: string
  statusColor: string
  x: number
  y: number
  side: 'left' | 'right'
}

interface GGroup {
  label: string
  x: number
  y: number
  w: number
  h: number
}

interface GEdge {
  id: string
  sourceId: string
  targetId: string
  suspect: boolean
}

interface Layout {
  nodes: GNode[]
  groups: GGroup[]
  edges: GEdge[]
  nodeById: Map<string, GNode>
  width: number
  height: number
}

// ── Layout calculation ──────────────────────────
function calcLayout(data: TraceabilityMatrixData, projectKey: string): Layout {
  const nodes: GNode[] = []
  const groups: GGroup[] = []
  const edges: GEdge[] = []
  const nodeById = new Map<string, GNode>()

  // Only include items that have links
  const linkedIds = new Set<string>()
  for (const lk of data.links) {
    linkedIds.add(lk.source_id)
    linkedIds.add(lk.target_id)
  }

  const groupW = NODE_W + GRP_PX * 2

  // LEFT: group rows by level (only linked items)
  const linkedRows = data.rows.filter(r => linkedIds.has(r.id))
  const byLevel = new Map<number, MatrixWorkItem[]>()
  for (const r of linkedRows) {
    const lvl = r.level || 1
    if (!byLevel.has(lvl)) byLevel.set(lvl, [])
    byLevel.get(lvl)!.push(r)
  }

  let ly = PAD
  for (const level of [...byLevel.keys()].toSorted()) {
    const items = byLevel.get(level)!
    const gy = ly

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const n: GNode = {
        id: it.id,
        key: `${projectKey}-${it.number}`,
        pkey: projectKey,
        title: it.title,
        statusColor: it.status?.color || '#94a3b8',
        x: PAD + GRP_PX,
        y: gy + GRP_PT + i * (NODE_H + NODE_GAP),
        side: 'left',
      }
      nodes.push(n)
      nodeById.set(n.id, n)
    }

    const gh = GRP_PT + items.length * (NODE_H + NODE_GAP) - NODE_GAP + GRP_PB
    groups.push({ label: `L${level}`, x: PAD, y: gy, w: groupW, h: gh })
    ly += gh + GROUP_GAP
  }

  // RIGHT: group by project
  const rx = PAD + groupW + LANE_GAP
  let ry = PAD
  for (const cg of data.columnGroups) {
    // Only linked items
    const cgItems = cg.items.filter(it => linkedIds.has(it.id))
    if (cgItems.length === 0) continue

    const gy = ry
    for (let i = 0; i < cgItems.length; i++) {
      const it = cgItems[i]
      const n: GNode = {
        id: it.id,
        key: `${cg.project_key}-${it.number}`,
        pkey: cg.project_key,
        title: it.title,
        statusColor: it.status?.color || '#94a3b8',
        x: rx + GRP_PX,
        y: gy + GRP_PT + i * (NODE_H + NODE_GAP),
        side: 'right',
      }
      nodes.push(n)
      nodeById.set(n.id, n)
    }

    const gh = GRP_PT + cgItems.length * (NODE_H + NODE_GAP) - NODE_GAP + GRP_PB
    groups.push({ label: cg.project_key, x: rx, y: gy, w: groupW, h: gh })
    ry += gh + GROUP_GAP
  }

  // Edges
  for (const lk of data.links) {
    if (nodeById.has(lk.source_id) && nodeById.has(lk.target_id)) {
      edges.push({ id: lk.id, sourceId: lk.source_id, targetId: lk.target_id, suspect: lk.suspect })
    }
  }

  const cw = Math.max(rx + groupW + PAD, 800)
  const ch = Math.max(ly, ry, 400) + PAD

  return { nodes, groups, edges, nodeById, width: cw, height: ch }
}

// ── Bezier edge path ────────────────────────────
function edgePath(src: GNode, tgt: GNode): string {
  const sy = src.y + NODE_H / 2
  const ty = tgt.y + NODE_H / 2

  // Same column: arc outward
  if (src.side === tgt.side) {
    const outside = src.side === 'left' ? -1 : 1
    const edgeX = src.side === 'left' ? src.x : src.x + NODE_W
    const bulge = Math.max(50, Math.abs(sy - ty) * 0.3)
    const arcX = edgeX + outside * bulge
    return `M${edgeX},${sy} C${arcX},${sy} ${arcX},${ty} ${edgeX},${ty}`
  }

  // Cross column
  const ltr = src.x < tgt.x
  const sx = ltr ? src.x + NODE_W : src.x
  const tx = ltr ? tgt.x : tgt.x + NODE_W
  const dx = tx - sx
  const off = Math.min(Math.abs(dx) * 0.4, 120)
  const sgn = dx >= 0 ? 1 : -1
  return `M${sx},${sy} C${sx + sgn * off},${sy} ${tx - sgn * off},${ty} ${tx},${ty}`
}

// ── Component ───────────────────────────────────
interface GraphViewProps {
  projectId: string
  projectKey: string
  workItems: WorkItemWithRelations[]
  trackers: TrackerRef[]
  onSelectItem?: (id: string, nodeProjectKey: string) => void
  focusItemId?: string | null
  onClearFocus?: () => void
}

export function GraphView({ projectId, projectKey, workItems, onSelectItem, focusItemId, onClearFocus }: GraphViewProps) {
  const [data, setData] = useState<TraceabilityMatrixData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<string | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [internalFocusId, setInternalFocusId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ active: false, sx: 0, sy: 0, px: 0, py: 0 })
  const fitted = useRef(false)

  // 외부 focusItemId와 내부 internalFocusId 합산
  const activeFocusId = focusItemId || internalFocusId

  // Fetch data
  useEffect(() => {
    let cancel = false
     
    queueMicrotask(() => setLoading(true))
    getTraceabilityMatrixData(projectId).then(r => {
      if (!cancel) {
        if (r.data) setData(r.data)
         
        queueMicrotask(() => setLoading(false))
      }
    })
    return () => { cancel = true }
  }, [projectId])

  // Apply workItems filter (status, level, assignee filters from parent)
  // Then apply focus mode on top
  const effectiveData = useMemo(() => {
    if (!data) return null

    // Step 1: Filter rows by workItems (current project items only)
    const visibleIds = new Set(workItems.map(w => w.id))
    const filteredRows = data.rows.filter(r => visibleIds.has(r.id))
    // Filter links: source OR target must be in visible rows
    const filteredLinks = data.links.filter(lk => visibleIds.has(lk.source_id) || visibleIds.has(lk.target_id))

    let filtered = { ...data, rows: filteredRows, links: filteredLinks }

    // Step 2: Focus mode — further narrow to 1-hop neighbors
    if (activeFocusId) {
      const neighborLinks = filtered.links.filter(
        lk => lk.source_id === activeFocusId || lk.target_id === activeFocusId
      )
      if (neighborLinks.length === 0) return null
      filtered = { ...filtered, links: neighborLinks }
    }

    return filtered
  }, [data, workItems, activeFocusId])

  // Focus item label for banner
  const focusLabel = useMemo(() => {
    if (!data || !activeFocusId) return null
    const row = data.rows.find(r => r.id === activeFocusId)
    if (row) return `${projectKey}-${row.number}`
    for (const cg of data.columnGroups) {
      const item = cg.items.find(it => it.id === activeFocusId)
      if (item) return `${cg.project_key}-${item.number}`
    }
    return null
  }, [data, activeFocusId, projectKey])

  const layout = useMemo(() => effectiveData ? calcLayout(effectiveData, projectKey) : null, [effectiveData, projectKey])

  // Connected set for hover highlighting
  const conn = useMemo(() => {
    if (!hovered || !layout) return { nodes: new Set<string>(), edges: new Set<string>() }
    const ns = new Set([hovered])
    const es = new Set<string>()
    for (const e of layout.edges) {
      if (e.sourceId === hovered || e.targetId === hovered) {
        es.add(e.id)
        ns.add(e.sourceId)
        ns.add(e.targetId)
      }
    }
    return { nodes: ns, edges: es }
  }, [hovered, layout])

  // Fit to view
  const fitView = useCallback(() => {
    if (!layout || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const sx = rect.width / layout.width
    const sy = rect.height / layout.height
    const s = Math.min(sx, sy, 1) * 0.92
    setPan({
      x: (rect.width - layout.width * s) / 2,
      y: (rect.height - layout.height * s) / 2,
    })
    setScale(s)
  }, [layout])

  // activeFocusId 변경 시 fitView 트리거 (레이아웃이 바뀌므로 재배치)
  useEffect(() => {
    fitted.current = false
  }, [activeFocusId])

  // 레이아웃이 변경되면 fitView 자동 실행
  useEffect(() => {
    if (layout && !fitted.current) {
      fitted.current = true
      requestAnimationFrame(fitView)
    }
  }, [layout, fitView])

  // ESC 키로 포커스 해제
  useEffect(() => {
    if (!activeFocusId) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInternalFocusId(null)
        onClearFocus?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeFocusId, onClearFocus])

  // Pan handlers (+ 빈 영역 클릭 시 포커스 해제)
  const onPtrDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-node]')) return
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [pan])

  const onPtrMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return
    const d = dragRef.current
    setPan({ x: d.px + e.clientX - d.sx, y: d.py + e.clientY - d.sy })
  }, [])

  const onPtrUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return
    const d = dragRef.current
    const dist = Math.hypot(e.clientX - d.sx, e.clientY - d.sy)
    dragRef.current.active = false
    // 드래그 거리가 5px 미만이면 클릭으로 판정 → 포커스 해제
    if (dist < 5 && internalFocusId) {
      setInternalFocusId(null)
    }
  }, [internalFocusId])

  // Zoom (non-passive wheel) — cursor-centric via affine transform
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      // 터치패드 핀치(ctrlKey)는 deltaY 감도가 다름
      const factor = e.ctrlKey
        ? Math.max(0.2 / 3, Math.min(3, 1 - e.deltaY * 0.01))
        : (e.deltaY > 0 ? 0.92 : 1.08)

      setScale(prev => {
        const next = Math.max(0.2, Math.min(3, prev * factor))
        const ratio = next / prev
        setPan(p => ({
          x: mx - (mx - p.x) * ratio,
          y: my - (my - p.y) * ratio,
        }))
        return next
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">그래프 데이터 로딩 중...</span>
      </div>
    )
  }

  // Empty state
  if (!data || !layout || layout.edges.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <GitBranch className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">
          {activeFocusId ? '이 항목에 연결된 의존성이 없습니다' : '연결된 항목이 없습니다'}
        </p>
        <p className="text-xs mt-1">
          {activeFocusId ? (
            <button
              onClick={() => { setInternalFocusId(null); onClearFocus?.() }}
              className="text-blue-500 hover:underline"
            >
              전체 그래프 보기
            </button>
          ) : (
            '속성 패널에서 항목 간 의존성을 추가해주세요'
          )}
        </p>
      </div>
    )
  }

  const hasHov = hovered !== null

  return (
    <div className="h-full w-full relative">
      {/* Focus banner */}
      {activeFocusId && focusLabel && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 backdrop-blur-sm shadow-sm">
          <Focus className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-xs font-medium">
            <span className="font-mono text-blue-500">{focusLabel}</span>
            <span className="text-muted-foreground ml-1">의 의존성</span>
          </span>
          <button
            onClick={() => { setInternalFocusId(null); onClearFocus?.() }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            title="전체 그래프 보기 (ESC)"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden overscroll-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPtrDown}
        onPointerMove={onPtrMove}
        onPointerUp={onPtrUp}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: layout.width,
            height: layout.height,
            position: 'relative',
          }}
        >
          {/* Group boundaries */}
          {layout.groups.map((g, i) => (
            <div
              key={i}
              className="absolute rounded-xl border border-dashed border-border/50 bg-muted/20"
              style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
            >
              <span className="absolute top-2.5 left-3.5 text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wider">
                {g.label}
              </span>
            </div>
          ))}

          {/* Edges (SVG overlay) */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={layout.width}
            height={layout.height}
            style={{ zIndex: 10 }}
          >
            <defs>
              <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0.5, 7 3, 0 5.5" fill="#3b82f6" fillOpacity="0.5" />
              </marker>
              <marker id="ah-s" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0.5, 7 3, 0 5.5" fill="#f59e0b" fillOpacity="0.8" />
              </marker>
              <marker id="ah-h" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                <polygon points="0 0, 8 3.5, 0 7" fill="#3b82f6" />
              </marker>
            </defs>

            {layout.edges.map(e => {
              const src = layout.nodeById.get(e.sourceId)
              const tgt = layout.nodeById.get(e.targetId)
              if (!src || !tgt) return null

              const isHl = conn.edges.has(e.id)
              const dim = hasHov && !isHl

              return (
                <path
                  key={e.id}
                  d={edgePath(src, tgt)}
                  fill="none"
                  stroke={e.suspect ? '#f59e0b' : '#3b82f6'}
                  strokeWidth={isHl ? 2.5 : 1.5}
                  strokeOpacity={e.suspect ? 0.8 : isHl ? 1 : 0.4}
                  strokeDasharray={e.suspect ? '6,3' : undefined}
                  markerEnd={`url(#${e.suspect ? 'ah-s' : isHl ? 'ah-h' : 'ah'})`}
                  style={{
                    opacity: dim ? 0.12 : 1,
                    transition: 'opacity 0.15s',
                  }}
                />
              )
            })}
          </svg>

          {/* Nodes */}
          {layout.nodes.map(n => {
            const isHl = conn.nodes.has(n.id)
            const dim = hasHov && !isHl
            const isThis = hovered === n.id

            return (
              <div
                key={n.id}
                data-node
                className={cn(
                  'absolute flex items-start gap-2.5 px-3 py-2 rounded-md border bg-background cursor-pointer select-none',
                  isThis
                    ? 'border-blue-500 dark:border-blue-400 shadow-md shadow-blue-500/10'
                    : isHl
                      ? 'border-blue-400/50 dark:border-blue-500/50'
                      : 'border-border hover:border-blue-300/50 dark:hover:border-blue-500/30',
                )}
                style={{
                  left: n.x,
                  top: n.y,
                  width: NODE_W,
                  height: NODE_H,
                  zIndex: isThis ? 30 : 20,
                  opacity: dim ? 0.2 : 1,
                  transition: 'opacity 0.15s, border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setInternalFocusId(n.id)}
                onDoubleClick={() => onSelectItem?.(n.id, n.pkey)}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: n.statusColor }}
                />
                <div className="flex flex-col min-w-0 gap-0.5">
                  <span className="text-[10px] text-muted-foreground font-mono leading-none">
                    {n.key}
                  </span>
                  <span className="text-xs leading-tight line-clamp-3">{n.title}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-background/90 backdrop-blur-sm border rounded-lg shadow-sm p-1 z-40">
        <button
          onClick={() => setScale(s => Math.min(3, s * 1.2))}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="확대"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setScale(s => Math.max(0.2, s / 1.2))}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="축소"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-4 bg-border" />
        <button
          onClick={fitView}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="전체 보기"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <span className="text-[10px] text-muted-foreground px-1.5 tabular-nums">
          {Math.round(scale * 100)}%
        </span>
      </div>
    </div>
  )
}

export default GraphView
