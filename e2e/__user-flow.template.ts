/**
 * ╭─────────────────────────────────────────────────────────────────────────╮
 * │ TEMPLATE — copy to `e2e/<area>.spec.ts` and customize.                  │
 * │ The leading-underscore name keeps Playwright from running this file.    │
 * ╰─────────────────────────────────────────────────────────────────────────╯
 *
 * Conventions:
 *   - Prefer `data-component="..."` selectors (see src/features/calendar/components/*).
 *     They survive CSS-module renames.
 *   - Fall back to `aria-label` for icon-only buttons.
 *   - Fall back to `getByRole('button', { name: '...' })` for labelled ones.
 *   - For modals, scope assertions inside the dialog to avoid hitting
 *     other elements with the same text on the page.
 *
 * Helpers available (from e2e/fixtures/localstorage.ts):
 *   - `clearState(page)` — wipes Calino state + dismisses onboarding & cookie consent
 *   - `seedAccount(page, account)` — adds a CalDAV account to localStorage
 *   - `seedRecurringEvent(page, seed)` — adds a recurring event to the calendar store
 */
import { test, expect } from '@playwright/test'
import { clearState } from './fixtures/localstorage'

test.describe('<AREA> — <short description>', () => {
  test.beforeEach(async ({ page }) => {
    // Clean slate per test. Disables onboarding + cookie consent.
    await clearState(page)
  })

  test('<USER VISIBLE FLOW> works end-to-end', async ({ page }) => {
    // ── Arrange ────────────────────────────────────────────────────────
    // Optional: seed CalDAV account, recurring events, etc.
    // await seedAccount(page, { name: 'Test', serverUrl: '...', ... })

    // ── Act ────────────────────────────────────────────────────────────
    await page.goto('/<route>')
    await expect(page.locator('[data-component="header"]')).toBeVisible()

    // Drive the UI. Use page.getByRole / getByLabel / getByText first;
    // fall back to data-component only when ARIA is ambiguous.

    // ── Assert ─────────────────────────────────────────────────────────
    await expect(page.getByText('<something the user sees>')).toBeVisible()
  })
})