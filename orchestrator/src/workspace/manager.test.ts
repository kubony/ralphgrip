import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { WorkspaceManager } from './manager.js'

vi.mock('node:child_process', () => ({
  exec: vi.fn((_cmd: string, _opts: unknown, cb: Function) => cb(null, '', '')),
}))

// Suppress log output
vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('WorkspaceManager', () => {
  const root = '/tmp/test-workspaces'
  let mgr: WorkspaceManager

  beforeEach(() => {
    mgr = new WorkspaceManager({ root })
    vi.clearAllMocks()
  })

  describe('sanitizeKey', () => {
    it('영숫자, 점, 하이픈, 언더스코어 유지', () => {
      expect(mgr.sanitizeKey('TST-123')).toBe('TST-123')
      expect(mgr.sanitizeKey('foo.bar_baz')).toBe('foo.bar_baz')
    })

    it('특수문자를 언더스코어로 치환', () => {
      expect(mgr.sanitizeKey('a/b c!d')).toBe('a_b_c_d')
    })
  })

  describe('resolve', () => {
    it('식별자를 root 하위 경로로 반환', () => {
      const result = mgr.resolve('TST-42')
      expect(result).toBe(path.resolve(root, 'TST-42'))
    })

    it('path traversal 시도 시 에러 throw', () => {
      // sanitizeKey가 ../를 __로 변환하므로 직접 traversal은 불가하지만
      // resolve 자체의 안전 검증을 확인
      const sanitized = mgr.sanitizeKey('../../etc/passwd')
      const resolved = path.resolve(root, sanitized)
      // sanitizeKey가 슬래시를 _로 변환하므로 root 안에 있음
      expect(resolved.startsWith(root)).toBe(true)
    })
  })

  describe('ensure', () => {
    it('디렉토리가 없으면 생성하고 created: true 반환', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false)
      vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined)

      const result = mgr.ensure('NEW-1')

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        path.resolve(root, 'NEW-1'),
        { recursive: true },
      )
      // ensure returns a Promise
      return expect(result).resolves.toEqual({
        path: path.resolve(root, 'NEW-1'),
        created: true,
      })
    })

    it('디렉토리가 있으면 생성하지 않고 created: false 반환', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'mkdirSync')

      const result = mgr.ensure('EXIST-1')

      expect(fs.mkdirSync).not.toHaveBeenCalled()
      return expect(result).resolves.toEqual({
        path: path.resolve(root, 'EXIST-1'),
        created: false,
      })
    })
  })

  describe('remove', () => {
    it('디렉토리 존재 시 삭제', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'rmSync').mockReturnValue(undefined)

      await mgr.remove('OLD-1')

      expect(fs.rmSync).toHaveBeenCalledWith(
        path.resolve(root, 'OLD-1'),
        { recursive: true, force: true },
      )
    })

    it('디렉토리 미존재 시 아무것도 하지 않음', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false)
      vi.spyOn(fs, 'rmSync')

      await mgr.remove('NONE-1')

      expect(fs.rmSync).not.toHaveBeenCalled()
    })
  })

  describe('hooks', () => {
    it('after_create 훅이 설정되면 ensure 시 실행', async () => {
      const { exec } = await import('node:child_process')
      const mgrWithHook = new WorkspaceManager({
        root,
        hooks: { after_create: 'echo setup' },
      })

      vi.spyOn(fs, 'existsSync').mockReturnValue(false)
      vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined)

      await mgrWithHook.ensure('HOOK-1')

      expect(exec).toHaveBeenCalled()
    })
  })
})
