import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

// React.cache()로 요청당 1번만 Supabase 클라이언트 생성
// (동일 요청 내 20+회 createClient() 호출 시 cookies() 중복 방지)
async function _createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                maxAge: options?.maxAge ?? 60 * 60 * 24 * 7,
              })
            )
          } catch {
            // Server Component에서 호출 시 무시
          }
        },
      },
    }
  )
}

export const createClient = cache(_createClient)
