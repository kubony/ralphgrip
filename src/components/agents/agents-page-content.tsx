'use client'

import { useState, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AgentCard } from './agent-card'
import { CreateAgentDialog } from './create-agent-dialog'
import { AgentDetailDialog } from './agent-detail-dialog'
import { Button } from '@/components/ui/button'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Bot from 'lucide-react/dist/esm/icons/bot'
import type { AgentStatus, AgentCategory } from '@/types/database'

interface AgentRow {
  id: string
  name: string
  display_name: string
  avatar_url: string | null
  description: string | null
  agent_kind: string
  agent_model: string | null
  agent_role: string
  agent_runtime: string
  status: AgentStatus
  category: string
  owner_id: string | null
  project_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  owner?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

interface AgentsPageContentProps {
  initialAgents: AgentRow[]
}

export function AgentsPageContent({ initialAgents }: AgentsPageContentProps) {
  const [agents, setAgents] = useState<AgentRow[]>(initialAgents)
  const [selectedAgent, setSelectedAgent] = useState<AgentRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  const globalAgents = useMemo(() => agents.filter((a) => a.category === 'global'), [agents])
  const ownedAgents = useMemo(() => agents.filter((a) => a.category === 'owned'), [agents])
  const restrictedAgents = useMemo(() => agents.filter((a) => a.category === 'restricted'), [agents])
  const projectAgents = useMemo(() => agents.filter((a) => a.project_id !== null), [agents])

  const handleAgentClick = (agent: AgentRow) => {
    setSelectedAgent(agent)
    setDetailOpen(true)
  }

  const handleAgentCreated = (newAgent: AgentRow) => {
    setAgents((prev) => [...prev, newAgent])
  }

  const handleAgentUpdated = (updated: AgentRow) => {
    setAgents((prev) => prev.map((a) => a.id === updated.id ? updated : a))
    setSelectedAgent(updated)
  }

  const handleAgentDeleted = (id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id))
    setDetailOpen(false)
    setSelectedAgent(null)
  }

  const renderAgentGrid = (list: AgentRow[], emptyMessage: string) => {
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bot className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      )
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((agent) => (
          <AgentCard key={agent.id} agent={agent} onClick={() => handleAgentClick(agent)} />
        ))}
      </div>
    )
  }

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            에이전트를 생성하고 관리합니다. 프로젝트의 담당자로 할당할 수 있습니다.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          에이전트 생성
        </Button>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">전체 ({agents.length})</TabsTrigger>
          <TabsTrigger value="global">글로벌 ({globalAgents.length})</TabsTrigger>
          <TabsTrigger value="owned">내 에이전트 ({ownedAgents.length})</TabsTrigger>
          <TabsTrigger value="restricted">공유됨 ({restrictedAgents.length})</TabsTrigger>
          {projectAgents.length > 0 && (
            <TabsTrigger value="project">프로젝트 ({projectAgents.length})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all">
          {renderAgentGrid(agents, '등록된 에이전트가 없습니다.')}
        </TabsContent>
        <TabsContent value="global">
          {renderAgentGrid(globalAgents, '글로벌 에이전트가 없습니다.')}
        </TabsContent>
        <TabsContent value="owned">
          {renderAgentGrid(ownedAgents, '내가 생성한 에이전트가 없습니다.')}
        </TabsContent>
        <TabsContent value="restricted">
          {renderAgentGrid(restrictedAgents, '공유된 에이전트가 없습니다.')}
        </TabsContent>
        {projectAgents.length > 0 && (
          <TabsContent value="project">
            {renderAgentGrid(projectAgents, '프로젝트 에이전트가 없습니다.')}
          </TabsContent>
        )}
      </Tabs>

      <CreateAgentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleAgentCreated}
      />

      {selectedAgent && (
        <AgentDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          agent={selectedAgent}
          onUpdated={handleAgentUpdated}
          onDeleted={handleAgentDeleted}
        />
      )}
    </div>
  )
}
