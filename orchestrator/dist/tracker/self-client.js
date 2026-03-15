import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../logger.js';
const log = createLogger('self-tracker');
export class SelfTrackerClient {
    supabase;
    projectId;
    activeStates;
    terminalStates;
    cachedOwnerId = null;
    constructor(config) {
        this.supabase = createClient(config.supabaseUrl, config.supabaseKey, {
            auth: { persistSession: false },
        });
        this.projectId = config.projectId;
        this.activeStates = config.activeStates;
        this.terminalStates = config.terminalStates;
    }
    async getProjectOwnerId() {
        if (this.cachedOwnerId)
            return this.cachedOwnerId;
        const { data, error } = await this.supabase
            .from('projects')
            .select('owner_id')
            .eq('id', this.projectId)
            .single();
        if (error || !data)
            throw new Error(`Could not resolve project owner: ${error?.message}`);
        this.cachedOwnerId = data.owner_id;
        return data.owner_id;
    }
    async resolveStatusId(statusName) {
        const { data, error } = await this.supabase
            .from('statuses')
            .select('id')
            .eq('project_id', this.projectId)
            .ilike('name', statusName)
            .limit(1)
            .single();
        if (error || !data)
            throw new Error(`Status "${statusName}" not found in project`);
        return data.id;
    }
    async fetchActiveIssues() {
        const { data, error } = await this.supabase
            .from('work_items')
            .select(`
        id, number, title, description, priority, created_at, updated_at,
        status:statuses!inner(name),
        project:projects!inner(key)
      `)
            .eq('project_id', this.projectId)
            .in('statuses.name', this.activeStates)
            .is('deleted_at', null)
            .order('priority', { ascending: true })
            .order('created_at', { ascending: true });
        if (error) {
            log.error('Failed to fetch active issues', { error: error.message });
            throw error;
        }
        return (data ?? []).map((item) => ({
            id: item.id,
            identifier: `${item.project.key}-${item.number}`,
            title: item.title,
            description: item.description,
            priority: item.priority,
            state: item.status.name,
            created_at: item.created_at,
            updated_at: item.updated_at,
        }));
    }
    async fetchIssueStates(ids) {
        if (ids.length === 0)
            return new Map();
        const { data, error } = await this.supabase
            .from('work_items')
            .select('id, status:statuses!inner(name)')
            .in('id', ids)
            .is('deleted_at', null);
        if (error) {
            log.error('Failed to fetch issue states', { error: error.message });
            throw error;
        }
        const result = new Map();
        for (const item of data ?? []) {
            result.set(item.id, item.status.name);
        }
        return result;
    }
    async updateIssueStatus(id, statusName) {
        const statusId = await this.resolveStatusId(statusName);
        const { error } = await this.supabase
            .from('work_items')
            .update({ status_id: statusId })
            .eq('id', id);
        if (error) {
            log.error('Failed to update issue status', { id, statusName, error: error.message });
            throw error;
        }
        log.info('Issue status updated', { id, statusName });
    }
    async addComment(issueId, content) {
        const ownerId = await this.getProjectOwnerId();
        const { error } = await this.supabase
            .from('comments')
            .insert({
            work_item_id: issueId,
            author_id: ownerId,
            content,
        });
        if (error) {
            log.error('Failed to add comment', { issueId, error: error.message });
            throw error;
        }
        log.info('Comment added to issue', { issueId });
    }
    isTerminalState(state) {
        return this.terminalStates.some(s => s.toLowerCase() === state.toLowerCase());
    }
    isActiveState(state) {
        return this.activeStates.some(s => s.toLowerCase() === state.toLowerCase());
    }
}
//# sourceMappingURL=self-client.js.map