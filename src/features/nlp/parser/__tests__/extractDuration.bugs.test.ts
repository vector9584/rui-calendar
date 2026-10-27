import { describe, it, expect } from 'vitest'
import { extractRecurrence } from '../extractDuration'

describe('Bug #93: Recurrence patterns should not match inside hyphenated words', () => {
  it('does not match "daily" in "semi-daily"', () => {
    const result = extractRecurrence('semi-daily standup')
    expect(result).toBeNull()
  })

  it('does not match "weekly" in "biweekly"', () => {
    const result = extractRecurrence('biweekly sync')
    expect(result).toBeNull()
  })

  it('does not match "monthly" in "non-monthly"', () => {
    const result = extractRecurrence('non-monthly review')
    expect(result).toBeNull()
  })

  it('does not match "yearly" in "mid-yearly"', () => {
    const result = extractRecurrence('mid-yearly planning')
    expect(result).toBeNull()
  })

  it('does not match "annually" in "bi-annually"', () => {
    const result = extractRecurrence('bi-annually checkup')
    expect(result).toBeNull()
  })

  it('does not match "weekday" in "extra-weekday"', () => {
    const result = extractRecurrence('extra-weekday meetings')
    expect(result).toBeNull()
  })

  it('does not match "weekend" in "pre-weekend"', () => {
    const result = extractRecurrence('pre-weekend prep')
    expect(result).toBeNull()
  })

  it('does not match "weekdays" in "sub-weekdays"', () => {
    const result = extractRecurrence('sub-weekdays tasks')
    expect(result).toBeNull()
  })

  it('does not match "weekends" in "post-weekends"', () => {
    const result = extractRecurrence('post-weekends cleanup')
    expect(result).toBeNull()
  })

  it('still matches standalone "daily"', () => {
    const result = extractRecurrence('daily standup at 9am')
    expect(result).not.toBeNull()
    expect(result?.frequency).toBe('daily')
  })

  it('still matches standalone "weekly"', () => {
    const result = extractRecurrence('weekly review')
    expect(result).not.toBeNull()
    expect(result?.frequency).toBe('weekly')
  })

  it('still matches standalone "monthly"', () => {
    const result = extractRecurrence('monthly report')
    expect(result).not.toBeNull()
    expect(result?.frequency).toBe('monthly')
  })

  it('still matches standalone "yearly"', () => {
    const result = extractRecurrence('yearly audit')
    expect(result).not.toBeNull()
    expect(result?.frequency).toBe('yearly')
  })

  it('still matches standalone "annually"', () => {
    const result = extractRecurrence('annually checkup')
    expect(result).not.toBeNull()
    expect(result?.frequency).toBe('yearly')
  })

  it('still matches "every day"', () => {
    const result = extractRecurrence('every day at 8am')
    expect(result).not.toBeNull()
    expect(result?.frequency).toBe('daily')
  })

  it('still matches "every week"', () => {
    const result = extractRecurrence('every week on Monday')
    expect(result).not.toBeNull()
    expect(result?.frequency).toBe('weekly')
  })

  it('still matches "every month"', () => {
    const result = extractRecurrence('every month')
    expect(result).not.toBeNull()
    expect(result?.frequency).toBe('monthly')
  })

  it('still matches "every year"', () => {
    const result = extractRecurrence('every year')
    expect(result).not.toBeNull()
    expect(result?.frequency).toBe('yearly')
  })

  it('still matches "every weekday"', () => {
    const result = extractRecurrence('every weekday')
    expect(result).not.toBeNull()
    expect(result?.frequency).toBe('weekly')
  })

  it('still matches "every weekend"', () => {
    const result = extractRecurrence('every weekend')
    expect(result).not.toBeNull()
    expect(result?.frequency).toBe('weekly')
  })
})
