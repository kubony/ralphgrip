'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet'
import Presentation from 'lucide-react/dist/esm/icons/presentation'
import Folder from 'lucide-react/dist/esm/icons/folder'
import File from 'lucide-react/dist/esm/icons/file'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
  webViewLink?: string
}

interface BreadcrumbItem {
  id: string
  name: string
}

interface DriveFileListProps {
  rootFolderId: string
}

function getFileIcon(mimeType: string) {
  if (mimeType === 'application/vnd.google-apps.document') {
    return <FileText className="h-5 w-5 text-blue-500 shrink-0" />
  }
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    return <FileSpreadsheet className="h-5 w-5 text-green-500 shrink-0" />
  }
  if (mimeType === 'application/vnd.google-apps.presentation') {
    return <Presentation className="h-5 w-5 text-yellow-500 shrink-0" />
  }
  if (mimeType === 'application/vnd.google-apps.folder') {
    return <Folder className="h-5 w-5 text-amber-400 shrink-0" />
  }
  if (mimeType === 'application/pdf') {
    return <FileText className="h-5 w-5 text-red-500 shrink-0" />
  }
  return <File className="h-5 w-5 text-muted-foreground shrink-0" />
}

function formatFileSize(bytes?: string): string {
  if (!bytes) return ''
  const n = parseInt(bytes, 10)
  if (isNaN(n)) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export function DriveFileList({ rootFolderId }: DriveFileListProps) {
  const pathname = usePathname()
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsRelogin, setNeedsRelogin] = useState(false)
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: rootFolderId, name: '루트' },
  ])

  const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id

  const fetchFiles = useCallback(async (folderId: string) => {
    setLoading(true)
    setError(null)
    setNeedsRelogin(false)
    try {
      const res = await fetch(`/api/drive/files?folderId=${encodeURIComponent(folderId)}`)
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'drive_scope_missing' || data.error === 'token_expired') {
          setNeedsRelogin(true)
        }
        setError(data.message ?? '파일 목록을 불러오지 못했습니다.')
        setFiles([])
      } else {
        setFiles(data.files ?? [])
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFiles(currentFolderId)
  }, [currentFolderId, fetchFiles])

  const handleFolderClick = (file: DriveFile) => {
    setBreadcrumbs((prev) => [...prev, { id: file.id, name: file.name }])
  }

  const handleBreadcrumbClick = (index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1))
  }

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
            {i < breadcrumbs.length - 1 ? (
              <button
                onClick={() => handleBreadcrumbClick(i)}
                className="hover:text-foreground hover:underline transition-colors"
              >
                {crumb.name}
              </button>
            ) : (
              <span className="text-foreground font-medium">{crumb.name}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="font-medium">파일을 불러올 수 없습니다</p>
            <p className="text-destructive/80">{error}</p>
            {needsRelogin && (
              <a
                href={`/api/auth/reauth?next=${encodeURIComponent(pathname)}`}
                className="inline-block rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
              >
                다시 로그인하기
              </a>
            )}
          </div>
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Folder className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">이 폴더는 비어 있습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {files.map((file, i) => {
            const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
            return isFolder ? (
              <button
                key={file.id}
                onClick={() => handleFolderClick(file)}
                className="flex items-center gap-2.5 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors group animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-200"
                style={{ animationDelay: `${Math.min(i * 30, 500)}ms` }}
              >
                {getFileIcon(file.mimeType)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate group-hover:text-foreground">
                    {file.name}
                  </p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            ) : (
              <a
                key={file.id}
                href={file.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-lg border p-3 hover:bg-muted/50 transition-colors group animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-200"
                style={{ animationDelay: `${Math.min(i * 30, 500)}ms` }}
              >
                {getFileIcon(file.mimeType)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate group-hover:text-foreground">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {file.modifiedTime
                      ? format(new Date(file.modifiedTime), 'yyyy.MM.dd', { locale: ko })
                      : ''}
                    {file.size ? ` · ${formatFileSize(file.size)}` : ''}
                  </p>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
