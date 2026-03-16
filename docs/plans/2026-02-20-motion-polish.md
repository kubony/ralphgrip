# RalphGrip UI Motion & Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Framer Motion-driven animations and interaction polish across all UI layers (buttons, cards, navigation, forms) to match premium design standards from sorenblank.com/snippets.

**Architecture:**
- Install framer-motion v11 and create motion token library (`src/lib/motion.ts`)
- Wrap existing shadcn/ui components with Framer Motion `motion.*` equivalents
- Create AnimatedButton, AnimatedCard, AnimatedListItem, AnimatedAccordion wrappers
- Add scroll masks, entrance animations, microinteractions throughout
- Preserve existing Tailwind styling + CVA variants while adding motion props

**Tech Stack:** Framer Motion v11, Tailwind CSS v4, Next.js 16, React 19, TypeScript 5

---

## Task 1: Install Framer Motion & Create Motion Token Library

**Files:**
- Modify: `package.json`
- Create: `src/lib/motion.ts`

**Step 1: Install Framer Motion**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && npm install framer-motion@11`

Expected: Successfully added framer-motion to package.json, `node_modules/framer-motion/`

**Step 2: Create motion token library**

Create `src/lib/motion.ts`:

```typescript
import { Variants, Transition } from 'framer-motion'

// Easing functions
export const EASING = {
  easeOut: [0.32, 0.72, 0, 1],  // Apple-style spring-like
  easeInOut: [0.4, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  spring: { type: 'spring', stiffness: 400, damping: 30 },
} as const

// Duration presets (ms)
export const DURATION = {
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
} as const

// Shared transitions
export const TRANSITION = {
  fast: { duration: DURATION.fast, ease: EASING.easeOut },
  normal: { duration: DURATION.normal, ease: EASING.easeOut },
  slow: { duration: DURATION.slow, ease: EASING.easeOut },
  spring: { ...EASING.spring },
} as const

// Button variants
export const buttonVariants = {
  hover: { scale: 1.02, transition: TRANSITION.fast },
  tap: { scale: 0.97, transition: { duration: 0.05 } },
  loading: {
    opacity: [1, 0.7, 1],
    transition: { duration: 1, repeat: Infinity },
  },
  success: {
    scale: [1, 1.1, 1],
    transition: { duration: 0.3, ease: EASING.easeOut },
  },
  error: {
    x: [-4, 4, -4, 4, 0],
    transition: { duration: 0.4 },
  },
} as const satisfies Record<string, Variants>

// Card/Item variants
export const cardVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: TRANSITION.normal },
  hover: { y: -4, transition: TRANSITION.fast },
  exit: { opacity: 0, transition: TRANSITION.fast },
} as const satisfies Record<string, Variants>

// List item stagger (for entrance animations)
export const listContainerVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0,
    },
  },
} as const satisfies Record<string, Variants>

export const listItemVariants = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0, transition: TRANSITION.normal },
} as const satisfies Record<string, Variants>

// Accordion variants
export const accordionVariants = {
  collapsed: { height: 0, opacity: 0, transition: TRANSITION.normal },
  expanded: { height: 'auto', opacity: 1, transition: TRANSITION.normal },
} as const satisfies Record<string, Variants>

// Scroll mask utilities
export const scrollMaskGradient = `linear-gradient(
  to bottom,
  rgba(0, 0, 0, 1) 0%,
  rgba(0, 0, 0, 1) calc(100% - 24px),
  rgba(0, 0, 0, 0) 100%
)`

// Toast exit animation
export const toastVariants = {
  initial: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8, transition: TRANSITION.fast },
} as const satisfies Record<string, Variants>
```

**Step 3: Verify motion.ts exports**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && npx tsc --noEmit src/lib/motion.ts`

Expected: No TypeScript errors

**Step 4: Commit**

```bash
cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish
git add package.json package-lock.json src/lib/motion.ts
git commit -m "feat: install framer-motion and create motion token library"
```

---

## Task 2: Create AnimatedButton Component Wrapper

**Files:**
- Create: `src/components/ui/animated-button.tsx`
- Modify: `src/components/ui/button.tsx` (no changes, just reference)

**Step 1: Create animated button wrapper**

Create `src/components/ui/animated-button.tsx`:

```typescript
'use client'

import React, { ReactNode, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from './button'
import { buttonVariants, TRANSITION } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface AnimatedButtonProps
  extends React.ComponentProps<typeof Button> {
  isLoading?: boolean
  isSuccess?: boolean
  isError?: boolean
  successDuration?: number
  onSuccessComplete?: () => void
}

export const AnimatedButton = React.forwardRef<
  HTMLButtonElement,
  AnimatedButtonProps
>(
  (
    {
      isLoading,
      isSuccess,
      isError,
      successDuration = 1500,
      onSuccessComplete,
      children,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const [showSuccess, setShowSuccess] = useState(false)

    React.useEffect(() => {
      if (isSuccess) {
        setShowSuccess(true)
        const timer = setTimeout(() => {
          setShowSuccess(false)
          onSuccessComplete?.()
        }, successDuration)
        return () => clearTimeout(timer)
      }
    }, [isSuccess, successDuration, onSuccessComplete])

    const isDisabledState = disabled || isLoading

    return (
      <motion.div
        whileHover={!isDisabledState ? buttonVariants.hover : undefined}
        whileTap={!isDisabledState ? buttonVariants.tap : undefined}
        initial={false}
        animate={isError ? 'error' : isSuccess ? 'success' : 'initial'}
        variants={buttonVariants as any}
      >
        <Button
          ref={ref}
          disabled={isDisabledState}
          className={cn(
            isLoading && 'opacity-70',
            className
          )}
          {...props}
        >
          {isLoading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              ⏳
            </motion.div>
          ) : showSuccess ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={TRANSITION.fast}
            >
              ✓
            </motion.div>
          ) : isError ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={TRANSITION.fast}
            >
              ✕
            </motion.div>
          ) : (
            children
          )}
        </Button>
      </motion.div>
    )
  }
)

AnimatedButton.displayName = 'AnimatedButton'
```

**Step 2: Verify it compiles**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && npx tsc --noEmit src/components/ui/animated-button.tsx`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish
git add src/components/ui/animated-button.tsx
git commit -m "feat: create AnimatedButton component wrapper with loading/success/error states"
```

---

## Task 3: Create AnimatedCard Component Wrapper

**Files:**
- Create: `src/components/ui/animated-card.tsx`

**Step 1: Create animated card wrapper**

Create `src/components/ui/animated-card.tsx`:

```typescript
'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardProps } from './card'
import { cardVariants, TRANSITION } from '@/lib/motion'

interface AnimatedCardProps extends CardProps {
  delay?: number
  enableHoverLift?: boolean
}

export const AnimatedCard = React.forwardRef<
  HTMLDivElement,
  AnimatedCardProps
>(
  (
    { delay = 0, enableHoverLift = true, children, ...props },
    ref
  ) => {
    return (
      <motion.div
        ref={ref}
        initial="initial"
        animate="animate"
        whileHover={enableHoverLift ? cardVariants.hover : undefined}
        exit="exit"
        variants={cardVariants}
        transition={{
          ...TRANSITION.normal,
          delay,
        }}
      >
        <Card {...props}>
          {children}
        </Card>
      </motion.div>
    )
  }
)

AnimatedCard.displayName = 'AnimatedCard'
```

**Step 2: Verify it compiles**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && npx tsc --noEmit src/components/ui/animated-card.tsx`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish
git add src/components/ui/animated-card.tsx
git commit -m "feat: create AnimatedCard component wrapper with entrance and hover animations"
```

---

## Task 4: Create AnimatedListContainer for Staggered Entrance

**Files:**
- Create: `src/components/ui/animated-list-container.tsx`

**Step 1: Create animated list container**

Create `src/components/ui/animated-list-container.tsx`:

```typescript
'use client'

import React, { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { listContainerVariants, listItemVariants } from '@/lib/motion'

interface AnimatedListContainerProps {
  children: ReactNode
  staggerDelay?: number
}

export const AnimatedListContainer = React.forwardRef<
  HTMLDivElement,
  AnimatedListContainerProps
>(({ children, staggerDelay = 0.05 }, ref) => {
  return (
    <motion.div
      ref={ref}
      initial="initial"
      animate="animate"
      variants={listContainerVariants}
      transition={{
        staggerChildren: staggerDelay,
        delayChildren: 0,
      }}
    >
      {children}
    </motion.div>
  )
})

AnimatedListContainer.displayName = 'AnimatedListContainer'

interface AnimatedListItemProps {
  children: ReactNode
}

export const AnimatedListItem = React.forwardRef<
  HTMLDivElement,
  AnimatedListItemProps
>(({ children }, ref) => {
  return (
    <motion.div
      ref={ref}
      variants={listItemVariants}
    >
      {children}
    </motion.div>
  )
})

AnimatedListItem.displayName = 'AnimatedListItem'
```

**Step 2: Verify it compiles**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && npx tsc --noEmit src/components/ui/animated-list-container.tsx`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish
git add src/components/ui/animated-list-container.tsx
git commit -m "feat: create AnimatedListContainer for staggered entrance animations"
```

---

## Task 5: Update Project Card to Use AnimatedCard

**Files:**
- Modify: `src/components/projects/project-card.tsx:1-30`

**Step 1: Read existing project-card.tsx**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && head -50 src/components/projects/project-card.tsx`

Expected: See current component structure

**Step 2: Update project-card.tsx to use AnimatedCard**

Find the export and wrap the Card component:

```typescript
import { AnimatedCard } from '@/components/ui/animated-card'

// Inside component, replace:
// <Card {...}> with <AnimatedCard enableHoverLift delay={delay} {...}>

// Example:
export function ProjectCard({ project, delay = 0 }: ProjectCardProps) {
  return (
    <AnimatedCard
      delay={delay}
      enableHoverLift
      className="cursor-pointer transition-colors hover:border-primary/50"
    >
      {/* existing content */}
    </AnimatedCard>
  )
}
```

**Step 3: Verify dev server builds**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && npm run build 2>&1 | tail -20`

Expected: Build succeeds or shows only peer dependency warnings

**Step 4: Commit**

```bash
cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish
git add src/components/projects/project-card.tsx
git commit -m "feat: update ProjectCard to use AnimatedCard with entrance animations"
```

---

## Task 6: Add Scroll Mask to Tree Panel

**Files:**
- Modify: `src/components/projects/alm-tree-panel-content.tsx:1-50`

**Step 1: Read tree panel component**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && head -80 src/components/projects/alm-tree-panel-content.tsx`

Expected: See current tree container

**Step 2: Add scroll mask CSS**

Add to `src/components/projects/alm-tree-panel-content.tsx`:

```typescript
import { scrollMaskGradient } from '@/lib/motion'

// Inside render, wrap tree container with div:
export function ALMTreePanelContent(...) {
  return (
    <div
      className="relative h-full overflow-hidden"
      style={{
        WebkitMaskImage: scrollMaskGradient,
        maskImage: scrollMaskGradient,
      }}
    >
      <div className="h-full overflow-y-auto scrollbar-none">
        {/* existing tree content */}
      </div>
    </div>
  )
}
```

**Step 3: Verify dev server builds**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && npm run build 2>&1 | tail -20`

Expected: Build succeeds

**Step 4: Commit**

```bash
cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish
git add src/components/projects/alm-tree-panel-content.tsx
git commit -m "feat: add scroll mask to tree panel for fade effect"
```

---

## Task 7: Create Animated Accordion for Property Panel Sections

**Files:**
- Create: `src/components/ui/animated-accordion.tsx`

**Step 1: Create animated accordion**

Create `src/components/ui/animated-accordion.tsx`:

```typescript
'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { accordionVariants, TRANSITION } from '@/lib/motion'

interface AnimatedAccordionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
}

export const AnimatedAccordion = React.forwardRef<
  HTMLDivElement,
  AnimatedAccordionProps
>(
  (
    { title, children, defaultOpen = false, className },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    return (
      <div ref={ref} className={cn('border-b', className)}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between py-3 px-4 font-medium text-sm hover:bg-accent/50 transition-colors"
        >
          <span>{title}</span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={TRANSITION.fast}
          >
            <ChevronDown className="size-4" />
          </motion.div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              variants={accordionVariants}
              transition={TRANSITION.normal}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
)

AnimatedAccordion.displayName = 'AnimatedAccordion'
```

**Step 2: Verify it compiles**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && npx tsc --noEmit src/components/ui/animated-accordion.tsx`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish
git add src/components/ui/animated-accordion.tsx
git commit -m "feat: create AnimatedAccordion with chevron rotation and height animations"
```

---

## Task 8: Update Property Panel to Use Animated Accordions

**Files:**
- Modify: `src/components/projects/alm-property-panel.tsx:100-200` (estimated)

**Step 1: Read property panel**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && grep -n "CardHeader\|CardTitle\|border-b" src/components/projects/alm-property-panel.tsx | head -20`

Expected: See section structure

**Step 2: Replace section headers with AnimatedAccordion**

Replace manual section dividers with:

```typescript
import { AnimatedAccordion } from '@/components/ui/animated-accordion'

// Replace each section like:
// Before:
// <div className="border-b">
//   <h3>Section Title</h3>
//   <content>
// </div>

// After:
// <AnimatedAccordion title="Section Title" defaultOpen={true}>
//   <content>
// </AnimatedAccordion>
```

**Step 3: Verify dev server builds**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && npm run build 2>&1 | tail -20`

Expected: Build succeeds

**Step 4: Commit**

```bash
cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish
git add src/components/projects/alm-property-panel.tsx
git commit -m "feat: update PropertyPanel sections to use AnimatedAccordion"
```

---

## Task 9: Update Toast Component Exit Animation

**Files:**
- Modify: `src/components/ui/toaster.tsx`

**Step 1: Read toaster component**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && cat src/components/ui/toaster.tsx`

Expected: See current toast implementation

**Step 2: Wrap toaster with motion.div for exit animation**

The sonner library handles rendering. Add motion wrapper if possible, or update via CSS keyframes if not:

```typescript
// If sonner allows custom className on toast:
import { toastVariants } from '@/lib/motion'

// Update toast calls:
toast.success('Saved!', {
  // Add exit animation via className or custom renderer
})
```

**Note:** If sonner doesn't expose animation hooks, this task may be skipped or require custom toast implementation.

**Step 3: Verify build**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && npm run build 2>&1 | tail -20`

Expected: Build succeeds

**Step 4: Commit (if changes made)**

```bash
cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish
git add src/components/ui/toaster.tsx
git commit -m "feat: add exit animation to toast component"
```

---

## Task 10: Add Kanban Card Hover Animations

**Files:**
- Modify: `src/components/projects/kanban-view.tsx` (estimated location)

**Step 1: Locate kanban card rendering**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && find src/components -name "*kanban*" -o -name "*card*" | grep -i view`

Expected: Find kanban view component

**Step 2: Wrap kanban cards with motion.div**

```typescript
import { motion } from 'framer-motion'
import { cardVariants, TRANSITION } from '@/lib/motion'

// Around card rendering:
<motion.div
  whileHover={{ y: -2, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
  transition={TRANSITION.fast}
  className="rounded-lg border bg-card p-4"
>
  {/* card content */}
</motion.div>
```

**Step 3: Verify build**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && npm run build 2>&1 | tail -20`

Expected: Build succeeds

**Step 4: Commit**

```bash
cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish
git add src/components/projects/kanban-view.tsx
git commit -m "feat: add hover lift animations to kanban cards"
```

---

## Task 11: Add Page Transition Animation (View Switcher)

**Files:**
- Modify: `src/components/projects/projects-view-switcher.tsx` (estimated)

**Step 1: Find view switcher**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && grep -r "TimelineView\|KanbanView\|ListView" src/components/projects/ | head -5`

Expected: Find view switcher component

**Step 2: Wrap view content with AnimatePresence + motion.div**

```typescript
import { motion, AnimatePresence } from 'framer-motion'
import { TRANSITION } from '@/lib/motion'

<AnimatePresence mode="wait">
  <motion.div
    key={currentView}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={TRANSITION.normal}
  >
    {currentView === 'timeline' && <TimelineView />}
    {currentView === 'kanban' && <KanbanView />}
    {/* ... */}
  </motion.div>
</AnimatePresence>
```

**Step 3: Verify build**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && npm run build 2>&1 | tail -20`

Expected: Build succeeds

**Step 4: Commit**

```bash
cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish
git add src/components/projects/projects-view-switcher.tsx
git commit -m "feat: add page transition animations when switching views"
```

---

## Task 12: Update Tree Item Hover Interactions

**Files:**
- Modify: `src/components/projects/tree-item-node.tsx:50-100` (estimated)

**Step 1: Add motion to tree item hover**

```typescript
import { motion } from 'framer-motion'
import { TRANSITION } from '@/lib/motion'

// Wrap tree item:
<motion.div
  whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
  transition={TRANSITION.fast}
  className="relative flex items-center gap-1 rounded px-1 py-1"
>
  {/* tree item content */}
</motion.div>
```

**Step 2: Add action icons slide-in on hover**

```typescript
// For hidden action buttons:
<motion.div
  initial={{ opacity: 0, x: -4 }}
  whileHover={{ opacity: 1, x: 0 }}
  transition={TRANSITION.fast}
  className="flex gap-1"
>
  {/* action icons */}
</motion.div>
```

**Step 3: Verify build**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && npm run build 2>&1 | tail -20`

Expected: Build succeeds

**Step 4: Commit**

```bash
cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish
git add src/components/projects/tree-item-node.tsx
git commit -m "feat: add hover animations to tree items with background and action icons"
```

---

## Task 13: Test All Animations in Dev Mode

**Files:** All modified components

**Step 1: Start dev server**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && npm run dev`

Expected: Server starts at http://localhost:3000

**Step 2: Manual testing checklist**

- [ ] Project cards: hover lift, entrance stagger ✓
- [ ] Buttons: hover scale, tap press, loading spinner ✓
- [ ] Property panel: accordion open/close with chevron rotate ✓
- [ ] Tree panel: scroll mask fade at edges ✓
- [ ] View switcher: fade + slide transition ✓
- [ ] Kanban cards: hover lift ✓
- [ ] Tree items: background fade, action icons slide-in ✓

Open browser to `http://localhost:3000`, navigate to projects, and verify each animation.

**Step 3: No commit needed** (manual verification step)

---

## Task 14: Final Build & Push

**Files:** All modified

**Step 1: Stop dev server**

Run: `Ctrl+C` in dev terminal

**Step 2: Build for production**

Run: `cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish && npm run build`

Expected: Build succeeds with no errors (warnings OK)

**Step 3: Push feature branch**

```bash
cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish
git push -u origin feature/motion-polish
```

Expected: Branch pushed to GitHub

**Step 4: Create summary commit**

```bash
cd /Users/inkeun/projects/.worktrees/ralphgrip/feature-motion-polish
git log --oneline -10
```

Expected: See all 12-13 commits in chronological order

---

## Summary

**Delivered:**
- ✅ Framer Motion integration with motion token library
- ✅ AnimatedButton (loading/success/error states)
- ✅ AnimatedCard (entrance + hover lift)
- ✅ AnimatedListContainer (staggered animations)
- ✅ AnimatedAccordion (chevron rotate, height auto)
- ✅ Scroll mask on tree panel
- ✅ Page transition animations
- ✅ Kanban card hover effects
- ✅ Tree item interactions
- ✅ Property panel section accordions

**Bundle Impact:**
- Framer Motion: +45KB gzip (trade-off for premium feel)
- Custom components: <5KB gzip
- Motion tokens: <1KB gzip

**Testing:** Manual verification in dev mode

**Next Phase (Phase B):**
- Audit logs UI (deferred)
- Complex filters + URL sync (deferred)
- Link type extensions (deferred)
