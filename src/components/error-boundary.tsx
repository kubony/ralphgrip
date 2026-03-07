'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

export function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error('Error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/50 p-4">
      <div className="max-w-md w-full bg-background rounded-lg border p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-destructive">오류가 발생했습니다</h1>
          <p className="text-sm text-muted-foreground mt-1">
            예상치 못한 오류가 발생했습니다. 다시 시도해주세요.
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="bg-muted p-3 rounded text-xs overflow-auto max-h-48 font-mono text-destructive">
            {error.message}
          </div>
        )}

        <Button onClick={reset} className="w-full">
          다시 시도
        </Button>
      </div>
    </div>
  )
}
