import type { Page } from '@playwright/test'
import { clearState, STORAGE_KEYS } from './localstorage'

export async function seedStyledEvents(page: Page): Promise<void> {
  await clearState(page)
  await page.addInitScript(({ key }: { key: string }) => {
    if (sessionStorage.getItem('__calino_category_styles')) return
    sessionStorage.setItem('__calino_category_styles', '1')
    const date = new Date()
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 2,
        state: {
          calendars: [
            {
              id: 'default',
              name: 'Calendar',
              color: '#648574',
              isVisible: true,
              isDefault: true,
            },
          ],
          categories: [{ id: 'important-id', name: 'important', color: '#ac7332' }],
          events: [
            {
              id: 'styled-important',
              title: 'Client presentation',
              categories: ['important-id', 'deadline', 'maybe'],
            },
            { id: 'styled-maybe', title: 'Studio visit', categories: ['Unconfirmed'] },
            {
              id: 'styled-both',
              title: 'Review with Alex?',
              categories: ['important', 'maybe'],
            },
          ].map((event, index) => ({
            ...event,
            calendarId: 'default',
            start: `${today}T${String(9 + index).padStart(2, '0')}:00:00`,
            end: `${today}T${String(10 + index).padStart(2, '0')}:00:00`,
            isAllDay: false,
            type: 'event',
          })),
        },
      })
    )
  }, { key: STORAGE_KEYS.calendar })
}
