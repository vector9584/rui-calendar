export interface WebcalSubscription {
  id: string
  calendarId: string
  name: string
  // Normalized https:// form — webcal:// is rewritten at add-time.
  url: string
  refreshIntervalMinutes: number
  proxyUrl?: string | null
  lastFetchedAt: string | null
  lastError: string | null
  // True for subscriptions defined in calino.config.json — hidden from
  // edit/delete in the settings UI, same as preconfigured CalDAV accounts.
  isPreconfigured?: boolean
  // Built-in preset id (see presetSubscriptions.ts) — hides delete and lets
  // the settings toggle turn this subscription on/off without losing it.
  presetId?: string
}
