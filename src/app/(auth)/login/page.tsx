'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

const ERROR_MESSAGES: Record<string, string> = {
  domain_not_allowed: '허용되지 않은 계정입니다.',
  auth_failed: '로그인에 실패했습니다. 다시 시도해주세요.',
}

function LoginForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    const next = searchParams.get('next')
    const callbackUrl = new URL(`${window.location.origin}/auth/callback`)
    if (next?.startsWith('/')) {
      callbackUrl.searchParams.set('next', next)
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Mascot */}
      <Image
        src="/images/ralph-logo.png"
        alt="Ralph"
        width={176}
        height={224}
        className="w-44 h-56 object-contain drop-shadow-lg"
        priority
      />

      {/* Login Card */}
      <div className="w-full max-w-sm bg-white/90 dark:bg-card/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-border p-8 space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="text-[#FFD90F]" style={{ textShadow: '1px 1px 0 #8B6508, -0.5px -0.5px 0 #8B6508' }}>Ralph</span>
            <span className="text-foreground">Grip</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            프로젝트를 즐겁게 관리하는 방법
          </p>
        </div>

        {/* Error */}
        {error && ERROR_MESSAGES[error] && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center">
            {ERROR_MESSAGES[error]}
          </div>
        )}

        {/* Google Login */}
        <Button
          onClick={handleGoogleLogin}
          className="w-full h-12 text-base font-semibold rounded-xl"
          size="lg"
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google로 로그인
        </Button>

        <p className="text-xs text-center text-muted-foreground/60">
          로그인하면 서비스 이용약관에 동의하는 것으로 간주됩니다
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#FFD90F]/10 via-background to-[#7ECFCF]/10 dark:from-[#FFD90F]/5 dark:via-background dark:to-[#7ECFCF]/5">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#FFD90F]/8 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[#7ECFCF]/10 blur-3xl" />
      </div>

      <div className="relative z-10">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
