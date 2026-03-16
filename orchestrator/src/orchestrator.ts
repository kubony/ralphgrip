import { type WorkflowConfig } from './config.js'
import { WorkflowLoader } from './workflow-loader.js'
import { SelfTrackerClient, type Issue } from './tracker/self-client.js'
import { WorkspaceManager } from './workspace/manager.js'
import { ClaudeRunner, type RunResult } from './agent/claude-runner.js'
import { createLogger } from './logger.js'

const log = createLogger('orchestrator')

interface RunningEntry {
  issueId: string
  identifier: string
  runner: ClaudeRunner
  workspacePath: string
  startedAt: number
  attempt: number
  abortController: AbortController
}

interface RetryEntry {
  attempts: number
  lastFailedAt: number
  nextRetryAt: number
}

export interface OrchestratorSnapshot {
  running: Array<{ id: string; identifier: string; attempt: number; durationMs: number }>
  retrying: Array<{ id: string; identifier: string; nextRetryAt: number }>
  tokenTotals: { input: number; output: number }
}

export class Orchestrator {
  private running = new Map<string, RunningEntry>()
  private claimed = new Set<string>()
  private retryAttempts = new Map<string, RetryEntry>()
  private completed = new Set<string>()
  private tokenTotals = { input: 0, output: 0 }
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private stopping = false

  // Callback for triggering an immediate poll (used by status API)
  onRefreshRequest: (() => void) | null = null

  constructor(
    private loader: WorkflowLoader,
    private tracker: SelfTrackerClient,
    private workspaceManager: WorkspaceManager,
  ) {}

  private get config(): WorkflowConfig {
    return this.loader.getConfig()
  }

  async start(): Promise<void> {
    log.info('Orchestrator starting', {
      maxConcurrent: this.config.agent.max_concurrent_agents,
      pollingInterval: this.config.polling.interval_ms,
    })

    // Register shutdown handlers
    const shutdown = async () => {
      if (this.stopping) return
      log.info('Shutdown signal received')
      await this.stop()
      process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    // Run initial poll
    await this.poll()

    // Start polling loop
    this.pollTimer = setInterval(() => {
      this.poll().catch((err) => {
        log.error('Poll cycle failed', { error: err instanceof Error ? err.message : String(err) })
      })
    }, this.config.polling.interval_ms)

    this.onRefreshRequest = () => {
      this.poll().catch((err) => {
        log.error('Manual refresh poll failed', { error: err instanceof Error ? err.message : String(err) })
      })
    }
  }

  async stop(): Promise<void> {
    this.stopping = true
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }

    log.info('Stopping orchestrator, waiting for running workers...', {
      count: this.running.size,
    })

    // Signal all runners to abort
    for (const entry of this.running.values()) {
      entry.abortController.abort()
    }

    // Wait up to 30s for graceful shutdown
    const deadline = Date.now() + 30_000
    while (this.running.size > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000))
    }

    // Force kill remaining
    for (const entry of this.running.values()) {
      entry.runner.kill()
    }

    log.info('Orchestrator stopped')
  }

  async poll(): Promise<void> {
    if (this.stopping) return

    try {
      // 1. Reconcile running workers
      await this.reconcile()

      // 2. Fetch active issues from DB
      const issues = await this.tracker.fetchActiveIssues()
      log.debug('Fetched active issues', { count: issues.length })

      // 3. Filter candidates
      const now = Date.now()
      const candidates = issues.filter((issue) => {
        if (this.running.has(issue.id)) return false
        if (this.claimed.has(issue.id)) return false
        if (this.completed.has(issue.id)) return false
        const retry = this.retryAttempts.get(issue.id)
        if (retry && now < retry.nextRetryAt) return false
        return true
      })

      // 4. Sort: priority ASC → created_at ASC → identifier ASC
      candidates.sort((a, b) => {
        const pa = a.priority ?? 0
        const pb = b.priority ?? 0
        if (pa !== pb) return pa - pb
        const ca = new Date(a.created_at).getTime()
        const cb = new Date(b.created_at).getTime()
        if (ca !== cb) return ca - cb
        return a.identifier.localeCompare(b.identifier)
      })

      // 5. Dispatch eligible
      const availableSlots = this.config.agent.max_concurrent_agents - this.running.size
      const toDispatch = candidates.slice(0, Math.max(0, availableSlots))

      if (toDispatch.length > 0) {
        log.info('Dispatching issues', {
          count: toDispatch.length,
          identifiers: toDispatch.map((i) => i.identifier),
        })
      }

      for (const issue of toDispatch) {
        // Fire and forget — dispatch handles its own lifecycle
        this.dispatch(issue).catch((err) => {
          log.error('Dispatch failed', {
            identifier: issue.identifier,
            error: err instanceof Error ? err.message : String(err),
          })
          this.claimed.delete(issue.id)
        })
      }
    } catch (err) {
      log.error('Poll cycle error', { error: err instanceof Error ? err.message : String(err) })
    }
  }

  private async reconcile(): Promise<void> {
    if (this.running.size === 0) return

    // Refresh DB states for running issues
    const runningIds = [...this.running.keys()]
    const states = await this.tracker.fetchIssueStates(runningIds)

    for (const [issueId, entry] of this.running) {
      const currentState = states.get(issueId)
      if (currentState && this.tracker.isTerminalState(currentState)) {
        log.info('Running issue moved to terminal state, aborting', {
          identifier: entry.identifier,
          state: currentState,
        })
        entry.abortController.abort()
        // Cleanup will happen in dispatch's finally block
      }
    }
  }

  private async dispatch(issue: Issue): Promise<void> {
    this.claimed.add(issue.id)
    const retry = this.retryAttempts.get(issue.id)
    const attempt = retry ? retry.attempts + 1 : 1

    try {
      // Update status to "In Progress"
      if (issue.state !== 'In Progress') {
        await this.tracker.updateIssueStatus(issue.id, 'In Progress')
      }

      // Prepare workspace
      const workspacePath = await this.workspaceManager.prepareForRun(issue.identifier)

      // Create runner
      const c = this.config.claude
      const runner = new ClaudeRunner({
        model: c.model,
        maxTurns: c.max_turns,
        turnTimeoutMs: c.turn_timeout_ms,
        stallTimeoutMs: c.stall_timeout_ms,
        allowedTools: c.allowed_tools,
      })
      const abortController = new AbortController()

      const entry: RunningEntry = {
        issueId: issue.id,
        identifier: issue.identifier,
        runner,
        workspacePath,
        startedAt: Date.now(),
        attempt,
        abortController,
      }
      this.running.set(issue.id, entry)

      log.info('Worker started', {
        identifier: issue.identifier,
        attempt,
        workspace: workspacePath,
      })

      // Render prompt
      const prompt = await this.loader.renderPrompt({
        issue,
        attempt: attempt > 1 ? attempt : undefined,
      })

      // Run Claude Code
      const result = await runner.run(prompt, workspacePath, {
        signal: abortController.signal,
        continuation: false,
      })

      // Accumulate token usage
      this.tokenTotals.input += result.usage.input_tokens
      this.tokenTotals.output += result.usage.output_tokens

      if (result.success) {
        log.info('Worker completed successfully', {
          identifier: issue.identifier,
          durationMs: result.durationMs,
          tokens: result.usage,
        })

        // Add completion comment
        await this.tracker.addComment(
          issue.id,
          `🤖 **RalphGrip Orchestrator** — 작업 완료 (attempt ${attempt})\n\n` +
          `Duration: ${Math.round(result.durationMs / 1000)}s | ` +
          `Tokens: ${result.usage.input_tokens} in / ${result.usage.output_tokens} out\n\n` +
          (result.result ? `\`\`\`\n${result.result.slice(0, 2000)}\n\`\`\`` : ''),
        )

        // Check if issue is still active → continuation
        await this.handleContinuation(issue, entry, result)

        // Clear retry state on success
        this.retryAttempts.delete(issue.id)
      } else {
        log.warn('Worker failed', {
          identifier: issue.identifier,
          error: result.error,
          attempt,
        })

        // Add failure comment
        await this.tracker.addComment(
          issue.id,
          `🤖 **RalphGrip Orchestrator** — 작업 실패 (attempt ${attempt})\n\n` +
          `Error: ${result.error}\n` +
          `Duration: ${Math.round(result.durationMs / 1000)}s`,
        )

        // Schedule retry with exponential backoff
        this.scheduleRetry(issue.id, issue.identifier, attempt)
      }
    } catch (err) {
      log.error('Worker dispatch error', {
        identifier: issue.identifier,
        error: err instanceof Error ? err.message : String(err),
      })
      this.scheduleRetry(issue.id, issue.identifier, attempt)
    } finally {
      this.running.delete(issue.id)
      this.claimed.delete(issue.id)
      await this.workspaceManager.cleanupAfterRun(issue.identifier)
    }
  }

  private async handleContinuation(
    issue: Issue,
    entry: RunningEntry,
    prevResult: RunResult,
  ): Promise<void> {
    // Wait 1s before checking for continuation
    await new Promise((r) => setTimeout(r, 1000))

    // Re-check issue state from DB
    const states = await this.tracker.fetchIssueStates([issue.id])
    const currentState = states.get(issue.id)

    if (!currentState || this.tracker.isTerminalState(currentState)) {
      log.info('Issue reached terminal state, no continuation needed', {
        identifier: issue.identifier,
        state: currentState,
      })
      this.completed.add(issue.id)
      return
    }

    if (!this.tracker.isActiveState(currentState)) {
      log.info('Issue no longer active, skipping continuation', {
        identifier: issue.identifier,
        state: currentState,
      })
      return
    }

    log.info('Issue still active, running continuation', {
      identifier: issue.identifier,
      state: currentState,
    })

    // Continuation run with --continue
    const contPrompt = `Continue working on issue ${issue.identifier}: ${issue.title}. Check previous work in the workspace and continue from where you left off.`
    const contResult = await entry.runner.run(contPrompt, entry.workspacePath, {
      signal: entry.abortController.signal,
      continuation: true,
    })

    this.tokenTotals.input += contResult.usage.input_tokens
    this.tokenTotals.output += contResult.usage.output_tokens

    if (contResult.success) {
      await this.tracker.addComment(
        issue.id,
        `🤖 **RalphGrip Orchestrator** — continuation 완료\n\n` +
        `Duration: ${Math.round(contResult.durationMs / 1000)}s | ` +
        `Tokens: ${contResult.usage.input_tokens} in / ${contResult.usage.output_tokens} out`,
      )
    }
  }

  private scheduleRetry(issueId: string, identifier: string, attempt: number): void {
    const backoffMs = Math.min(
      10_000 * Math.pow(2, attempt - 1),
      this.config.agent.max_retry_backoff_ms,
    )
    const nextRetryAt = Date.now() + backoffMs

    this.retryAttempts.set(issueId, {
      attempts: attempt,
      lastFailedAt: Date.now(),
      nextRetryAt,
    })

    log.info('Retry scheduled', {
      identifier,
      attempt,
      backoffMs,
      nextRetryAt: new Date(nextRetryAt).toISOString(),
    })
  }

  getState(): OrchestratorSnapshot {
    const now = Date.now()
    return {
      running: [...this.running.values()].map((e) => ({
        id: e.issueId,
        identifier: e.identifier,
        attempt: e.attempt,
        durationMs: now - e.startedAt,
      })),
      retrying: [...this.retryAttempts.entries()].map(([id, r]) => ({
        id,
        identifier: this.running.get(id)?.identifier ?? id,
        nextRetryAt: r.nextRetryAt,
      })),
      tokenTotals: { ...this.tokenTotals },
    }
  }
}
