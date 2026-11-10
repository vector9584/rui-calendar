import { z } from 'zod'

export { IPC } from './ipc'

export const APP_ORIGIN = 'ruili://app'
export const SHELL_ORIGIN = 'ruili://shell'
export const TOOLBAR_HEIGHT = 32
export const WINDOW_MIN_WIDTH = 320
export const WINDOW_MIN_HEIGHT = 480
export const GLOBAL_SHORTCUT = 'CommandOrControl+Shift+Space'

export const boundsSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().min(WINDOW_MIN_WIDTH).max(16384),
  height: z.number().int().min(WINDOW_MIN_HEIGHT).max(16384),
})

export function isServerUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}

export const serverUrlSchema = z.string().max(4096).refine(isServerUrl, '请输入 http 或 https 地址，不要在地址中包含密码')
const optionalUrlSchema = z.union([z.literal(''), serverUrlSchema])

export const preferencesSchema = z.object({
  opacity: z.number().min(0.05).max(1).default(0.95),
  mode: z.enum(['top', 'desktop']).default('top'),
  autoStart: z.boolean().default(false),
  locked: z.boolean().default(false),
  bounds: boundsSchema.nullable().default(null),
  mini: z.boolean().default(false),
  doNotDisturb: z.boolean().default(false),
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  remoteUrl: optionalUrlSchema.default(''),
  updateUrl: optionalUrlSchema.refine((url) => !url || url.startsWith('https:'), '更新地址必须使用 HTTPS').default(''),
  skippedVersion: z.string().max(100).default(''),
  trustedCertificates: z.record(z.string(), z.string().regex(/^[A-Fa-f0-9:]+$/)).default({}),
}).strict()

export const configSchema = z.object({
  version: z.literal(1).default(1),
  revision: z.number().int().nonnegative().default(0),
  preferences: preferencesSchema.default(() => preferencesSchema.parse({})),
})

export type Preferences = z.infer<typeof preferencesSchema>
export type Config = z.infer<typeof configSchema>
export type Bounds = z.infer<typeof boundsSchema>

export const credentialSchema = z.object({
  id: z.string().min(1).max(200),
  serverUrl: serverUrlSchema,
  username: z.string().max(1024),
  password: z.string().max(16384),
  customHeaders: z.record(z.string().max(200), z.string().max(16384)).optional(),
}).strict()
export type Credential = z.infer<typeof credentialSchema>

export interface CertificateProblem {
  origin: string
  fingerprint: string
  subject: string
  issuer: string
  validExpiry: number
  reason: string
}

export interface AppState extends Config {
  runtime: {
    platform: string
    version: string
    trayAvailable: boolean
    hotkeyAvailable: boolean
    keychainAvailable: boolean
    autoStartAvailable: boolean
    opacityAvailable: boolean
    dark: boolean
    message: string
    certificate: CertificateProblem | null
    update: {
      status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
      version: string
      progress: number
      message: string
    }
  }
}

export const patchSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('preferences'), value: preferencesSchema.partial() }).strict(),
  z.object({ type: z.literal('credential:save'), value: credentialSchema }).strict(),
  z.object({ type: z.literal('credential:delete'), id: z.string().min(1).max(200) }).strict(),
  z.object({ type: z.literal('certificate:trust'), origin: serverUrlSchema, fingerprint: z.string().max(256) }).strict(),
  z.object({ type: z.literal('open:external'), url: serverUrlSchema }).strict(),
  z.object({ type: z.literal('notification'), title: z.string().max(200), body: z.string().max(2000), id: z.string().max(200) }).strict(),
  z.object({ type: z.literal('log'), level: z.enum(['info', 'warn', 'error']), message: z.string().max(4000) }).strict(),
  z.object({ type: z.literal('backup:create'), password: z.string().min(12).max(1024), data: z.string().max(64 * 1024 * 1024) }).strict(),
  z.object({ type: z.literal('backup:restore'), password: z.string().min(1).max(1024) }).strict(),
  z.object({ type: z.literal('action'), name: z.enum(['hide', 'show', 'quit', 'settings', 'calendar', 'reload', 'menu', 'logs:export', 'update:check', 'update:download', 'update:install', 'update:later', 'update:skip']) }).strict(),
])
export type StatePatch = z.infer<typeof patchSchema>
export type PatchResult = { state: AppState; data?: string }
export type StateQuery = { type: 'state' } | { type: 'credentials' }
export interface DesktopApi {
  get(query?: { type: 'state' }): Promise<AppState>
  get(query: { type: 'credentials' }): Promise<Credential[]>
  patch(patch: StatePatch): Promise<PatchResult>
  subscribe(listener: (state: AppState) => void): () => void
}

declare global {
  interface Window {
    ruili?: DesktopApi
  }
}
