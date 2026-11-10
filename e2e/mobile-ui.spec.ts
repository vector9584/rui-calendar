import { test, expect } from '@playwright/test'
import { clearState } from './fixtures/localstorage'

test.describe('mobile UI surfaces', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('keeps floating navigation available without a tracking-cookie banner', async ({ page }) => {
    await clearState(page)
    await page.goto('/month')
    const pill = page.locator('[data-component="floating-nav-pill"]')
    await expect(page.locator('[data-component="cookie-consent"]')).toHaveCount(0)
    await expect(pill).toBeVisible()
  })

  test('keeps the ellipsis affordance and marks secondary routes current', async ({ page }) => {
    await clearState(page)
    await page.goto('/tasks')

    const more = page.locator('[data-component="nav-more"]')
    await expect(more.locator('svg')).toBeVisible()
    await expect(more).toHaveAttribute('aria-label', 'Show all views')
    await expect(more).toHaveAttribute('aria-current', 'page')
  })

  test('keeps mobile navigation controls at 44px minimum hit height', async ({ page }) => {
    await clearState(page)
    await page.goto('/month')

    const controls = page.locator(
      '[data-component="nav-pill-switcher"] button, [data-component="floating-nav-pill"] button[aria-label="Create"], [data-component="floating-nav-pill"] button[aria-label="Toggle sidebar"], button[aria-label="Previous"], button[aria-label="Next"]'
    )
    await expect(controls.first()).toBeVisible()

    const heights = await controls.evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().height))
    )

    expect(heights.length).toBeGreaterThan(0)
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44)
  })

  test('leads onboarding with connecting a calendar', async ({ page }) => {
    await clearState(page)
    await page.goto('/month')
    await page.evaluate(() => {
      localStorage.removeItem('calino-settings')
    })
    await page.reload()

    const dialog = page.getByRole('dialog', { name: /Start with your calendar|从你的日历开始/ })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('details')).toHaveCount(0)
    await expect(dialog.getByText(/Connect iCloud|连接 iCloud/)).toBeVisible()
    await expect(dialog.locator('[data-component="connect-submit"]')).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Skip for now|暂时跳过/ })).toBeVisible()
  })
})

test.describe('narrow mobile UI surfaces', () => {
  test.use({
    viewport: { width: 320, height: 568 },
    hasTouch: true,
    isMobile: true,
  })

  test('keeps bottom surfaces and the ellipsis inside a 320px viewport', async ({ page }) => {
    await clearState(page)
    await page.goto('/tasks')
    const bounds = await page.evaluate(() => {
      const pill = document.querySelector('[data-component="floating-nav-pill"]')
      const more = document.querySelector('[data-component="nav-more"]')
      if (!(pill instanceof HTMLElement) || !(more instanceof HTMLElement)) {
        return null
      }

      const pillRect = pill.getBoundingClientRect()
      const moreRect = more.getBoundingClientRect()
      return {
        pillInsideViewport: pillRect.left >= 0 && pillRect.right <= window.innerWidth,
        moreInsideViewport: moreRect.left >= 0 && moreRect.right <= window.innerWidth,
      }
    })

    expect(bounds).toEqual({
      pillInsideViewport: true,
      moreInsideViewport: true,
    })
  })
})
