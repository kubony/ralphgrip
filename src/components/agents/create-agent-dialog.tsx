'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { createGlobalAgent } from '@/app/(dashboard)/agents/actions'
import Copy from 'lucide-react/dist/esm/icons/copy'
import type { AgentCategory } from '@/types/database'

interface CreateAgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreated: (agent: any) => void
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

const categoryOptions = [
  { value: 'global', label: '글로벌', description: '모든 사용자가 사용 가능' },
  { value: 'owned', label: '개인', description: '나만 사용 가능' },
  { value: 'restricted', label: '공유', description: '권한 부여한 사용자만 사용 가능' },
]

export function CreateAgentDialog({ open, onOpenChange, onCreated }: CreateAgentDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [newApiKey, setNewApiKey] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [category, setCategory] = useState<AgentCategory>('global')
  const [agentKind, setAgentKind] = useState('claude-code')
  const [agentRole, setAgentRole] = useState('developer')
  const [agentModel, setAgentModel] = useState('')
  const [agentRuntime, setAgentRuntime] = useState('local')
  const [description, setDescription] = useState('')

  const resetForm = () => {
    setName('')
    setDisplayName('')
    setCategory('global')
    setAgentKind('claude-code')
    setAgentRole('developer')
    setAgentModel('')
    setAgentRuntime('local')
    setDescription('')
    setNewApiKey(null)
  }

  const handleCreate = () => {
    if (!name.trim() || !displayName.trim()) {
      toast.error('이름과 표시명을 입력하세요.')
      return
    }

    startTransition(async () => {
      const result = await createGlobalAgent({
        name: name.trim(),
        display_name: displayName.trim(),
        category,
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
        if (result.data) {
          onCreated(result.data)
        }
        if (!result.apiKey) {
          resetForm()
          onOpenChange(false)
        }
      }
    })
  }

  const handleClose = (open: boolean) => {
    if (!open) resetForm()
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{newApiKey ? 'API 키 생성 완료' : '에이전트 생성'}</DialogTitle>
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
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(newApiKey)
                  toast.success('클립보드에 복사했습니다.')
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button className="w-full" onClick={() => handleClose(false)}>
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

            <div className="space-y-2">
              <Label>카테고리</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as AgentCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span>{c.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">— {c.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <Button className="w-full" onClick={handleCreate} disabled={isPending}>
              {isPending ? '생성 중...' : '생성'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
