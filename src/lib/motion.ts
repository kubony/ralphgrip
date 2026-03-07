import type { Variants, Transition } from 'framer-motion'

// ── Easing ──────────────────────────────────────────────
export const EASING = {
  /** Apple-style smooth ease-out */
  easeOut: [0.32, 0.72, 0, 1] as const,
  easeInOut: [0.4, 0, 0.2, 1] as const,
  easeIn: [0.4, 0, 1, 1] as const,
  spring: { type: 'spring' as const, stiffness: 400, damping: 30 },
}

// ── Duration (seconds) ──────────────────────────────────
export const DURATION = {
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
} as const

// ── Shared Transitions ──────────────────────────────────
export const TRANSITION: Record<string, Transition> = {
  fast: { duration: DURATION.fast, ease: EASING.easeOut },
  normal: { duration: DURATION.normal, ease: EASING.easeOut },
  slow: { duration: DURATION.slow, ease: EASING.easeOut },
  spring: { ...EASING.spring },
}

// ── Button Motion ───────────────────────────────────────
export const buttonMotion = {
  hover: { scale: 1.02 },
  tap: { scale: 0.97 },
} as const

export const buttonStateVariants: Variants = {
  idle: { x: 0, scale: 1 },
  success: {
    scale: [1, 1.05, 1],
    transition: { duration: 0.3 },
  },
  error: {
    x: [-4, 4, -4, 4, 0],
    transition: { duration: 0.4 },
  },
}

// ── Card / Item Motion ──────────────────────────────────
export const cardVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: TRANSITION.normal,
  },
  exit: { opacity: 0, transition: TRANSITION.fast },
}

export const cardHover = {
  y: -4,
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  transition: TRANSITION.fast,
} as const

// ── Staggered List ──────────────────────────────────────
export const listContainerVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
}

export const listItemVariants: Variants = {
  initial: { opacity: 0, x: -8 },
  animate: {
    opacity: 1,
    x: 0,
    transition: TRANSITION.normal,
  },
}

// ── Accordion ───────────────────────────────────────────
export const accordionVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: { duration: DURATION.normal, ease: EASING.easeOut },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: { duration: DURATION.normal, ease: EASING.easeOut },
  },
}

// ── Page / View transition ──────────────────────────────
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: TRANSITION.normal },
  exit: { opacity: 0, y: -8, transition: TRANSITION.fast },
}

// ── Scroll Mask (CSS value) ─────────────────────────────
export const scrollMaskTop =
  'linear-gradient(to bottom, transparent 0%, black 12px)'

export const scrollMaskBottom =
  'linear-gradient(to bottom, black calc(100% - 24px), transparent 100%)'

export const scrollMaskBoth =
  'linear-gradient(to bottom, transparent 0%, black 12px, black calc(100% - 24px), transparent 100%)'
