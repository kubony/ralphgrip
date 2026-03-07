'use client'

import { useState, useTransition, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover'
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem
} from '@/components/ui/command'
import {
  searchUsers, inviteProjectMember, removeProjectMember, updateProjectMemberRole
} from '../actions'
import type { ProjectRole } from '@/types/database'
import XIcon from 'lucide-react/dist/esm/icons/x'
import Crown from 'lucide-react/dist/esm/icons/crown'
import SearchIcon from 'lucide-react/dist/esm/icons/search'

type SearchUser = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
}

export type MemberWithUser = {
  id: string
  role: string
  user_id: string
  created_at: string
  user: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

interface MembersSettingsProps {
  projectId: string
  ownerId: string
  members: MemberWithUser[]
  currentUserId?: string
}

const roleLabels: Record<ProjectRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
}

export function MembersSettings({ projectId, ownerId, members, currentUserId }: MembersSettingsProps) {
  const [inviteRole, setInviteRole] = useState<ProjectRole>('member')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const isOwner = currentUserId === ownerId

  const handleOpenChange = useCallback(async (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      setIsSearching(true)
      const result = await searchUsers(projectId)
      setSearchResults(result.users)
      setIsSearching(false)
    }
  }, [projectId])

  function handleSelectUser(user: SearchUser) {
    setMessage(null)
    setOpen(false)
    setSearchResults([])
    startTransition(async () => {
      const result = await inviteProjectMember(projectId, user.email, inviteRole)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: `${user.full_name || user.email}님이 추가되었습니다.` })
        setTimeout(() => setMessage(null), 3000)
      }
    })
  }

  function handleRoleChange(memberId: string, role: ProjectRole) {
    startTransition(async () => {
      await updateProjectMemberRole(projectId, memberId, role)
    })
  }

  function handleRemove(memberId: string) {
    startTransition(async () => {
      await removeProjectMember(projectId, memberId)
    })
  }

  function getInitials(name: string | null, email: string) {
    if (name) return name.slice(0, 2)
    return email.slice(0, 2).toUpperCase()
  }

  return (
    <section id="members">
      <h2 className="text-base font-semibold mb-4">Members</h2>
      <div className="space-y-4">
        {/* Invite form */}
        {isOwner && (
          <div className="rounded-lg border p-4 space-y-3">
            <Label className="text-sm font-medium">멤버 추가</Label>
            <div className="flex gap-2">
              <Popover open={open} onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="flex-1 justify-start font-normal text-muted-foreground"
                    disabled={isPending}
                  >
                    <SearchIcon className="h-4 w-4 mr-2 shrink-0" />
                    사용자 검색...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[360px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="사용자 검색..." />
                    <CommandList>
                      {isSearching && searchResults.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          검색 중...
                        </div>
                      ) : searchResults.length === 0 ? (
                        <CommandEmpty>추가할 수 있는 사용자가 없습니다</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {searchResults.map((user) => (
                            <CommandItem
                              key={user.id}
                              value={`${user.full_name || ''} ${user.email}`}
                              onSelect={() => handleSelectUser(user)}
                              className="cursor-pointer"
                            >
                              <Avatar size="sm" className="mr-2">
                                {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                                <AvatarFallback>
                                  {getInitials(user.full_name, user.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium truncate">
                                  {user.full_name || user.email}
                                </span>
                                <span className="text-xs text-muted-foreground truncate">
                                  {user.email}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as ProjectRole)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {message && (
              <p className={`text-sm ${message.type === 'error' ? 'text-destructive' : 'text-green-600'}`}>
                {message.text}
              </p>
            )}
          </div>
        )}

        {/* Member list */}
        <div className="rounded-lg border divide-y">
          {members.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              프로젝트 멤버가 없습니다.
            </div>
          ) : (
            members.map((member) => {
              const user = member.user
              if (!user) return null
              const isProjectOwner = user.id === ownerId

              return (
                <div key={member.id} className="flex items-center gap-3 p-3">
                  <Avatar size="sm">
                    {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                    <AvatarFallback>{getInitials(user.full_name, user.email)}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {user.full_name || user.email}
                      </span>
                      {isProjectOwner && (
                        <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate block">
                      {user.email}
                    </span>
                  </div>

                  {isOwner && !isProjectOwner ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleRoleChange(member.id, v as ProjectRole)}
                        disabled={isPending}
                      >
                        <SelectTrigger className="w-[110px]" size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemove(member.id)}
                        disabled={isPending}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <XIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {roleLabels[member.role as ProjectRole] ?? member.role}
                    </Badge>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
