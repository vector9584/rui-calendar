import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '@/types'
import { getInitialFormState } from '../eventModalState'

describe('getInitialFormState legacy event values', () => {
  it('normalizes a missing legacy event title to a controlled string', () => {
    const event = {
      id: 'legacy-event',
      title: undefined,
      start: '2026-09-15T10:00:00.000Z',
      end: '2026-09-15T11:00:00.000Z',
      calendarId: 'default',
      isAllDay: false,
    } as unknown as CalendarEvent

    const state = getInitialFormState(
      true,
      event.id,
      null,
      null,
      [event],
      [{ id: 'default', isDefault: true }],
      []
    )

    expect(state.title).toBe('')
  })
})
