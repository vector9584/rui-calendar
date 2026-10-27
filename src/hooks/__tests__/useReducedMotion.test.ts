import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReducedMotion } from '../useReducedMotion'

describe('useReducedMotion', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    matchMediaMock = vi.fn()
    // Save original
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: matchMediaMock,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when the user has not requested reduced motion', () => {
    const mq = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    matchMediaMock.mockReturnValue(mq)

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('returns true when prefers-reduced-motion is reduce', () => {
    const mq = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    matchMediaMock.mockReturnValue(mq)

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('subscribes to changes via addEventListener (modern API)', () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener,
      removeEventListener,
    })

    const { unmount } = renderHook(() => useReducedMotion())
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    unmount()
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('falls back to addListener/removeListener for legacy environments', () => {
    const addListener = vi.fn()
    const removeListener = vi.fn()
    // No addEventListener / removeEventListener present (old Safari, jsdom)
    matchMediaMock.mockReturnValue({
      matches: false,
      addListener,
      removeListener,
    })

    const { unmount } = renderHook(() => useReducedMotion())
    expect(addListener).toHaveBeenCalled()

    unmount()
    expect(removeListener).toHaveBeenCalled()
  })

  it('updates state when the media query changes', () => {
    // Use a mutable object so we can flip `matches` and have the hook
    // observe the new value via the same change event.
    const mq = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    let onChange: (() => void) | null = null
    mq.addEventListener = vi.fn((_event: string, cb: () => void) => {
      onChange = cb
    })
    matchMediaMock.mockReturnValue(mq)

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)

    // Simulate the user toggling reduced motion in System Settings
    mq.matches = true
    act(() => {
      onChange?.()
    })
    expect(result.current).toBe(true)
  })
})
