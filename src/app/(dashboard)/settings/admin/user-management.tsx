'use client'

import { useState, useTransition } from 'react'
import { updateUserRole } from '../admin-actions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRouter } from 'next/navigation'

interface UserData {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  app_role: string
  created_at: string
}

interface UserManagementProps {
  users: UserData[]
  currentUserId: string
}

const roleBadgeStyles: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  user: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  guest: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
}

export function UserManagement({ users, currentUserId }: UserManagementProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const allUsers = users

  const handleRoleChange = (userId: string, newRole: string) => {
    setUpdatingUserId(userId)
    startTransition(async () => {
      const result = await updateUserRole(userId, newRole)
      if (result.error) {
        alert(result.error)
      }
      setUpdatingUserId(null)
      router.refresh()
    })
  }

  const renderUserRow = (user: UserData) => {
    const isCurrentUser = user.id === currentUserId
    const initials = user.full_name
      ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      : user.email[0].toUpperCase()

    return (
      <div
        key={user.id}
        className="flex items-center justify-between py-3 px-4 rounded-lg border"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user.avatar_url ?? undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">
                {user.full_name || user.email}
              </p>
              {isCurrentUser && (
                <span className="text-[10px] text-muted-foreground">(me)</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>

        <div className="shrink-0 ml-4">
          {isCurrentUser ? (
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${roleBadgeStyles[user.app_role] || ''}`}>
              {user.app_role}
            </span>
          ) : (
            <Select
              value={user.app_role}
              onValueChange={(value) => handleRoleChange(user.id, value)}
              disabled={isPending && updatingUserId === user.id}
            >
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="guest">guest</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground mb-6">
          사용자의 앱 역할을 관리합니다. <strong>admin</strong>은 전체 기능 + 사용자 관리, <strong>user</strong>는 전체 기능, <strong>guest</strong>는 데모 프로젝트 및 초대된 프로젝트만 접근 가능합니다.
        </p>
      </div>

      {allUsers.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            전체 사용자 ({allUsers.length})
          </h2>
          <div className="space-y-2">
            {allUsers.map(renderUserRow)}
          </div>
        </section>
      )}

      {users.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          등록된 사용자가 없습니다.
        </p>
      )}
    </div>
  )
}
