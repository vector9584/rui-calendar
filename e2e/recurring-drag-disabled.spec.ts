/**
 * E2E spec for the recurring-event drag-and-drop restriction.
 *
 * Background: before this change, dragging a recurring event in week / day /
 * month view would either silently move the entire series (DayView / WeekView)
 * or fail to update anything (CalendarGrid, because the visible instance's id
 * has a date suffix that didn't match the master, so updateEvent hit a stale
 * occurrence and the expansion overwrote it on the next render — looks like
 * "snaps back").
 *
 * Recurring events have a "which occurrence?" question that has to be answered
 * through the RecurrenceDialog. To make the UX consistent, drag-and-drop is
 * disabled for any recurring event (master, generated instance, or exception).
 * The user has to click → modal → RecurrenceDialog.
 *
 * This spec exercises the user-visible path:
 *
 *   1. Seed a weekly recurring event on this week's Monday.
 *   2. Visit week view.
 *   3. Assert the event card has `data-no-drag` (drag is disabled).
 *   4. Assert the resize handle is NOT rendered.
 *   5. Click the event → preview popup opens.
 *   6. Click "Open event" → modal opens.
 *   7. Assert the modal shows the existing event data (proves we didn't break
 *      the click handler).
 *
 * If the bug were present, step 3 would fail (the card would still have its
 * drag listeners attached) and step 4 would show a resize handle.
 */
import { test, expect } from '@playwright/test'
import { clearState, seedRecurringEvent } from './fixtures/localstorage'

function startOfThisWeekUtc(): string {
  const now = new Date()
  const offsetToMonday = (now.getUTCDay() + 6) % 7
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offsetToMonday)
  )
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`
}

// Note on timezones: `startOfThisWeekUtc` matches the existing pattern used
// in `drag-anim.spec.ts`. It assumes the test runner is within UTC±9 of the
// event's 09:00 UTC start time, otherwise the seeded event lands outside the
// current week in week view. CI is expected to run in a compatible timezone.

test.describe('Recurring event — drag-and-drop is disabled', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page)
    await seedRecurringEvent(page, {
      id: 'weekly-standup',
      title: 'Weekly standup',
      startDate: startOfThisWeekUtc(),
      endDate: startOfThisWeekUtc(),
      startTime: '09:00',
      endTime: '09:30',
      frequency: 'weekly',
      interval: 1,
    })
  })

  test('recurring event card has data-no-drag and no resize handle', async ({ page }) => {
    await page.goto('/week')
    const card = page.locator('[data-component="event-card"]').filter({ hasText: 'Weekly standup' }).first()
    await expect(card).toBeVisible()

    // Drag is disabled at the dnd-kit level. The data-no-drag attribute is
    // the user-facing signal of that — tests can assert on it without having
    // to simulate a drag.
    await expect(card).toHaveAttribute('data-no-drag', '')

    // The resize handle is conditionally rendered; recurring events don't
    // have one because the "which occurrence?" question has to be answered
    // through the modal.
    await expect(card.locator('[class*="resizeHandle"]')).toHaveCount(0)

    // The cursor should not be `grab` — dnd-kit's disabled state is reflected
    // by the inline `cursor: pointer` so the user understands the card isn't
    // draggable.
    const cursor = await card.evaluate((el) => (el as HTMLElement).style.cursor)
    expect(cursor).toBe('pointer')
  })

  test('clicking a recurring event opens the modal (drag is the only path disabled)', async ({ page }) => {
    await page.goto('/week')
    const card = page.locator('[data-component="event-card"]').filter({ hasText: 'Weekly standup' }).first()
    await expect(card).toBeVisible()

    // Click → preview popup → "Open event" → modal.
    await card.click()
    const preview = page.locator('[data-component="event-preview"]')
    await expect(preview).toBeVisible()
    await preview.getByRole('button', { name: /Open event/ }).click()

    const modal = page.locator('[data-component="modal-card"]')
    await expect(modal).toBeVisible()
    // The title is preserved — this proves we routed through the modal
    // correctly and not through some broken drag path.
    await expect(modal.locator('[data-component="event-title-input"]')).toHaveValue('Weekly standup')
    // The Recurring toggle is on, which proves the modal knows the event is
    // recurring and will offer the RecurrenceDialog on save.
    await expect(modal.getByText('Recurring', { exact: true })).toBeVisible()
  })
})
