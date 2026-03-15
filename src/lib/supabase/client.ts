import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
        sameSite: 'lax' as const,
        secure: process.env.NEXT_PUBLIC_APP_URL?.startsWith('https'),
      },
    }
  )
}
