'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { updateProjectInfo } from '../actions'
import type { Project } from '@/types/database'

interface GeneralSettingsProps {
  project: Project
}

export function GeneralSettings({ project }: GeneralSettingsProps) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const hasChanges = name !== project.name || description !== (project.description ?? '')

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const result = await updateProjectInfo(project.id, {
        name,
        description: description || null,
      })
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: '저장되었습니다.' })
        setTimeout(() => setMessage(null), 3000)
      }
    })
  }

  return (
    <section id="general">
      <h2 className="text-base font-semibold mb-4">General</h2>
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="project-name">프로젝트 이름</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="project-description">설명</Label>
          <Textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
            rows={3}
          />
        </div>

        <div className="flex gap-6">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Key</Label>
            <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{project.key}</span>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">타입</Label>
            <Badge variant="secondary">
              {project.project_type === 'requirement' ? '요구사항' : '이슈'}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={isPending || !hasChanges}
            size="sm"
          >
            {isPending ? '저장 중...' : '저장'}
          </Button>
          {message && (
            <span className={`text-sm ${message.type === 'error' ? 'text-destructive' : 'text-green-600'}`}>
              {message.text}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
