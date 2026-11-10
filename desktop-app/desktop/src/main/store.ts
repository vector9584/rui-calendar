import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { configSchema, preferencesSchema } from '../shared/schema'
import type { Config, Preferences } from '../shared/schema'

export function migrateConfig(raw: unknown): Config {
  const current = configSchema.safeParse(raw)
  if (current.success && typeof raw === 'object' && raw !== null && 'preferences' in raw) return current.data
  if (typeof raw !== 'object' || raw === null) throw new Error('配置文件不是有效对象')
  if ('version' in raw && raw.version !== 0 && raw.version !== undefined) throw new Error('此配置由更新版本创建，请使用相同或更新的瑞历版本')
  const legacy = raw as Record<string, unknown>
  const fields: Record<string, unknown> = {}
  for (const key of Object.keys(preferencesSchema.shape)) {
    const value = legacy[key]
    if (value !== undefined) {
      const parsed = preferencesSchema.shape[key as keyof Preferences].safeParse(value)
      if (parsed.success) fields[key] = parsed.data
    }
  }
  return configSchema.parse({ preferences: fields })
}

/** Atomic, durable writes: a failed write never becomes the authoritative in-memory state. */
export function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp`
  writeFileSync(temporary, content, { encoding: 'utf8', mode: 0o600, flush: true })
  renameSync(temporary, path)
}

export class ConfigStore {
  private config: Config
  private readonly listeners = new Set<(config: Config) => void>()
  readonly recoveryMessage: string

  constructor(private readonly path: string) {
    if (!existsSync(path)) {
      this.config = configSchema.parse({})
      this.recoveryMessage = ''
      return
    }
    try {
      const raw: unknown = JSON.parse(readFileSync(path, 'utf8'))
      this.config = migrateConfig(raw)
      if (!(typeof raw === 'object' && raw !== null && 'preferences' in raw)) {
        copyFileSync(path, `${path}.legacy-backup`)
        writeAtomic(path, JSON.stringify(this.config, null, 2))
      }
      this.recoveryMessage = ''
    } catch (error) {
      if (error instanceof Error && error.message.includes('更新版本')) throw error
      copyFileSync(path, `${path}.damaged-${Date.now()}`)
      if (existsSync(`${path}.previous`)) {
        this.config = migrateConfig(JSON.parse(readFileSync(`${path}.previous`, 'utf8')) as unknown)
        this.recoveryMessage = '设置文件损坏，已恢复上次设置；原文件已保留在日志目录旁。'
      } else {
        this.config = configSchema.parse({})
        this.recoveryMessage = '设置文件损坏，已保留原文件并恢复窗口默认设置；日历数据未被修改。'
      }
    }
  }

  get(): Config {
    return structuredClone(this.config)
  }

  patch(value: Partial<Preferences>): Config {
    const validated = preferencesSchema.partial().parse(value)
    const next = configSchema.parse({ ...this.config, revision: this.config.revision + 1, preferences: { ...this.config.preferences, ...validated } })
    if (existsSync(this.path)) copyFileSync(this.path, `${this.path}.previous`)
    writeAtomic(this.path, JSON.stringify(next, null, 2))
    this.config = next
    for (const listener of this.listeners) listener(this.get())
    return this.get()
  }

  subscribe(listener: (config: Config) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
}
