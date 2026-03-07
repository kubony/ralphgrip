/**
 * CSV/PDF 내보내기 공통 유틸리티
 */

/**
 * parent_id 기반 DFS 계층 정렬
 * 트리 구조를 평탄화하여 계층 레벨과 함께 반환
 */
export function flattenByHierarchy<T extends { id: string; parent_id: string | null; position?: number }>(
  items: T[]
): Array<{ item: T; level: number }> {
  const childrenMap = new Map<string | null, T[]>()
  for (const item of items) {
    const key = item.parent_id ?? null
    if (!childrenMap.has(key)) childrenMap.set(key, [])
    childrenMap.get(key)!.push(item)
  }
  // position 기준 정렬
  for (const [key, children] of childrenMap.entries()) {
    childrenMap.set(key, children.toSorted((a, b) => ((a.position as number) ?? 0) - ((b.position as number) ?? 0)))
  }

  const result: Array<{ item: T; level: number }> = []
  function dfs(parentId: string | null, level: number) {
    const children = childrenMap.get(parentId) ?? []
    for (const child of children) {
      result.push({ item: child, level })
      dfs(child.id, level + 1)
    }
  }
  dfs(null, 0)
  return result
}

/**
 * Blob을 브라우저 다운로드로 트리거
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 우선순위 숫자 → 한글 라벨
 */
export function priorityLabel(priority: number): string {
  switch (priority) {
    case 1: return '낮음'
    case 2: return '보통'
    case 3: return '높음'
    case 4: return '긴급'
    default: return '-'
  }
}

/**
 * 공개 수준 → 한글 라벨
 */
export function visibilityLabel(visibility: string): string {
  switch (visibility) {
    case 'public': return '공개'
    case 'internal': return '내부'
    default: return '내부'
  }
}

/**
 * ISO 날짜 → 한국 날짜 형식 (YYYY-MM-DD)
 */
export function formatDateForExport(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}
