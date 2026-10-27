import { describe, it, expect } from 'vitest'
import { matchEventBackground } from '../eventBackground'

describe('matchEventBackground', () => {
  it('matches hiking-related titles to mountain', () => {
    expect(matchEventBackground('Morning hike')).toBe('mountain')
    expect(matchEventBackground('Trek to the summit')).toBe('mountain')
  })

  it('matches biking and cycling to bike', () => {
    expect(matchEventBackground('Bike to work')).toBe('bike')
    expect(matchEventBackground('Cycling club')).toBe('bike')
  })

  it('matches coffee/cafe to coffee', () => {
    expect(matchEventBackground('Coffee with Sam')).toBe('coffee')
    expect(matchEventBackground('Café catch-up')).toBe('coffee')
  })

  it('is case-insensitive', () => {
    expect(matchEventBackground('BIRTHDAY PARTY')).toBe('cake')
  })

  it('respects word boundaries so "runway" does not match "run"', () => {
    expect(matchEventBackground('Airport runway inspection')).not.toBe('run')
  })

  it('falls through to the first matching rule in order', () => {
    // "trip" (plane) appears but "hike" (mountain) is earlier and also present.
    expect(matchEventBackground('Hike trip')).toBe('mountain')
  })

  it('returns null for no match and empty input', () => {
    expect(matchEventBackground('Xyzzy plugh')).toBeNull()
    expect(matchEventBackground('')).toBeNull()
    expect(matchEventBackground(undefined)).toBeNull()
    expect(matchEventBackground(null)).toBeNull()
  })

  it('maps common everyday events to sensible icons', () => {
    expect(matchEventBackground('Team sync')).toBe('meeting')
    expect(matchEventBackground('Standup')).toBe('meeting')
    expect(matchEventBackground('Call with client')).toBe('call')
    expect(matchEventBackground('Dentist appointment')).toBe('medical')
    expect(matchEventBackground('Grocery shopping')).toBe('shopping')
    expect(matchEventBackground('Chemistry lecture')).toBe('school')
    expect(matchEventBackground('Movie night')).toBe('movie')
    expect(matchEventBackground('Pay rent')).toBe('money')
    expect(matchEventBackground('Haircut')).toBe('haircut')
    expect(matchEventBackground('Vet visit')).toBe('pet')
  })
})
