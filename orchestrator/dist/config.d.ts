import { z } from 'zod';
export declare const WorkflowConfigSchema: z.ZodObject<{
    tracker: z.ZodObject<{
        kind: z.ZodLiteral<"self">;
        supabase_url: z.ZodString;
        supabase_key: z.ZodString;
        project_id: z.ZodString;
        active_states: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        terminal_states: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        kind: "self";
        supabase_url: string;
        supabase_key: string;
        project_id: string;
        active_states: string[];
        terminal_states: string[];
    }, {
        kind: "self";
        supabase_url: string;
        supabase_key: string;
        project_id: string;
        active_states?: string[] | undefined;
        terminal_states?: string[] | undefined;
    }>;
    polling: z.ZodDefault<z.ZodObject<{
        interval_ms: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        interval_ms: number;
    }, {
        interval_ms?: number | undefined;
    }>>;
    workspace: z.ZodObject<{
        root: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        root: string;
    }, {
        root: string;
    }>;
    hooks: z.ZodDefault<z.ZodObject<{
        after_create: z.ZodOptional<z.ZodString>;
        before_run: z.ZodOptional<z.ZodString>;
        after_run: z.ZodOptional<z.ZodString>;
        before_remove: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        after_create?: string | undefined;
        before_run?: string | undefined;
        after_run?: string | undefined;
        before_remove?: string | undefined;
    }, {
        after_create?: string | undefined;
        before_run?: string | undefined;
        after_run?: string | undefined;
        before_remove?: string | undefined;
    }>>;
    agent: z.ZodDefault<z.ZodObject<{
        max_concurrent_agents: z.ZodDefault<z.ZodNumber>;
        max_retry_backoff_ms: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        max_concurrent_agents: number;
        max_retry_backoff_ms: number;
    }, {
        max_concurrent_agents?: number | undefined;
        max_retry_backoff_ms?: number | undefined;
    }>>;
    claude: z.ZodDefault<z.ZodObject<{
        model: z.ZodDefault<z.ZodString>;
        max_turns: z.ZodDefault<z.ZodNumber>;
        turn_timeout_ms: z.ZodDefault<z.ZodNumber>;
        stall_timeout_ms: z.ZodDefault<z.ZodNumber>;
        allowed_tools: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        model: string;
        max_turns: number;
        turn_timeout_ms: number;
        stall_timeout_ms: number;
        allowed_tools: string[];
    }, {
        model?: string | undefined;
        max_turns?: number | undefined;
        turn_timeout_ms?: number | undefined;
        stall_timeout_ms?: number | undefined;
        allowed_tools?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    tracker: {
        kind: "self";
        supabase_url: string;
        supabase_key: string;
        project_id: string;
        active_states: string[];
        terminal_states: string[];
    };
    polling: {
        interval_ms: number;
    };
    workspace: {
        root: string;
    };
    hooks: {
        after_create?: string | undefined;
        before_run?: string | undefined;
        after_run?: string | undefined;
        before_remove?: string | undefined;
    };
    agent: {
        max_concurrent_agents: number;
        max_retry_backoff_ms: number;
    };
    claude: {
        model: string;
        max_turns: number;
        turn_timeout_ms: number;
        stall_timeout_ms: number;
        allowed_tools: string[];
    };
}, {
    tracker: {
        kind: "self";
        supabase_url: string;
        supabase_key: string;
        project_id: string;
        active_states?: string[] | undefined;
        terminal_states?: string[] | undefined;
    };
    workspace: {
        root: string;
    };
    polling?: {
        interval_ms?: number | undefined;
    } | undefined;
    hooks?: {
        after_create?: string | undefined;
        before_run?: string | undefined;
        after_run?: string | undefined;
        before_remove?: string | undefined;
    } | undefined;
    agent?: {
        max_concurrent_agents?: number | undefined;
        max_retry_backoff_ms?: number | undefined;
    } | undefined;
    claude?: {
        model?: string | undefined;
        max_turns?: number | undefined;
        turn_timeout_ms?: number | undefined;
        stall_timeout_ms?: number | undefined;
        allowed_tools?: string[] | undefined;
    } | undefined;
}>;
export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;
/** Replace $VAR and ${VAR} patterns with process.env values */
export declare function resolveEnvVars(value: string): string;
/** Recursively resolve env vars in all string values of an object */
export declare function resolveEnvVarsDeep(obj: unknown): unknown;
