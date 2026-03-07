'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { updateProjectSettings } from '../actions'
import type { ProjectSettings } from '@/types/database'

interface ProjectSettingsFormProps {
  projectId: string
  settings: ProjectSettings
}

export function ProjectSettingsForm({ projectId, settings }: ProjectSettingsFormProps) {
  const [showTrackerId, setShowTrackerId] = useState(settings.show_tracker_id !== false)
  const [showTrackerIdInDocument, setShowTrackerIdInDocument] = useState(settings.show_tracker_id_in_document !== false)
  const [autoInsertDate, setAutoInsertDate] = useState(settings.auto_insert_date !== false)
  const [isPending, startTransition] = useTransition()

  function handleToggleTree(checked: boolean) {
    setShowTrackerId(checked)
    startTransition(async () => {
      await updateProjectSettings(projectId, {
        ...settings,
        show_tracker_id: checked,
      })
    })
  }

  function handleToggleDocument(checked: boolean) {
    setShowTrackerIdInDocument(checked)
    startTransition(async () => {
      const result = await updateProjectSettings(projectId, {
        ...settings,
        show_tracker_id_in_document: checked,
      })
      if (result?.error) {
        toast.error('설정을 저장하지 못했습니다.')
      } else {
        toast.success('설정이 저장되었습니다.')
      }
    })
  }

  return (
    <section id="display">
      <h2 className="text-base font-semibold mb-4">Display</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="show-tracker-id-tree" className="text-sm font-medium">
              Show tracker ID in tree
            </Label>
            <p className="text-xs text-muted-foreground">
              Display tracker ID (e.g. PRJ-1, PRJ-2) next to the title in the tree panel
            </p>
          </div>
          <Switch
            id="show-tracker-id-tree"
            checked={showTrackerId}
            onCheckedChange={handleToggleTree}
            disabled={isPending}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="show-tracker-id-document" className="text-sm font-medium">
              Show tracker ID in document
            </Label>
            <p className="text-xs text-muted-foreground">
              Display tracker ID (e.g. PRJ-1, PRJ-2) next to the title in the document view
            </p>
          </div>
          <Switch
            id="show-tracker-id-document"
            checked={showTrackerIdInDocument}
            onCheckedChange={handleToggleDocument}
            disabled={isPending}
          />
        </div>
      </div>

      <h2 className="text-base font-semibold mb-4 mt-8">Editor</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="auto-insert-date" className="text-sm font-medium">
              편집 시 날짜 자동 삽입
            </Label>
            <p className="text-xs text-muted-foreground">
              문서 편집을 시작할 때 오늘 날짜를 자동으로 맨 앞에 삽입합니다 (일지 작성용)
            </p>
          </div>
          <Switch
            id="auto-insert-date"
            checked={autoInsertDate}
            onCheckedChange={(checked) => {
              setAutoInsertDate(checked)
              startTransition(async () => {
                const result = await updateProjectSettings(projectId, {
                  ...settings,
                  auto_insert_date: checked,
                })
                if (result?.error) {
                  toast.error('설정을 저장하지 못했습니다.')
                }
              })
            }}
            disabled={isPending}
          />
        </div>
      </div>
    </section>
  )
}
