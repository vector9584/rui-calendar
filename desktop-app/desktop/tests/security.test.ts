import { describe, expect, it } from 'vitest'
import { canNavigate, isLocalAppUrl, localResourcePath, localResourceContentType } from '../src/shared/security'

describe('navigation policy', () => {
  it('accepts only the local application schemes', () => {
    expect(isLocalAppUrl('ruili://app/index.html')).toBe(true)
    expect(isLocalAppUrl('file:///etc/passwd')).toBe(false)
    expect(localResourcePath('ruili://app/../secret')).toBe(null)
  })
  it('keeps remote content on the configured origin', () => {
    expect(canNavigate('https://calendar.example/events', 'https://calendar.example/')).toBe(true)
    expect(canNavigate('https://evil.example/', 'https://calendar.example/')).toBe(false)
  })
  it('serves packaged resources with browser-compatible MIME types', () => {
    expect(localResourceContentType('/build/web/index.html')).toBe('text/html; charset=utf-8')
    expect(localResourceContentType('/build/web/assets/main.js')).toBe('text/javascript; charset=utf-8')
    expect(localResourceContentType('/build/web/assets/main.css')).toBe('text/css; charset=utf-8')
    expect(localResourceContentType('/build/web/fonts/calendar.woff2')).toBe('font/woff2')
    expect(localResourceContentType('/build/web/assets/data.bin')).toBe('application/octet-stream')
  })
})
