import { test, expect } from '@playwright/test'
import { seedStyledEvents } from './fixtures/category-styles'

test('loading the sample calendar demonstrates category styles and their combination', async ({
  page,
}) => {
  await seedStyledEvents(page)
  await page.goto('/month')
  const card = (title: string) =>
    page.locator('[data-component="event-card"]').filter({ hasText: title }).first()
  const combined = card('Client presentation')
  await expect(combined).toHaveCSS('background-image', /repeating-linear-gradient/)
  await expect(combined.locator('[data-component="category-sketch"]')).toBeVisible()

  await page.goto('/agenda')
  await expect(
    page.locator('[data-component="agenda-event"]').filter({ hasText: 'Studio visit' })
  ).toHaveCSS('background-image', /repeating-linear-gradient/)

  // Preset rules are persisted and applied to matching calendar events.
  await page.goto('/settings?tab=theme')
  const rules = page.locator('[data-component="category-style-settings"]')
  await rules.getByRole('button', { name: '+ On the move – diagonal texture', exact: true }).click()
  await rules.getByLabel('Match any category').fill('focus')
  await rules.getByRole('button', { name: '+ Marker – underline', exact: true }).click()
  await rules.getByLabel('Match any category').fill('important')
  await page.goto('/month')
  await page.goto('/agenda')
  await expect(
    page.locator('[data-component="agenda-event"]').filter({ hasText: 'Studio visit' })
  ).toHaveCSS('background-image', /repeating-linear-gradient/)
  await page.goto('/month')
  await expect(card('Client presentation').locator('[data-marker]')).toBeVisible()
})
