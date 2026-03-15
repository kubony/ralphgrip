#!/usr/bin/env node

import { parseArgs } from 'node:util'
import { WorkflowLoader } from './workflow-loader.js'
import { SelfTrackerClient } from './tracker/self-client.js'
import { WorkspaceManager } from './workspace/manager.js'
import { Orchestrator } from './orchestrator.js'
import { createStatusServer } from './server/api.js'
import { createLogger } from './logger.js'

const log = createLogger('main')

const { values } = parseArgs({
  options: {
    port: { type: 'string', short: 'p', default: '3456' },
    workflow: { type: 'string', short: 'w', default: './WORKFLOW.md' },
  },
  strict: false,
})

async function main() {
  const port = parseInt(values.port as string, 10)
  const workflowPath = values.workflow as string

  log.info('AgentGrip Orchestrator starting', { port, workflowPath })

  // 1. Load workflow config
  const loader = new WorkflowLoader(workflowPath)
  const config = loader.getConfig()

  // 2. Create tracker client
  const tracker = new SelfTrackerClient({
    supabaseUrl: config.tracker.supabase_url,
    supabaseKey: config.tracker.supabase_key,
    projectId: config.tracker.project_id,
    activeStates: config.tracker.active_states,
    terminalStates: config.tracker.terminal_states,
    agentId: process.env.AGENTGRIP_AGENT_ID,
  })

  // 3. Create workspace manager
  const workspaceManager = new WorkspaceManager({
    root: config.workspace.root,
    hooks: config.hooks,
  })

  // 4. Create orchestrator
  const orchestrator = new Orchestrator(loader, tracker, workspaceManager)

  // 5. Watch for config changes
  loader.onChange(() => {
    log.info('Workflow config changed, next poll will use new config')
  })

  // 6. Start status server
  await createStatusServer(orchestrator, port)

  // 7. Start orchestrator
  await orchestrator.start()

  log.info('AgentGrip Orchestrator is running', {
    statusApi: `http://localhost:${port}/api/v1/state`,
    polling: `${config.polling.interval_ms}ms`,
    maxConcurrent: config.agent.max_concurrent_agents,
  })
}

main().catch((err) => {
  log.error('Fatal error', { error: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
