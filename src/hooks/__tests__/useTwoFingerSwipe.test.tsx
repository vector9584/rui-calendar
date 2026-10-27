import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useRef } from 'react'
import { useTwoFingerSwipe } from '../useTwoFingerSwipe'

function Harness({
  onSwipe,
  enabled = true,
}: {
  onSwipe: (dir: 'left' | 'right') => void
  enabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useTwoFingerSwipe(ref, { onSwipe, enabled })
  return <div ref={ref} data-testid="surface" style={{ width: 400, height: 400 }} />
}

// jsdom has no real TouchEvent; fabricate one carrying a `touches` array.
function touch(x: number, y: number): { clientX: number; clientY: number } {
  return { clientX: x, clientY: y }
}
function dispatchTouch(
  el: Element,
  type: 'touchstart' | 'touchmove' | 'touchend',
  points: Array<{ clientX: number; clientY: number }>
): void {
  const event = new Event(type, { bubbles: true })
  Object.defineProperty(event, 'touches', { value: points, configurable: true })
  el.dispatchEvent(event)
}

describe('useTwoFingerSwipe', () => {
  it('fires "left" when two fingers move left together', () => {
    const onSwipe = vi.fn()
    const { getByTestId } = render(<Harness onSwipe={onSwipe} />)
    const el = getByTestId('surface')
    dispatchTouch(el, 'touchstart', [touch(200, 100), touch(260, 100)])
    dispatchTouch(el, 'touchmove', [touch(120, 105), touch(180, 105)])
    expect(onSwipe).toHaveBeenCalledWith('left')
  })

  it('fires "right" when two fingers move right together', () => {
    const onSwipe = vi.fn()
    const { getByTestId } = render(<Harness onSwipe={onSwipe} />)
    const el = getByTestId('surface')
    dispatchTouch(el, 'touchstart', [touch(120, 100), touch(180, 100)])
    dispatchTouch(el, 'touchmove', [touch(220, 98), touch(280, 98)])
    expect(onSwipe).toHaveBeenCalledWith('right')
  })

  it('ignores a pinch (spread changes, centroid barely moves)', () => {
    const onSwipe = vi.fn()
    const { getByTestId } = render(<Harness onSwipe={onSwipe} />)
    const el = getByTestId('surface')
    dispatchTouch(el, 'touchstart', [touch(180, 100), touch(220, 100)])
    // Fingers spread apart, centroid stays put.
    dispatchTouch(el, 'touchmove', [touch(80, 100), touch(320, 100)])
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('fires only once per gesture', () => {
    const onSwipe = vi.fn()
    const { getByTestId } = render(<Harness onSwipe={onSwipe} />)
    const el = getByTestId('surface')
    dispatchTouch(el, 'touchstart', [touch(200, 100), touch(260, 100)])
    dispatchTouch(el, 'touchmove', [touch(120, 100), touch(180, 100)])
    dispatchTouch(el, 'touchmove', [touch(60, 100), touch(120, 100)])
    expect(onSwipe).toHaveBeenCalledTimes(1)
  })

  it('does nothing when disabled', () => {
    const onSwipe = vi.fn()
    const { getByTestId } = render(<Harness onSwipe={onSwipe} enabled={false} />)
    const el = getByTestId('surface')
    dispatchTouch(el, 'touchstart', [touch(200, 100), touch(260, 100)])
    dispatchTouch(el, 'touchmove', [touch(120, 100), touch(180, 100)])
    expect(onSwipe).not.toHaveBeenCalled()
  })
})
