import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 이미 로그인된 경우 홈(내 작업)으로 리다이렉트
  if (user) {
    redirect('/my-work')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#FFD90F]/8 via-background to-[#7ECFCF]/10">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/images/ralph-logo.png"
              alt="RalphGrip"
              width={32}
              height={32}
              className="h-8 w-8 rounded-md dark:hidden"
            />
            <Image
              src="/images/ralph-logo-dark.webp"
              alt="RalphGrip"
              width={32}
              height={32}
              className="h-8 w-8 rounded-md hidden dark:block"
            />
            <span className="font-extrabold text-xl tracking-tight">
              <span className="text-[#FFD90F]" style={{ textShadow: '0.5px 0.5px 0 #8B6508' }}>Ralph</span>
              <span>Grip</span>
            </span>
          </div>
          <Link href="/login">
            <Button className="rounded-xl px-6">로그인</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 text-center">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <Image
              src="/images/ralph-logo.png"
              alt="Ralph"
              width={120}
              height={120}
              className="w-28 h-28 rounded-2xl shadow-lg dark:hidden"
              priority
            />
            <Image
              src="/images/ralph-logo-dark.webp"
              alt="Ralph"
              width={120}
              height={120}
              className="w-28 h-28 rounded-2xl shadow-lg hidden dark:block"
              priority
            />
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
            프로젝트를
            <br />
            <span className="text-[#FFD90F]" style={{ textShadow: '1px 1px 0 #8B6508' }}>즐겁게</span> 관리하세요
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            계층 트리, 추적성 매트릭스, 의존성 그래프로
            <br />
            프로젝트의 전체 흐름을 놓치지 않는 ALM 도구
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="rounded-xl px-8 h-12 text-base font-semibold">
                시작하기
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2026 RalphGrip. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
