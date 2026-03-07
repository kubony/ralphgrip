import type { SupabaseClient, User } from '@supabase/supabase-js'

type AuthResult =
  | { user: User; error: null }
  | { user: null; error: string }

export async function requireAuthenticatedUser(
  supabase: SupabaseClient,
  errorMessage = '로그인이 필요합니다.'
): Promise<AuthResult> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { user: null, error: errorMessage }
  }

  return { user, error: null }
}
