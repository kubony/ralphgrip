'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import Bell from 'lucide-react/dist/esm/icons/bell'
import AtSign from 'lucide-react/dist/esm/icons/at-sign'
import UserPlus from 'lucide-react/dist/esm/icons/user-plus'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import ArrowRightLeft from 'lucide-react/dist/esm/icons/arrow-right-left'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { markNotificationRead, markAllNotificationsRead } from '@/app/(dashboard)/notification-actions'
import { useRealtimeNotifications, type NotificationItem } from '@/hooks/use-realtime-notifications'

interface NotificationBellProps {
  userId: string
  initialNotifications: NotificationItem[]
  initialUnreadCount: number
}

const TYPE_CONFIG: Record<
  string,
  { Icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  mention: { Icon: AtSign, color: 'text-blue-500', label: '님이 멘션했습니다' },
  assigned: { Icon: UserPlus, color: 'text-green-500', label: '님이 담당자로 지정했습니다' },
  comment: { Icon: MessageSquare, color: 'text-orange-500', label: '님이 댓글을 달았습니다' },
  status_change: { Icon: ArrowRightLeft, color: 'text-purple-500', label: '님이 상태를 변경했습니다' },
}

export function NotificationBell({
  userId,
  initialNotifications,
  initialUnreadCount,
}: NotificationBellProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount } = useRealtimeNotifications(
    userId,
    initialNotifications,
    initialUnreadCount
  )

  async function handleMarkAllRead() {
    await markAllNotificationsRead()
  }

  function NotificationRow({ notification: n }: { notification: NotificationItem }) {
    const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.comment
    const { Icon, color, label } = config
    const actorName = n.actor?.full_name ?? '누군가'
    const isUnread = n.read_at === null

    async function handleClick() {
      if (n.work_item_id) {
        router.push(`/projects/${n.project_key}/alm?item=${n.work_item_id}`)
      }
      setOpen(false)
      if (isUnread) {
        await markNotificationRead(n.id)
      }
    }

    return (
      <button
        onClick={handleClick}
        className={cn(
          'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/80 transition-colors',
          isUnread && 'bg-muted/50'
        )}
      >
        <div className="relative shrink-0 mt-0.5">
          <Avatar size="sm">
            <AvatarImage src={n.actor?.avatar_url ?? undefined} alt={actorName} />
            <AvatarFallback>{actorName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-background p-0.5',
              color
            )}
          >
            <Icon className="h-2.5 w-2.5" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug">
            <span className="font-medium">{actorName}</span>
            <span className="text-muted-foreground">{label}</span>
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{n.title}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ko })}
          </p>
        </div>
        {isUnread && (
          <span className="shrink-0 mt-1.5 h-2 w-2 rounded-full bg-primary" />
        )}
      </button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="알림"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-medium text-sm">알림</h4>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              모두 읽음
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">알림이 없습니다</div>
          ) : (
            notifications.map(n => <NotificationRow key={n.id} notification={n} />)
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
