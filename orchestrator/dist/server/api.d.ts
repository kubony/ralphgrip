import Fastify from 'fastify';
import type { Orchestrator } from '../orchestrator.js';
export declare function createStatusServer(orchestrator: Orchestrator, port: number): Promise<Fastify.FastifyInstance<import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, Fastify.FastifyBaseLogger, Fastify.FastifyTypeProviderDefault>>;
