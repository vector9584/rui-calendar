import type { AdjustableFontFamily } from '@/types'

export const ADJUSTABLE_FONT_STACKS: Record<AdjustableFontFamily, string> = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'SF Mono', 'Fira Code', 'Roboto Mono', monospace",
}
