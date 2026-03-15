import Fastify from 'fastify'
import type { Orchestrator, OrchestratorSnapshot } from '../orchestrator.js'
import { createLogger } from '../logger.js'

const log = createLogger('status-api')

export async function createStatusServer(orchestrator: Orchestrator, port: number) {
  const app = Fastify({ logger: false })

  app.get('/api/v1/state', async () => {
    return orchestrator.getState()
  })

  app.post('/api/v1/refresh', async (_req, reply) => {
    orchestrator.onRefreshRequest?.()
    return reply.code(202).send({ message: 'Poll triggered' })
  })

  app.get('/health', async () => {
    return { status: 'ok', uptime: process.uptime() }
  })

  await app.listen({ port, host: '0.0.0.0' })
  log.info(`Status API listening on http://0.0.0.0:${port}`)

  return app
}
