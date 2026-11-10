import { APP_ORIGIN, SHELL_ORIGIN } from './schema'

export function isLocalAppUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'ruili:' && ['app', 'shell'].includes(url.hostname) && !url.port && !url.username && !url.password
  } catch {
    return false
  }
}

export function canNavigate(value: string, remoteUrl = ''): boolean {
  if (isLocalAppUrl(value)) return true
  if (!remoteUrl) return false
  try {
    const target = new URL(value)
    return ['https:', 'http:'].includes(target.protocol) && target.origin === new URL(remoteUrl).origin && !target.username && !target.password
  } catch {
    return false
  }
}

export function localResourcePath(value: string): { area: 'app' | 'shell'; pathname: string } | null {
  if (!isLocalAppUrl(value)) return null
  if (/(?:^|\/)\.\.(?:\/|$)/.test(value) || /%2e%2e/i.test(value)) return null
  try {
    const url = new URL(value)
    const pathname = decodeURIComponent(url.pathname)
    if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').includes('..')) return null
    return { area: url.hostname === 'app' ? 'app' : 'shell', pathname }
  } catch {
    return null
  }
}

export function localResourceContentType(path: string): string {
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase()
  const contentTypes: Record<string, string> = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm',
    '.ics': 'text/calendar; charset=utf-8', '.vcf': 'text/vcard; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  }
  return contentTypes[extension] ?? 'application/octet-stream'
}

export const SHELL_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
].join('; ')

export const LOCAL_ORIGINS = [APP_ORIGIN, SHELL_ORIGIN] as const
