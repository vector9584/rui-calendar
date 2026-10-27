import { describe, it, expect, beforeEach } from 'vitest'
import { useCalendarStore } from '../calendarStore'
import type { DuplicateUidIssue } from '@/types'

const makeIssue = (overrides: Partial<DuplicateUidIssue> = {}): DuplicateUidIssue => ({
  uid: 'shared',
  calendarId: 'cal-1',
  resources: [
    { title: 'Event A', start: '2024-04-02T00:00:00Z', href: '/cal/a.ics', kept: true },
    { title: 'Event B', start: '2024-09-15T00:00:00Z', href: '/cal/b.ics', kept: false },
  ],
  detectedAt: '2026-07-09T00:00:00Z',
  ...overrides,
})

describe('Duplicate UID issues store', () => {
  beforeEach(() => {
    useCalendarStore.setState({ duplicateUidIssues: [] })
  })

  it('adds a duplicate-UID issue', () => {
    useCalendarStore.getState().addDuplicateUidIssue(makeIssue())
    expect(useCalendarStore.getState().duplicateUidIssues).toHaveLength(1)
    expect(useCalendarStore.getState().duplicateUidIssues[0].uid).toBe('shared')
  })

  it('replaces an existing issue with the same uid and calendarId', () => {
    const { addDuplicateUidIssue } = useCalendarStore.getState()
    addDuplicateUidIssue(makeIssue({ detectedAt: 'first' }))
    addDuplicateUidIssue(makeIssue({ detectedAt: 'second' }))

    const issues = useCalendarStore.getState().duplicateUidIssues
    expect(issues).toHaveLength(1)
    expect(issues[0].detectedAt).toBe('second')
  })

  it('keeps issues with the same uid but different calendars separate', () => {
    const { addDuplicateUidIssue } = useCalendarStore.getState()
    addDuplicateUidIssue(makeIssue({ calendarId: 'cal-1' }))
    addDuplicateUidIssue(makeIssue({ calendarId: 'cal-2' }))
    expect(useCalendarStore.getState().duplicateUidIssues).toHaveLength(2)
  })

  it('clears all duplicate-UID issues', () => {
    const { addDuplicateUidIssue, clearDuplicateUidIssues } = useCalendarStore.getState()
    addDuplicateUidIssue(makeIssue({ calendarId: 'cal-1' }))
    addDuplicateUidIssue(makeIssue({ calendarId: 'cal-2' }))
    clearDuplicateUidIssues()
    expect(useCalendarStore.getState().duplicateUidIssues).toEqual([])
  })

  it('removes a single resource, leaving the rest of the issue intact', () => {
    const { addDuplicateUidIssue, removeDuplicateUidResource } = useCalendarStore.getState()
    addDuplicateUidIssue(
      makeIssue({
        resources: [
          { title: 'Event A', start: '2024-04-02T00:00:00Z', href: '/cal/a.ics', kept: true },
          { title: 'Event B', start: '2024-09-15T00:00:00Z', href: '/cal/b.ics', kept: false },
          { title: 'Event C', start: '2024-11-01T00:00:00Z', href: '/cal/c.ics', kept: false },
        ],
      })
    )

    removeDuplicateUidResource('shared', 'cal-1', '/cal/c.ics')

    const issues = useCalendarStore.getState().duplicateUidIssues
    expect(issues).toHaveLength(1)
    expect(issues[0].resources.map((r) => r.href)).toEqual(['/cal/a.ics', '/cal/b.ics'])
  })

  it('drops the whole issue once fewer than two resources remain', () => {
    const { addDuplicateUidIssue, removeDuplicateUidResource } = useCalendarStore.getState()
    addDuplicateUidIssue(makeIssue())

    removeDuplicateUidResource('shared', 'cal-1', '/cal/b.ics')

    expect(useCalendarStore.getState().duplicateUidIssues).toEqual([])
  })

  it('leaves other calendars/uids untouched', () => {
    const { addDuplicateUidIssue, removeDuplicateUidResource } = useCalendarStore.getState()
    addDuplicateUidIssue(makeIssue({ calendarId: 'cal-1' }))
    addDuplicateUidIssue(makeIssue({ calendarId: 'cal-2' }))

    removeDuplicateUidResource('shared', 'cal-1', '/cal/b.ics')

    const issues = useCalendarStore.getState().duplicateUidIssues
    expect(issues).toHaveLength(1)
    expect(issues[0].calendarId).toBe('cal-2')
  })
})
