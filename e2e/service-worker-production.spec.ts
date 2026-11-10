import { expect, test } from '@playwright/test'
import { clearState } from './fixtures/localstorage'

test('production service worker serves lazy calendar views after network loss', async ({
  browser,
  context,
}) => {
  const previewUrl = process.env.E2E_PREVIEW_URL
  if (!previewUrl) throw new Error('Production preview URL is not configured')
  const productionContext = await browser.newContext()
  const page = await productionContext.newPage()
  await clearState(page)
  await page.goto(previewUrl)
  await expect(page.locator('[data-component="header"]')).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js'))
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)

  const cachedViews = await page.evaluate(async () => {
    const name = (await caches.keys()).find((key) => key.startsWith('rui-'))
    if (!name) return []
    const cache = await caches.open(name)
    return (await cache.keys()).map((request) => new URL(request.url).pathname)
  })
  for (const chunk of ['WeekView-', 'DayView-', 'AgendaView-', 'CalendarGrid-']) {
    expect(cachedViews.some((url) => url.includes(chunk))).toBe(true)
  }

  // Abort network fallbacks while leaving the browser online so the Service
  // Worker can still fulfill cache hits. This avoids WebKit's offline emulation
  // rejecting requests before its fetch handler runs.
  await context.route('**/*', async (route) => {
    await route.abort('internetdisconnected')
  })

  for (const view of ['week', 'day', 'agenda', 'month'] as const) {
    const tab = page.locator(`[data-component="header"] [data-view="${view}"]`)
    if (await tab.isVisible()) {
      await tab.click()
    } else {
      await page.locator('[data-component="view-dropdown-trigger"]').click()
      const label = view[0].toUpperCase() + view.slice(1)
      await page.getByRole('menuitem', { name: label, exact: true }).click()
    }
    await expect(page).toHaveURL(new RegExp(`/${view}$`))
    await expect(page.locator('main')).toBeVisible()
    if (view === 'week') await expect(page.locator('[data-component="week-grid"]')).toBeVisible()
    if (view === 'day') await expect(page.locator('[data-component="day-grid"]')).toBeVisible()
    if (view === 'month')
      await expect(page.locator('[data-component="calendar-grid"]')).toBeVisible()
  }
  await productionContext.close()
})
