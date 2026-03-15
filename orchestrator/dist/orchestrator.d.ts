import { WorkflowLoader } from './workflow-loader.js';
import { SelfTrackerClient } from './tracker/self-client.js';
import { WorkspaceManager } from './workspace/manager.js';
export interface OrchestratorSnapshot {
    running: Array<{
        id: string;
        identifier: string;
        attempt: number;
        durationMs: number;
    }>;
    retrying: Array<{
        id: string;
        identifier: string;
        nextRetryAt: number;
    }>;
    tokenTotals: {
        input: number;
        output: number;
    };
}
export declare class Orchestrator {
    private loader;
    private tracker;
    private workspaceManager;
    private running;
    private claimed;
    private retryAttempts;
    private completed;
    private tokenTotals;
    private pollTimer;
    private stopping;
    onRefreshRequest: (() => void) | null;
    constructor(loader: WorkflowLoader, tracker: SelfTrackerClient, workspaceManager: WorkspaceManager);
    private get config();
    start(): Promise<void>;
    stop(): Promise<void>;
    poll(): Promise<void>;
    private reconcile;
    private dispatch;
    private handleContinuation;
    private scheduleRetry;
    getState(): OrchestratorSnapshot;
}
