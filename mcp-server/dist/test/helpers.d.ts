import { type SupabaseClient } from '@supabase/supabase-js';
export declare function createTestSupabase(): SupabaseClient;
export interface TestProject {
    id: string;
    key: string;
    ownerId: string;
    trackerId: string;
    trackerName: string;
    statusIds: Map<string, string>;
}
export declare function createTestProject(supabase: SupabaseClient, opts?: {
    projectType?: 'issue' | 'requirement';
}): Promise<TestProject>;
export interface TestAgent {
    id: string;
    name: string;
}
export declare function createTestAgent(supabase: SupabaseClient, projectId: string): Promise<TestAgent>;
export declare function cleanupTestProject(supabase: SupabaseClient, projectId: string): Promise<void>;
