/**
 * 프로젝트 작업 항목을 Google Sheets로 내보내기
 *
 * 유저의 OAuth access_token을 받아 본인 Google Drive에 시트 생성
 */

import type { sheets_v4 } from 'googleapis'
import { flattenByHierarchy, priorityLabel, visibilityLabel, formatDateForExport } from './export-utils'

// 레벨별 연한 배경색 (RGB 0-1 범위)
const LEVEL_COLORS: Array<{ red: number; green: number; blue: number }> = [
  { red: 0.84, green: 0.89, blue: 0.94 },  // Level 0: 연한 파랑
  { red: 0.85, green: 0.92, blue: 0.83 },  // Level 1: 연한 초록
  { red: 1.0, green: 0.95, blue: 0.8 },    // Level 2: 연한 노랑
  { red: 0.9, green: 0.85, blue: 0.94 },   // Level 3: 연한 보라
  { red: 0.93, green: 0.93, blue: 0.93 },  // Level 4: 연한 회색
]

const HEADER_COLOR = { red: 0.26, green: 0.26, blue: 0.26 }
const HEADER_TEXT_COLOR = { red: 1, green: 1, blue: 1 }

interface StatusInfo { id: string; name: string }
interface TrackerInfo { id: string; name: string }
interface MemberInfo { id: string; full_name: string | null }

export interface GSheetWorkItem {
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

function getLevelColor(level: number) {
  return LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)]
}

export async function exportToGoogleSheet(
  accessToken: string,
  workItems: GSheetWorkItem[],
  projectName: string,
  projectKey: string,
  options?: { external?: boolean; allWorkItems?: GSheetWorkItem[] },
): Promise<{ url: string; spreadsheetId: string }> {
  const { external = false, allWorkItems } = options ?? {}

  // 외부용: 공개 항목만 필터
  const items = external ? workItems.filter(w => w.visibility === 'public') : workItems

  // 유저의 access_token으로 인증
  const { google } = await import('googleapis')
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })

  const sheets = google.sheets({ version: 'v4', auth: oauth2Client })

  // 1. 새 스프레드시트 생성 (유저의 Drive에 생성됨)
  const suffix = external ? '(External)' : 'Export'
  const title = `${projectName} — Work Items ${suffix}`
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        {
          properties: {
            title: projectKey,
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: 'Timeline',
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    },
  })

  const spreadsheetId = createRes.data.spreadsheetId!
  const sheetId = createRes.data.sheets![0].properties!.sheetId!
  const timelineSheetId = createRes.data.sheets![1].properties!.sheetId!

  // 2. 데이터 준비
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

  // 3. 데이터 쓰기
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${projectKey}'!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers, ...rows] },
  })

  // 4. 서식 요청 빌드
  const totalRows = rows.length + 1
  const totalCols = headers.length
  const requests: sheets_v4.Schema$Request[] = []

  // 헤더 스타일
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: totalCols },
      cell: {
        userEnteredFormat: {
          backgroundColor: HEADER_COLOR,
          textFormat: { bold: true, foregroundColor: HEADER_TEXT_COLOR, fontSize: 10 },
          horizontalAlignment: 'CENTER',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
    },
  })

  // 레벨별 행 색상
  for (let i = 0; i < flat.length; i++) {
    const { level } = flat[i]
    const bgColor = getLevelColor(level)
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: i + 1,
          endRowIndex: i + 2,
          startColumnIndex: 0,
          endColumnIndex: totalCols,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: bgColor,
            textFormat: { bold: level === 0, fontSize: 10 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    })
  }

  // 열 너비
  const colWidths = external
    ? [90, 50, 350, 300, 80, 80, 70, 90, 90, 100, 100, 100, 100, 70, 70, 200, 90, 100, 100]
    : [90, 50, 350, 300, 80, 80, 70, 70, 90, 90, 100, 100, 100, 100, 70, 70, 200, 90, 100, 100]
  for (let i = 0; i < colWidths.length; i++) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: colWidths[i] },
        fields: 'pixelSize',
      },
    })
  }

  // 테두리
  requests.push({
    updateBorders: {
      range: { sheetId, startRowIndex: 0, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: totalCols },
      top: { style: 'SOLID', color: { red: 0.8, green: 0.8, blue: 0.8 } },
      bottom: { style: 'SOLID', color: { red: 0.8, green: 0.8, blue: 0.8 } },
      left: { style: 'SOLID', color: { red: 0.8, green: 0.8, blue: 0.8 } },
      right: { style: 'SOLID', color: { red: 0.8, green: 0.8, blue: 0.8 } },
      innerHorizontal: { style: 'SOLID', color: { red: 0.85, green: 0.85, blue: 0.85 } },
      innerVertical: { style: 'SOLID', color: { red: 0.9, green: 0.9, blue: 0.9 } },
    },
  })

  // 필터
  requests.push({
    setBasicFilter: {
      filter: {
        range: { sheetId, startRowIndex: 0, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: totalCols },
      },
    },
  })

  // 5. 서식 일괄 적용
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  })

  // 6. Timeline 시트 작성
  const timelineItems = flat
    .filter(({ item }) => item.start_date || item.due_date)
    .map(({ item }) => {
      const startDate = formatDateForExport(item.start_date) || formatDateForExport(item.due_date)
      const dueDate = formatDateForExport(item.due_date) || formatDateForExport(item.start_date)
      return [
        item.title,
        startDate,
        dueDate,
        item.assignee?.full_name ?? '',
        item.status?.name ?? '',
        item.tracker?.name ?? '',
      ]
    })

  if (timelineItems.length > 0) {
    const tlHeaders = ['제목', '시작일', '마감일', '담당자', '상태', '트래커']

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "'Timeline'!A1",
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [tlHeaders, ...timelineItems] },
    })

    const tlTotalRows = timelineItems.length + 1
    const tlTotalCols = tlHeaders.length
    const tlRequests: sheets_v4.Schema$Request[] = []

    // 헤더 스타일
    tlRequests.push({
      repeatCell: {
        range: { sheetId: timelineSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: tlTotalCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_COLOR,
            textFormat: { bold: true, foregroundColor: HEADER_TEXT_COLOR, fontSize: 10 },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    })

    // 열 너비
    const tlColWidths = [300, 120, 120, 120, 100, 100]
    for (let i = 0; i < tlColWidths.length; i++) {
      tlRequests.push({
        updateDimensionProperties: {
          range: { sheetId: timelineSheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
          properties: { pixelSize: tlColWidths[i] },
          fields: 'pixelSize',
        },
      })
    }

    // 날짜 컬럼 포맷 (B, C열)
    tlRequests.push({
      repeatCell: {
        range: { sheetId: timelineSheetId, startRowIndex: 1, endRowIndex: tlTotalRows, startColumnIndex: 1, endColumnIndex: 3 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' },
          },
        },
        fields: 'userEnteredFormat.numberFormat',
      },
    })

    // A1 셀에 안내 메모
    tlRequests.push({
      updateCells: {
        range: { sheetId: timelineSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
        rows: [{
          values: [{
            note: '삽입 > 타임라인 메뉴로 타임라인 뷰를 활성화하세요',
          }],
        }],
        fields: 'note',
      },
    })

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: tlRequests },
    })
  }

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
  return { url, spreadsheetId }
}
