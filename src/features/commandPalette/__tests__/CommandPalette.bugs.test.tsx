import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommandPalette } from '../components/CommandPalette'

vi.mock('@/store/calendarStore', () => ({
  useCalendarStore: vi.fn((selector) => {
    const state = {
      events: [],
      calendars: [
        { id: 'cal1', name: 'Calendar 1', color: '#4285F4', isVisible: true, isDefault: true },
      ],
      addEvent: vi.fn(),
      setCurrentDate: vi.fn(),
      setCurrentView: vi.fn(),
      openModal: vi.fn(),
    }
    return selector(state as never)
  }),
}))

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: vi.fn((selector) => {
    return selector({ timeFormat: '12h' })
  }),
}))

vi.mock('../hooks/useCommandPalette', () => ({
  useCommandPalette: vi.fn(() => ({
    query: '',
    setQuery: vi.fn(),
    items: [],
    executeSelected: vi.fn().mockResolvedValue({ success: false, message: '' }),
  })),
}))

describe('Bug #72: CommandPalette Ctrl+K handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not call onClose when Ctrl+K is pressed while palette is closed', () => {
    const onClose = vi.fn()
    render(<CommandPalette isOpen={false} onClose={onClose} />)

    // Simulate Ctrl+K globally
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Ctrl+K is pressed while palette is open', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<CommandPalette isOpen={true} onClose={onClose} />)

    // Simulate Ctrl+K via userEvent (more realistic)
    await user.keyboard('{Control>}{k}{/Control}')

    // Close is deferred until the exit animation completes (~140ms).
    await new Promise((r) => setTimeout(r, 200))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Cmd+K is pressed while palette is open', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<CommandPalette isOpen={true} onClose={onClose} />)

    await user.keyboard('{Meta>}{k}{/Meta}')

    await new Promise((r) => setTimeout(r, 200))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not call onClose when Cmd+K is pressed while palette is closed', () => {
    const onClose = vi.fn()
    render(<CommandPalette isOpen={false} onClose={onClose} />)

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('returns early after handling Ctrl+K without triggering Escape handler', async () => {
    const onClose = vi.fn()
    render(<CommandPalette isOpen={true} onClose={onClose} />)

    // Simulate Ctrl+K: should close but not duplicate calls
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)

    // Close is deferred until the exit animation completes.
    await new Promise((r) => setTimeout(r, 200))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
