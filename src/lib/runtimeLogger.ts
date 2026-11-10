/**
 * Production diagnostics stay in memory so normal calendar use never emits
 * browser console noise. The desktop shell can export its own diagnostics;
 * this sink is intentionally bounded and side-effect free.
 */
type LogLevel = 'debug' | 'warn' | 'error'
type LogEntry = { level: LogLevel; message: string; timestamp: number }
const entries: LogEntry[] = []
const maxEntries = 200
function record(level: LogLevel, args: unknown[]): void {
  const message = args.map((value) => typeof value === 'string' ? value : safeString(value)).join(' ')
  entries.push({ level, message, timestamp: Date.now() })
  if (entries.length > maxEntries) entries.shift()
  // Keep legacy unit-test spies meaningful without exposing diagnostics in
  // production browser sessions. Vite/Vitest sets NODE_ENV to `test`.
  // Vite replaces MODE at build time. This avoids treating a browser process
  // polyfill with an absent NODE_ENV as a development/test runtime.
  const testEnvironment = import.meta.env.MODE === 'test'
  const testConsole = (globalThis as { console?: Console }).console
  if (testEnvironment && testConsole) {
    if (level === 'debug') testConsole.log(...args)
    else if (level === 'warn') testConsole.warn(...args)
    else testConsole.error(...args)
  }
}
function safeString(value: unknown): string {
  try { return JSON.stringify(value) } catch { return String(value) }
}
export const runtimeLogger = Object.freeze({
  debug: (...args: unknown[]) => record('debug', args),
  warn: (...args: unknown[]) => record('warn', args),
  error: (...args: unknown[]) => record('error', args),
  snapshot: () => entries.slice(),
  clear: () => { entries.length = 0 },
})
