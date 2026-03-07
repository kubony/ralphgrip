'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { ProjectCard } from './project-card'
import { cardEdgePath, edgeWidth, type Rect } from '@/lib/edge-utils'
import type { ProjectCardSummary } from '@/lib/supabase/cached-queries'
import type { CrossProjectLink } from '@/types/database'

interface PEdge {
  id: string
  sourceId: string
  targetId: string
  linkCount: number
  suspectCount: number
}

interface Props {
  projects: {
    id: string
    key: string
    name: string
    description: string | null
    project_type: string
    is_demo: boolean
  }[]
  summaries: Map<string, ProjectCardSummary>
  allLinksMap: Map<string, CrossProjectLink[]>
  crossLinks: CrossProjectLink[]
}

export function ProjectCardGridWithEdges({
  projects,
  summaries,
  allLinksMap,
  crossLinks,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [cardRects, setCardRects] = useState<Map<string, Rect>>(new Map())
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null)

  // Deduplicated edges
  const edges = useMemo(() => {
    const result: PEdge[] = []
    const seen = new Set<string>()
    for (const link of crossLinks) {
      const eid = `${link.source_project_id}->${link.target_project_id}`
      if (!seen.has(eid)) {
        seen.add(eid)
        result.push({
          id: eid,
          sourceId: link.source_project_id,
          targetId: link.target_project_id,
          linkCount: link.link_count,
          suspectCount: link.suspect_count,
        })
      }
    }
    return result
  }, [crossLinks])

  // Measure card positions relative to container
  const measureCards = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const next = new Map<string, Rect>()
    const els = container.querySelectorAll<HTMLElement>('[data-project-id]')
    for (const el of els) {
      const id = el.dataset.projectId!
      const r = el.getBoundingClientRect()
      next.set(id, {
        x: r.left - containerRect.left,
        y: r.top - containerRect.top,
        width: r.width,
        height: r.height,
      })
    }
    setCardRects(next)
  }, [])

  // Observe container resize (grid column changes)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    // Initial measurement after layout
    const raf = requestAnimationFrame(measureCards)
    const ro = new ResizeObserver(measureCards)
    ro.observe(container)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [measureCards])

  // Connected set for hover highlighting
  const connectedSet = useMemo(() => {
    if (!hoveredProjectId) return { nodes: new Set<string>(), edges: new Set<string>() }
    const ns = new Set([hoveredProjectId])
    const es = new Set<string>()
    for (const e of edges) {
      if (e.sourceId === hoveredProjectId || e.targetId === hoveredProjectId) {
        es.add(e.id)
        ns.add(e.sourceId)
        ns.add(e.targetId)
      }
    }
    return { nodes: ns, edges: es }
  }, [hoveredProjectId, edges])

  const hasHover = hoveredProjectId !== null
  const hasEdges = edges.length > 0

  return (
    <div ref={containerRef} className="relative">
      {/* SVG overlay for edges */}
      {hasEdges && cardRects.size > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <defs>
            <marker id="grid-pah" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
              <polygon points="0 0.5, 9 4, 0 7.5" fill="#3b82f6" fillOpacity="0.6" />
            </marker>
            <marker id="grid-pah-s" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
              <polygon points="0 0.5, 9 4, 0 7.5" fill="#f59e0b" fillOpacity="0.8" />
            </marker>
            <marker id="grid-pah-h" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
              <polygon points="0 0, 9 4, 0 8" fill="#3b82f6" />
            </marker>
          </defs>

          {edges.map((e) => {
            const srcRect = cardRects.get(e.sourceId)
            const tgtRect = cardRects.get(e.targetId)
            if (!srcRect || !tgtRect) return null

            const isHl = connectedSet.edges.has(e.id)
            const hasSuspect = e.suspectCount > 0

            return (
              <path
                key={e.id}
                d={cardEdgePath(srcRect, tgtRect)}
                fill="none"
                stroke={hasSuspect ? '#f59e0b' : '#3b82f6'}
                strokeWidth={edgeWidth(e.linkCount)}
                strokeOpacity={hasHover ? (isHl ? 1 : 0.1) : 0.3}
                strokeDasharray={hasSuspect ? '8,4' : undefined}
                markerEnd={`url(#${hasSuspect ? 'grid-pah-s' : isHl ? 'grid-pah-h' : 'grid-pah'})`}
                style={{ transition: 'stroke-opacity 0.15s' }}
              />
            )
          })}
        </svg>
      )}

      {/* Card grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <div
            key={project.id}
            data-project-id={project.id}
            onMouseEnter={() => setHoveredProjectId(project.id)}
            onMouseLeave={() => setHoveredProjectId(null)}
          >
            <ProjectCard
              project={project}
              summary={summaries.get(project.id)}
              relatedProjects={allLinksMap.get(project.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
