/**
 * 프로젝트 전체 작업 항목을 CSV로 내보내기
 */

import { flattenByHierarchy, downloadBlob, priorityLabel, visibilityLabel, formatDateForExport } from './export-utils'

interface StatusInfo {
  id: string
  name: string
}

interface TrackerInfo {
  id: string
  name: string
}

interface MemberInfo {
  id: string
  full_name: string | null
}

interface CsvWorkItem {
  id: string
  number: number
  title: string
  description: string | null
  parent_id: string | null
  position?: number
  priority: number
  visibility: string
  due_date: string | null
  start_date: string | null
  actual_start_date?: string | null
  actual_resolved_date?: string | null
  actual_end_date?: string | null
  estimated_hours: number | null
  actual_hours: number | null
  external_url: string | null
  created_at: string
  updated_at: string
  status: StatusInfo
  tracker: TrackerInfo
  assignee: MemberInfo | null
  reporter: MemberInfo | null
}

/**
 * RFC 4180 기준 CSV 셀 이스케이프
 */
function escapeCsvCell(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * 프로젝트 전체 작업 항목을 CSV로 내보내기
 * @param external true이면 공개 항목만, 공개수준 컬럼 제외
 */
export function exportWorkItemsToCsv(
  workItems: CsvWorkItem[],
  projectName: string,
  projectKey: string,
  options?: { external?: boolean; allWorkItems?: CsvWorkItem[] }
) {
  const { external = false, allWorkItems } = options ?? {}

  // 외부용: 공개 항목만 필터
  const items = external ? workItems.filter(w => w.visibility === 'public') : workItems

  const headers = external
    ? ['번호', '레벨', '제목', '설명', '상태', '트래커', '우선순위',
       '담당자', '생성자', '목표 마감일', '목표 시작일', '실제 시작일', '실제 완료일', '실제 종료일', '예상공수', '실적공수',
       '외부링크', '상위항목번호', '생성일', '수정일']
    : ['번호', '레벨', '제목', '설명', '상태', '트래커', '우선순위',
       '공개수준', '담당자', '생성자', '목표 마감일', '목표 시작일', '실제 시작일', '실제 완료일', '실제 종료일', '예상공수', '실적공수',
       '외부링크', '상위항목번호', '생성일', '수정일']

  const flat = flattenByHierarchy(items)
  const itemsForParentLookup = allWorkItems ?? items
  const parentMap = new Map(itemsForParentLookup.map(w => [w.id, w]))

  const rows = flat.map(({ item, level }) => {
    const indent = '  '.repeat(level)
    const parentItem = item.parent_id ? parentMap.get(item.parent_id) ?? null : null

    const base = [
      `${projectKey}-${item.number}`,
      String(level),
      `${indent}${item.title}`,
      item.description ?? '',
      item.status?.name ?? '',
      item.tracker?.name ?? '',
      priorityLabel(item.priority),
    ]

    // 내부용만 공개수준 포함
    if (!external) base.push(visibilityLabel(item.visibility))

    base.push(
      item.assignee?.full_name ?? '',
      item.reporter?.full_name ?? '',
      formatDateForExport(item.due_date),
      formatDateForExport(item.start_date),
      formatDateForExport(item.actual_start_date ?? null),
      formatDateForExport(item.actual_resolved_date ?? null),
      formatDateForExport(item.actual_end_date ?? null),
      item.estimated_hours != null ? String(item.estimated_hours) : '',
      item.actual_hours != null ? String(item.actual_hours) : '',
      item.external_url ?? '',
      parentItem ? `${projectKey}-${parentItem.number}` : '',
      formatDateForExport(item.created_at),
      formatDateForExport(item.updated_at),
    )

    return base
  })

  // BOM + CSV 생성
  const csvContent =
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const sanitizedName = projectName.replace(/[/\\?%*:|"<>]/g, '')
  const suffix = external ? '_external' : '_export'
  downloadBlob(blob, `${sanitizedName}${suffix}.csv`)
}
