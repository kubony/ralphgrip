'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { ActorAvatar } from '@/components/ui/actor-avatar'
import { updateGlobalAgent, deleteGlobalAgent, getAgentLogs } from '@/app/(dashboard)/agents/actions'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import type { AgentStatus, AgentLogEntry } from '@/types/database'

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

interface AgentDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent: AgentRow
  onUpdated: (agent: AgentRow) => void
  onDeleted: (id: string) => void
}

export function AgentDetailDialog({ open, onOpenChange, agent, onUpdated, onDeleted }: AgentDetailDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [logs, setLogs] = useState<AgentLogEntry[]>([])
  const [editMode, setEditMode] = useState(false)
  const [displayName, setDisplayName] = useState(agent.display_name)
  const [description, setDescription] = useState(agent.description ?? '')
  const [status, setStatus] = useState(agent.status)

  useEffect(() => {
    if (open) {
      getAgentLogs(agent.id).then((result) => {
        if (result.data) setLogs(result.data as AgentLogEntry[])
      })
    }
  }, [open, agent.id])

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateGlobalAgent(agent.id, {
        display_name: displayName,
        description: description || undefined,
        status,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('에이전트를 수정했습니다.')
        onUpdated({ ...agent, display_name: displayName, description, status })
        setEditMode(false)
      }
    })
  }

  const handleDelete = () => {
    if (!confirm(`"${agent.display_name}" 에이전트를 삭제하시겠습니까?`)) return

    startTransition(async () => {
      const result = await deleteGlobalAgent(agent.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('에이전트를 삭제했습니다.')
        onDeleted(agent.id)
      }
    })
  }

  const formatDate = (d: string) => new Date(d).toLocaleString('ko-KR')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <ActorAvatar agent={agent} size="default" />
            <div>
              <div>{agent.display_name}</div>
              <div className="text-xs text-muted-foreground font-normal">{agent.name}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">카테고리</span>
              <div><Badge variant="secondary">{agent.category}</Badge></div>
            </div>
            <div>
              <span className="text-muted-foreground">상태</span>
              <div>
                {editMode ? (
                  <Select value={status} onValueChange={(v) => setStatus(v as AgentStatus)}>
                    <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="revoked">Revoked</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline">{agent.status}</Badge>
                )}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">역할</span>
              <div>{agent.agent_role}</div>
            </div>
            <div>
              <span className="text-muted-foreground">종류</span>
              <div>{agent.agent_kind}</div>
            </div>
            <div>
              <span className="text-muted-foreground">모델</span>
              <div>{agent.agent_model || '미지정'}</div>
            </div>
            <div>
              <span className="text-muted-foreground">실행환경</span>
              <div>{agent.agent_runtime}</div>
            </div>
          </div>

          {editMode && (
            <>
              <div className="space-y-2">
                <Label>표시명</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>설명</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </>
          )}

          {agent.description && !editMode && (
            <div>
              <span className="text-sm text-muted-foreground">설명</span>
              <p className="text-sm mt-1">{agent.description}</p>
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-1">
            <div>생성: {formatDate(agent.created_at)}</div>
            <div>수정: {formatDate(agent.updated_at)}</div>
            {agent.owner?.full_name && <div>생성자: {agent.owner.full_name}</div>}
          </div>

          <div className="flex gap-2">
            {editMode ? (
              <>
                <Button size="sm" onClick={handleSave} disabled={isPending}>저장</Button>
                <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>취소</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>수정</Button>
                <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isPending} className="gap-1">
                  <Trash2 className="h-3.5 w-3.5" />
                  삭제
                </Button>
              </>
            )}
          </div>

          {/* 활동 로그 */}
          {logs.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">활동 로그</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.id} className="text-xs border rounded px-3 py-2">
                      <div className="flex justify-between">
                        <span className="font-medium">{log.action}</span>
                        <span className="text-muted-foreground">{formatDate(log.created_at)}</span>
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <pre className="mt-1 text-muted-foreground whitespace-pre-wrap">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
