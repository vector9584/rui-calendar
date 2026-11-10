import { defineConfig } from '@playwright/test'

const executablePath = process.env.E2E_CHROMIUM_PATH
const browserName = process.env.E2E_BROWSER === 'webkit' ? 'webkit' : 'chromium'

export default defineConfig({
  testDir: './desktop/e2e',
  workers: 1,
  timeout: 60_000,
  retries: 0,
  reporter: 'list',
  use: {
    browserName,
    ...(executablePath && browserName === 'chromium' ? { launchOptions: { executablePath } } : {}),
  },
})
