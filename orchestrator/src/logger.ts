const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
type Level = keyof typeof LEVELS

const COLORS: Record<Level, string> = {
  debug: '\x1b[90m',   // gray
  info: '\x1b[36m',    // cyan
  warn: '\x1b[33m',    // yellow
  error: '\x1b[31m',   // red
}
const RESET = '\x1b[0m'

const minLevel: Level = (process.env.LOG_LEVEL as Level) || 'info'

export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void
  info(msg: string, ctx?: Record<string, unknown>): void
  warn(msg: string, ctx?: Record<string, unknown>): void
  error(msg: string, ctx?: Record<string, unknown>): void
}

export function createLogger(namespace: string): Logger {
  const log = (level: Level, msg: string, ctx?: Record<string, unknown>) => {
    if (LEVELS[level] < LEVELS[minLevel]) return
    const entry = {
      ts: new Date().toISOString(),
      level,
      ns: namespace,
      msg,
      ...ctx,
    }
    const color = COLORS[level]
    const prefix = `${color}[${entry.ts}] ${level.toUpperCase().padEnd(5)}${RESET} [${namespace}]`
    if (ctx && Object.keys(ctx).length > 0) {
      console.log(`${prefix} ${msg}`, ctx)
    } else {
      console.log(`${prefix} ${msg}`)
    }
  }
  return {
    debug: (msg, ctx) => log('debug', msg, ctx),
    info: (msg, ctx) => log('info', msg, ctx),
    warn: (msg, ctx) => log('warn', msg, ctx),
    error: (msg, ctx) => log('error', msg, ctx),
  }
}
