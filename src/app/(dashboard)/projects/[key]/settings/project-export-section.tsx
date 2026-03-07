'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { exportWorkItemsToCsv } from '@/lib/csv-export'
import { exportProjectToPdf } from '@/lib/pdf-export'
import { exportWorkItemsToGoogleSheet } from '@/app/(dashboard)/projects/[key]/export-actions'
import { useGoogleToken } from '@/hooks/use-google-token'
import { cn } from '@/lib/utils'
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Sheet from 'lucide-react/dist/esm/icons/sheet'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Lock from 'lucide-react/dist/esm/icons/lock'
import Globe from 'lucide-react/dist/esm/icons/globe'

interface StatusInfo {
  id: string
  name: string
  color: string | null
  is_closed: boolean
}

interface TrackerInfo {
  id: string
  name: string
}

interface MemberInfo {
  id: string
  full_name: string | null
}

interface WorkItemForExport {
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

type ExportMode = 'internal' | 'external'

interface ProjectExportSectionProps {
  projectId: string
  projectName: string
  projectKey: string
  projectCreatedAt: string
  workItems: WorkItemForExport[]
}

export function ProjectExportSection({
  projectId,
  projectName,
  projectKey,
  projectCreatedAt,
  workItems,
}: ProjectExportSectionProps) {
  const [csvExporting, setCsvExporting] = useState(false)
  const [pdfExporting, setPdfExporting] = useState(false)
  const [gsheetExporting, setGsheetExporting] = useState(false)
  const [gsheetUrl, setGsheetUrl] = useState<string | null>(null)
  const [mode, setMode] = useState<ExportMode>('internal')
  const { requestToken } = useGoogleToken()

  const hasGoogleClientId = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const isExternal = mode === 'external'

  const publicCount = useMemo(
    () => workItems.filter(w => w.visibility === 'public').length,
    [workItems]
  )

  const effectiveCount = isExternal ? publicCount : workItems.length

  // Google Sheets export
  const handleGsheetExport = async () => {
    setGsheetExporting(true)
    setGsheetUrl(null)
    try {
      const accessToken = await requestToken()
      const result = await exportWorkItemsToGoogleSheet(
        accessToken, projectId, { external: isExternal }
      )
      if (result.error) {
        toast.error(`Google Sheets 내보내기 실패: ${result.error}`)
      } else if (result.data) {
        setGsheetUrl(result.data.url)
        window.open(result.data.url, '_blank')
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '알 수 없는 오류'
      if (!msg.includes('취소') && !msg.includes('cancel')) {
        toast.error(`Google Sheets 내보내기 실패: ${msg}`)
      }
    } finally {
      setGsheetExporting(false)
    }
  }

  const handleCsvExport = () => {
    setCsvExporting(true)
    try {
      exportWorkItemsToCsv(workItems, projectName, projectKey, { external: isExternal })
    } catch (error) {
      console.error('CSV 내보내기 실패:', error)
      toast.error('CSV 내보내기 중 오류가 발생했습니다.')
    } finally {
      setCsvExporting(false)
    }
  }

  const handlePdfExport = async () => {
    setPdfExporting(true)
    try {
      const items = isExternal
        ? workItems.filter(w => w.visibility === 'public')
        : workItems
      await exportProjectToPdf({
        projectName,
        projectKey,
        createdAt: projectCreatedAt,
        workItems: items,
      })
    } catch (error) {
      console.error('PDF 내보내기 실패:', error)
      toast.error('PDF 내보내기 중 오류가 발생했습니다.')
    } finally {
      setPdfExporting(false)
    }
  }

  return (
    <section>
      <h2 className="text-base font-semibold mb-4">Export</h2>
      <div className="space-y-4">
        {/* 내부용/외부용 모드 선택 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode('internal')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors',
              mode === 'internal'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            )}
          >
            <Lock className="h-3.5 w-3.5" />
            내부용
          </button>
          <button
            onClick={() => setMode('external')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors',
              mode === 'external'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            )}
          >
            <Globe className="h-3.5 w-3.5" />
            외부용
          </button>
          <span className="text-xs text-muted-foreground ml-2">
            {isExternal
              ? `공개 항목 ${publicCount}개만 내보냄 (공개수준 열 제외)`
              : `전체 ${workItems.length}개 항목 내보냄`}
          </span>
        </div>

        {/* Google Sheets */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Google Sheets</p>
            <p className="text-xs text-muted-foreground">
              {hasGoogleClientId
                ? '내 Google Drive에 레벨별 색상으로 스프레드시트를 생성합니다'
                : 'NEXT_PUBLIC_GOOGLE_CLIENT_ID 환경변수 설정이 필요합니다'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {gsheetUrl && (
              <a
                href={gsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                열기
              </a>
            )}
            <button
              onClick={handleGsheetExport}
              disabled={gsheetExporting || effectiveCount === 0 || !hasGoogleClientId}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sheet className="h-4 w-4" />
              {gsheetExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>

        {/* CSV */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">CSV</p>
            <p className="text-xs text-muted-foreground">
              Export as CSV spreadsheet (Excel compatible)
            </p>
          </div>
          <button
            onClick={handleCsvExport}
            disabled={csvExporting || effectiveCount === 0}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {csvExporting ? 'Exporting...' : 'Download'}
          </button>
        </div>

        {/* PDF */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">PDF</p>
            <p className="text-xs text-muted-foreground">
              Export as a document-style PDF with full descriptions
            </p>
          </div>
          <button
            onClick={handlePdfExport}
            disabled={pdfExporting || effectiveCount === 0}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="h-4 w-4" />
            {pdfExporting ? 'Exporting...' : 'Download'}
          </button>
        </div>

        {effectiveCount === 0 && (
          <p className="text-xs text-muted-foreground">
            {isExternal
              ? '공개 항목이 없습니다. 속성 패널에서 공개 수준을 변경하세요.'
              : '내보낼 작업 항목이 없습니다.'}
          </p>
        )}
      </div>
    </section>
  )
}
