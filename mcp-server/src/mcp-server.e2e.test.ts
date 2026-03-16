import { describe, it, expect, afterEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'

let proc: ChildProcess | null = null

afterEach(() => {
  if (proc && !proc.killed) {
    proc.kill('SIGTERM')
    proc = null
  }
})

function sendJsonRpc(
  child: ChildProcess,
  method: string,
  params?: Record<string, unknown>,
  id = 1
): void {
  const msg = JSON.stringify({
    jsonrpc: '2.0',
    id,
    method,
    params: params ?? {},
  })
  child.stdin!.write(msg + '\n')
}

function waitForResponse(
  child: ChildProcess,
  timeoutMs = 10_000
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Response timeout')), timeoutMs)
    let buffer = ''

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const parsed = JSON.parse(trimmed)
          if (parsed.jsonrpc === '2.0' && parsed.id !== undefined) {
            clearTimeout(timer)
            child.stdout!.removeListener('data', onData)
            resolve(parsed)
            return
          }
        } catch {
          // not JSON yet
        }
      }
      // Keep last incomplete line
      buffer = lines[lines.length - 1]
    }

    child.stdout!.on('data', onData)
  })
}

describe('MCP Server — stdio E2E', () => {
  // ── Test 24: MCP 프로토콜 통신 ──
  it('stdio로 서버 시작 → JSON-RPC initialize → tools/list → 응답 파싱', async () => {
    const distPath = path.resolve(__dirname, '../dist/index.js')

    proc = spawn('node', [distPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // These should be loaded from .env.local via setup.ts
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        MADSPEED_PROJECT_ID: process.env.MADSPEED_PROJECT_ID || 'test-project-id',
      },
    })

    // Collect stderr for debugging
    let stderr = ''
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    // 1. Send initialize
    sendJsonRpc(proc, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '0.1.0' },
    })

    const initResponse = await waitForResponse(proc)
    expect(initResponse.result).toBeDefined()
    expect((initResponse.result as any).serverInfo?.name).toBe('agentgrip')

    // 2. Send initialized notification (no id)
    proc.stdin!.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }) + '\n')

    // 3. List tools
    sendJsonRpc(proc, 'tools/list', {}, 2)

    const toolsResponse = await waitForResponse(proc)
    expect(toolsResponse.result).toBeDefined()

    const tools = (toolsResponse.result as any).tools
    expect(Array.isArray(tools)).toBe(true)

    const toolNames = tools.map((t: any) => t.name)
    expect(toolNames).toContain('create_task')
    expect(toolNames).toContain('update_task')
    expect(toolNames).toContain('list_tasks')
    expect(toolNames).toContain('get_task')
    expect(toolNames).toContain('add_comment')
    expect(toolNames).toContain('get_project_meta')
  })
})
