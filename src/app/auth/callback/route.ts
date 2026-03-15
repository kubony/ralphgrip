import { createClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin: rawOrigin } = new URL(request.url)
  // 리버스 프록시 뒤에서는 request.url이 localhost:3000으로 잡히므로 환경변수 우선 사용
  const origin = process.env.NEXT_PUBLIC_APP_URL || rawOrigin
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/projects'
  // 오픈 리다이렉트 방지: 반드시 내부 경로(/)로만 허용
  const next = rawNext.startsWith('/') ? rawNext : '/projects'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      // Google 토큰 저장 (Drive API 서버사이드 접근용)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.provider_token && user) {
        const admin = getServiceClient()
        await admin.from('profiles').update({
          google_access_token: session.provider_token,
          google_refresh_token: session.provider_refresh_token ?? null,
          google_token_expires_at: session.expires_at
            ? new Date(session.expires_at * 1000).toISOString()
            : new Date(Date.now() + 3600 * 1000).toISOString(),
        }).eq('id', user.id)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // 에러 발생 시 로그인 페이지로 리다이렉트
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
