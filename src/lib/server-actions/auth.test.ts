import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'

import { requireAuthenticatedUser } from '@/lib/server-actions/auth'

function makeSupabaseClient(user: User | null, error: Error | null = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error,
      }),
    },
  } as unknown as SupabaseClient
}

describe('requireAuthenticatedUser', () => {
  it('returns the authenticated user when available', async () => {
    const user = { id: 'user-1', email: 'user@example.com' } as User
    const supabase = makeSupabaseClient(user)

    await expect(requireAuthenticatedUser(supabase)).resolves.toEqual({
      user,
      error: null,
    })
  })

  it('returns the provided error message when user is missing', async () => {
    const supabase = makeSupabaseClient(null)

    await expect(requireAuthenticatedUser(supabase, '인증 필요')).resolves.toEqual({
      user: null,
      error: '인증 필요',
    })
  })
})
