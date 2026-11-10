import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const MAX_LOG_BYTES = 1024 * 1024
const LOG_FILES = 5

export function redact(value: string): string {
  return value
    .replace(/(authorization|password|passwd|token|secret|cookie)([\s"':=]+)[^\s,}\n]+/gi, '$1$2[redacted]')
    .replace(/(https?:\/\/)[^/@\s]+:[^/@\s]+@/g, '$1[redacted]@')
    .replace(/\b(Basic|Bearer)\s+\S+/gi, '$1 [redacted]')
}

export class RollingLogger {
  readonly directory: string
  constructor(directory: string) {
    this.directory = directory
    mkdirSync(directory, { recursive: true })
  }
  write(level: 'info' | 'warn' | 'error', message: string): void {
    const file = join(this.directory, 'ruili.log')
    if (existsSync(file) && statSync(file).size > MAX_LOG_BYTES) {
      const oldest = `${file}.${LOG_FILES}`
      if (existsSync(oldest)) unlinkSync(oldest)
      for (let index = LOG_FILES - 1; index >= 1; index--) {
        if (existsSync(`${file}.${index}`)) renameSync(`${file}.${index}`, `${file}.${index + 1}`)
      }
      renameSync(file, `${file}.1`)
    }
    appendFileSync(file, JSON.stringify({ time: new Date().toISOString(), level, message: redact(message) }) + '\n', { mode: 0o600 })
  }
  export(): string {
    return [...Array.from({ length: LOG_FILES }, (_, index) => `ruili.log.${LOG_FILES - index}`), 'ruili.log']
      .map((name) => join(this.directory, name)).filter(existsSync)
      .map((file) => readFileSync(file, 'utf8')).join('')
  }
}
