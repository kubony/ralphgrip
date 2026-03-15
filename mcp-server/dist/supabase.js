import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
});
export function getProjectId() {
    const projectId = process.env.MADSPEED_PROJECT_ID;
    if (!projectId) {
        throw new Error('Missing MADSPEED_PROJECT_ID environment variable');
    }
    return projectId;
}
let cachedOwnerId = null;
export async function getProjectOwnerId() {
    if (cachedOwnerId)
        return cachedOwnerId;
    const projectId = getProjectId();
    const { data, error } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .single();
    if (error || !data) {
        throw new Error(`Could not resolve project owner: ${error?.message}`);
    }
    cachedOwnerId = data.owner_id;
    return data.owner_id;
}
/**
 * Returns { profileId, agentId } for the current actor.
 * If MADSPEED_AGENT_ID is set, the actor is an agent; otherwise falls back to project owner.
 */
export async function getActorIds() {
    const agentId = process.env.MADSPEED_AGENT_ID || null;
    if (agentId) {
        return { profileId: null, agentId };
    }
    const profileId = await getProjectOwnerId();
    return { profileId, agentId: null };
}
//# sourceMappingURL=supabase.js.map