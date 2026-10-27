// Built-in (hardcoded) webcal subscription presets — shown as toggles in the
// sync settings, auto-subscribed on first run, and hidden from delete (like
// preconfigured feeds) so they never interfere with user-added subscriptions.
//
// All preset feeds point at your-feed.example.com. the feed provider serves plain ICS without CORS
// headers, so the browser cannot fetch it directly (same-origin policy blocks
// it). Every preset is routed through a generic Calino CORS proxy mounted at
// `/proxy/` on our own origin — the proxy accepts any https target, so it also
// covers user-added external ICS feeds. The base is derived from the current
// origin so a redeploy on another domain keeps working without code changes.

export interface PresetSubscription {
  id: string
  name: string
  type: 'fixed' | 'astro' | 'weather'
  /** Path relative to the feed proxy base, e.g. `/huangli/yi.ics`. */
  path?: string
  color: string
}

export const ZODIAC_SIGNS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'aries', label: '白羊座' },
  { key: 'taurus', label: '金牛座' },
  { key: 'gemini', label: '双子座' },
  { key: 'cancer', label: '巨蟹座' },
  { key: 'leo', label: '狮子座' },
  { key: 'virgo', label: '处女座' },
  { key: 'libra', label: '天秤座' },
  { key: 'scorpio', label: '天蝎座' },
  { key: 'sagittarius', label: '射手座' },
  { key: 'capricorn', label: '摩羯座' },
  { key: 'aquarius', label: '水瓶座' },
  { key: 'pisces', label: '双鱼座' },
]

export const PRESET_SUBSCRIPTIONS: PresetSubscription[] = [
  {
    id: 'huangli-yi',
    name: '老黄历（宜）',
    type: 'fixed',
    path: '/huangli/yi.ics',
    color: '#FBBC05',
  },
  {
    id: 'huangli-ji',
    name: '老黄历（忌）',
    type: 'fixed',
    path: '/huangli/ji.ics',
    color: '#EA4335',
  },
  {
    id: 'holiday',
    name: '法定节假日',
    type: 'fixed',
    path: '/HoliBack/HoliBack.php?days=1&hour=20',
    color: '#C2185B',
  },
  {
    id: 'jieqi',
    name: '节日节气',
    type: 'fixed',
    path: '/jieqi/jieqi.ics',
    color: '#34A853',
  },
  {
    id: 'astro',
    name: '星座运势',
    type: 'astro',
    color: '#7B1FA2',
  },
  {
    id: 'weather',
    name: '天气',
    type: 'weather',
    color: '#4285F4',
  },
]

const DEFAULT_ASTRO_SIGN = 'pisces'
const DEFAULT_WEATHER_LOCATION = 'Beijing_Beijing_Haidian'

/**
 * Base URL for preset feeds — the real your-feed.example.com origin. The CORS bypass is
 * applied separately through each subscription's proxyUrl field (see
 * proxyBase() below), so the stored URL stays the canonical public feed URL.
 */
function feedBase(): string {
  return 'https://your-feed.example.com'
}

/**
 * Generic CORS-proxy base on our own origin. Every preset (and, by default,
 * user-added) subscription routes through this to bypass CORS. It is a Calino
 * CORS proxy that accepts any https target, so it works for arbitrary external
 * ICS feeds — not just the built-in feed.
 */
export function proxyBase(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/proxy`
  }
  return ''
}

export function buildAstroUrl(sign: string): string {
  return `${feedBase()}/Star/Star.php?astro=${encodeURIComponent(
    sign
  )}&days=1&title=%E7%BB%BC%E5%90%88%E6%8C%87%E6%95%B0`
}

export function buildWeatherUrl(location: string): string {
  return `${feedBase()}/weather/calendar.php?location=${encodeURIComponent(
    location
  )}&days=7&title=both&alarm=8`
}

export function getPresetUrl(preset: PresetSubscription, state: PresetState): string {
  if (preset.type === 'astro') {
    return buildAstroUrl(state.astro)
  }
  if (preset.type === 'weather') {
    return buildWeatherUrl(state.weather)
  }
  return `${feedBase()}${preset.path ?? ''}`
}

// ─── State (persisted to localStorage) ──────────────────────────────────────

export interface PresetState {
  /** presetId -> enabled */
  toggles: Record<string, boolean>
  /** Selected zodiac sign key (see ZODIAC_SIGNS). */
  astro: string
  /** Weather location string, e.g. "Beijing_Beijing_Haidian". */
  weather: string
}

const PRESET_STATE_KEY = 'calino_preset_state'

export function getDefaultPresetState(): PresetState {
  const toggles: Record<string, boolean> = {}
  for (const preset of PRESET_SUBSCRIPTIONS) {
    toggles[preset.id] = true
  }
  return {
    toggles,
    astro: DEFAULT_ASTRO_SIGN,
    weather: DEFAULT_WEATHER_LOCATION,
  }
}

export function loadPresetState(): PresetState {
  const raw = localStorage.getItem(PRESET_STATE_KEY)
  if (!raw) {
    return getDefaultPresetState()
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PresetState>
    const def = getDefaultPresetState()
    return {
      toggles: { ...def.toggles, ...(parsed.toggles ?? {}) },
      astro: parsed.astro ?? def.astro,
      weather: parsed.weather ?? def.weather,
    }
  } catch {
    return getDefaultPresetState()
  }
}

export function savePresetState(state: PresetState): void {
  localStorage.setItem(PRESET_STATE_KEY, JSON.stringify(state))
}
