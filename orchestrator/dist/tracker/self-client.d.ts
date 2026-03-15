export interface Issue {
    id: string;
    identifier: string;
    title: string;
    description: string | null;
    priority: number | null;
    state: string;
    created_at: string;
    updated_at: string;
}
interface SelfTrackerConfig {
    supabaseUrl: string;
    supabaseKey: string;
    projectId: string;
    activeStates: string[];
    terminalStates: string[];
}
export declare class SelfTrackerClient {
    private supabase;
    private projectId;
    private activeStates;
    private terminalStates;
    private cachedOwnerId;
    constructor(config: SelfTrackerConfig);
    private getProjectOwnerId;
    private resolveStatusId;
    fetchActiveIssues(): Promise<Issue[]>;
    fetchIssueStates(ids: string[]): Promise<Map<string, string>>;
    updateIssueStatus(id: string, statusName: string): Promise<void>;
    addComment(issueId: string, content: string): Promise<void>;
    isTerminalState(state: string): boolean;
    isActiveState(state: string): boolean;
}
export {};
