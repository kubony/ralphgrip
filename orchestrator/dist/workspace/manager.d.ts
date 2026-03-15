interface WorkspaceHooks {
    after_create?: string;
    before_run?: string;
    after_run?: string;
    before_remove?: string;
}
interface WorkspaceManagerConfig {
    root: string;
    hooks?: WorkspaceHooks;
}
export declare class WorkspaceManager {
    private root;
    private hooks;
    constructor(config: WorkspaceManagerConfig);
    sanitizeKey(identifier: string): string;
    resolve(identifier: string): string;
    ensure(identifier: string): Promise<{
        path: string;
        created: boolean;
    }>;
    prepareForRun(identifier: string): Promise<string>;
    cleanupAfterRun(identifier: string): Promise<void>;
    remove(identifier: string): Promise<void>;
    private runHook;
}
export {};
