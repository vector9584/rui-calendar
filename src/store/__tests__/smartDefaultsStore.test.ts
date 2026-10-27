import { describe, it, expect, beforeEach } from 'vitest'
import { useSmartDefaultsStore } from '../smartDefaultsStore'

describe('smartDefaultsStore', () => {
  beforeEach(() => {
    useSmartDefaultsStore.getState().clear()
  })

  it('learns calendar and duration after two matching creations', () => {
    const { record } = useSmartDefaultsStore.getState()
    record('Gym', 'fitness', 45)
    expect(useSmartDefaultsStore.getState().suggest('Gym session')).toEqual({})

    record('Gym workout', 'fitness', 45)
    expect(useSmartDefaultsStore.getState().suggest('Gym')).toEqual({
      durationMinutes: 45,
      calendarId: 'fitness',
    })
  })

  it('keys on the first meaningful word so variants share a pattern', () => {
    const { record, suggest } = useSmartDefaultsStore.getState()
    record('Standup with team', 'work', 15)
    record('Standup', 'work', 15)
    expect(suggest('Standup tomorrow')).toEqual({ durationMinutes: 15, calendarId: 'work' })
  })

  it('ignores empty titles and missing calendars', () => {
    const { record, suggest } = useSmartDefaultsStore.getState()
    record('', 'work', 30)
    record('Meeting', '', 30)
    expect(suggest('Meeting')).toEqual({})
  })
})
