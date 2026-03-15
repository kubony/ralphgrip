import Fastify from 'fastify';
import { createLogger } from '../logger.js';
const log = createLogger('status-api');
export async function createStatusServer(orchestrator, port) {
    const app = Fastify({ logger: false });
    app.get('/api/v1/state', async () => {
        return orchestrator.getState();
    });
    app.post('/api/v1/refresh', async (_req, reply) => {
        orchestrator.onRefreshRequest?.();
        return reply.code(202).send({ message: 'Poll triggered' });
    });
    app.get('/health', async () => {
        return { status: 'ok', uptime: process.uptime() };
    });
    await app.listen({ port, host: '0.0.0.0' });
    log.info(`Status API listening on http://0.0.0.0:${port}`);
    return app;
}
//# sourceMappingURL=api.js.map