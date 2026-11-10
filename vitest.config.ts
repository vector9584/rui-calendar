import { defineConfig } from 'vitest/config'
import base from './vite.config'

const defaults = ['**/node_modules/**', '**/dist/**', '**/.idea/**', '**/.git/**', '**/.cache/**']

export default defineConfig({
  ...base,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    projects: [
      { extends: true, test: { name: 'west', env: { TZ: 'America/New_York' } } },
      { extends: true, test: { name: 'east', env: { TZ: 'Europe/Copenhagen' }, exclude: [...defaults, 'e2e/**', '.claude/**', '**/*.perf.test.ts'] } },
    ],
    exclude: [...defaults, 'e2e/**', '.claude/**'],
    css: { include: [/built-in\.css/] },
  },
})
