export interface ClaudeRunnerConfig {
    model: string;
    maxTurns: number;
    turnTimeoutMs: number;
    stallTimeoutMs: number;
    allowedTools: string[];
}
export interface RunResult {
    success: boolean;
    result?: string;
    error?: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
    durationMs: number;
}
export declare class ClaudeRunner {
    private proc;
    private config;
    constructor(config: ClaudeRunnerConfig);
    run(prompt: string, cwd: string, opts?: {
        signal?: AbortSignal;
        continuation?: boolean;
    }): Promise<RunResult>;
    kill(): void;
}
