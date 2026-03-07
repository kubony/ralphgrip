'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import Search from 'lucide-react/dist/esm/icons/search'
import FolderKanban from 'lucide-react/dist/esm/icons/folder-kanban'
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list'
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3'
import { UserMenu } from './user-menu'
import { NotificationBell } from './notification-bell'
import { cn } from '@/lib/utils'
import type { NotificationItem } from '@/hooks/use-realtime-notifications'

interface HeaderProps {
  user: {
    email: string
    full_name?: string | null
    avatar_url?: string | null
    app_role?: string | null
  } | null
  userId?: string | null
  initialNotifications?: NotificationItem[]
  initialUnreadCount?: number
}

const navItems = [
  { href: '/my-work', label: '내 작업', icon: ClipboardList },
  { href: '/projects', label: '프로젝트', icon: FolderKanban },
  { href: '/pipeline', label: '사업현황', icon: BarChart3 },
]

export function Header({ user, userId, initialNotifications, initialUnreadCount }: HeaderProps) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-6">
        {/* Logo */}
        <Link href="/my-work" className="flex items-center">
          <Image
            src="/images/logo.png"
            alt="GRIP"
            width={100}
            height={28}
            className="h-7 w-auto"
            priority
          />
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Search trigger */}
        <div className="flex-1 max-w-md">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
            className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">검색...</span>
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘/Ctrl</span>K
            </kbd>
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Notifications */}
        {userId && (
          <NotificationBell
            userId={userId}
            initialNotifications={initialNotifications ?? []}
            initialUnreadCount={initialUnreadCount ?? 0}
          />
        )}

        {/* User menu */}
        {user && <UserMenu user={user} />}
      </div>
    </header>
  )
}
