'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Minus from 'lucide-react/dist/esm/icons/minus'
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2'
import GitBranch from 'lucide-react/dist/esm/icons/git-branch'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import type { ProjectCardSummary } from '@/lib/supabase/cached-queries'
import type { CrossProjectLink } from '@/types/database'
import { cardEdgePath, edgeWidth, type Rect } from '@/lib/edge-utils'

// ── Layout constants ────────────────────────────
const NODE_W = 280
const NODE_H = 140
const PAD = 60

// ── Types ───────────────────────────────────────
interface PNode {
  id: string
  key: string
  name: string
  projectType: string
  itemCount: number
  closedCount: number
  x: number
  y: number
}

interface PEdge {
  id: string
  sourceId: string
  targetId: string
  linkCount: number
  suspectCount: number
}

interface PLayout {
  nodes: PNode[]
  edges: PEdge[]
  nodeById: Map<string, PNode>
  width: number
  height: number
}

// ── Layout calculation ──────────────────────────
function calcProjectLayout(
  projects: { id: string; key: string; name: string; project_type: string }[],
  summaries: Record<string, ProjectCardSummary>,
  crossLinks: CrossProjectLink[],
): PLayout {
  const nodes: PNode[] = []
  const edges: PEdge[] = []
  const nodeById = new Map<string, PNode>()

  // Deduplicate edges (A→B and B→A should be separate)
  const edgeSet = new Set<string>()
  for (const link of crossLinks) {
    const eid = `${link.source_project_id}->${link.target_project_id}`
    if (!edgeSet.has(eid)) {
      edgeSet.add(eid)
      edges.push({
        id: eid,
        sourceId: link.source_project_id,
        targetId: link.target_project_id,
        linkCount: link.link_count,
        suspectCount: link.suspect_count,
      })
    }
  }

  // Find connected components
  const connectedIds = new Set<string>()
  for (const e of edges) {
    connectedIds.add(e.sourceId)
    connectedIds.add(e.targetId)
  }

  const connectedProjects = projects.filter(p => connectedIds.has(p.id))
  const isolatedProjects = projects.filter(p => !connectedIds.has(p.id))

  // Layout connected projects in ellipse
  const cx = PAD + (connectedProjects.length > 0 ? 400 : 200)
  const cy = PAD + 250
  const rx = Math.max(200, connectedProjects.length * 80)
  const ry = Math.max(150, connectedProjects.length * 60)

  connectedProjects.forEach((p, i) => {
    const angle = (2 * Math.PI * i) / connectedProjects.length - Math.PI / 2
    const summary = summaries[p.id]
    const node: PNode = {
      id: p.id,
      key: p.key,
      name: p.name,
      projectType: p.project_type,
      itemCount: summary?.item_count ?? 0,
      closedCount: summary?.closed_count ?? 0,
      x: cx + rx * Math.cos(angle) - NODE_W / 2,
      y: cy + ry * Math.sin(angle) - NODE_H / 2,
    }
    nodes.push(node)
    nodeById.set(node.id, node)
  })

  // Layout isolated projects at bottom
  const isoY = connectedProjects.length > 0 ? cy + ry + NODE_H + 60 : PAD
  const isoTotalW = isolatedProjects.length * (NODE_W + 24) - 24
  const isoStartX = Math.max(PAD, cx - isoTotalW / 2)

  isolatedProjects.forEach((p, i) => {
    const summary = summaries[p.id]
    const node: PNode = {
      id: p.id,
      key: p.key,
      name: p.name,
      projectType: p.project_type,
      itemCount: summary?.item_count ?? 0,
      closedCount: summary?.closed_count ?? 0,
      x: isoStartX + i * (NODE_W + 24),
      y: isoY,
    }
    nodes.push(node)
    nodeById.set(node.id, node)
  })

  // Calculate bounds
  let maxX = 0, maxY = 0
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + NODE_W)
    maxY = Math.max(maxY, n.y + NODE_H)
  }

  return {
    nodes,
    edges,
    nodeById,
    width: Math.max(maxX + PAD, 800),
    height: Math.max(maxY + PAD, 400),
  }
}

// ── Helper: PNode → Rect ────────────────────────
function nodeToRect(n: PNode): Rect {
  return { x: n.x, y: n.y, width: NODE_W, height: NODE_H }
}

// ── Component ───────────────────────────────────
interface ProjectGraphViewProps {
  projects: {
    id: string
    key: string
    name: string
    project_type: string
    description: string | null
  }[]
  summaries: Record<string, ProjectCardSummary>
  crossLinks: CrossProjectLink[]
}

export function ProjectGraphView({ projects, summaries, crossLinks }: ProjectGraphViewProps) {
  const router = useRouter()
  const [hovered, setHovered] = useState<string | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ active: false, sx: 0, sy: 0, px: 0, py: 0 })
  const fitted = useRef(false)

  const layout = useMemo(
    () => calcProjectLayout(projects, summaries, crossLinks),
    [projects, summaries, crossLinks],
  )

  // Connected set for hover highlighting
  const conn = useMemo(() => {
    if (!hovered) return { nodes: new Set<string>(), edges: new Set<string>() }
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
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const sx = rect.width / layout.width
    const sy = rect.height / layout.height
    const s = Math.min(sx, sy, 1) * 0.9
    setPan({
      x: (rect.width - layout.width * s) / 2,
      y: (rect.height - layout.height * s) / 2,
    })
    setScale(s)
  }, [layout])

  // Auto-fit on first load
  useEffect(() => {
    if (!fitted.current) {
      fitted.current = true
      requestAnimationFrame(fitView)
    }
  }, [fitView])

  // Pan handlers
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

  const onPtrUp = useCallback(() => { dragRef.current.active = false }, [])

  // Zoom — cursor-centric via affine transform
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

  // Empty state
  if (layout.edges.length === 0 && projects.length <= 1) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <GitBranch className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">프로젝트 간 연결이 없습니다</p>
        <p className="text-xs mt-1">작업 항목의 의존성을 추가하면 프로젝트 관계가 자동으로 표시됩니다</p>
      </div>
    )
  }

  const hasHov = hovered !== null

  return (
    <div className="h-full w-full relative">
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
          {/* Edges (SVG overlay) */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={layout.width}
            height={layout.height}
            style={{ zIndex: 10 }}
          >
            <defs>
              <marker id="pah" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                <polygon points="0 0.5, 9 4, 0 7.5" fill="#3b82f6" fillOpacity="0.6" />
              </marker>
              <marker id="pah-s" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                <polygon points="0 0.5, 9 4, 0 7.5" fill="#f59e0b" fillOpacity="0.8" />
              </marker>
              <marker id="pah-h" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                <polygon points="0 0, 9 4, 0 8" fill="#3b82f6" />
              </marker>
            </defs>

            {layout.edges.map(e => {
              const src = layout.nodeById.get(e.sourceId)
              const tgt = layout.nodeById.get(e.targetId)
              if (!src || !tgt) return null

              const isHl = conn.edges.has(e.id) || hoveredEdge === e.id
              const dim = hasHov && !isHl
              const hasSuspect = e.suspectCount > 0

              return (
                <g key={e.id}>
                  {/* Hit area (wider, invisible) */}
                  <path
                    d={cardEdgePath(nodeToRect(src), nodeToRect(tgt))}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={20}
                    style={{ pointerEvents: 'stroke', cursor: 'default' }}
                    onMouseEnter={() => setHoveredEdge(e.id)}
                    onMouseLeave={() => setHoveredEdge(null)}
                  />
                  {/* Visible edge */}
                  <path
                    d={cardEdgePath(nodeToRect(src), nodeToRect(tgt))}
                    fill="none"
                    stroke={hasSuspect ? '#f59e0b' : '#3b82f6'}
                    strokeWidth={edgeWidth(e.linkCount)}
                    strokeOpacity={isHl ? 1 : 0.5}
                    strokeDasharray={hasSuspect ? '8,4' : undefined}
                    markerEnd={`url(#${hasSuspect ? 'pah-s' : isHl ? 'pah-h' : 'pah'})`}
                    style={{
                      opacity: dim ? 0.12 : 1,
                      transition: 'opacity 0.15s',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Edge label (link count) */}
                  {isHl && (() => {
                    const mx = (src.x + NODE_W / 2 + tgt.x + NODE_W / 2) / 2
                    const my = (src.y + NODE_H / 2 + tgt.y + NODE_H / 2) / 2
                    return (
                      <g>
                        <rect
                          x={mx - 40}
                          y={my - 14}
                          width={80}
                          height={28}
                          rx={6}
                          className="fill-background stroke-border"
                          strokeWidth={1}
                        />
                        <text
                          x={mx}
                          y={my + 4}
                          textAnchor="middle"
                          className="fill-foreground text-[11px]"
                          style={{ pointerEvents: 'none' }}
                        >
                          {e.linkCount}개 연결
                          {e.suspectCount > 0 ? ` (${e.suspectCount} 의심)` : ''}
                        </text>
                      </g>
                    )
                  })()}
                </g>
              )
            })}
          </svg>

          {/* Nodes */}
          {layout.nodes.map(n => {
            const isHl = conn.nodes.has(n.id)
            const dim = hasHov && !isHl
            const isThis = hovered === n.id
            const progress = n.itemCount > 0
              ? Math.round((n.closedCount / n.itemCount) * 100)
              : null

            return (
              <div
                key={n.id}
                data-node
                className={cn(
                  'absolute rounded-xl border bg-background shadow-sm cursor-pointer select-none overflow-hidden',
                  isThis
                    ? 'border-blue-500 dark:border-blue-400 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/20'
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
                onClick={() => router.push(`/projects/${n.key}`)}
              >
                <div className="p-3 h-full flex flex-col gap-2">
                  {/* Header: key + type */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                      {n.key}
                    </span>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                      n.projectType === 'requirement'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
                    )}>
                      {n.projectType === 'requirement' ? '요구사항' : '이슈'}
                    </span>
                  </div>

                  {/* Name */}
                  <p className="text-sm font-medium leading-tight line-clamp-2 flex-1">
                    {n.name}
                  </p>

                  {/* Footer: item count + progress */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      <span className="font-mono">{n.itemCount}</span>
                    </div>
                    {progress !== null && (
                      <div className="flex items-center gap-1.5 flex-1">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px]">{progress}%</span>
                      </div>
                    )}
                  </div>
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

      {/* Legend */}
      <div className="absolute top-4 left-4 flex items-center gap-4 text-xs text-muted-foreground bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-2 z-40">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-blue-500 rounded-full" />
          <span>정상 연결</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 border-t-2 border-dashed border-amber-500" />
          <span>변경 의심</span>
        </div>
      </div>
    </div>
  )
}
