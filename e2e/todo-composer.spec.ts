/**
 * TodoView composer flow — R1.5 regression net.
 *
 * Pre-R1.5: typing in the TodoView inline composer and pressing Enter
 * opened the task modal with an empty title, forcing the user to retype.
 *
 * Post-R1.5: the modal opens with the composer's text pre-filled in the
 * Title field.
 */
import { test, expect } from '@playwright/test'
import { clearState } from './fixtures/localstorage'

test.describe('TodoView composer forwards title into modal', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page)
  })

  test('typing a task and pressing Enter pre-fills the modal title', async ({
    page,
  }) => {
    // TodoView is mounted at /tasks (see App.tsx VIEW_ROUTES).
    await page.goto('/tasks')

    // Open the inline composer by clicking "Add task".
    await page.locator('[data-component="add-task-button"]').click()

    // The composer input is identified by its placeholder.
    const composer = page.getByPlaceholder('What needs doing?')
    await expect(composer).toBeVisible()
    await composer.fill('Buy milk')
    await composer.press('Enter')

    // The task modal should now be open with our text in the title input.
    const modal = page.locator('[data-component="modal-card"]')
    await expect(modal).toBeVisible()
    const titleInput = page.locator('[data-component="event-title-input"]')
    await expect(titleInput).toHaveValue('Buy milk')
  })

  test('can create a task without a due date', async ({ page }) => {
    await page.goto('/tasks')

    await page.locator('[data-component="add-task-button"]').click()
    const composer = page.getByPlaceholder('What needs doing?')
    await composer.fill('Someday task')
    await composer.press('Enter')

    const modal = page.locator('[data-component="modal-card"]')
    await expect(modal).toBeVisible()
    await modal.locator('[data-component="due-mode-none"]').click()
    await modal.locator('[data-component="modal-save"]').click()

    await expect(modal).not.toBeVisible()
    await expect(page.locator('main').getByText('No due date')).toBeVisible()
    await expect(page.locator('main').getByText('Someday task')).toBeVisible()
  })

  test('clearing the composer input and pressing Enter does not open the modal', async ({
    page,
  }) => {
    await page.goto('/tasks')
    await page.locator('[data-component="add-task-button"]').click()

    const composer = page.getByPlaceholder('What needs doing?')
    await expect(composer).toBeVisible()
    // Press Enter with empty content — should NOT open the modal.
    await composer.press('Enter')

    await expect(page.locator('[data-component="modal-card"]')).not.toBeVisible()
  })

  test('Escape on the composer closes composing without opening the modal', async ({
    page,
  }) => {
    await page.goto('/tasks')
    await page.locator('[data-component="add-task-button"]').click()

    const composer = page.getByPlaceholder('What needs doing?')
    await expect(composer).toBeVisible()
    await composer.fill('temporary text')
    await composer.press('Escape')

    await expect(page.locator('[data-component="modal-card"]')).not.toBeVisible()
  })

  test('clicking the composer checkmark submits the text into the modal', async ({
    page,
  }) => {
    // The composer now has two ways to submit: Enter (existing) and a click on
    // the round checkmark to the right of the input. Both paths must land on
    // the same modal-with-pre-filled-title behavior.
    await page.goto('/tasks')

    await page.locator('[data-component="add-task-button"]').click()
    const composer = page.getByPlaceholder('What needs doing?')
    await expect(composer).toBeVisible()
    await composer.fill('Walk the dog')

    // Round submit button next to the input. data-component is stable; role
    // defaults to "button" and aria-label is "Add task".
    const submitBtn = page.locator('[data-component="composer-submit"]')
    await expect(submitBtn).toBeVisible()
    await submitBtn.click()

    const modal = page.locator('[data-component="modal-card"]')
    await expect(modal).toBeVisible()
    await expect(page.locator('[data-component="event-title-input"]')).toHaveValue(
      'Walk the dog'
    )
  })

  test('clicking the composer checkmark with empty input does not open the modal', async ({
    page,
  }) => {
    // Symmetric to the existing "Enter with empty input" test — the button
    // submits only when there's text, matching the Enter behavior.
    await page.goto('/tasks')
    await page.locator('[data-component="add-task-button"]').click()

    const composer = page.getByPlaceholder('What needs doing?')
    await expect(composer).toBeVisible()
    // Don't fill anything — just click submit.
    await page.locator('[data-component="composer-submit"]').click()

    await expect(page.locator('[data-component="modal-card"]')).not.toBeVisible()
    // The composer stays open so the user can keep typing.
    await expect(composer).toBeVisible()
  })

  test('hides tasks when their calendar is disabled', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'calino-storage',
        JSON.stringify({
          state: {
            calendars: [
              {
                id: 'default',
                name: 'Personal',
                color: '#4285F4',
                isVisible: true,
                isDefault: true,
                showTasksInViews: true,
              },
              {
                id: 'work',
                name: 'Work',
                color: '#EA4335',
                isVisible: true,
                isDefault: false,
                showTasksInViews: true,
              },
            ],
            events: [
              {
                id: 'work-task',
                calendarId: 'work',
                title: 'Hidden work task',
                type: 'task',
                start: '2026-07-10T09:00:00.000Z',
                end: '2026-07-10T09:00:00.000Z',
                isAllDay: false,
                completed: false,
              },
            ],
          },
          version: 1,
        })
      )
    })

    await page.goto('/tasks')
    const todoTask = page.locator('main').getByText('Hidden work task')
    await expect(todoTask).toBeVisible()

    await page.locator('[data-component="calendar-section-toggle"]').click()
    await page.locator('label').filter({ hasText: 'Work' }).getByRole('checkbox').click()

    await expect(todoTask).not.toBeVisible()
  })
})
