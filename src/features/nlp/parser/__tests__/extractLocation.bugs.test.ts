import { describe, it, expect } from 'vitest'
import { extractLocation } from '../extractLocation'

describe('Bug #102: "at the" location capture includes trailing date words', () => {
  it('truncates "at the" location at "tomorrow"', () => {
    const result = extractLocation('meeting at the office tomorrow')
    expect(result).toBe('office')
  })

  it('truncates "at the" location at "today"', () => {
    const result = extractLocation('lunch at the cafe today')
    expect(result).toBe('cafe')
  })

  it('truncates "at the" location at day names', () => {
    const result = extractLocation('meeting at the conference room monday')
    expect(result).toBe('conference room')
  })

  it('truncates "at the" location at time words', () => {
    const result = extractLocation('dinner at the restaurant morning')
    expect(result).toBe('restaurant')
  })

  it('truncates "at the" location at "next week"', () => {
    const result = extractLocation('visit at the doctor next week')
    expect(result).toBe('doctor')
  })

  it('still returns full location when no date/time words follow', () => {
    const result = extractLocation('meeting at the grand ballroom')
    expect(result).toBe('grand ballroom')
  })

  it('handles "at the" with comma-separated location before date', () => {
    const result = extractLocation('event at the park, main entrance tomorrow')
    expect(result).toBe('park, main entrance')
  })

  it('does not return single character locations', () => {
    const result = extractLocation('meeting at the a tomorrow')
    expect(result).toBeUndefined()
  })

  it('truncates "at the" at "noon"', () => {
    const result = extractLocation('gym at the pool noon')
    expect(result).toBe('pool')
  })

  it('does not break simple "at the" without trailing words', () => {
    const result = extractLocation('meeting at the office')
    expect(result).toBe('office')
  })

  it('does not treat "16 to 17" as a location', () => {
    const result = extractLocation('hang out tomorrow at 16 to 17')
    expect(result).toBeUndefined()
  })
})
