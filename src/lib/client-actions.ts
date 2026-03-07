'use client'

import { toast } from 'sonner'

/**
 * Server Action 실행 후 토스트 알림을 표시하는 래퍼
 * 성공/실패 시 자동으로 토스트 메시지를 표시합니다.
 */
export async function executeWithToast<T>(
  action: () => Promise<T>,
  {
    successMessage = '성공했습니다.',
    errorMessage = '오류가 발생했습니다.',
    loadingMessage,
  }: {
    successMessage?: string
    errorMessage?: string
    loadingMessage?: string
  } = {}
): Promise<{ data?: T; error?: unknown }> {
  const toastId = loadingMessage ? toast.loading(loadingMessage) : undefined

  try {
    const result = await action()

    if (toastId) {
      toast.dismiss(toastId)
    }
    toast.success(successMessage)

    return { data: result }
  } catch (error) {
    if (toastId) {
      toast.dismiss(toastId)
    }

    const message = error instanceof Error ? error.message : errorMessage
    toast.error(message)

    return { error }
  }
}
