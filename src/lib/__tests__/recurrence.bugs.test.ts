import { describe, it, expect } from 'vitest'
import { describeRecurrence } from '../recurrence'
import { makeEvent, makeRule } from './fixtures'

describe('Bug #85: Sub-daily frequencies in describeFromRecurrenceRule', () => {
  describe('RecurrenceRule objects', () => {
    it('describes SECONDLY frequency', () => {
      const event = makeEvent({ recurrence: makeRule({ frequency: 'secondly' }) })
      expect(describeRecurrence(event)).toBe('Every second')
    })

    it('describes MINUTELY frequency', () => {
      const event = makeEvent({ recurrence: makeRule({ frequency: 'minutely' }) })
      expect(describeRecurrence(event)).toBe('Every minute')
    })

    it('describes HOURLY frequency', () => {
      const event = makeEvent({ recurrence: makeRule({ frequency: 'hourly' }) })
      expect(describeRecurrence(event)).toBe('Every hour')
    })

    it('describes MINUTELY with interval 5', () => {
      const event = makeEvent({ recurrence: makeRule({ frequency: 'minutely', interval: 5 }) })
      expect(describeRecurrence(event)).toBe('Every 5 minutes')
    })

    it('describes HOURLY with interval 2', () => {
      const event = makeEvent({ recurrence: makeRule({ frequency: 'hourly', interval: 2 }) })
      expect(describeRecurrence(event)).toBe('Every 2 hours')
    })

    it('describes SECONDLY with interval 30', () => {
      const event = makeEvent({ recurrence: makeRule({ frequency: 'secondly', interval: 30 }) })
      expect(describeRecurrence(event)).toBe('Every 30 seconds')
    })
  })

  describe('rruleString sources', () => {
    it('describes SECONDLY from rruleString', () => {
      const event = makeEvent({ rruleString: 'FREQ=SECONDLY;INTERVAL=1' })
      expect(describeRecurrence(event)).toBe('Every second')
    })

    it('describes MINUTELY from rruleString', () => {
      const event = makeEvent({ rruleString: 'FREQ=MINUTELY;INTERVAL=5' })
      expect(describeRecurrence(event)).toBe('Every 5 minutes')
    })

    it('describes HOURLY from rruleString', () => {
      const event = makeEvent({ rruleString: 'FREQ=HOURLY;INTERVAL=2' })
      expect(describeRecurrence(event)).toBe('Every 2 hours')
    })

    it('describes HOURLY with interval 1 from rruleString', () => {
      const event = makeEvent({ rruleString: 'FREQ=HOURLY' })
      expect(describeRecurrence(event)).toBe('Every hour')
    })
  })

  describe('existing frequencies still work', () => {
    it('describes DAILY frequency', () => {
      const event = makeEvent({ recurrence: makeRule({ frequency: 'daily' }) })
      expect(describeRecurrence(event)).toBe('Every day')
    })

    it('describes WEEKLY frequency', () => {
      const event = makeEvent({ recurrence: makeRule({ frequency: 'weekly' }) })
      expect(describeRecurrence(event)).toBe('Every week')
    })

    it('describes MONTHLY frequency', () => {
      const event = makeEvent({ recurrence: makeRule({ frequency: 'monthly' }) })
      expect(describeRecurrence(event)).toBe('Every month')
    })

    it('describes YEARLY frequency', () => {
      const event = makeEvent({ recurrence: makeRule({ frequency: 'yearly' }) })
      expect(describeRecurrence(event)).toBe('Every year')
    })
  })

  describe('end-of-recurrence suffixes (rrule.toText() handles them natively)', () => {
    it('includes count when rule has count', () => {
      const event = makeEvent({
        recurrence: makeRule({ frequency: 'weekly', count: 5 }),
      })
      expect(describeRecurrence(event)).toBe('Every week for 5 times')
    })

    it('uses singular "time" for count=1', () => {
      const event = makeEvent({
        recurrence: makeRule({ frequency: 'daily', count: 1 }),
      })
      expect(describeRecurrence(event)).toBe('Every day for 1 time')
    })

    it('includes "until" when rule has endDate', () => {
      const event = makeEvent({
        recurrence: makeRule({
          frequency: 'daily',
          endDate: '2025-12-31T23:59:59',
        }),
      })
      expect(describeRecurrence(event)).toBe('Every day until December 31, 2025')
    })

    it('includes count when rruleString has COUNT', () => {
      const event = makeEvent({ rruleString: 'FREQ=WEEKLY;COUNT=10' })
      expect(describeRecurrence(event)).toBe('Every week for 10 times')
    })

    it('includes until when rruleString has UNTIL (date only)', () => {
      const event = makeEvent({ rruleString: 'FREQ=DAILY;UNTIL=20251231' })
      expect(describeRecurrence(event)).toBe('Every day until December 31, 2025')
    })
  })
})
