'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ChartWrapperProps {
  title: string
  headerAction?: React.ReactNode
  children: React.ReactNode
  className?: string
  isEmpty?: boolean
  emptyMessage?: string
}

export function ChartWrapper({ title, headerAction, children, className, isEmpty, emptyMessage = '데이터가 없습니다.' }: ChartWrapperProps) {
  return (
    <Card className={cn('flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md', className)}>
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {headerAction}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {isEmpty ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
