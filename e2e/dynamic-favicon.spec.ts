import { expect, test } from '@playwright/test'
import { clearState } from './fixtures/localstorage'

test.describe('dynamic favicon', () => {
  test('keeps the static icon markup before JavaScript runs', async ({ page }) => {
    const response = await page.request.get('/')
    expect(response.ok()).toBe(true)
    expect(await response.text()).toContain('href="/favicon-96x96.png"')
  })

  test('keeps the static brand icon after the calendar loads', async ({ page }) => {
    await clearState(page)
    await page.goto('/month')
    await expect(page.locator('[data-component="header"]')).toBeVisible()

    const icon = page.locator('link[rel="icon"]')
    await expect(icon).toHaveAttribute('href', '/favicon-96x96.png')
    await expect(icon).toHaveAttribute('type', 'image/png')
  })
})
