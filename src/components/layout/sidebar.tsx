'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { scrollMaskBoth } from '@/lib/motion'
import FolderKanban from 'lucide-react/dist/esm/icons/folder-kanban'
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list'
import Settings from 'lucide-react/dist/esm/icons/settings'

const navigation = [
  { name: '내 작업', href: '/my-work', icon: ClipboardList },
  { name: '프로젝트', href: '/projects', icon: FolderKanban },
  { name: '설정', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 pt-14">
      <div className="flex-1 flex flex-col min-h-0 border-r bg-background">
        <div
          className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto"
          style={{ WebkitMaskImage: scrollMaskBoth, maskImage: scrollMaskBoth }}
        >
          <nav className="mt-5 flex-1 px-2 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon
                    className={cn(
                      'mr-3 h-5 w-5 flex-shrink-0',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </aside>
  )
}
