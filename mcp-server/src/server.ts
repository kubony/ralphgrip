import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerWorkItemTools } from './tools/work-items.js'
import { registerProjectMetaTools } from './tools/project-meta.js'
import { registerAgentInfoTools } from './tools/agent-info.js'
import { registerLinkTools } from './tools/links.js'
import { registerSearchTools } from './tools/search.js'
import { registerPrompts } from './prompts/workflows.js'
import type { AgentContext } from './auth.js'

/**
 * Create and configure the MCP server with all tools registered.
 * AgentContext is null in legacy mode.
 */
export function createMcpServer(agentCtx: AgentContext | null): McpServer {
  const server = new McpServer({
    name: 'ralphgrip',
    version: '0.2.0',
  })

  // Register all tool modules
  registerAgentInfoTools(server, agentCtx)
  registerProjectMetaTools(server, agentCtx)
  registerWorkItemTools(server, agentCtx)
  registerLinkTools(server, agentCtx)
  registerSearchTools(server, agentCtx)
  registerPrompts(server)

  return server
}
