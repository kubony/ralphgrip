import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Drive 스코프 등 추가 권한이 필요할 때 재인증을 위한 엔드포인트.
// 로그아웃 후 next 파라미터를 유지한 채 로그인 페이지로 리다이렉트한다.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const rawNext = searchParams.get('next') ?? '/projects'
  const next = rawNext.startsWith('/') ? rawNext : '/projects'

  const supabase = await createClient()
  await supabase.auth.signOut()

  return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(next)}`)
}
