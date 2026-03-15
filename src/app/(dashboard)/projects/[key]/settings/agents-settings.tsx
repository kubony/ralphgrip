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
  agent_kind: string
  agent_role: string
  agent_model: string | null
  agent_runtime: string
  status: AgentStatus
  api_key_prefix: string | null
  description: string | null
  created_at: string
}

interface AgentsSettingsProps {
  projectId: string
  initialAgents: Agent[]
}

const agentRoles = [
  { value: 'developer', label: 'Developer' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'tester', label: 'Tester' },
  { value: 'pm', label: 'PM' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'ai-researcher', label: 'AI Researcher' },
  { value: 'devops', label: 'DevOps' },
]

const agentModels = [
  { value: '', label: '미지정' },
  { value: 'claude-opus-4.6', label: 'Claude Opus 4.6' },
  { value: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'codex', label: 'Codex' },
  { value: 'deepseek-r1', label: 'DeepSeek R1' },
]

const agentKinds = [
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'openclaw', label: 'OpenClaw' },
  { value: 'aider', label: 'Aider' },
  { value: 'codex-cli', label: 'Codex CLI' },
  { value: 'custom', label: 'Custom' },
]

const agentRuntimes = [
  { value: 'local', label: 'Local' },
  { value: 'gcp-vm', label: 'GCP VM' },
  { value: 'gcp-cloud-run', label: 'GCP Cloud Run' },
  { value: 'aws-ec2', label: 'AWS EC2' },
  { value: 'edge', label: 'Edge Function' },
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
  const [agentKind, setAgentKind] = useState('claude-code')
  const [agentRole, setAgentRole] = useState('developer')
  const [agentModel, setAgentModel] = useState('')
  const [agentRuntime, setAgentRuntime] = useState('local')
  const [description, setDescription] = useState('')

  const resetForm = () => {
    setName('')
    setDisplayName('')
    setAgentKind('claude-code')
    setAgentRole('developer')
    setAgentModel('')
    setAgentRuntime('local')
    setDescription('')
  }

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
        agent_kind: agentKind,
        agent_role: agentRole,
        agent_model: agentModel || undefined,
        agent_runtime: agentRuntime,
        description: description.trim() || undefined,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        setNewApiKey(result.apiKey ?? null)
        resetForm()
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

  const getLabelForValue = (options: { value: string; label: string }[], value: string | null) =>
    options.find((o) => o.value === value)?.label ?? value

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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>내부 이름</Label>
                    <Input placeholder="예: openclaw-coder-1" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>표시명</Label>
                    <Input placeholder="예: OpenClaw 코더" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>역할</Label>
                    <Select value={agentRole} onValueChange={setAgentRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {agentRoles.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>AI 모델</Label>
                    <Select value={agentModel} onValueChange={setAgentModel}>
                      <SelectTrigger><SelectValue placeholder="미지정" /></SelectTrigger>
                      <SelectContent>
                        {agentModels.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>종류</Label>
                    <Select value={agentKind} onValueChange={setAgentKind}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {agentKinds.map((k) => (
                          <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>실행환경</Label>
                    <Select value={agentRuntime} onValueChange={setAgentRuntime}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {agentRuntimes.map((rt) => (
                          <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
              <TableHead>설정</TableHead>
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
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">{getLabelForValue(agentRoles, agent.agent_role)}</Badge>
                    {agent.agent_model && <Badge variant="secondary" className="text-xs">{getLabelForValue(agentModels, agent.agent_model)}</Badge>}
                    <Badge variant="outline" className="text-xs">{getLabelForValue(agentKinds, agent.agent_kind)}</Badge>
                    <Badge variant="outline" className="text-xs">{getLabelForValue(agentRuntimes, agent.agent_runtime)}</Badge>
                  </div>
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
