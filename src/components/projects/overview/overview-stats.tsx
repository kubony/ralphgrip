'use client'

import { AnimatedCard } from '@/components/ui/animated-card'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { listContainerVariants } from '@/lib/motion'
import { motion } from 'framer-motion'
import ListChecks from 'lucide-react/dist/esm/icons/list-checks'
import Clock from 'lucide-react/dist/esm/icons/clock'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'

interface OverviewStatsProps {
  total: number
  inProgress: number
  completed: number
  overdue: number
}

export function OverviewStats({ total, inProgress, completed, overdue }: OverviewStatsProps) {
  const stats = [
    {
      label: '전체 작업',
      value: total,
      icon: ListChecks,
      color: '',
    },
    {
      label: '진행 중',
      value: inProgress,
      icon: Clock,
      color: 'text-blue-600',
    },
    {
      label: '완료',
      value: completed,
      icon: CheckCircle2,
      color: 'text-green-600',
    },
    {
      label: '마감 초과',
      value: overdue,
      icon: AlertTriangle,
      color: overdue > 0 ? 'text-red-600' : '',
      highlight: overdue > 0,
    },
  ]

  return (
    <motion.div
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      variants={listContainerVariants}
      initial="initial"
      animate="animate"
    >
      {stats.map((stat, index) => (
        <AnimatedCard
          key={stat.label}
          delay={index * 0.04}
          enableHoverLift
          className={cn(stat.highlight && 'border-red-200 dark:border-red-900')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
            <stat.icon className={cn('h-4 w-4 text-muted-foreground', stat.color)} />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', stat.color)}>
              {stat.value}
            </div>
            {stat.label === '완료' && total > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round((completed / total) * 100)}% 완료율
              </p>
            )}
          </CardContent>
        </AnimatedCard>
      ))}
    </motion.div>
  )
}
