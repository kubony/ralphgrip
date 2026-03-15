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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#FFD90F]/8 via-background to-[#7ECFCF]/10">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="font-extrabold text-xl tracking-tight">
            <span className="text-[#FFD90F]" style={{ textShadow: '0.5px 0.5px 0 #8B6508' }}>Ralph</span>
            <span>Grip</span>
          </div>
          <Link href="/login">
            <Button className="rounded-xl px-6">로그인</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 text-center">
          {/* Mascot - Ralph head */}
          <div className="mb-8 flex justify-center">
            <svg viewBox="0 0 160 170" className="w-32 h-36 drop-shadow-lg" xmlns="http://www.w3.org/2000/svg">
              {/* Head */}
              <ellipse cx="80" cy="85" rx="52" ry="55" fill="#FFD90F" stroke="#C9A200" strokeWidth="1.5" />
              {/* Hair spikes */}
              <polygon points="35,48 42,15 55,42 65,8 78,40 90,3 102,40 115,10 125,45 132,18 140,52" fill="#FFD90F" stroke="#C9A200" strokeWidth="1.5" strokeLinejoin="round" />
              {/* Ears */}
              <ellipse cx="30" cy="90" rx="9" ry="11" fill="#FFD90F" stroke="#C9A200" strokeWidth="1.2" />
              <ellipse cx="130" cy="90" rx="9" ry="11" fill="#FFD90F" stroke="#C9A200" strokeWidth="1.2" />
              {/* Eyes */}
              <ellipse cx="62" cy="80" rx="14" ry="16" fill="white" stroke="#2C2C2C" strokeWidth="1.5" />
              <ellipse cx="98" cy="80" rx="14" ry="16" fill="white" stroke="#2C2C2C" strokeWidth="1.5" />
              <circle cx="66" cy="83" r="5.5" fill="#2C2C2C" />
              <circle cx="102" cy="83" r="5.5" fill="#2C2C2C" />
              <circle cx="64" cy="79" r="2.2" fill="white" />
              <circle cx="100" cy="79" r="2.2" fill="white" />
              {/* Nose */}
              <ellipse cx="80" cy="97" rx="7" ry="4.5" fill="#E8BE00" stroke="#C9A200" strokeWidth="0.8" />
              {/* Mouth + overbite */}
              <path d="M58 112 Q80 126, 102 112" stroke="#8B6508" strokeWidth="2" fill="none" strokeLinecap="round" />
              <rect x="68" y="111" width="24" height="8" rx="1.5" fill="white" stroke="#8B6508" strokeWidth="0.8" />
              <line x1="80" y1="111" x2="80" y2="119" stroke="#8B6508" strokeWidth="0.5" />
              {/* Shirt peek */}
              <path d="M38 132 Q80 148 122 132 L122 170 L38 170 Z" fill="#7ECFCF" stroke="#5BA8A8" strokeWidth="1.2" />
              <path d="M62 135 Q80 142 98 135" stroke="#5BA8A8" strokeWidth="1" fill="none" />
            </svg>
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
