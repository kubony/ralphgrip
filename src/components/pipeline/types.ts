import type { ProjectSettings, PipelinePhase, PipelineCategory } from '@/types/database'

export interface PipelineMember {
  name: string | null
  avatar_url: string | null
}

export interface PipelineProject {
  id: string
  key: string
  name: string
  projectType: string
  startDate: string | null
  endDate: string | null
  budget: string | null
  phase: PipelinePhase
  category: PipelineCategory | 'uncategorized'
  note: string | null
  itemCount: number
  closedCount: number
  memberCount: number
  members: PipelineMember[]
  ownerName: string | null
  ownerAvatarUrl: string | null
  settings: ProjectSettings
}

export const PHASE_CONFIG: Record<PipelinePhase, { label: string; color: string; bgColor: string }> = {
  prospect: { label: '잠재', color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  sales: { label: '영업중', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  contracted: { label: '계약', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  active: { label: '수행중', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  delivered: { label: '수행완료', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  settled: { label: '정산완료', color: 'text-green-700 dark:text-green-500', bgColor: 'bg-green-50 dark:bg-green-900/20' },
}

export type PipelineCategoryOrUncategorized = PipelineCategory | 'uncategorized'

export const CATEGORY_CONFIG: Record<PipelineCategoryOrUncategorized, { label: string; color: string; bgColor: string }> = {
  internal: { label: '자체 프로젝트', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
  government: { label: '정부과제', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-900/20' },
  contract: { label: '용역개발', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20' },
  uncategorized: { label: '미분류', color: 'text-gray-500 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-800/50' },
}

export const CATEGORY_ORDER: PipelineCategoryOrUncategorized[] = ['contract', 'government', 'internal', 'uncategorized']

export const CATEGORIES: PipelineCategory[] = ['internal', 'government', 'contract']

// Hex colors for inline styles (Gantt bars)
export const PHASE_HEX_COLORS: Record<PipelinePhase, string> = {
  prospect: '#9ca3af',
  sales: '#3b82f6',
  contracted: '#a855f7',
  active: '#f59e0b',
  delivered: '#22c55e',
  settled: '#16a34a',
}
