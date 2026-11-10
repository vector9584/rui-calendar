import { test, expect, type Page } from '@playwright/test'
import { clearState, seedAccount, STORAGE_KEYS } from './fixtures/localstorage'

/**
 * Issue #116 — journal DTSTART not stored adjusted for time zone.
 *
 * A journal entry's DTSTART is a *floating* date (`VALUE=DATE`), so it has to
 * be the user's local calendar day. Calino derived the compose form's default
 * from `new Date().toISOString()` — UTC — so west of UTC every evening entry
 * was filed under tomorrow. The reporter's case: created 2026-08-12 20:18
 * America/New_York, stored as `DTSTART;VALUE=DATE:20260813`.
 *
 * Playwright can pin both halves of that instant for real (`timezoneId` +
 * `page.clock`), and the mock CalDAV backend exposes the stored `.ics` text,
 * so this asserts the actual bytes that reach the server.
 */

// 2026-08-12 20:18 America/New_York — already the 13th in UTC.
const REPORTED_INSTANT = new Date('2026-08-13T00:18:00Z')
const LOCAL_DAY = '20260812'
const UTC_DAY = '20260813'

// Owned outright by this spec (see vite-caldav-mock.ts): it asserts the exact
// contents of a single stored resource, so it cannot share with a parallel spec.
const J_TZ = '/dav/calendars/userj/j-tz/'

test.use({ timezoneId: 'America/New_York' })

async function seedTzStore(page: Page): Promise<void> {
  await page.addInitScript(({ calendarKey, settingsKey }) => {
    const calendar = {
      id: 'j-tz', name: 'Journal TZ', color: '#34A853', isVisible: true,
      isDefault: true, showTasksInViews: true,
      supportedComponents: ['VEVENT', 'VTODO', 'VJOURNAL'],
    }
    const calendarRaw = localStorage.getItem(calendarKey)
    const calendarState = calendarRaw ? JSON.parse(calendarRaw) : { state: {}, version: 2 }
    calendarState.state = { ...(calendarState.state ?? {}), calendars: [calendar], events: [] }
    localStorage.setItem(calendarKey, JSON.stringify(calendarState))
    const settingsRaw = localStorage.getItem(settingsKey)
    const settingsState = settingsRaw ? JSON.parse(settingsRaw) : { state: {}, version: 4 }
    settingsState.state = { ...(settingsState.state ?? {}), journalEnabled: true }
    localStorage.setItem(settingsKey, JSON.stringify(settingsState))
  }, { calendarKey: STORAGE_KEYS.calendar, settingsKey: STORAGE_KEYS.settings })
}

/** Snapshot the mock's stored resources, retrying transient resets like journal.spec.ts. */
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

async function settleInitialSync(page: Page): Promise<void> {
  const syncButton = page.locator('[data-component="sync-all-calendars"]')
  await syncButton.click()
  await expect(
    page.getByText(/All calendars synced\.|Calendars are already syncing\.|Sync failed/).first()
  ).toBeVisible({ timeout: 15_000 })
}

async function openJournalAfterSync(page: Page): Promise<void> {
  // Settings sync is shared by the mock CalDAV server across Playwright
  // workers. Finish that pull first, then enable Journal through the same
  // user-facing control this feature requires instead of relying on a local
  // storage seed that a remote settings snapshot can overwrite.
  await page.goto('/month')
  await settleInitialSync(page)
  await page.goto('/settings')
  const journalToggle = page.getByRole('checkbox', { name: 'Journal' })
  if (!(await journalToggle.isChecked()))
    await page.locator('[data-setting="journal"] [data-component="toggle"]').click()
  await expect(journalToggle).toBeChecked()
    await page.goto('/journal')
    await expect(page.getByRole('button', { name: /Journal/ })).toBeVisible()
    await expect(page.locator('[data-component="journal-view"]')).toBeVisible()
}

test.describe('Journal entry date across the UTC boundary (#116)', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await clearState(page)
    // Installed before any navigation so the app's very first `new Date()`
    // already sees the pinned instant.
    await page.clock.setFixedTime(REPORTED_INSTANT)
    await seedAccount(page, {
      id: 'journal-tz-account',
      name: 'Journal TZ Mock',
      serverUrl: `${baseURL}/mock-caldav-journal/dav/`,
      username: 'user',
      password: 'pass',
      calendars: [{ id: 'j-tz', name: 'Journal TZ', path: 'calendars/userj/j-tz/', isDefault: true }],
    })
    await page.request.post(
      `${baseURL}/mock-caldav-journal/__test__/reset?prefix=${encodeURIComponent(J_TZ)}`
    )
    await seedTzStore(page)
  })

  test('a new entry defaults to the local day, not the UTC day', async ({ page }) => {
    await openJournalAfterSync(page)
    const newEntry = page.locator('[data-component="journal-new-entry"]')
    await expect(newEntry).toBeVisible()
    await newEntry.click()
    // Wait for the compose form to actually be up before reaching into it —
    // on a cold load the persisted store can hydrate late and swap the view
    // out from under the click. journal.spec.ts settles the same way.
    await expect(page.getByPlaceholder('Title (optional)')).toBeVisible()

    // The compose form shows the date as a button; clicking it reveals the
    // <input type="date"> holding the raw yyyy-MM-dd that will be saved.
    await page.getByTitle('Click to change date').click()
    await expect(page.locator('input[type="date"]')).toHaveValue('2026-08-12')
  })

  test('the entry stored on the server carries the local DTSTART', async ({ page, baseURL }) => {
    await openJournalAfterSync(page)
    const newEntry = page.locator('[data-component="journal-new-entry"]')
    await expect(newEntry).toBeVisible()
    await newEntry.click()

    const titleField = page.getByPlaceholder('Title (optional)')
    await expect(titleField).toBeVisible()
    const bodyField = page.getByPlaceholder('Write something…')
    await expect(bodyField).toBeVisible()
    await titleField.fill('Debug Journal')
    await expect(titleField).toHaveValue('Debug Journal')
    await expect(bodyField).toBeVisible()
    await bodyField.click()
    await bodyField.pressSequentially('This is what a Journal Looks Like')
    await expect(bodyField).toHaveValue('This is what a Journal Looks Like')

    // Journal edits are persisted automatically; wait for the debounced sync
    // rather than looking for the old explicit Save button.
    await expect(page.locator('[data-component="journal-save-status"]')).toHaveText('Saved', {
      timeout: 15_000,
    })
    await expect(page.getByText('Debug Journal')).toBeVisible()

    await expect
      .poll(async () => Object.keys((await dump(page, baseURL!, J_TZ)) ?? {}).length, {
        timeout: 15_000,
      })
      .toBe(1)

    const ics = Object.values((await dump(page, baseURL!, J_TZ)) ?? {}).join('\n')
    expect(ics).toContain(`DTSTART;VALUE=DATE:${LOCAL_DAY}`)
    expect(ics).not.toContain(`DTSTART;VALUE=DATE:${UTC_DAY}`)
    // DTSTAMP is a true instant and stays in UTC — that half was never broken,
    // and "fixing" it would be a regression.
    expect(ics).toContain('DTSTAMP:20260813T001800Z')
  })
})
