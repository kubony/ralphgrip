// Shared edge drawing utilities for project graph and card grid views

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Bezier curve path between the centers of two rectangles.
 * Used by both the graph view (PNode-based) and card grid (DOM rect-based).
 */
export function cardEdgePath(src: Rect, tgt: Rect): string {
  const sx = src.x + src.width / 2
  const sy = src.y + src.height / 2
  const tx = tgt.x + tgt.width / 2
  const ty = tgt.y + tgt.height / 2

  const dx = tx - sx
  const dy = ty - sy
  const dist = Math.sqrt(dx * dx + dy * dy)

  const angle = Math.atan2(dy, dx)
  const startX = sx + Math.cos(angle) * Math.min(src.width / 2, dist * 0.1)
  const startY = sy + Math.sin(angle) * Math.min(src.height / 2, dist * 0.1)
  const endX = tx - Math.cos(angle) * Math.min(tgt.width / 2, dist * 0.1)
  const endY = ty - Math.sin(angle) * Math.min(tgt.height / 2, dist * 0.1)

  const cpOff = Math.min(dist * 0.3, 120)
  const perpX = -Math.sin(angle) * cpOff * 0.3
  const perpY = Math.cos(angle) * cpOff * 0.3

  const cp1x = startX + dx * 0.3 + perpX
  const cp1y = startY + dy * 0.3 + perpY
  const cp2x = endX - dx * 0.3 + perpX
  const cp2y = endY - dy * 0.3 + perpY

  return `M${startX},${startY} C${cp1x},${cp1y} ${cp2x},${cp2y} ${endX},${endY}`
}

/**
 * Edge stroke width based on link count.
 */
export function edgeWidth(count: number): number {
  if (count <= 5) return 1.5
  if (count <= 20) return 2.5
  return 3.5
}
