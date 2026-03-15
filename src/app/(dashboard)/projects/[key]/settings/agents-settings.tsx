'use client'

import { useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import {
  getAgents, createAgent, updateAgent, deleteAgent, regenerateAgentApiKey
} from '../actions'
import { ActorAvatar } from '@/components/ui/actor-avatar'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import RotateCw from 'lucide-react/dist/esm/icons/rotate-cw'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Key from 'lucide-react/dist/esm/icons/key'
import type { AgentStatus } from '@/types/database'

interface Agent {
  id: string
  name: string
  display_name: string
  avatar_url: string | null
  agent_type: string
  status: AgentStatus
  api_key_prefix: string | null
  description: string | null
  created_at: string
}

interface AgentsSettingsProps {
  projectId: string
  initialAgents: Agent[]
}

const agentTypes = [
  { value: 'mcp', label: 'MCP' },
  { value: 'openclaw', label: 'OpenClaw' },
  { value: 'orchestrator', label: 'Orchestrator' },
  { value: 'custom', label: 'Custom' },
]

export function AgentsSettings({ projectId, initialAgents }: AgentsSettingsProps) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents)
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const confirm = useConfirmDialog()

  // Form state
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [agentType, setAgentType] = useState('mcp')
  const [description, setDescription] = useState('')

  const loadAgents = useCallback(async () => {
    const result = await getAgents(projectId)
    if (result.data) setAgents(result.data as Agent[])
  }, [projectId])

  const handleCreate = () => {
    if (!name.trim() || !displayName.trim()) {
      toast.error('이름과 표시명을 입력하세요.')
      return
    }

    startTransition(async () => {
      const result = await createAgent(projectId, {
        name: name.trim(),
        display_name: displayName.trim(),
        agent_type: agentType,
        description: description.trim() || undefined,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        setNewApiKey(result.apiKey ?? null)
        setName('')
        setDisplayName('')
        setDescription('')
        setAgentType('mcp')
        await loadAgents()
        if (!result.apiKey) setDialogOpen(false)
      }
    })
  }

  const handleDelete = async (agent: Agent) => {
    const confirmed = await confirm({
      title: '에이전트 삭제',
      description: `"${agent.display_name}" 에이전트를 삭제하시겠습니까? 관련된 댓글과 로그에서 에이전트 정보가 사라집니다.`,
      actionLabel: '삭제',
      cancelLabel: '취소',
      variant: 'destructive',
    })
    if (!confirmed) return

    startTransition(async () => {
      const result = await deleteAgent(agent.id, projectId)
      if (result.error) {
        toast.error(result.error)
      } else {
        setAgents((prev) => prev.filter((a) => a.id !== agent.id))
      }
    })
  }

  const handleStatusChange = (agent: Agent, status: string) => {
    startTransition(async () => {
      const result = await updateAgent(agent.id, projectId, { status })
      if (result.error) {
        toast.error(result.error)
      } else {
        setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, status: status as AgentStatus } : a))
      }
    })
  }

  const handleRegenerateKey = async (agent: Agent) => {
    const confirmed = await confirm({
      title: 'API 키 재생성',
      description: `"${agent.display_name}"의 API 키를 재생성하시겠습니까? 기존 키는 즉시 무효화됩니다.`,
      actionLabel: '재생성',
      cancelLabel: '취소',
      variant: 'destructive',
    })
    if (!confirmed) return

    startTransition(async () => {
      const result = await regenerateAgentApiKey(agent.id, projectId)
      if (result.error) {
        toast.error(result.error)
      } else if (result.apiKey) {
        setNewApiKey(result.apiKey)
        await loadAgents()
      }
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('클립보드에 복사했습니다.')
  }

  return (
    <section id="agents" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Agents</h3>
          <p className="text-sm text-muted-foreground">
            프로젝트에 연결된 AI 에이전트를 관리합니다.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setNewApiKey(null) }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              에이전트 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{newApiKey ? 'API 키 생성 완료' : '에이전트 추가'}</DialogTitle>
            </DialogHeader>
            {newApiKey ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  아래 API 키는 한 번만 표시됩니다. 안전한 곳에 저장하세요.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-xs break-all">
                    {newApiKey}
                  </code>
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(newApiKey)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button className="w-full" onClick={() => { setDialogOpen(false); setNewApiKey(null) }}>
                  확인
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>내부 이름</Label>
                  <Input placeholder="예: openclaw-coder-1" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>표시명</Label>
                  <Input placeholder="예: OpenClaw 코더" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>타입</Label>
                  <Select value={agentType} onValueChange={setAgentType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {agentTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>설명 (선택)</Label>
                  <Input placeholder="에이전트 역할 설명" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={isPending}>생성</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {agents.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4">등록된 에이전트가 없습니다.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>에이전트</TableHead>
              <TableHead>타입</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>API 키</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ActorAvatar agent={agent} size="sm" />
                    <div>
                      <div className="text-sm font-medium">{agent.display_name}</div>
                      <div className="text-xs text-muted-foreground">{agent.name}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{agent.agent_type}</Badge>
                </TableCell>
                <TableCell>
                  <Select value={agent.status} onValueChange={(v) => handleStatusChange(agent, v)}>
                    <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="revoked">Revoked</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Key className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-mono">{agent.api_key_prefix || '—'}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRegenerateKey(agent)} disabled={isPending} title="키 재생성">
                      <RotateCw className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(agent)} disabled={isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
