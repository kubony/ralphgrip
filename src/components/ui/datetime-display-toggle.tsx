'use client'

import Clock3 from 'lucide-react/dist/esm/icons/clock-3'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface DateTimeDisplayToggleProps {
  showSeconds: boolean
  onToggle: () => void
  className?: string
}

export function DateTimeDisplayToggle({
  showSeconds,
  onToggle,
  className,
}: DateTimeDisplayToggleProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('h-7 gap-1.5 text-xs', className)}
      onClick={onToggle}
      aria-pressed={showSeconds}
    >
      <Clock3 className="h-3.5 w-3.5" />
      초: {showSeconds ? '표시' : '숨김'}
    </Button>
  )
}
