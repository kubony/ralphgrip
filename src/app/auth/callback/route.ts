import { createClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

const ALLOWED_DOMAIN = '@maum.ai'
const ALLOWED_EMAILS = ['kubony@gmail.com']

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/projects'
  // 오픈 리다이렉트 방지: 반드시 내부 경로(/)로만 허용
  const next = rawNext.startsWith('/') ? rawNext : '/projects'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // 도메인 화이트리스트 체크
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email?.endsWith(ALLOWED_DOMAIN) && !ALLOWED_EMAILS.includes(user?.email ?? '')) {
        await supabase.auth.signOut()
        return NextResponse.redirect(
          `${origin}/login?error=domain_not_allowed`
        )
      }

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
