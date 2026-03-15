import { type WorkflowConfig } from './config.js';
export declare class WorkflowLoader {
    private filePath;
    private config;
    private promptTemplate;
    private liquid;
    private watcher;
    private changeCallbacks;
    constructor(filePath: string);
    private load;
    getConfig(): WorkflowConfig;
    renderPrompt(vars: Record<string, unknown>): Promise<string>;
    onChange(cb: () => void): void;
    close(): void;
}
