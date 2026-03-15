import { z } from 'zod';
export const WorkflowConfigSchema = z.object({
    tracker: z.object({
        kind: z.literal('self'),
        supabase_url: z.string(),
        supabase_key: z.string(),
        project_id: z.string(),
        active_states: z.array(z.string()).default(['Open', 'In Progress']),
        terminal_states: z.array(z.string()).default(['Resolved', 'Closed']),
    }),
    polling: z.object({
        interval_ms: z.number().default(30000),
    }).default({}),
    workspace: z.object({
        root: z.string(),
    }),
    hooks: z.object({
        after_create: z.string().optional(),
        before_run: z.string().optional(),
        after_run: z.string().optional(),
        before_remove: z.string().optional(),
    }).default({}),
    agent: z.object({
        max_concurrent_agents: z.number().default(3),
        max_retry_backoff_ms: z.number().default(300000),
    }).default({}),
    claude: z.object({
        model: z.string().default('claude-sonnet-4-20250514'),
        max_turns: z.number().default(50),
        turn_timeout_ms: z.number().default(3600000),
        stall_timeout_ms: z.number().default(300000),
        allowed_tools: z.array(z.string()).default(['Edit', 'Write', 'Bash', 'Read', 'Glob', 'Grep']),
    }).default({}),
});
/** Replace $VAR and ${VAR} patterns with process.env values */
export function resolveEnvVars(value) {
    return value.replace(/\$\{(\w+)\}|\$(\w+)/g, (_, braced, plain) => {
        const name = braced || plain;
        const val = process.env[name];
        if (val === undefined) {
            throw new Error(`Environment variable ${name} is not set`);
        }
        return val;
    });
}
/** Recursively resolve env vars in all string values of an object */
export function resolveEnvVarsDeep(obj) {
    if (typeof obj === 'string')
        return resolveEnvVars(obj);
    if (Array.isArray(obj))
        return obj.map(resolveEnvVarsDeep);
    if (obj !== null && typeof obj === 'object') {
        const result = {};
        for (const [k, v] of Object.entries(obj)) {
            result[k] = resolveEnvVarsDeep(v);
        }
        return result;
    }
    return obj;
}
//# sourceMappingURL=config.js.map