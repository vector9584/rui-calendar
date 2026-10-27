import { describe, it, expect } from 'vitest'
import { parseNaturalLanguage } from '@/features/nlp/parser/NLParser'

describe('NLP e2e — time range not treated as location', () => {
  it('hang out tomorrow at 16 to 17', () => {
    const result = parseNaturalLanguage('hang out tomorrow at 16 to 17')
    expect(result.title).toBe('Hang out')
    expect(result.location).toBeUndefined()
    expect(result.startDate).toBeTruthy()
    expect(result.endDate).toBeTruthy()
    expect(result.isAllDay).toBe(false)
  })

  it('call from 3 to 4', () => {
    const result = parseNaturalLanguage('call from 3 to 4')
    expect(result.title).toBe('Call')
    expect(result.location).toBeUndefined()
  })

  it('meeting tomorrow at 16 to 17', () => {
    const result = parseNaturalLanguage('meeting tomorrow at 16 to 17')
    expect(result.title).toBe('Meeting')
    expect(result.location).toBeUndefined()
  })

  it('gym at 5 to 6', () => {
    const result = parseNaturalLanguage('gym at 5 to 6')
    expect(result.title).toBe('Gym')
    expect(result.location).toBeUndefined()
  })
})
