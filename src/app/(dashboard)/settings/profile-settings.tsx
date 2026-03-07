'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { updateProfile } from './actions'

interface ProfileSettingsProps {
  profile: {
    email: string
    full_name: string | null
    avatar_url: string | null
  }
}

export function ProfileSettings({ profile }: ProfileSettingsProps) {
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const hasChanges = fullName !== (profile.full_name ?? '')

  const initials = profile.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile.email[0].toUpperCase()

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const result = await updateProfile({ full_name: fullName })
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: '저장되었습니다.' })
        setTimeout(() => setMessage(null), 3000)
      }
    })
  }

  return (
    <section id="profile">
      <h2 className="text-base font-semibold mb-4">Profile</h2>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar size="lg">
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{profile.full_name || profile.email}</p>
            <p className="text-xs text-muted-foreground">Google 계정 아바타가 사용됩니다</p>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="full-name">이름</Label>
          <Input
            id="full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isPending}
            placeholder="이름을 입력하세요"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            value={profile.email}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">Google OAuth로 연결된 이메일은 변경할 수 없습니다</p>
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
