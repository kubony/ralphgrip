import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('createLogger', () => {
  let originalLogLevel: string | undefined

  beforeEach(() => {
    originalLogLevel = process.env.LOG_LEVEL
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    if (originalLogLevel === undefined) delete process.env.LOG_LEVEL
    else process.env.LOG_LEVEL = originalLogLevel
    vi.restoreAllMocks()
    // Reset module cache so LOG_LEVEL is re-evaluated
    vi.resetModules()
  })

  it('info 레벨이 기본값이고 info 메시지 출력', async () => {
    delete process.env.LOG_LEVEL
    const { createLogger } = await import('./logger.js')
    const log = createLogger('test')

    log.info('hello')
    expect(console.log).toHaveBeenCalledTimes(1)
    expect(vi.mocked(console.log).mock.calls[0][0]).toContain('hello')
    expect(vi.mocked(console.log).mock.calls[0][0]).toContain('[test]')
  })

  it('debug 메시지는 기본 레벨(info)에서 출력되지 않음', async () => {
    delete process.env.LOG_LEVEL
    const { createLogger } = await import('./logger.js')
    const log = createLogger('test')

    log.debug('hidden')
    expect(console.log).not.toHaveBeenCalled()
  })

  it('LOG_LEVEL=debug 시 debug 메시지 출력', async () => {
    process.env.LOG_LEVEL = 'debug'
    const { createLogger } = await import('./logger.js')
    const log = createLogger('test')

    log.debug('visible')
    expect(console.log).toHaveBeenCalledTimes(1)
    expect(vi.mocked(console.log).mock.calls[0][0]).toContain('visible')
  })

  it('error 레벨은 항상 출력', async () => {
    process.env.LOG_LEVEL = 'error'
    const { createLogger } = await import('./logger.js')
    const log = createLogger('test')

    log.info('suppressed')
    log.warn('suppressed')
    log.error('shown')
    expect(console.log).toHaveBeenCalledTimes(1)
    expect(vi.mocked(console.log).mock.calls[0][0]).toContain('shown')
  })

  it('context 객체가 있으면 두 번째 인자로 전달', async () => {
    delete process.env.LOG_LEVEL
    const { createLogger } = await import('./logger.js')
    const log = createLogger('test')

    const ctx = { key: 'val' }
    log.info('with context', ctx)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('with context'), ctx)
  })
})
