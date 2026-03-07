'use client'

import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      theme="system"
      position="top-right"
      richColors
      expand
      closeButton
    />
  )
}
