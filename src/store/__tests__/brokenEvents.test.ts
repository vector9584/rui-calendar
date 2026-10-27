import { describe, it, expect, beforeEach } from 'vitest'
import { useCalendarStore } from '../calendarStore'
import type { CalendarEvent } from '@/types'

const createEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'test-1',
  calendarId: 'default',
  title: 'Test Event',
  start: '2026-03-10T10:00:00Z',
  end: '2026-03-10T11:00:00Z',
  isAllDay: false,
  ...overrides,
})

describe('Broken Events Store', () => {
  beforeEach(() => {
    useCalendarStore.setState({
      events: [],
      brokenEvents: [],
      calendars: [
        {
          id: 'default',
          name: 'My Calendar',
          color: '#4285F4',
          isVisible: true,
          isDefault: true,
          showTasksInViews: true,
        },
      ],
      categories: [],
      autoCategoryRules: [],
    })
  })

  describe('addEvent with broken dates', () => {
    it('adds event with start > end to brokenEvents instead of events', () => {
      const brokenEvent = createEvent({
        id: 'broken-1',
        start: '2026-03-10T15:00:00Z',
        end: '2026-03-10T14:00:00Z',
      })

      useCalendarStore.getState().addEvent(brokenEvent)

      const state = useCalendarStore.getState()
      expect(state.events).toHaveLength(0)
      expect(state.brokenEvents).toHaveLength(1)
      expect(state.brokenEvents[0].event.id).toBe('broken-1')
      expect(state.brokenEvents[0].reason).toContain('start')
      expect(state.brokenEvents[0].reason).toContain('>')
      expect(state.brokenEvents[0].reason).toContain('end')
    })

    it('adds valid event to events normally', () => {
      const validEvent = createEvent({
        id: 'valid-1',
        start: '2026-03-10T10:00:00Z',
        end: '2026-03-10T11:00:00Z',
      })

      useCalendarStore.getState().addEvent(validEvent)

      const state = useCalendarStore.getState()
      expect(state.events).toHaveLength(1)
      expect(state.brokenEvents).toHaveLength(0)
    })

    it('does not duplicate broken events with same id', () => {
      const brokenEvent = createEvent({
        id: 'broken-1',
        start: '2026-03-10T15:00:00Z',
        end: '2026-03-10T14:00:00Z',
      })

      useCalendarStore.getState().addEvent(brokenEvent)
      useCalendarStore.getState().addEvent(brokenEvent)

      const state = useCalendarStore.getState()
      expect(state.brokenEvents).toHaveLength(1)
    })

    it('allows all-day events with start > end', () => {
      const allDayEvent = createEvent({
        id: 'allday-1',
        start: '2026-03-12',
        end: '2026-03-11',
        isAllDay: true,
      })

      useCalendarStore.getState().addEvent(allDayEvent)

      const state = useCalendarStore.getState()
      expect(state.events).toHaveLength(1)
      expect(state.brokenEvents).toHaveLength(0)
    })
  })

  describe('updateEvent with broken dates', () => {
    it('moves event to brokenEvents when update creates start > end', () => {
      const validEvent = createEvent({
        id: 'event-1',
        start: '2026-03-10T10:00:00Z',
        end: '2026-03-10T11:00:00Z',
      })

      useCalendarStore.getState().addEvent(validEvent)
      expect(useCalendarStore.getState().events).toHaveLength(1)

      useCalendarStore.getState().updateEvent('event-1', {
        start: '2026-03-10T15:00:00Z',
        end: '2026-03-10T14:00:00Z',
      })

      const state = useCalendarStore.getState()
      expect(state.events).toHaveLength(0)
      expect(state.brokenEvents).toHaveLength(1)
      expect(state.brokenEvents[0].event.id).toBe('event-1')
    })
  })

  describe('addBrokenEvent', () => {
    it('adds a broken event to the list', () => {
      const event = createEvent({ id: 'broken-1' })
      useCalendarStore.getState().addBrokenEvent(event, 'test reason')

      const state = useCalendarStore.getState()
      expect(state.brokenEvents).toHaveLength(1)
      expect(state.brokenEvents[0].event.id).toBe('broken-1')
      expect(state.brokenEvents[0].reason).toBe('test reason')
      expect(state.brokenEvents[0].detectedAt).toBeDefined()
    })

    it('does not add duplicate broken events', () => {
      const event = createEvent({ id: 'broken-1' })
      useCalendarStore.getState().addBrokenEvent(event, 'reason 1')
      useCalendarStore.getState().addBrokenEvent(event, 'reason 2')

      const state = useCalendarStore.getState()
      expect(state.brokenEvents).toHaveLength(1)
      expect(state.brokenEvents[0].reason).toBe('reason 1')
    })
  })

  describe('removeBrokenEvent', () => {
    it('removes a broken event by id', () => {
      const event = createEvent({ id: 'broken-1' })
      useCalendarStore.getState().addBrokenEvent(event, 'reason')
      expect(useCalendarStore.getState().brokenEvents).toHaveLength(1)

      useCalendarStore.getState().removeBrokenEvent('broken-1')
      expect(useCalendarStore.getState().brokenEvents).toHaveLength(0)
    })
  })

  describe('fixBrokenEvent', () => {
    it('swaps start/end and moves event to normal events', () => {
      const brokenEvent = createEvent({
        id: 'broken-1',
        start: '2026-03-10T15:00:00Z',
        end: '2026-03-10T14:00:00Z',
      })

      useCalendarStore.getState().addBrokenEvent(brokenEvent, 'start > end')
      expect(useCalendarStore.getState().brokenEvents).toHaveLength(1)

      useCalendarStore.getState().fixBrokenEvent('broken-1')

      const state = useCalendarStore.getState()
      expect(state.brokenEvents).toHaveLength(0)
      expect(state.events).toHaveLength(1)
      expect(state.events[0].start).toBe('2026-03-10T14:00:00Z')
      expect(state.events[0].end).toBe('2026-03-10T15:00:00Z')
    })

    it('does nothing if broken event not found', () => {
      useCalendarStore.getState().fixBrokenEvent('nonexistent')

      const state = useCalendarStore.getState()
      expect(state.brokenEvents).toHaveLength(0)
      expect(state.events).toHaveLength(0)
    })
  })

  describe('brokenEvents persistence', () => {
    it('persists brokenEvents in state', () => {
      const brokenEvent = createEvent({ id: 'broken-1' })
      useCalendarStore.getState().addBrokenEvent(brokenEvent, 'reason')

      const state = useCalendarStore.getState()
      expect(state.brokenEvents).toHaveLength(1)
      expect(state.brokenEvents[0].event.id).toBe('broken-1')
    })
  })
})
