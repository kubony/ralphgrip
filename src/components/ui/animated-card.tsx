'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cardVariants, cardHover, TRANSITION } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface AnimatedCardProps {
  /** Entrance delay in seconds */
  delay?: number
  /** Enable hover lift + shadow effect */
  enableHoverLift?: boolean
  className?: string
  children?: React.ReactNode
  onClick?: () => void
}

export function AnimatedCard({
  delay = 0,
  enableHoverLift = true,
  className,
  children,
  onClick,
}: AnimatedCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      whileHover={enableHoverLift ? cardHover : undefined}
      whileTap={enableHoverLift ? { y: 0, scale: 0.985, transition: TRANSITION.fast } : undefined}
      transition={{ ...TRANSITION.normal, delay }}
      className={cn(
        'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm',
        className
      )}
      onClick={onClick}
    >
      {children}
    </motion.div>
  )
}
