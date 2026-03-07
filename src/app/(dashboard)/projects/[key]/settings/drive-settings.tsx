'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { updateProjectSettings } from '../actions'
import type { ProjectSettings } from '@/types/database'

interface DriveSettingsProps {
  projectId: string
  settings: ProjectSettings
}

function isValidDriveUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'drive.google.com'
  } catch {
    return false
  }
}

export function DriveSettings({ projectId, settings }: DriveSettingsProps) {
  const [driveUrl, setDriveUrl] = useState(settings.google_drive_url ?? '')
  const [isSaving, startSaving] = useTransition()

  const isConnected = !!settings.google_drive_url

  function handleSave() {
    const trimmed = driveUrl.trim()
    if (!isValidDriveUrl(trimmed)) {
      toast.error('올바른 Google Drive URL을 입력하세요. (drive.google.com)')
      return
    }
    startSaving(async () => {
      const result = await updateProjectSettings(projectId, {
        ...settings,
        google_drive_url: trimmed,
      })
      if (result?.error) {
        toast.error('저장에 실패했습니다.')
      }
    })
  }

  function handleDisconnect() {
    setDriveUrl('')
    startSaving(async () => {
      const result = await updateProjectSettings(projectId, {
        ...settings,
        google_drive_url: undefined,
      })
      if (result?.error) {
        toast.error('연결 해제에 실패했습니다.')
      }
    })
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path d="M7.71 3.5L1.15 15l3.43 5.97h6.56L7.71 3.5z" fill="#0066DA" />
            <path d="M16.29 3.5H7.71l3.43 17.47h12.01L16.29 3.5z" fill="#00AC47" />
            <path d="M1.15 15l3.43 5.97h18.57L16.29 3.5 1.15 15z" fill="#EA4335" />
            <path d="M16.29 3.5L7.71 3.5l3.43 5.97L16.29 3.5z" fill="#00832D" />
            <path d="M7.71 3.5l3.43 5.97 5.15 11.5h6.86L16.29 3.5H7.71z" fill="#2684FC" />
            <path d="M1.15 15l3.43 5.97h6.56l-5.15-8.47L1.15 15z" fill="#FFBA00" />
          </svg>
          <span className="font-medium text-sm">Google Drive</span>
        </div>
        {isConnected && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Connected
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        프로젝트 관련 문서가 보관된 Google Drive 폴더를 연결합니다. 자료 탭에서 1클릭으로 폴더를 열 수 있습니다.
      </p>

      <div className="space-y-2">
        <Label htmlFor="drive-url" className="text-sm">
          Folder URL
        </Label>
        <Input
          id="drive-url"
          placeholder="https://drive.google.com/drive/folders/..."
          value={driveUrl}
          onChange={(e) => setDriveUrl(e.target.value)}
          disabled={isSaving}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Google Drive에서 폴더를 열고 브라우저 주소창의 URL을 붙여넣으세요.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || !driveUrl.trim()}
        >
          {isSaving ? '저장 중...' : '저장'}
        </Button>
        {isConnected && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDisconnect}
            disabled={isSaving}
            className="text-destructive hover:text-destructive"
          >
            연결 해제
          </Button>
        )}
      </div>
    </div>
  )
}
