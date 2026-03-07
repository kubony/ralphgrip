'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import X from 'lucide-react/dist/esm/icons/x'
import { ALMPropertyPanel } from './alm-property-panel'
import type { WorkItemWithRelations, StatusRef, TrackerRef, PersonRef } from '@/types/database'

interface TimelinePropertyOverlayProps {
  workItem: WorkItemWithRelations | null
  allWorkItems: WorkItemWithRelations[]
  statuses: StatusRef[]
  trackers: TrackerRef[]
  members: PersonRef[]
  projectId: string
  currentUserId?: string
  onClose: () => void
}

export default function TimelinePropertyOverlay({
  workItem,
  allWorkItems,
  statuses,
  trackers,
  members,
  projectId,
  currentUserId,
  onClose,
}: TimelinePropertyOverlayProps) {
  // Handle ESC key
  useEffect(() => {
    if (!workItem) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [workItem, onClose])

  return (
    <AnimatePresence>
      {workItem && (
        <>
          {/* Background overlay */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 bg-black/20 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Slide-over panel */}
          <motion.div
            key="panel"
            className="fixed right-0 top-0 bottom-0 w-[360px] bg-background border-l shadow-xl z-50"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1 rounded-md hover:bg-accent z-10 relative after:absolute after:-inset-2 after:content-['']"
              aria-label="Close properties panel"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Property panel */}
            <div className="h-full overflow-y-auto">
              <ALMPropertyPanel
                workItem={workItem}
                allWorkItems={allWorkItems}
                statuses={statuses}
                trackers={trackers}
                members={members}
                projectId={projectId}
                currentUserId={currentUserId}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
