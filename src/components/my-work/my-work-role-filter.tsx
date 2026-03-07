'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import UserCheck from 'lucide-react/dist/esm/icons/user-check'
import PenLine from 'lucide-react/dist/esm/icons/pen-line'
import AtSign from 'lucide-react/dist/esm/icons/at-sign'
import type { MyWorkItem, RoleFilter, RoleType } from './types'

interface MyWorkRoleFilterProps {
  roleFilter: RoleFilter
  onRoleFilterChange: (filter: RoleFilter) => void
  items: MyWorkItem[]
}

const ROLE_CHIPS: { key: RoleType; label: string; icon: typeof UserCheck }[] = [
  { key: 'assigned', label: '할당', icon: UserCheck },
  { key: 'created', label: '생성', icon: PenLine },
  { key: 'mentioned', label: '언급', icon: AtSign },
]

export function MyWorkRoleFilter({ roleFilter, onRoleFilterChange, items }: MyWorkRoleFilterProps) {
  const roleCounts = useMemo(() => {
    const counts: Record<RoleType, number> = { assigned: 0, created: 0, mentioned: 0 }
    for (const item of items) {
      for (const reason of item.matchReasons) {
        counts[reason]++
      }
    }
    return counts
  }, [items])

  return (
    <div className="flex items-center gap-0.5">
      {ROLE_CHIPS.map(({ key, label, icon: Icon }) => {
        const isActive = roleFilter === key
        return (
          <button
            key={key}
            onClick={() => onRoleFilterChange(isActive ? null : key)}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-all',
              isActive
                ? 'bg-primary/10 text-primary ring-1 ring-primary/30 font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
            <span className={cn(
              'font-mono tabular-nums',
              isActive ? 'text-primary/70' : 'text-muted-foreground/60'
            )}>
              {roleCounts[key]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
