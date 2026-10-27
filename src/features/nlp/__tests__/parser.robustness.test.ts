import { describe, it, expect } from 'vitest'
import { parseNaturalLanguage } from '../parser/NLParser'

describe('NLP pipeline robustness: pass ordering must not corrupt extraction', () => {
  it('extracts location when duration is also in the phrase', () => {
    const result = parseNaturalLanguage('lunch at the office for an hour on Friday')
    expect(result.location).toBe('office')
    expect(result.title.toLowerCase()).toContain('lunch')
  })

  it('extracts duration when location is also in the phrase', () => {
    const result = parseNaturalLanguage('lunch at the office for an hour on Friday')
    expect(result.duration).toBe(60)
  })

  it('extracts location when recurrence is also in the phrase', () => {
    const result = parseNaturalLanguage('standup at the office every Monday at 9am')
    expect(result.location).toBe('office')
  })
})
