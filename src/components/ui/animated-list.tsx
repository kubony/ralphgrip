'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { listContainerVariants, listItemVariants } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface AnimatedListProps {
  /** Delay between each child entrance (seconds) */
  staggerDelay?: number
  className?: string
  children?: React.ReactNode
}

export function AnimatedList({
  staggerDelay = 0.04,
  className,
  children,
}: AnimatedListProps) {
  return (
    <motion.div
      variants={{
        ...listContainerVariants,
        animate: {
          ...listContainerVariants.animate,
          transition: { staggerChildren: staggerDelay },
        },
      }}
      initial="initial"
      animate="animate"
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}

interface AnimatedListItemProps {
  className?: string
  children?: React.ReactNode
}

export function AnimatedListItem({
  className,
  children,
}: AnimatedListItemProps) {
  return (
    <motion.div
      variants={listItemVariants}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}
