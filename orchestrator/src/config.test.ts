import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WorkflowConfigSchema, resolveEnvVars, resolveEnvVarsDeep } from './config.js'

// ── WorkflowConfigSchema tests ──
describe('WorkflowConfigSchema', () => {
  const baseConfig = {
    tracker: {
      kind: 'self' as const,
      supabase_url: 'https://example.supabase.co',
      supabase_key: 'test-key',
      project_id: 'proj-123',
    },
    workspace: { root: '/tmp/ws' },
  }

  it('agent_id 필드 없이도 파싱 성공 (optional)', () => {
    const result = WorkflowConfigSchema.parse(baseConfig)
    expect(result.tracker.agent_id).toBeUndefined()
    expect(result.tracker.project_id).toBe('proj-123')
  })

  it('agent_id 필드 있으면 파싱 결과에 포함', () => {
    const config = {
      ...baseConfig,
      tracker: { ...baseConfig.tracker, agent_id: 'agent-abc' },
    }
    const result = WorkflowConfigSchema.parse(config)
    expect(result.tracker.agent_id).toBe('agent-abc')
  })
})

// ── resolveEnvVars tests ──
describe('resolveEnvVars', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    saved['TEST_VAR'] = process.env.TEST_VAR
    saved['ANOTHER'] = process.env.ANOTHER
    process.env.TEST_VAR = 'hello'
    process.env.ANOTHER = 'world'
  })

  afterEach(() => {
    if (saved['TEST_VAR'] === undefined) delete process.env.TEST_VAR
    else process.env.TEST_VAR = saved['TEST_VAR']
    if (saved['ANOTHER'] === undefined) delete process.env.ANOTHER
    else process.env.ANOTHER = saved['ANOTHER']
  })

  it('$VAR 패턴 치환', () => {
    expect(resolveEnvVars('prefix-$TEST_VAR-suffix')).toBe('prefix-hello-suffix')
  })

  it('${VAR} 패턴 치환', () => {
    expect(resolveEnvVars('${TEST_VAR}/${ANOTHER}')).toBe('hello/world')
  })

  it('미설정 환경변수 시 에러 throw', () => {
    expect(() => resolveEnvVars('$NONEXISTENT_VAR_XYZ')).toThrow('NONEXISTENT_VAR_XYZ is not set')
  })
})

// ── resolveEnvVarsDeep tests ──
describe('resolveEnvVarsDeep', () => {
  beforeEach(() => {
    process.env.DEEP_A = 'alpha'
    process.env.DEEP_B = 'beta'
  })

  afterEach(() => {
    delete process.env.DEEP_A
    delete process.env.DEEP_B
  })

  it('중첩 객체의 모든 문자열 치환', () => {
    const input = { outer: { inner: '$DEEP_A', nested: { val: '${DEEP_B}' } } }
    const result = resolveEnvVarsDeep(input) as Record<string, unknown>
    expect((result.outer as Record<string, unknown>).inner).toBe('alpha')
    expect(((result.outer as Record<string, unknown>).nested as Record<string, unknown>).val).toBe('beta')
  })

  it('배열 내 문자열 치환', () => {
    const input = ['$DEEP_A', '${DEEP_B}', 'plain']
    const result = resolveEnvVarsDeep(input) as string[]
    expect(result).toEqual(['alpha', 'beta', 'plain'])
  })

  it('비문자열(number, null) 그대로 유지', () => {
    const input = { num: 42, nil: null, str: '$DEEP_A' }
    const result = resolveEnvVarsDeep(input) as Record<string, unknown>
    expect(result.num).toBe(42)
    expect(result.nil).toBeNull()
    expect(result.str).toBe('alpha')
  })
})
