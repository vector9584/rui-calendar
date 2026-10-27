import { describe, it, expect } from 'vitest'
import type { CalendarEvent } from '../index'

describe('CalendarEvent type', () => {
  it('accepts recurrenceId field', () => {
    const event: CalendarEvent = {
      id: '1',
      calendarId: 'cal-1',
      title: 'Test Event',
      start: '2024-01-01T10:00:00Z',
      end: '2024-01-01T11:00:00Z',
      isAllDay: false,
      recurrenceId: '2024-01-01T10:00:00Z',
    }
    expect(event.recurrenceId).toBe('2024-01-01T10:00:00Z')
  })

  it('recurrenceId is optional', () => {
    const event: CalendarEvent = {
      id: '1',
      calendarId: 'cal-1',
      title: 'Test Event',
      start: '2024-01-01T10:00:00Z',
      end: '2024-01-01T11:00:00Z',
      isAllDay: false,
    }
    expect(event.recurrenceId).toBeUndefined()
  })
})
