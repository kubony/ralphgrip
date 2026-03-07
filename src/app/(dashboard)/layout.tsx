import { getCurrentUser, getUserProfile, getRecentNotifications, getUnreadNotificationCount } from '@/lib/supabase/cached-queries'
import { Header } from '@/components/layout/header'
import { CommandPalette } from '@/components/command-palette'
import { ThemeProvider } from '@/hooks/use-theme'

interface User {
  email: string
  full_name?: string | null
  avatar_url?: string | null
  app_role?: string | null
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // React.cache()를 활용한 사용자 조회 (요청당 중복 제거)
  const authUser = await getCurrentUser()

  let user: User | null = null
  let initialNotifications: Awaited<ReturnType<typeof getRecentNotifications>> = []
  let initialUnreadCount = 0

  if (authUser) {
    // 캐시된 프로필 조회 + 알림 데이터 병렬 조회
    const [profile, notifications, unreadCount] = await Promise.all([
      getUserProfile(authUser.id),
      getRecentNotifications(authUser.id),
      getUnreadNotificationCount(authUser.id),
    ])

    initialNotifications = notifications
    initialUnreadCount = unreadCount

    if (profile) {
      user = profile
    } else {
      user = {
        email: authUser.email ?? '',
        full_name: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name,
        avatar_url: authUser.user_metadata?.avatar_url,
        app_role: null,
      }
    }
  }

  return (
    <ThemeProvider>
      <div className="h-screen flex flex-col bg-background">
        <div data-main-header className="shrink-0">
          <Header
            user={user}
            userId={authUser?.id ?? null}
            initialNotifications={initialNotifications}
            initialUnreadCount={initialUnreadCount}
          />
        </div>
        <CommandPalette />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </ThemeProvider>
  )
}
