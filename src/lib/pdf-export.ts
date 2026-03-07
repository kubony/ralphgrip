import type jsPDF from 'jspdf'
import { flattenByHierarchy, formatDateForExport } from './export-utils'

// 폰트 캐시 (한 번 로드하면 재사용)
let cachedFontBase64: string | null = null

/**
 * ArrayBuffer → base64 변환 (대용량 파일 지원)
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunks: string[] = []
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    chunks.push(String.fromCharCode.apply(null, Array.from(chunk)))
  }
  return btoa(chunks.join(''))
}

/**
 * 한글 폰트 로드 및 jsPDF에 등록
 */
async function loadKoreanFont(pdf: jsPDF): Promise<void> {
  if (!cachedFontBase64) {
    const response = await fetch('/fonts/NotoSansKR.ttf')
    if (!response.ok) {
      throw new Error('한글 폰트 로드 실패. public/fonts/NotoSansKR.ttf 파일을 확인하세요.')
    }
    const buffer = await response.arrayBuffer()
    cachedFontBase64 = arrayBufferToBase64(buffer)
  }

  pdf.addFileToVFS('NotoSansKR.ttf', cachedFontBase64)
  pdf.addFont('NotoSansKR.ttf', 'NotoSansKR', 'normal')
}

/**
 * 마크다운 → 플레인 텍스트 변환 (서식 제거)
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
}

/**
 * hex 색상을 RGB로 변환
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  }
}

interface PdfWorkItem {
  id: string
  number: number
  title: string
  description: string | null
  parent_id: string | null
  position?: number
  status: { name: string; color: string | null; is_closed: boolean }
}

interface ProjectPdfOptions {
  projectName: string
  projectKey: string
  createdAt: string
  workItems: PdfWorkItem[]
}

/**
 * 프로젝트 전체를 텍스트 기반 PDF로 내보내기
 *
 * jsPDF 텍스트 API + 한글 폰트 임베딩으로
 * 실제 텍스트가 포함된 문서 스타일 PDF를 생성한다.
 */
export async function exportProjectToPdf(options: ProjectPdfOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { projectName, projectKey, createdAt, workItems } = options
  const flat = flattenByHierarchy(workItems)

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // 한글 폰트 로드
  await loadKoreanFont(pdf)
  pdf.setFont('NotoSansKR', 'normal')

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  /** 페이지 넘김 체크 */
  function checkPageBreak(requiredSpace: number) {
    if (y + requiredSpace > pageHeight - margin) {
      pdf.addPage()
      y = margin
    }
  }

  // === 프로젝트 헤더 ===
  pdf.setFontSize(22)
  pdf.setTextColor(26, 26, 26)
  const titleLines = pdf.splitTextToSize(projectName, contentWidth)
  checkPageBreak(titleLines.length * 9 + 20)
  pdf.text(titleLines, margin, y)
  y += titleLines.length * 9 + 3

  pdf.setFontSize(9)
  pdf.setTextColor(120, 120, 120)
  pdf.text(`Project Key: ${projectKey}  |  Created: ${formatDateForExport(createdAt)}`, margin, y)
  y += 6

  // 헤더 구분선
  pdf.setDrawColor(51, 51, 51)
  pdf.setLineWidth(0.5)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 12

  // === 작업 항목 ===
  for (const { item, level } of flat) {
    const indent = level * 8
    const itemX = margin + indent
    const itemWidth = contentWidth - indent - 8

    // 제목 폰트 크기
    const fontSize = level === 0 ? 14 : level === 1 ? 12 : 10
    const lineHeight = fontSize * 0.45

    // 제목 텍스트
    const titleText = `${projectKey}-${item.number}  ${item.title}`
    pdf.setFontSize(fontSize)
    pdf.setTextColor(26, 26, 26)
    const itemTitleLines = pdf.splitTextToSize(titleText, itemWidth)

    checkPageBreak(itemTitleLines.length * lineHeight + 10)

    // 상태 원
    const statusColor = item.status?.color || '#94a3b8'
    const { r, g, b } = hexToRgb(statusColor)
    pdf.setFillColor(r, g, b)
    pdf.circle(itemX + 2, y - 1.2, 1.5, 'F')

    // 제목
    pdf.text(itemTitleLines, itemX + 7, y)
    y += itemTitleLines.length * lineHeight + 2

    // 설명
    if (item.description) {
      pdf.setFontSize(9)
      pdf.setTextColor(68, 68, 68)
      const descLineHeight = 4

      const plainText = stripMarkdown(item.description)
      const descLines = pdf.splitTextToSize(plainText, itemWidth)

      for (const line of descLines) {
        checkPageBreak(descLineHeight + 2)
        pdf.text(line, itemX + 7, y)
        y += descLineHeight
      }
      y += 2
    }

    // 구분선
    checkPageBreak(8)
    y += 2
    pdf.setDrawColor(229, 231, 235)
    pdf.setLineWidth(0.15)
    pdf.line(margin, y, pageWidth - margin, y)
    y += 6
  }

  // 저장
  const sanitizedName = projectName.replace(/[/\\?%*:|"<>]/g, '')
  pdf.save(`${sanitizedName}_document.pdf`)
}
