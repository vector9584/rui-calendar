import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConfigStore, migrateConfig } from '../src/main/store'

describe('ConfigStore', () => {
  it('migrates legacy flat configuration and preserves bounds', () => {
    const root = mkdtempSync(join(tmpdir(), 'ruili-store-'))
    const path = join(root, 'config.json')
    writeFileSync(path, JSON.stringify({ opacity: 0.6, mode: 'desktop', bounds: { x: 1, y: 2, width: 400, height: 680 } }))
    const store = new ConfigStore(path)
    expect(store.get().preferences.mode).toBe('desktop')
    expect(store.get().preferences.bounds?.x).toBe(1)
    expect(JSON.parse(readFileSync(path, 'utf8')).preferences.opacity).toBe(0.6)
  })
  it('increments revision and atomically persists a patch', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'ruili-store-')), 'config.json')
    const store = new ConfigStore(path)
    const first = store.get().revision
    store.patch({ opacity: 0.5, theme: 'dark' })
    expect(store.get().revision).toBe(first + 1)
    expect(store.get().preferences.theme).toBe('dark')
  })
  it('rejects credentials embedded in server URLs', () => {
    expect(migrateConfig({ remoteUrl: 'https://user:password@example.com' }).preferences.remoteUrl).toBe('')
  })
})
