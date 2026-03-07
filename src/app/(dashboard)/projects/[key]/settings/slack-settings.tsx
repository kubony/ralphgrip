'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { updateProjectSettings, testSlackNotification } from '../actions'
import type { ProjectSettings } from '@/types/database'

interface SlackSettingsProps {
  projectId: string
  settings: ProjectSettings
}

export function SlackSettings({ projectId, settings }: SlackSettingsProps) {
  const [channelId, setChannelId] = useState(settings.slack_channel_id ?? '')
  const [isSaving, startSaving] = useTransition()
  const [isTesting, startTesting] = useTransition()

  const isConnected = !!settings.slack_channel_id

  function handleSave() {
    const trimmed = channelId.trim()
    startSaving(async () => {
      const result = await updateProjectSettings(projectId, {
        ...settings,
        slack_channel_id: trimmed || undefined,
      })
      if (result?.error) {
        toast.error('저장에 실패했습니다.')
      } else {
        toast.success('Slack 채널이 저장되었습니다.')
      }
    })
  }

  function handleTest() {
    startTesting(async () => {
      const result = await testSlackNotification(projectId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('테스트 메시지가 전송되었습니다.')
      }
    })
  }

  function handleDisconnect() {
    setChannelId('')
    startSaving(async () => {
      const result = await updateProjectSettings(projectId, {
        ...settings,
        slack_channel_id: undefined,
      })
      if (result?.error) {
        toast.error('연결 해제에 실패했습니다.')
      } else {
        toast.success('Slack 연결이 해제되었습니다.')
      }
    })
  }

  return (
    <section id="integrations">
      <h2 className="text-base font-semibold mb-4">Integrations</h2>
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="currentColor" />
              </svg>
              <span className="font-medium text-sm">Slack</span>
            </div>
            {isConnected && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Connected
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            작업 생성, 상태 변경, 댓글 추가 시 Slack 채널로 알림을 전송합니다.
          </p>

          <div className="space-y-2">
            <Label htmlFor="slack-channel-id" className="text-sm">
              Channel ID
            </Label>
            <Input
              id="slack-channel-id"
              placeholder="C0123456789"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              disabled={isSaving}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Slack 채널의 상세 정보에서 Channel ID를 복사하세요.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !channelId.trim()}
            >
              {isSaving ? '저장 중...' : '저장'}
            </Button>
            {isConnected && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTest}
                  disabled={isTesting || isSaving}
                >
                  {isTesting ? '전송 중...' : '테스트 전송'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDisconnect}
                  disabled={isSaving}
                  className="text-destructive hover:text-destructive"
                >
                  연결 해제
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
