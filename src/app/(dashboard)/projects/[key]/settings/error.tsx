'use client'

import { ErrorBoundary } from '@/components/error-boundary'

interface SettingsErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function SettingsError({
  error,
  reset,
}: SettingsErrorProps) {
  return <ErrorBoundary error={error} reset={reset} />
}
