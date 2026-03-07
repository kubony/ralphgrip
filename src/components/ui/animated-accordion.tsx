'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import { cn } from '@/lib/utils'
import { accordionVariants, TRANSITION } from '@/lib/motion'

interface AnimatedAccordionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
  /** Optional count badge */
  count?: number
}

export function AnimatedAccordion({
  title,
  children,
  defaultOpen = true,
  className,
  count,
}: AnimatedAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={cn('border-b last:border-b-0', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-2.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          {title}
          {count != null && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
              {count}
            </span>
          )}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={TRANSITION.fast}
        >
          <ChevronDown className="size-3.5" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={accordionVariants}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
