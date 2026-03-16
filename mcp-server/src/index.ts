#!/usr/bin/env node
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createMcpServer } from './server.js'
import { validateApiKey } from './auth.js'
import type { AgentContext } from './auth.js'
import { isApiKeyMode } from './supabase.js'

// ── CLI argument parsing ──
const args = process.argv.slice(2)
const transportMode = getArg(args, '--transport') || 'stdio'
const httpPort = parseInt(getArg(args, '--port') || '3001', 10)

function getArg(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag)
  return idx !== -1 && idx + 1 < argv.length ? argv[idx + 1] : undefined
}

async function main() {
  // Proxy mode: RALPHGRIP_URL set → forward stdio to remote HTTP server
  if (process.env.RALPHGRIP_URL && transportMode === 'stdio') {
    await startProxyClient()
    return
  }

  if (transportMode === 'http') {
    await startHttpServer(httpPort)
  } else {
    await startStdioServer()
  }
}

// ── Stdio Transport (direct Supabase) ──
async function startStdioServer() {
  let agentCtx: AgentContext | null = null

  if (isApiKeyMode()) {
    agentCtx = await validateApiKey(process.env.RALPHGRIP_API_KEY!)
    if (!agentCtx) {
      console.error('Invalid API key. Exiting.')
      process.exit(1)
    }
    console.error(`Authenticated as ${agentCtx.displayName} (${agentCtx.agentKind}/${agentCtx.agentRole})`)
  } else {
    console.error('Running in legacy mode (MADSPEED_PROJECT_ID + MADSPEED_AGENT_ID)')
  }

  const server = createMcpServer(agentCtx)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// ── Stdio → HTTP Proxy Client ──
async function startProxyClient() {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js')

  const serverUrl = process.env.RALPHGRIP_URL!
  const apiKey = process.env.RALPHGRIP_API_KEY

  if (!apiKey) {
    console.error('RALPHGRIP_API_KEY is required when using RALPHGRIP_URL proxy mode.')
    process.exit(1)
  }

  console.error(`Proxy mode: connecting to ${serverUrl}/mcp`)

  const url = new URL('/mcp', serverUrl)
  const httpTransport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    },
  })

  // Create a local MCP client that connects to the remote server
  const client = new Client({ name: 'ralphgrip-proxy', version: '0.2.0' })
  await client.connect(httpTransport)

  // Now create a local stdio server that proxies to the remote
  const localServer = createMcpServer(null)
  const stdioTransport = new StdioServerTransport()

  // Override: intercept local tool calls and forward to remote
  // Instead of complex proxying, use a simpler approach:
  // Just pipe stdin/stdout through the HTTP transport
  console.error('Connected. Proxying MCP messages...')

  // The simplest proxy: read from stdin, send to HTTP, write response to stdout
  // MCP SDK handles the framing for us via transports

  // Register proxy tools that mirror the remote server's capabilities
  const remoteTools = await client.listTools()
  const remotePrompts = await client.listPrompts()

  // For each remote tool, register a local proxy
  for (const tool of remoteTools.tools) {
    localServer.tool(
      tool.name,
      tool.description || '',
      {},
      async (args: Record<string, unknown>) => {
        const result = await client.callTool({ name: tool.name, arguments: args })
        const content = result.content as Array<{ type: 'text'; text: string }>
        if (result.isError) {
          return { content, isError: true as const }
        }
        return { content }
      }
    )
  }

  // Proxy prompts
  for (const prompt of remotePrompts.prompts) {
    localServer.prompt(
      prompt.name,
      prompt.description || '',
      async () => {
        const result = await client.getPrompt({ name: prompt.name })
        return {
          messages: result.messages as Array<{
            role: 'user' | 'assistant'
            content: { type: 'text'; text: string }
          }>,
        }
      }
    )
  }

  await localServer.connect(stdioTransport)
}

// ── HTTP Transport (Streamable HTTP, multi-user) ──

interface SessionEntry {
  transport: StreamableHTTPServerTransport
  agentCtx: AgentContext | null
  createdAt: number
  lastActivity: number
}

const MAX_SESSIONS = 50
const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

interface RateEntry {
  count: number
  resetAt: number
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 60

const sessions = new Map<string, SessionEntry>()
const rateLimits = new Map<string, RateEntry>()

function cleanupSessions() {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      session.transport.close()
      sessions.delete(id)
    }
  }
}

function checkRateLimit(clientId: string): boolean {
  const now = Date.now()
  let entry = rateLimits.get(clientId)
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }
    rateLimits.set(clientId, entry)
  }
  entry.count++
  return entry.count <= RATE_LIMIT_MAX
}

/** Extract API key from Authorization header */
function extractApiKey(req: IncomingMessage): string | null {
  const auth = req.headers['authorization']
  if (!auth) return null
  const match = auth.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

async function startHttpServer(port: number) {
  setInterval(cleanupSessions, 5 * 60_000)

  console.error('HTTP mode: per-session API Key authentication enabled')

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`)

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id')
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Health check
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', sessions: sessions.size, uptime: process.uptime() }))
      return
    }

    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found. Use /mcp endpoint.' }))
      return
    }

    // Rate limiting
    const clientIp = req.socket.remoteAddress || 'unknown'
    if (!checkRateLimit(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Rate limit exceeded. Max 60 requests per minute.' }))
      return
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined

    // ── New session (POST without session ID) ──
    if (!sessionId && req.method === 'POST') {
      if (sessions.size >= MAX_SESSIONS) {
        cleanupSessions()
        if (sessions.size >= MAX_SESSIONS) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Server at capacity. Try again later.' }))
          return
        }
      }

      // Per-session API Key authentication
      const apiKey = extractApiKey(req)
      let agentCtx: AgentContext | null = null

      if (apiKey) {
        agentCtx = await validateApiKey(apiKey)
        if (!agentCtx) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid API key.' }))
          return
        }
      } else {
        // No API key: reject in HTTP mode (security requirement)
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Authorization header required. Use: Bearer ag_xxx' }))
        return
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      })

      const server = createMcpServer(agentCtx)
      await server.connect(transport)

      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId)
        }
      }

      await transport.handleRequest(req, res)

      if (transport.sessionId) {
        sessions.set(transport.sessionId, {
          transport,
          agentCtx,
          createdAt: Date.now(),
          lastActivity: Date.now(),
        })
      }
      return
    }

    // ── Existing session ──
    if (sessionId) {
      const session = sessions.get(sessionId)
      if (!session) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Session not found or expired.' }))
        return
      }
      session.lastActivity = Date.now()
      await session.transport.handleRequest(req, res)
      return
    }

    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Missing Authorization header or mcp-session-id.' }))
  })

  httpServer.listen(port, () => {
    console.error(`RalphGrip MCP HTTP server listening on port ${port}`)
    console.error(`  Endpoint: http://localhost:${port}/mcp`)
    console.error(`  Health:   http://localhost:${port}/health`)
    console.error(`  Auth:     Authorization: Bearer ag_xxx (per-session)`)
    console.error(`  Sessions: max ${MAX_SESSIONS}, TTL ${SESSION_TTL_MS / 60000}min`)
  })
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
