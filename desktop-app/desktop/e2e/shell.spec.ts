import { test, expect } from '@playwright/test'

test('settings shell exposes an accessible offline-first status page', async ({ page }) => {
  await page.goto('file://' + process.cwd() + '/build/desktop/renderer/index.html?settings=1')
  await expect(page.getByRole('heading', { name: '让日程安放在这里' })).toBeVisible()
  await expect(page.getByText('本地日历可离线使用')).toBeVisible()
  await page.screenshot({ path: 'docs/verification/screenshots/shell-settings-1440.png', fullPage: true })
})
