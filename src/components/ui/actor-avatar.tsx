import { Avatar, AvatarFallback, AvatarImage, AvatarBadge } from '@/components/ui/avatar'
import Bot from 'lucide-react/dist/esm/icons/bot'
import { cn } from '@/lib/utils'

interface ActorProfile {
  full_name: string | null
  avatar_url: string | null
}

interface ActorAgent {
  display_name: string
  avatar_url: string | null
  agent_type: string
}

interface ActorAvatarProps {
  profile?: ActorProfile | null
  agent?: ActorAgent | null
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

function getInitials(name: string | null | undefined) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ActorAvatar({ profile, agent, size = 'default', className }: ActorAvatarProps) {
  const isAgent = !!agent
  const name = isAgent ? agent.display_name : profile?.full_name
  const avatarUrl = isAgent ? agent.avatar_url : profile?.avatar_url

  return (
    <Avatar size={size} className={className}>
      <AvatarImage src={avatarUrl || undefined} />
      <AvatarFallback className={cn('text-xs', isAgent && 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300')}>
        {isAgent ? <Bot className="h-3.5 w-3.5" /> : getInitials(name)}
      </AvatarFallback>
      {isAgent && (
        <AvatarBadge className="bg-violet-500 text-white">
          <Bot />
        </AvatarBadge>
      )}
    </Avatar>
  )
}

export function getActorName(
  profile?: { full_name: string | null } | null,
  agent?: { display_name: string } | null,
): string {
  if (agent) return agent.display_name
  return profile?.full_name || '알 수 없음'
}
