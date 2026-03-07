'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import Filter from 'lucide-react/dist/esm/icons/filter'
import X from 'lucide-react/dist/esm/icons/x'
import type { MyWorkItem, Filters, Phase, DueDateFilter, StatFilter } from './types'
import { phaseLabels, priorityLabels } from './types'

interface MyWorkFiltersProps {
  items: MyWorkItem[]
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  statFilter: StatFilter
  onStatFilterClear: () => void
}

function CheckboxItem({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-input"
      />
      {label}
    </label>
  )
}

export function MyWorkFilters({ items, filters, onFiltersChange, statFilter, onStatFilterClear }: MyWorkFiltersProps) {
  const availableProjects = useMemo(() => {
    const map = new Map<string, { id: string; key: string; name: string }>()
    items.forEach(item => {
      if (item.project && !map.has(item.project.id)) {
        map.set(item.project.id, item.project)
      }
    })
    return Array.from(map.values()).toSorted((a, b) => a.key.localeCompare(b.key))
  }, [items])

  const hasActiveFilters = filters.projects.length > 0 ||
    filters.phases.length > 0 ||
    filters.priorities.length > 0 ||
    filters.dueDate !== 'all' ||
    statFilter !== null

  const clearFilters = () => {
    onFiltersChange({ projects: [], phases: [], priorities: [], dueDate: 'all' })
    onStatFilterClear()
  }

  const toggleProject = (projectId: string, checked: boolean) => {
    const next = checked
      ? [...filters.projects, projectId]
      : filters.projects.filter(id => id !== projectId)
    onFiltersChange({ ...filters, projects: next })
  }

  const togglePhase = (phase: Phase, checked: boolean) => {
    const next = checked
      ? [...filters.phases, phase]
      : filters.phases.filter(p => p !== phase)
    onFiltersChange({ ...filters, phases: next })
  }

  const togglePriority = (priority: number, checked: boolean) => {
    const next = checked
      ? [...filters.priorities, priority]
      : filters.priorities.filter(p => p !== priority)
    onFiltersChange({ ...filters, priorities: next })
  }

  const dueDateOptions: { value: DueDateFilter; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'today', label: '오늘' },
    { value: 'overdue', label: '지남' },
    { value: 'this_week', label: '이번 주' },
    { value: 'unset', label: '미설정' },
  ]

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* 프로젝트 필터 */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            프로젝트
            {filters.projects.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {filters.projects.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {availableProjects.map(project => (
              <CheckboxItem
                key={project.id}
                checked={filters.projects.includes(project.id)}
                label={`${project.key} - ${project.name}`}
                onChange={(checked) => toggleProject(project.id, checked)}
              />
            ))}
            {availableProjects.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">프로젝트 없음</p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* 단계 필터 */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            단계
            {filters.phases.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {filters.phases.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-2" align="start">
          <div className="space-y-0.5">
            {(Object.entries(phaseLabels) as [Phase, string][]).map(([phase, label]) => (
              <CheckboxItem
                key={phase}
                checked={filters.phases.includes(phase)}
                label={label}
                onChange={(checked) => togglePhase(phase, checked)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* 우선순위 필터 */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            우선순위
            {filters.priorities.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {filters.priorities.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-2" align="start">
          <div className="space-y-0.5">
            {[0, 1, 2, 3, 4].map(priority => (
              <CheckboxItem
                key={priority}
                checked={filters.priorities.includes(priority)}
                label={priorityLabels[priority]}
                onChange={(checked) => togglePriority(priority, checked)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* 마감일 필터 */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            마감일
            {filters.dueDate !== 'all' && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">1</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-2" align="start">
          <div className="space-y-0.5">
            {dueDateOptions.map(option => (
              <label
                key={option.value}
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer"
              >
                <input
                  type="radio"
                  name="dueDate"
                  checked={filters.dueDate === option.value}
                  onChange={() => onFiltersChange({ ...filters, dueDate: option.value })}
                  className="border-input"
                />
                {option.label}
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* 필터 초기화 */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={clearFilters}>
          <X className="h-3.5 w-3.5" />
          초기화
        </Button>
      )}
    </div>
  )
}
