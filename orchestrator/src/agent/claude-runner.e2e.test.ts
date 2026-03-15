import { describe, it, expect } from 'vitest'
import { ClaudeRunner } from './claude-runner.js'

const runnerConfig = {
  model: 'claude-sonnet-4-20250514',
  maxTurns: 1,
  turnTimeoutMs: 60_000,
  stallTimeoutMs: 30_000,
  allowedTools: [],
}

describe('ClaudeRunner — E2E (실제 Claude CLI)', () => {
  // ── Test 21: 간단한 프롬프트로 Claude CLI 실행 ──
  it('간단한 프롬프트 실행 → RunResult 반환', async () => {
    const runner = new ClaudeRunner(runnerConfig)
    const result = await runner.run(
      "Say 'hello' and nothing else.",
      process.cwd(),
      { continuation: false },
    )

    expect(result).toBeDefined()
    expect(typeof result.success).toBe('boolean')
    expect(typeof result.durationMs).toBe('number')
    expect(result.durationMs).toBeGreaterThan(0)
    expect(result.usage).toBeDefined()
    expect(typeof result.usage.input_tokens).toBe('number')
    expect(typeof result.usage.output_tokens).toBe('number')

    if (result.success) {
      expect(result.result).toBeDefined()
      expect(result.result!.toLowerCase()).toContain('hello')
    }
  })

  // ── Test 22: abort signal로 중단 ──
  it('AbortController.abort() → 프로세스 종료 + error=Aborted', async () => {
    const runner = new ClaudeRunner({
      ...runnerConfig,
      maxTurns: 100,
      turnTimeoutMs: 120_000,
    })
    const abortController = new AbortController()

    // Start and abort after 2 seconds
    const resultPromise = runner.run(
      "Count from 1 to 1000, one number per line, slowly.",
      process.cwd(),
      { signal: abortController.signal, continuation: false },
    )

    setTimeout(() => abortController.abort(), 2000)

    const result = await resultPromise

    expect(result.success).toBe(false)
    expect(result.error).toBe('Aborted')
  })
})
