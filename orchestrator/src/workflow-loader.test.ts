import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Suppress log output
vi.mock('./logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const VALID_WORKFLOW = `---
tracker:
  kind: self
  supabase_url: https://test.supabase.co
  supabase_key: test-key
  project_id: proj-123
  active_states: ["Open", "In Progress"]
  terminal_states: ["Resolved", "Closed"]

workspace:
  root: /tmp/ws

claude:
  model: claude-sonnet-4-20250514
---

You are working on **{{ issue.identifier }}**: {{ issue.title }}.
`

describe('WorkflowLoader', () => {
  const tmpFile = path.join(os.tmpdir(), `workflow-test-${Date.now()}.md`)

  beforeEach(() => {
    fs.writeFileSync(tmpFile, VALID_WORKFLOW)
  })

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
  })

  it('유효한 WORKFLOW.md 파싱 성공', async () => {
    const { WorkflowLoader } = await import('./workflow-loader.js')
    const loader = new WorkflowLoader(tmpFile)
    const config = loader.getConfig()

    expect(config.tracker.kind).toBe('self')
    expect(config.tracker.supabase_url).toBe('https://test.supabase.co')
    expect(config.tracker.project_id).toBe('proj-123')
    expect(config.workspace.root).toBe('/tmp/ws')
    expect(config.claude.model).toBe('claude-sonnet-4-20250514')
  })

  it('YAML front matter 없으면 에러 throw', async () => {
    fs.writeFileSync(tmpFile, 'no front matter here')
    const { WorkflowLoader } = await import('./workflow-loader.js')

    expect(() => new WorkflowLoader(tmpFile)).toThrow('Invalid WORKFLOW.md format')
  })

  it('Liquid 템플릿 렌더링', async () => {
    const { WorkflowLoader } = await import('./workflow-loader.js')
    const loader = new WorkflowLoader(tmpFile)

    const rendered = await loader.renderPrompt({
      issue: { identifier: 'TST-1', title: 'Fix bug' },
    })

    expect(rendered).toContain('TST-1')
    expect(rendered).toContain('Fix bug')
  })

  it('~ 경로를 홈 디렉토리로 확장', async () => {
    const tildeWorkflow = VALID_WORKFLOW.replace('/tmp/ws', '~/my-workspaces')
    fs.writeFileSync(tmpFile, tildeWorkflow)

    const { WorkflowLoader } = await import('./workflow-loader.js')
    const loader = new WorkflowLoader(tmpFile)
    const config = loader.getConfig()

    expect(config.workspace.root).toBe(path.join(os.homedir(), 'my-workspaces'))
  })

  it('환경변수 치환 ($VAR 패턴)', async () => {
    process.env.__TEST_SB_URL__ = 'https://env.supabase.co'
    const envWorkflow = VALID_WORKFLOW.replace(
      'https://test.supabase.co',
      '$__TEST_SB_URL__',
    )
    fs.writeFileSync(tmpFile, envWorkflow)

    const { WorkflowLoader } = await import('./workflow-loader.js')
    const loader = new WorkflowLoader(tmpFile)
    const config = loader.getConfig()

    expect(config.tracker.supabase_url).toBe('https://env.supabase.co')
    delete process.env.__TEST_SB_URL__
  })

  it('close()로 watcher 정리', async () => {
    const { WorkflowLoader } = await import('./workflow-loader.js')
    const loader = new WorkflowLoader(tmpFile)

    // onChange 등록하면 watcher 생성
    loader.onChange(() => {})
    // close 호출해도 에러 없이 정상 동작
    loader.close()
    // 두 번 호출해도 안전
    loader.close()
  })
})
