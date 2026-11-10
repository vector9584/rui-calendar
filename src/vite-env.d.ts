/// <reference types="vite/client" />

declare module '@touch4it/ical-timezones/zones.js' {
  const zones: Record<string, string>
  export default zones
}

declare const __APP_VERSION__: string
declare const __CALINO_SELF_HOSTED__: boolean

declare module 'virtual:calino-theme-catalog' {
  const themes: Record<string, string>
  export default themes
}

interface ImportMetaEnv {
  readonly CALINO_GITHUB_REPO?: string
  readonly CALINO_CONTACT_EMAIL?: string
  readonly CALINO_ENABLE_SW?: string
  /** Real origin of the built-in webcal feed provider (`.env.local`, gitignored). */
  readonly VITE_FEED_BASE?: string
}
