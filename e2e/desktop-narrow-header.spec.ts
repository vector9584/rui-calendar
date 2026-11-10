import { test, expect } from '@playwright/test'
import { clearState } from './fixtures/localstorage'

test.describe('narrow desktop header', () => {
  test.use({ viewport: { width: 400, height: 648 } })

  test('keeps the month title visible beside the date navigator', async ({ page }) => {
    await clearState(page)
    await page.goto('/month')

    const header = page.locator('[data-component="header"]')
    const title = header.locator('h1').first()
    const navigator = header.locator('div[class*="navigationGroup"]').first()
    await expect(title).toBeVisible()
    await page.waitForTimeout(350)

    const geometry = await page.evaluate(() => {
      const headerElement = document.querySelector('[data-component="header"]')
      const titleElement = headerElement?.querySelector('h1')
      const navigatorElement = headerElement?.querySelector('[class*="navigationGroup"]')
      if (!(headerElement instanceof HTMLElement) || !(titleElement instanceof HTMLElement) || !(navigatorElement instanceof HTMLElement))
        return null

      const headerRect = headerElement.getBoundingClientRect()
      const titleRect = titleElement.getBoundingClientRect()
      const navigatorRect = navigatorElement.getBoundingClientRect()
      return {
        contained: titleRect.left >= headerRect.left && titleRect.right <= headerRect.right,
        separated: titleRect.left >= navigatorRect.right,
        titleWidth: titleRect.width,
      }
    })

    expect(geometry).not.toBeNull()
    expect(geometry?.titleWidth).toBeGreaterThan(0)
    expect(geometry?.contained).toBe(true)
    expect(geometry?.separated).toBe(true)
    await expect(navigator).toBeVisible()
    await page.screenshot({
      path: '../../docs/verification/screenshots/desktop-narrow-header-400x648.png',
      fullPage: true,
    })
  })
})
