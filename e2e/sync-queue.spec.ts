import { test, expect, type Page } from '@playwright/test'
import { clearState, seedAccount, STORAGE_KEYS } from './fixtures/localstorage'

/**
 * Phase 3 — queued CalDAV edits are never lost.
 *
 * 1. An edit whose PUT fails (fault injection) survives locally, is queued,
 *    and lands once the server recovers.
 * 2. A stale-etag 412 is recovered by re-fetching the current etag and
 *    re-applying once, instead of replaying the dead If-Match forever.
 *
 * Owns the `/dav/calendars/user/sync-queue/` collection, like event-move owns
 * move-source/: resets scoped to it never race the specs sharing `personal/`.
 */

const SQ_PATH = '/dav/calendars/user/sync-queue/'
const CAL_SQ = 'cal-sync-queue'

interface StoreCalendarSeed {
  id: string
  name: string
  color: string
  isDefault?: boolean
}

/**
 * The calendar `<select>` in the event modal renders `calendarStore`
 * calendars, and `seedAccount` only primes the CalDAV calendar list. Seed
 * the store too so the select is populated before the first sync has run.
 */
async function seedStoreCalendars(page: Page, calendars: StoreCalendarSeed[]): Promise<void> {
  await page.addInitScript(
    ({ calendarKey, calendars }: { calendarKey: string; calendars: StoreCalendarSeed[] }) => {
      try {
        if (sessionStorage.getItem('__calino_test_sq_calendars')) return
        sessionStorage.setItem('__calino_test_sq_calendars', '1')
        const raw = localStorage.getItem(calendarKey)
        const parsed = raw ? JSON.parse(raw) : { state: {}, version: 1 }
        parsed.state = {
          ...(parsed.state ?? {}),
          calendars: calendars.map((calendar, index) => ({
            id: calendar.id,
            name: calendar.name,
            color: calendar.color,
            isVisible: true,
            isDefault: calendar.isDefault ?? index === 0,
            showTasksInViews: true,
            supportedComponents: ['VEVENT', 'VTODO', 'VJOURNAL'],
          })),
        }
        localStorage.setItem(calendarKey, JSON.stringify(parsed))
      } catch {
        /* noop */
      }
    },
    { calendarKey: STORAGE_KEYS.calendar, calendars }
  )
}

async function seedAccountSQ(page: Page, baseURL: string): Promise<void> {
  await seedAccount(page, {
    id: 'sync-queue-account',
    name: 'Mock A',
    serverUrl: `${baseURL}/mock-caldav/dav/`,
    username: 'user',
    password: 'pass',
    calendars: [
      {
        id: CAL_SQ,
        name: 'Sync Queue',
        path: 'calendars/user/sync-queue/',
        isDefault: true,
        color: '#4285F4',
        supportedComponents: ['VEVENT', 'VTODO', 'VJOURNAL'],
      },
    ],
  })
}

/**
 * Snapshot the mock's stored resources under a collection prefix.
 * Absorbs transient dev-server resets like event-move.spec.ts does.
 */
async function dump(
  page: Page,
  baseURL: string,
  prefix: string
): Promise<Record<string, string> | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await page.request.get(
        `${baseURL}/mock-caldav/__test__/dump?prefix=${encodeURIComponent(prefix)}`
      )
      return (await response.json()) as Record<string, string>
    } catch {
      if (attempt === 2) return null
      await page.waitForTimeout(250)
    }
  }
  return null
}

const icalStamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace('.000', '')

async function triggerSync(page: Page): Promise<void> {
  const syncButton = page.locator('[data-component="sync-all-calendars"]')
  await expect(syncButton).toBeEnabled({ timeout: 15_000 })
  await syncButton.click()
}

async function openEventModal(page: Page, title: string): Promise<void> {
  const card = page.locator('[data-component="event-card"]').filter({ hasText: title }).first()
  await expect(card).toBeVisible({ timeout: 15_000 })
  await card.click()
  await page
    .locator('[data-component="event-preview"]')
    .getByRole('button', { name: /Open event/i })
    .click()
  await expect(page.locator('[data-component="event-calendar-select"]')).toBeVisible()
}

test.describe('queued edits survive failed writes', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page, baseURL }) => {
    await page.request.post(
      `${baseURL!}/mock-caldav/__test__/reset?prefix=${encodeURIComponent(SQ_PATH)}`
    )
  })

  test('an edit made while PUTs fail is queued and lands once writes recover', async ({
    page,
    baseURL,
  }) => {
    await clearState(page)
    await seedAccountSQ(page, baseURL!)
    await seedStoreCalendars(page, [
      { id: CAL_SQ, name: 'Sync Queue', color: '#4285F4', isDefault: true },
    ])

    const start = new Date()
    start.setUTCHours(10, 0, 0, 0)
    await page.request.put(`${baseURL}/mock-caldav${SQ_PATH}queue-edit.ics`, {
      data: `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:queue-edit\r\nDTSTART:${icalStamp(start)}\r\nDTEND:${icalStamp(new Date(start.getTime() + 3_600_000))}\r\nSUMMARY:Queue edit event\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`,
    })

    await page.goto('/month')
    await triggerSync(page)
    await expect(
      page.locator('[data-component="event-card"]').filter({ hasText: 'Queue edit event' })
    ).toBeVisible({ timeout: 15_000 })

    // Arm the fault injector: the next PUT to this collection returns 500.
    await page.request.post(
      `${baseURL}/mock-caldav/__test__/fail?method=PUT&prefix=${encodeURIComponent(SQ_PATH)}&count=1`
    )

    await openEventModal(page, 'Queue edit event')
    await page.locator('[data-component="event-title-input"]').fill('Queue edit event (edited)')
    await page.locator('[data-component="modal-save"]').click()

    // The edit survives locally even though the write failed.
    await expect(
      page.locator('[data-component="event-card"]').filter({ hasText: 'Queue edit event (edited)' })
    ).toBeVisible({ timeout: 15_000 })

    // Recover: the next sync drains the queue and the edit lands on the server.
    await triggerSync(page)
    await expect
      .poll(
        async () => {
          const bytes = (await dump(page, baseURL!, SQ_PATH)) ?? {}
          return Object.values(bytes).join('')
        },
        { timeout: 15_000 }
      )
      .toContain('SUMMARY:Queue edit event (edited)')
  })

  test('offline event creation stays local and syncs within ten seconds after reconnect', async ({
    page,
    context,
    baseURL,
  }) => {
    const offlineConsoleWarnings: string[] = []
    let trackingOffline = false
    page.on('console', (message) => {
      if (trackingOffline && message.type() === 'warning')
        offlineConsoleWarnings.push(`warning: ${message.text()}`)
    })
    await clearState(page)
    await seedAccountSQ(page, baseURL!)
    await seedStoreCalendars(page, [
      { id: CAL_SQ, name: 'Sync Queue', color: '#4285F4', isDefault: true },
    ])

    await page.goto('/month')
    const syncButton = page.locator('[data-component="sync-all-calendars"]')
    await expect(syncButton).toBeEnabled({ timeout: 15_000 })
    await syncButton.click()

    await context.setOffline(true)
    trackingOffline = true
    await page.keyboard.press('c')
    await expect(page.locator('[data-component="event-title-input"]')).toBeVisible()
    await page.locator('[data-component="event-title-input"]').fill('Offline reconnect event')
    await page.locator('[data-component="modal-save"]').click()

    const eventCard = page
      .locator('[data-component="event-card"]')
      .filter({ hasText: 'Offline reconnect event' })
    await expect(eventCard).toBeVisible({ timeout: 15_000 })
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const raw = localStorage.getItem('calino_pending_changes')
            return raw ? (JSON.parse(raw) as unknown[]).length : 0
          }),
        { timeout: 10_000 }
      )
      .toBeGreaterThan(0)

    const reconnectedAt = Date.now()
    await context.setOffline(false)
    trackingOffline = false
    await expect
      .poll(
        async () => {
          const resources = (await dump(page, baseURL!, SQ_PATH)) ?? {}
          return Object.values(resources).join('')
        },
        { timeout: 10_000, intervals: [100, 250, 500] }
      )
      .toContain('SUMMARY:Offline reconnect event')

    expect(Date.now() - reconnectedAt).toBeLessThan(10_000)
    expect(offlineConsoleWarnings).toEqual([])
    await expect(eventCard).toBeVisible()
  })

  test('offline calendar remains usable for thirty minutes and syncs final changes within ten seconds', async ({
    page,
    context,
    baseURL,
  }) => {
    test.setTimeout(40 * 60 * 1000)
    await clearState(page)
    await seedAccountSQ(page, baseURL!)
    await seedStoreCalendars(page, [
      { id: CAL_SQ, name: 'Sync Queue', color: '#4285F4', isDefault: true },
    ])

    await page.goto('/month')
    await triggerSync(page)
    await expect(page.locator('[data-component="calendar-grid"]')).toBeVisible()
    // Load the lazy event editor while online. The offline phase verifies
    // local-first CRUD and persistence, not the browser cache's first import
    // of an editor chunk that this scenario has not visited yet.
    await page.keyboard.press('c')
    const warmupTitle = page.locator('[data-component="event-title-input"]')
    await expect(warmupTitle).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(warmupTitle).toBeHidden()
    await page.getByRole('button', { name: 'Search or commands' }).click()
    await expect(page.locator('[data-component="command-palette"]')).toBeVisible()
    await page.keyboard.press('Escape')
    for (const [viewName, route] of [
      ['Week', '/week'],
      ['Day', '/day'],
      ['Agenda', '/agenda'],
      ['Month', '/month'],
    ] as const) {
      const viewTab = page.locator(`[data-component="header"] [data-view="${route.slice(1)}"]`)
      if (await viewTab.isVisible()) {
        await viewTab.click()
      } else {
        await page.locator('[data-component="view-dropdown-trigger"]').click()
        await page
          .locator('[data-component="view-dropdown-menu"]')
          .getByRole('menuitem', { name: viewName, exact: true })
          .click()
      }
      await expect(page).toHaveURL(new RegExp(`${route}$`))
      await expect(page.locator('main')).toBeVisible()
    }
    const monthTab = page.locator('[data-component="header"] [data-view="month"]')
    if (await monthTab.isVisible()) {
      await monthTab.click()
    } else {
      await page.locator('[data-component="view-dropdown-trigger"]').click()
      await page
        .locator('[data-component="view-dropdown-menu"]')
        .getByRole('menuitem', { name: 'Month', exact: true })
        .click()
    }
    await expect(page.locator('[data-component="calendar-grid"]')).toBeVisible()
    await context.setOffline(true)

    await page.keyboard.press('c')
    const titleInput = page.locator('[data-component="event-title-input"]')
    await expect(titleInput).toBeVisible()
    await titleInput.fill('Offline thirty minute edit target')
    await page.locator('[data-component="modal-save"]').click()
    await expect(
      page.locator('[data-component="event-card"]').filter({
        hasText: 'Offline thirty minute edit target',
      })
    ).toBeVisible()

    await page.keyboard.press('c')
    await expect(titleInput).toBeVisible()
    await titleInput.fill('Offline thirty minute delete target')
    await page.locator('[data-component="modal-save"]').click()
    const deleteTarget = page
      .locator('[data-component="event-card"]')
      .filter({ hasText: 'Offline thirty minute delete target' })
    await expect(deleteTarget).toBeVisible()

    await openEventModal(page, 'Offline thirty minute edit target')
    await titleInput.fill('Offline thirty minute edited event')
    await expect(titleInput).toHaveValue('Offline thirty minute edited event')
    await page.locator('[data-component="modal-save"]').click()
    await expect(
      page.locator('[data-component="event-card"]').filter({
        hasText: 'Offline thirty minute edited event',
      })
    ).toBeVisible()

    await deleteTarget.click()
    await page
      .locator('[data-component="event-preview"]')
      .getByRole('button', { name: 'Open event' })
      .click()
    const modal = page.locator('[data-component="modal-card"]')
    await expect(modal).toBeVisible()
    await expect(modal.locator('[data-component="event-title-input"]')).toHaveValue(
      'Offline thirty minute delete target'
    )
    const modalDelete = modal.getByRole('button', { name: 'Delete' })
    await modalDelete.click()
    await expect(modal.getByRole('button', { name: 'Confirm delete' })).toBeVisible()
    await modal.getByRole('button', { name: 'Confirm delete' }).click()
    await expect(modal).toBeHidden()
    await expect(deleteTarget).toHaveCount(0)

    await page.getByRole('button', { name: 'Search or commands' }).click()
    const palette = page.locator('[data-component="command-palette"]')
    await expect(palette).toBeVisible()
    const searchInput = palette.locator('input').first()
    await searchInput.fill('Offline thirty minute edited event')
    await expect(
      palette.getByRole('group', { name: 'Events' }).getByText('Offline thirty minute edited event')
    ).toBeVisible()
    await searchInput.fill('Offline thirty minute delete target')
    await expect(
      palette
        .getByRole('group', { name: 'Events' })
        .getByText('Offline thirty minute delete target')
    ).toHaveCount(0)
    await page.keyboard.press('Escape')

    const offlineViews = [
      ['Week', '/week', 'week-grid'],
      ['Day', '/day', 'day-grid'],
      ['Agenda', '/agenda', 'agenda-view'],
      ['Month', '/month', 'calendar-grid'],
    ] as const
    for (const [viewName, route, component] of offlineViews) {
      const viewTab = page.locator(`[data-component="header"] [data-view="${route.slice(1)}"]`)
      if (await viewTab.isVisible()) {
        await viewTab.click()
      } else {
        await page.locator('[data-component="view-dropdown-trigger"]').click()
        await page
          .locator('[data-component="view-dropdown-menu"]')
          .getByRole('menuitem', { name: viewName, exact: true })
          .click()
      }
      await expect(page).toHaveURL(new RegExp(`${route}$`))
      if (component === 'agenda-view') {
        await expect(page.locator('[data-component="header"]')).toBeVisible()
        await expect(page.locator('main')).toBeVisible()
      } else {
        await expect(page.locator(`[data-component="${component}"]`)).toBeVisible()
      }
    }

    const offlineStartedAt = Date.now()
    const offlineDurationMs = Number(process.env.E2E_OFFLINE_DURATION_MS ?? 30 * 60 * 1000)
    const checkIntervalMs = Math.min(60 * 1000, Math.max(1000, offlineDurationMs))
    while (Date.now() - offlineStartedAt < offlineDurationMs) {
      await page.waitForTimeout(
        Math.min(checkIntervalMs, offlineDurationMs - (Date.now() - offlineStartedAt))
      )
      await expect(page.locator('[data-component="header"]')).toBeVisible()
      await expect
        .poll(() =>
          page.evaluate(() => {
            const raw = localStorage.getItem('calino_pending_changes')
            return raw ? (JSON.parse(raw) as unknown[]).length : 0
          })
        )
        .toBeGreaterThan(0)
    }
    expect(Date.now() - offlineStartedAt).toBeGreaterThanOrEqual(offlineDurationMs)

    const reconnectedAt = Date.now()
    await context.setOffline(false)
    await expect
      .poll(
        async () => {
          const resources = (await dump(page, baseURL!, SQ_PATH)) ?? {}
          return Object.values(resources).join('')
        },
        { timeout: 10_000, intervals: [100, 250, 500] }
      )
      .toContain('SUMMARY:Offline thirty minute edited event')
    expect(Date.now() - reconnectedAt).toBeLessThan(10_000)

    const finalResources = (await dump(page, baseURL!, SQ_PATH)) ?? {}
    const finalServerState = Object.values(finalResources).join('')
    expect(finalServerState).toContain('SUMMARY:Offline thirty minute edited event')
    expect(finalServerState).not.toContain('SUMMARY:Offline thirty minute edit target')
    expect(finalServerState).not.toContain('SUMMARY:Offline thirty minute delete target')
  })

  test('a stale-etag 412 is recovered by re-fetching the etag and re-applying once', async ({
    page,
    baseURL,
  }) => {
    // The month grid animates event cards into place while CalDAV hydration
    // completes. Reduced motion keeps the target stable for this sync race
    // test and also exercises the supported accessibility preference.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await clearState(page)
    await seedAccountSQ(page, baseURL!)
    await seedStoreCalendars(page, [
      { id: CAL_SQ, name: 'Sync Queue', color: '#4285F4', isDefault: true },
    ])

    const start = new Date()
    start.setUTCHours(11, 0, 0, 0)
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:stale-etag\r\nDTSTART:${icalStamp(start)}\r\nDTEND:${icalStamp(new Date(start.getTime() + 3_600_000))}\r\nSUMMARY:Stale etag event\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`
    await page.request.put(`${baseURL}/mock-caldav${SQ_PATH}stale-etag.ics`, { data: ics })

    await page.goto('/month')
    await triggerSync(page)
    await expect(
      page.locator('[data-component="event-card"]').filter({ hasText: 'Stale etag event' })
    ).toBeVisible({ timeout: 15_000 })

    // Bump the server etag WITHOUT changing the content: the app's next PUT
    // sends its (now stale) If-Match and the mock answers 412, exactly like
    // Radicale does when another client touched the resource.
    await page.request.put(`${baseURL}/mock-caldav${SQ_PATH}stale-etag.ics`, { data: ics })

    await openEventModal(page, 'Stale etag event')
    await page.locator('[data-component="event-title-input"]').fill('Stale etag event (edited)')
    await page.locator('[data-component="modal-save"]').click()

    // Let the queued update replay through a sync: the 412 must be
    // recovered (re-fetch etag, re-apply), not replayed forever.
    await triggerSync(page)

    await expect
      .poll(
        async () => {
          const bytes = (await dump(page, baseURL!, SQ_PATH)) ?? {}
          return Object.values(bytes).join('')
        },
        { timeout: 15_000 }
      )
      .toContain('SUMMARY:Stale etag event (edited)')

    // And the UI agrees in a view that does not collapse overflow events.
    await page.goto('/agenda')
    await expect(
      page
        .locator('[data-component="agenda-event"]')
        .filter({ hasText: 'Stale etag event (edited)' })
    ).toBeVisible({ timeout: 15_000 })
  })
})
