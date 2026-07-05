import { z } from 'zod'

/**
 * Shared zod schema for the `git` tool argument.
 *
 * JSON contract for `work_items.git_context` (fixed — do not change shape):
 *   { repo_url?, branch?, worktree?, commit?, updated_at? }
 *
 * `updated_at` is NOT accepted from the client — the server sets it at write time.
 */
export const gitArg = z
  .object({
    repo_url: z.string().optional().describe('Repository URL, e.g., https://github.com/kubony/ralphgrip'),
    branch: z.string().optional().describe('Branch name, e.g., feat/mcp-create-project'),
    worktree: z.string().optional().describe('Worktree path (omit if working in the main checkout)'),
    commit: z.string().optional().describe('Short commit hash of the current HEAD'),
  })
  .optional()
  .describe('Git context of the working agent (branch/worktree/commit). Passed → stored on work_items.git_context (replace, not merge); updated_at is set by the server.')

export type GitArg = z.infer<typeof gitArg>

/**
 * Build the value stored in `work_items.git_context`.
 * Replaces (does not merge) the existing value and stamps a server `updated_at`.
 */
export function buildGitContext(git: NonNullable<GitArg>): Record<string, unknown> {
  return { ...git, updated_at: new Date().toISOString() }
}
