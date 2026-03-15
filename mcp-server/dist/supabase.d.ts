export declare const supabase: import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
export declare function getProjectId(): string;
export declare function getProjectOwnerId(): Promise<string>;
/**
 * Returns { profileId, agentId } for the current actor.
 * If MADSPEED_AGENT_ID is set, the actor is an agent; otherwise falls back to project owner.
 */
export declare function getActorIds(): Promise<{
    profileId: string | null;
    agentId: string | null;
}>;
