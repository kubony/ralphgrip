import Link from 'next/link'
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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="font-bold text-xl">WoRV Grip</div>
          <Link href="/login">
            <Button>로그인</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            요구사항부터 이슈까지
            <br />
            한눈에 추적하세요
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            계층 트리, 추적성 매트릭스, 의존성 그래프로
            <br />
            프로젝트의 전체 흐름을 놓치지 않는 ALM 도구
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/login">
              <Button size="lg">
                시작하기
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2024 WoRV Grip. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
