'use client'

import { ErrorBoundary } from '@/components/error-boundary'

interface ProjectDetailErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ProjectDetailError({
  error,
  reset,
}: ProjectDetailErrorProps) {
  return <ErrorBoundary error={error} reset={reset} />
}
