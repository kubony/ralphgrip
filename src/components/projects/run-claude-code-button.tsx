'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Terminal from 'lucide-react/dist/esm/icons/terminal'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Check from 'lucide-react/dist/esm/icons/check'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import type { WorkItemWithRelations } from '@/types/database'
import { getAgentSystemPrompt } from '@/app/(dashboard)/projects/[key]/prompt-actions'
import { priorityLabel } from '@/lib/export-utils'

const AGENT_ROLES = [
  { value: 'developer', label: 'Developer' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'tester', label: 'Tester' },
  { value: 'pm', label: 'PM' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'architect', label: 'Architect' },
  { value: 'security', label: 'Security' },
  { value: 'db-optimizer', label: 'DB Optimizer' },
  { value: 'ux-designer', label: 'UX Designer' },
  { value: 'technical-writer', label: 'Technical Writer' },
  { value: 'orchestrator', label: 'Orchestrator' },
  { value: 'ai-researcher', label: 'AI Researcher' },
  { value: 'devops', label: 'DevOps' },
] as const

const MAX_PROMPT_BYTES = 30 * 1024 // 30KB
const DESC_LIMIT = 500
const DESC_FALLBACK_LIMIT = 200

interface RunClaudeCodeButtonProps {
  projectKey: string
  projectId: string
  workItems: WorkItemWithRelations[]
}

function getActiveTasks(workItems: WorkItemWithRelations[]) {
  return workItems
    .filter((item) => {
      if (item.status?.is_closed) return false
      if (item.tracker?.name === 'Folder') return false
      return true
    })
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}

function formatDueDate(date: string | null): string {
  if (!date) return '-'
  return date.slice(0, 10)
}

function buildTaskSection(
  tasks: WorkItemWithRelations[],
  projectKey: string,
  descLimit: number,
): string {
  if (tasks.length === 0) return ''
  const lines: string[] = [`## Active Tasks (${tasks.length} items)\n`]
  tasks.forEach((task, i) => {
    const key = task.number
      ? `${projectKey}-${task.number}`
      : `#${i + 1}`
    lines.push(`### Task ${i + 1}: [${key}] ${task.title}`)
    lines.push(`- **상태**: ${task.status?.name ?? '-'}`)
    lines.push(`- **우선순위**: ${priorityLabel(task.priority ?? 0)}`)
    lines.push(`- **담당자**: ${task.assignee?.full_name ?? task.agent_assignee?.display_name ?? '-'}`)
    lines.push(`- **마감일**: ${formatDueDate(task.due_date)}`)
    if (task.description && descLimit > 0) {
      const desc = task.description.length > descLimit
        ? task.description.slice(0, descLimit) + '...'
        : task.description
      lines.push(`- **설명**: ${desc}`)
    }
    lines.push('')
  })
  return lines.join('\n')
}

function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''")
}

function buildClaudeCommand(
  systemPrompt: string,
  tasks: WorkItemWithRelations[],
  projectKey: string,
  projectId: string,
): string {
  const header = `You are working on the AgentGrip project "${projectKey}" (ID: ${projectId}).`
  const instructions = `## Instructions
1. Execute each task in priority order (긴급 > 높음 > 보통 > 낮음).
2. Use /ralph to execute all tasks autonomously until completion.`

  let taskSection = buildTaskSection(tasks, projectKey, DESC_LIMIT)
  let prompt = [
    systemPrompt ? `<system>\n${systemPrompt}\n</system>\n` : '',
    header,
    '',
    taskSection,
    instructions,
    '',
    '/ralph',
  ].filter(Boolean).join('\n')

  // Check size and trim if needed
  const byteSize = new TextEncoder().encode(prompt).length
  if (byteSize > MAX_PROMPT_BYTES) {
    // Try shorter descriptions
    taskSection = buildTaskSection(tasks, projectKey, DESC_FALLBACK_LIMIT)
    prompt = [
      systemPrompt ? `<system>\n${systemPrompt}\n</system>\n` : '',
      header,
      '',
      taskSection,
      instructions,
      '',
      '/ralph',
    ].filter(Boolean).join('\n')

    // If still too large, strip descriptions entirely
    const reducedSize = new TextEncoder().encode(prompt).length
    if (reducedSize > MAX_PROMPT_BYTES) {
      taskSection = buildTaskSection(tasks, projectKey, 0)
      prompt = [
        systemPrompt ? `<system>\n${systemPrompt}\n</system>\n` : '',
        header,
        '',
        taskSection,
        instructions,
        '',
        '/ralph',
      ].filter(Boolean).join('\n')
    }
  }

  return `claude -p '${shellEscape(prompt)}'`
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for HTTP environments
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  }
}

export function RunClaudeCodeButton({
  projectKey,
  projectId,
  workItems,
}: RunClaudeCodeButtonProps) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState('developer')
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const activeTasks = getActiveTasks(workItems)

  const handleOpen = useCallback(() => {
    if (activeTasks.length === 0) {
      toast.error('활성 태스크가 없습니다.')
      return
    }
    setCommand('')
    setCopied(false)
    setOpen(true)
  }, [activeTasks.length])

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setCopied(false)
    try {
      const systemPrompt = await getAgentSystemPrompt(role)
      const cmd = buildClaudeCommand(systemPrompt, activeTasks, projectKey, projectId)
      setCommand(cmd)
    } catch {
      toast.error('명령어 생성에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [role, activeTasks, projectKey, projectId])

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(command)
    if (ok) {
      setCopied(true)
      toast.success('클립보드에 복사했습니다.')
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error('클립보드 복사에 실패했습니다.')
    }
  }, [command])

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="gap-1.5"
      >
        <Terminal className="h-4 w-4" />
        <span className="hidden sm:inline">Claude Code</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Claude Code 실행</DialogTitle>
            <DialogDescription>
              에이전트 역할을 선택하고 CLI 명령어를 생성합니다. 활성 태스크: {activeTasks.length}개
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-sm font-medium">에이전트 역할</label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGenerate} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                명령어 생성
              </Button>
            </div>

            {command && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">생성된 명령어</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="gap-1.5"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? '복사됨' : '복사'}
                  </Button>
                </div>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-80 whitespace-pre-wrap break-all">
                  {command}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
