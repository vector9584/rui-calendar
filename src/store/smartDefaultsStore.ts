import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeLocalStorage } from '@/lib/storage'
import {
  keywordFromTitle,
  recordObservation,
  suggestFromStat,
  type KeywordStat,
  type SmartSuggestion,
} from '@/lib/smartDefaults'

interface SmartDefaultsState {
  patterns: Record<string, KeywordStat>
  /** Learn from a freshly-created event. */
  record: (title: string, calendarId: string, durationMinutes: number | undefined) => void
  /** Suggest a calendar / duration for a title being typed. */
  suggest: (title: string) => SmartSuggestion
  clear: () => void
}

export const useSmartDefaultsStore = create<SmartDefaultsState>()(
  persist(
    (set, get) => ({
      patterns: {},

      record: (title, calendarId, durationMinutes): void => {
        const key = keywordFromTitle(title)
        if (!key || !calendarId) return
        set((state) => ({
          patterns: {
            ...state.patterns,
            [key]: recordObservation(state.patterns[key], durationMinutes, calendarId),
          },
        }))
      },

      suggest: (title): SmartSuggestion => {
        const key = keywordFromTitle(title)
        if (!key) return {}
        return suggestFromStat(get().patterns[key])
      },

      clear: (): void => {
        set({ patterns: {} })
      },
    }),
    {
      name: 'calino-smart-defaults',
      storage: createJSONStorage(() => safeLocalStorage),
    }
  )
)
