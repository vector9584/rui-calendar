import { describe, it, expect } from 'vitest'
import { compareVersions } from '../version'

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('0.6.0', '0.6.0')).toBe(0)
  })

  it('handles leading v prefix', () => {
    expect(compareVersions('v0.7.0', '0.6.0')).toBe(1)
  })

  it('compares major versions', () => {
    expect(compareVersions('1.0.0', '0.99.99')).toBe(1)
    expect(compareVersions('0.99.99', '1.0.0')).toBe(-1)
  })

  it('compares minor versions', () => {
    expect(compareVersions('0.7.0', '0.6.0')).toBe(1)
    expect(compareVersions('0.6.0', '0.7.0')).toBe(-1)
  })

  it('compares patch versions', () => {
    expect(compareVersions('0.6.1', '0.6.0')).toBe(1)
    expect(compareVersions('0.6.0', '0.6.1')).toBe(-1)
  })

  it('returns 0 when both have leading v', () => {
    expect(compareVersions('v0.6.0', 'v0.6.0')).toBe(0)
  })

  it('orders pre-release tags below the corresponding release', () => {
    expect(compareVersions('1.0.0-rc.1', '1.0.0')).toBe(-1)
    expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBe(1)
  })

  it('orders pre-release tags lexicographically', () => {
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1)
    expect(compareVersions('1.0.0-beta', '1.0.0-alpha')).toBe(1)
  })

  it('ignores build metadata', () => {
    expect(compareVersions('1.0.0+sha.abc', '1.0.0+sha.def')).toBe(0)
  })
})
