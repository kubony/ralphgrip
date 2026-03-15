'use client'

import { Badge } from '@/components/ui/badge'
import { ActorAvatar } from '@/components/ui/actor-avatar'
import type { AgentStatus } from '@/types/database'

interface AgentCardProps {
  agent: {
    id: string
    name: string
    display_name: string
    avatar_url: string | null
    description: string | null
    agent_kind: string
    agent_role: string
    agent_model: string | null
    status: AgentStatus
    category: string
    owner?: { id: string; full_name: string | null; avatar_url: string | null } | null
  }
  onClick: () => void
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 border-green-200',
  inactive: 'bg-gray-500/10 text-gray-500 border-gray-200',
  revoked: 'bg-red-500/10 text-red-500 border-red-200',
}

const categoryLabels: Record<string, string> = {
  global: '글로벌',
  owned: '개인',
  restricted: '공유',
}

export function AgentCard({ agent, onClick }: AgentCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left w-full rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors space-y-3"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <ActorAvatar agent={agent} size="default" />
          <div>
            <div className="font-medium text-sm">{agent.display_name}</div>
            <div className="text-xs text-muted-foreground">{agent.name}</div>
          </div>
        </div>
        <Badge variant="outline" className={statusColors[agent.status] ?? ''}>
          {agent.status}
        </Badge>
      </div>

      {agent.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{agent.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-xs">{categoryLabels[agent.category] ?? agent.category}</Badge>
        <Badge variant="outline" className="text-xs">{agent.agent_role}</Badge>
        {agent.agent_model && <Badge variant="outline" className="text-xs">{agent.agent_model}</Badge>}
        <Badge variant="outline" className="text-xs">{agent.agent_kind}</Badge>
      </div>

      {agent.owner?.full_name && (
        <div className="text-xs text-muted-foreground">
          생성자: {agent.owner.full_name}
        </div>
      )}
    </button>
  )
}
