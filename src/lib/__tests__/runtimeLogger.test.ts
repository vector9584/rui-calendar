import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runtimeLogger } from '../runtimeLogger'

describe('runtimeLogger', () => {
  beforeEach(() => runtimeLogger.clear())

  it('keeps a bounded diagnostic snapshot without requiring console output', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (let index = 0; index < 205; index += 1) runtimeLogger.warn('diagnostic', index)
    const snapshot = runtimeLogger.snapshot()
    expect(snapshot).toHaveLength(200)
    expect(snapshot[0]?.message).toContain('5')
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
