import { describe, it, expect, beforeEach } from 'vitest'
import { NLParser } from '../NLParser'

describe('Bug #92: Ordinal preprocessing should not corrupt month names', () => {
  let parser: NLParser

  beforeEach(() => {
    parser = new NLParser({
      defaultDate: new Date('2026-05-27T10:00:00'),
      defaultDuration: 60,
    })
  })

  it('does not double the month when ordinal precedes a month name', () => {
    const result = parser.parse('15th March meeting')
    // The title should not contain "March March"
    expect(result.title.toLowerCase()).not.toContain('march march')
  })

  it('preserves the month name from the user input when ordinal + month present', () => {
    const result = parser.parse('meeting on 3rd June')
    // Should not produce "3 june june"
    expect(result.title.toLowerCase()).not.toContain('june june')
  })

  it('still replaces standalone ordinal with current month', () => {
    // "the 15th" alone should be converted to "15 may" (May = month 4, 0-indexed)
    const result = parser.parse('the 15th of the month')
    // The preprocessed form should have "15 may" so chrono can parse it
    expect(result.startDate).toBeInstanceOf(Date)
    expect(result.startDate.getTime()).toBeGreaterThan(0)
  })

  it('replaces bare ordinal without month name', () => {
    const result = parser.parse('meeting on the 5th')
    expect(result.startDate).toBeInstanceOf(Date)
    expect(result.startDate.getTime()).toBeGreaterThan(0)
  })

  it('does not modify ordinals followed by full month names', () => {
    const result = parser.parse('1st January lunch')
    // "1st January" should stay intact, not become "1 january january"
    expect(result.title.toLowerCase()).not.toContain('january january')
  })

  it('produces correct title for ordinal with month name', () => {
    const result = parser.parse('15th March meeting')
    // "15th March" should be recognized as a date, leaving "meeting" as title
    expect(result.title.toLowerCase()).toContain('meeting')
  })
})

describe('Bug #95: Title extraction with preprocessed input', () => {
  let parser: NLParser

  beforeEach(() => {
    parser = new NLParser({
      defaultDate: new Date('2026-05-27T10:00:00'),
      defaultDuration: 60,
    })
  })

  it('produces a clean title when ordinal is preprocessed', () => {
    // "the 15th" gets preprocessed to "15 may" — title should still be clean
    const result = parser.parse('dentist on the 15th')
    expect(result.title).toBe('Dentist')
  })

  it('produces a clean title for ordinal with day only', () => {
    const result = parser.parse('appointment on 21st')
    expect(result.title).toBe('Appointment')
  })

  it('produces a clean title for time range with between', () => {
    const result = parser.parse('swimming with friends tomorrow , between 17-18')
    expect(result.title).toBe('Swimming with friends')
  })

  it('produces a clean title for time range with between and and', () => {
    const result = parser.parse('swimming with friends tomorrow between 17 and 18')
    expect(result.title).toBe('Swimming with friends')
  })

  it('produces a clean title for simple event', () => {
    const result = parser.parse('team meeting tomorrow at 3pm')
    expect(result.title.toLowerCase()).toContain('team meeting')
    expect(result.title.toLowerCase()).not.toContain('tomorrow')
  })

  it('strips task prefix and produces clean title', () => {
    const result = parser.parse('todo buy groceries')
    expect(result.isTask).toBe(true)
    expect(result.title.toLowerCase()).toContain('buy groceries')
  })
})
