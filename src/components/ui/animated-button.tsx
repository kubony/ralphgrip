'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button, buttonVariants as btnVariants } from './button'
import { buttonMotion, buttonStateVariants, TRANSITION } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { VariantProps } from 'class-variance-authority'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'

type ButtonVariantProps = VariantProps<typeof btnVariants>

interface AnimatedButtonProps
  extends Omit<React.ComponentProps<'button'>, 'ref'>,
    ButtonVariantProps {
  asChild?: boolean
  /** Show loading spinner and disable interactions */
  isLoading?: boolean
  /** Flash success state (auto-resets) */
  isSuccess?: boolean
  /** Flash error state with shake (auto-resets) */
  isError?: boolean
  /** How long success/error state persists (ms) */
  feedbackDuration?: number
}

export function AnimatedButton({
  isLoading = false,
  isSuccess = false,
  isError = false,
  feedbackDuration = 1500,
  children,
  disabled,
  className,
  variant,
  size,
  ...props
}: AnimatedButtonProps) {
  const [showFeedback, setShowFeedback] = useState<
    'idle' | 'success' | 'error'
  >('idle')

  useEffect(() => {
    if (isSuccess) {
       
      queueMicrotask(() => setShowFeedback('success'))
      const t = setTimeout(() => setShowFeedback('idle'), feedbackDuration)
      return () => clearTimeout(t)
    }
  }, [isSuccess, feedbackDuration])

  useEffect(() => {
    if (isError) {
       
      queueMicrotask(() => setShowFeedback('error'))
      const t = setTimeout(() => setShowFeedback('idle'), feedbackDuration)
      return () => clearTimeout(t)
    }
  }, [isError, feedbackDuration])

  const busy = disabled || isLoading

  return (
    <motion.div
      className="inline-flex"
      whileHover={!busy ? buttonMotion.hover : undefined}
      whileTap={!busy ? buttonMotion.tap : undefined}
      variants={buttonStateVariants}
      initial="idle"
      animate={showFeedback}
    >
      <Button
        disabled={busy}
        variant={variant}
        size={size}
        className={cn(className)}
        {...props}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={TRANSITION.fast}
              className="flex items-center gap-2"
            >
              <Loader2 className="size-4 animate-spin" />
            </motion.span>
          ) : showFeedback === 'success' ? (
            <motion.span
              key="success"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={TRANSITION.fast}
            >
              <Check className="size-4" />
            </motion.span>
          ) : showFeedback === 'error' ? (
            <motion.span
              key="error"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={TRANSITION.fast}
            >
              <X className="size-4" />
            </motion.span>
          ) : (
            <motion.span
              key="children"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={TRANSITION.fast}
            >
              {children}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
    </motion.div>
  )
}
