import fs from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'
import { createLogger } from '../logger.js'

const log = createLogger('workspace')

interface WorkspaceHooks {
  after_create?: string
  before_run?: string
  after_run?: string
  before_remove?: string
}

interface WorkspaceManagerConfig {
  root: string
  hooks?: WorkspaceHooks
}

export class WorkspaceManager {
  private root: string
  private hooks: WorkspaceHooks

  constructor(config: WorkspaceManagerConfig) {
    this.root = path.resolve(config.root)
    this.hooks = config.hooks ?? {}
  }

  sanitizeKey(identifier: string): string {
    return identifier.replace(/[^A-Za-z0-9._-]/g, '_')
  }

  resolve(identifier: string): string {
    const key = this.sanitizeKey(identifier)
    const resolved = path.resolve(this.root, key)
    // Safety: prevent path traversal
    if (!resolved.startsWith(this.root)) {
      throw new Error(`Workspace path "${resolved}" escapes root "${this.root}"`)
    }
    return resolved
  }

  async ensure(identifier: string): Promise<{ path: string; created: boolean }> {
    const wsPath = this.resolve(identifier)
    const exists = fs.existsSync(wsPath)

    if (!exists) {
      fs.mkdirSync(wsPath, { recursive: true })
      log.info('Workspace created', { identifier, path: wsPath })

      if (this.hooks.after_create) {
        await this.runHook('after_create', this.hooks.after_create, wsPath, true)
      }
      return { path: wsPath, created: true }
    }

    log.debug('Workspace exists, reusing', { identifier, path: wsPath })
    return { path: wsPath, created: false }
  }

  async prepareForRun(identifier: string): Promise<string> {
    const { path: wsPath } = await this.ensure(identifier)

    if (this.hooks.before_run) {
      await this.runHook('before_run', this.hooks.before_run, wsPath, true)
    }

    return wsPath
  }

  async cleanupAfterRun(identifier: string): Promise<void> {
    if (this.hooks.after_run) {
      const wsPath = this.resolve(identifier)
      try {
        await this.runHook('after_run', this.hooks.after_run, wsPath, false)
      } catch (err) {
        log.warn('after_run hook failed (non-fatal)', {
          identifier,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  async remove(identifier: string): Promise<void> {
    const wsPath = this.resolve(identifier)
    if (!fs.existsSync(wsPath)) return

    if (this.hooks.before_remove) {
      try {
        await this.runHook('before_remove', this.hooks.before_remove, wsPath, false)
      } catch (err) {
        log.warn('before_remove hook failed (non-fatal)', {
          identifier,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    fs.rmSync(wsPath, { recursive: true, force: true })
    log.info('Workspace removed', { identifier, path: wsPath })
  }

  private runHook(name: string, script: string, cwd: string, fatal: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      log.info(`Running hook: ${name}`, { cwd })
      const child = exec(`sh -lc ${JSON.stringify(script)}`, {
        cwd,
        timeout: 60_000,
      }, (error, stdout, stderr) => {
        if (stdout) log.debug(`[${name}] stdout`, { output: stdout.trim() })
        if (stderr) log.debug(`[${name}] stderr`, { output: stderr.trim() })

        if (error) {
          const msg = `Hook "${name}" failed: ${error.message}`
          if (fatal) {
            log.error(msg)
            reject(new Error(msg))
          } else {
            log.warn(msg)
            resolve()
          }
        } else {
          log.info(`Hook "${name}" completed`)
          resolve()
        }
      })
    })
  }
}
