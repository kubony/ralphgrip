import { getCurrentUser, getUserProfile } from '@/lib/supabase/cached-queries'
import { redirect } from 'next/navigation'
import { getAllUsers } from '../admin-actions'
import { UserManagement } from './user-management'

export default async function AdminPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getUserProfile(user.id)
  if (profile?.app_role !== 'admin') redirect('/settings')

  const result = await getAllUsers()
  if (result.error || !result.data) redirect('/settings')

  const currentUserId = user.id

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-none flex items-center gap-3 px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">Admin - User Management</h1>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6">
          <UserManagement users={result.data} currentUserId={currentUserId} />
        </div>
      </div>
    </div>
  )
}
