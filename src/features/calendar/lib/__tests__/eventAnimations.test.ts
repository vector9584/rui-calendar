import { describe, it, expect } from 'vitest'
import { eventCardVariants } from '../eventAnimations'

describe('eventCardVariants', () => {
  it('has initial state at opacity 0 and a slight scale-down', () => {
    // The "initial" state is what a freshly mounted card lands on
    // before its enter animation runs. Pinning it here means a future
    // refactor that loosens the fade (e.g. a designer asking for a
    // bigger scale-in) will be a conscious change, not a silent one.
    expect(eventCardVariants.initial).toEqual({
      opacity: 0,
      scale: 0.95,
    })
  })

  it('animates to fully opaque at scale 1', () => {
    // No transition on the variant itself — the duration is set per
    // component via `transition={{ duration: reducedMotion ? 0 : 0.18 }}`
    // so reduced-motion handling can stay in one place (the consumer).
    expect(eventCardVariants.animate).toEqual({
      opacity: 1,
      scale: 1,
    })
  })

  it('exits at opacity 0 and the same slight scale-down', () => {
    // Symmetry with `initial` keeps the animation "still" — the card
    // doesn't visibly grow on the way out, just fades.
    expect(eventCardVariants.exit).toEqual({
      opacity: 0,
      scale: 0.95,
    })
  })

  it('does not include y/x offsets', () => {
    // Event cards are absolutely positioned in the time grid; any
    // y or x offset would visibly jump them off their slot during
    // the animation. This guards against an accidental future
    // "let's add a slide-in" change.
    expect(eventCardVariants.initial).not.toHaveProperty('y')
    expect(eventCardVariants.initial).not.toHaveProperty('x')
    expect(eventCardVariants.animate).not.toHaveProperty('y')
    expect(eventCardVariants.animate).not.toHaveProperty('x')
    expect(eventCardVariants.exit).not.toHaveProperty('y')
    expect(eventCardVariants.exit).not.toHaveProperty('x')
  })
})
