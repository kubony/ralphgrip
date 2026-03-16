'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listApiKeys, generateApiKey, revokeApiKey, type ApiKeyInfo } from './actions'
import Key from 'lucide-react/dist/esm/icons/key'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Check from 'lucide-react/dist/esm/icons/check'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'

export function ApiKeysSettings() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const loadKeys = useCallback(async () => {
    setLoading(true)
    const result = await listApiKeys()
    setKeys(result.keys)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadKeys()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate() {
    if (!name.trim() || !displayName.trim()) return
    setCreating(true)
    const result = await generateApiKey({ name: name.trim(), displayName: displayName.trim() })
    setCreating(false)

    if (result.error) {
      alert(result.error)
      return
    }

    setNewKey(result.apiKey!)
    setShowCreate(false)
    setName('')
    setDisplayName('')
    await loadKeys()
  }

  async function handleRevoke(agentId: string) {
    if (!confirm('이 API Key를 폐기하시겠습니까? 이 키를 사용하는 에이전트는 더 이상 접속할 수 없습니다.')) return
    setRevoking(agentId)
    const result = await revokeApiKey(agentId)
    setRevoking(null)
    if (result.error) {
      alert(result.error)
      return
    }
    await loadKeys()
  }

  function handleCopy() {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <section id="api-keys">
      <h2 className="text-base font-semibold mb-1">API Keys</h2>
      <p className="text-sm text-muted-foreground mb-4">
        MCP 서버에 접속하기 위한 API Key를 발급합니다. 키는 생성 시 한 번만 표시됩니다.
      </p>

      {/* New key banner */}
      {newKey && (
        <div className="mb-4 p-4 rounded-lg border border-amber-500/50 bg-amber-500/10">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">API Key가 생성되었습니다. 이 키를 안전한 곳에 복사해주세요. 다시 볼 수 없습니다.</p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 text-xs bg-background p-2 rounded border font-mono break-all select-all">
              {newKey}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setNewKey(null)}>
            확인 완료
          </Button>
        </div>
      )}

      {/* Create form */}
      {showCreate ? (
        <div className="mb-4 p-4 rounded-lg border space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="key-name" className="text-sm">이름 (식별자)</Label>
            <Input
              id="key-name"
              placeholder="my-agent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="key-display" className="text-sm">표시 이름</Label>
            <Input
              id="key-display"
              placeholder="My Claude Agent"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={creating || !name.trim() || !displayName.trim()}>
              {creating ? '생성 중...' : '생성'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setName(''); setDisplayName('') }}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreate(true)}
          className="mb-4"
        >
          <Plus className="h-4 w-4 mr-1" />
          새 API Key 생성
        </Button>
      )}

      {/* Key list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      ) : keys.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">아직 API Key가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{key.display_name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    key.status === 'active' ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    {key.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-xs text-muted-foreground font-mono">{key.api_key_prefix}••••••</code>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(key.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRevoke(key.id)}
                disabled={revoking === key.id}
                className="text-destructive hover:text-destructive shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Usage guide */}
      {keys.length > 0 && (
        <details className="mt-4">
          <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
            사용 방법
          </summary>
          <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs font-mono whitespace-pre">{`// claude_desktop_config.json
{
  "mcpServers": {
    "ralphgrip": {
      "command": "npx",
      "args": ["@ralphgrip/mcp-server"],
      "env": {
        "RALPHGRIP_URL": "${process.env.NEXT_PUBLIC_APP_URL || 'http://34.50.15.61'}:3001",
        "RALPHGRIP_API_KEY": "ag_your_key_here"
      }
    }
  }
}`}</div>
        </details>
      )}
    </section>
  )
}
