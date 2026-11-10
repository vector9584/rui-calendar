import { describe, expect, it } from 'vitest'
import {
  getDefaultPresetState,
  loadPresetState,
  PRESET_SUBSCRIPTIONS,
} from '../presetSubscriptions'

describe('built-in webcal presets', () => {
  it('keeps optional preset feeds disabled until the user enables them', () => {
    expect(getDefaultPresetState().toggles).toEqual(
      Object.fromEntries(PRESET_SUBSCRIPTIONS.map(({ id }) => [id, false]))
    )
    expect(loadPresetState().toggles).toEqual(getDefaultPresetState().toggles)
  })
})
