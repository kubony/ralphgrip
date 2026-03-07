import { getCurrentUser, getUserProfile } from '@/lib/supabase/cached-queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { ProfileSettings } from './profile-settings'
import { AppearanceSettings } from './appearance-settings'
import { AccountSettings } from './account-settings'
import Activity from 'lucide-react/dist/esm/icons/activity'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Shield from 'lucide-react/dist/esm/icons/shield'

export default async function SettingsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const profile = await getUserProfile(user.id)
  const isAdmin = profile?.app_role === 'admin'

  const sections = [
    { id: 'profile', label: 'Profile' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'activity', label: 'Activity', href: '/settings/activity' },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', href: '/settings/admin' }] : []),
    { id: 'account', label: 'Account', destructive: true },
  ]

  const profileData = {
    email: profile?.email ?? user.email ?? '',
    full_name: profile?.full_name ?? user.user_metadata?.full_name ?? null,
    avatar_url: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-none flex items-center gap-3 px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto flex gap-8 p-6">
          {/* Side navigation */}
          <nav className="hidden md:block w-40 shrink-0 sticky top-6 self-start">
            <ul className="space-y-1">
              {sections.map((s) => (
                <li key={s.id}>
                  {s.href ? (
                    <Link
                      href={s.href}
                      className="block px-3 py-1.5 text-sm rounded-md transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      {s.label}
                    </Link>
                  ) : (
                    <a
                      href={`#${s.id}`}
                      className={`block px-3 py-1.5 text-sm rounded-md transition-colors hover:bg-muted ${
                        s.destructive
                          ? 'text-destructive hover:text-destructive'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {s.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-8">
            <ProfileSettings profile={profileData} />
            <Separator />
            <AppearanceSettings />
            <Separator />

            {/* Activity Log Link */}
            <section>
              <h2 className="text-base font-semibold mb-3">Activity</h2>
              <Link
                href="/settings/activity"
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">활동 로그</p>
                    <p className="text-xs text-muted-foreground">모든 유저의 행동 기록을 확인합니다</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
            </section>

            {isAdmin && (
              <>
                <Separator />
                <section>
                  <h2 className="text-base font-semibold mb-3">Admin</h2>
                  <Link
                    href="/settings/admin"
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">사용자 관리</p>
                        <p className="text-xs text-muted-foreground">사용자 역할 관리 및 접근 권한 설정</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                </section>
              </>
            )}

            <Separator />
            <AccountSettings email={profileData.email} />
          </div>
        </div>
      </div>
    </div>
  )
}
