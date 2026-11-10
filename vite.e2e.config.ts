import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { caldavMockPlugin } from './e2e/fixtures/vite-caldav-mock'
import { carddavMockPlugin } from './e2e/fixtures/vite-carddav-mock'
import { contentSecurityPolicy } from './src/config/contentSecurityPolicy.ts'
import { fontScalePostcss } from './src/config/fontScale.ts'
import { themeCatalogPlugin } from './scripts/themeCatalogPlugin'

const projectDirectory = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify('0.41.0'),
    __CALINO_CONFIG__: JSON.stringify({ version: 1, linkSchemes: { obsidian: 'Obsidian' } }),
    // E2E diagnostics use a plain-HTTP loopback DAV server on another port.
    // Model a self-hosted deployment so the production CSP does not block the
    // request before the browser can exercise CORS and private-network checks.
    __CALINO_SELF_HOSTED__: JSON.stringify(true),
    'import.meta.env.VITE_E2E_DISABLE_WEB_CAL_PRESETS': JSON.stringify('true'),
  },
  plugins: [
    {
      name: 'calino-content-security-policy',
      transformIndexHtml: (html: string) =>
        html.replace('__CALINO_CONTENT_SECURITY_POLICY__', contentSecurityPolicy(true)),
    },
    react(),
    themeCatalogPlugin(projectDirectory),
    caldavMockPlugin(),
    carddavMockPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(projectDirectory, './src'),
      'use-sync-external-store/shim': path.resolve(
        projectDirectory,
        './src/config/useSyncExternalStoreShim.ts'
      ),
      dexie: path.resolve(projectDirectory, './node_modules/dexie/dist/dexie.mjs'),
      'style-to-js': path.resolve(projectDirectory, './src/config/styleToJs.ts'),
      debug: path.resolve(projectDirectory, './src/config/debug.ts'),
      extend: path.resolve(projectDirectory, './src/config/extend.ts'),
    },
  },
  server: { host: '127.0.0.1', port: 5199, strictPort: true },
  css: { postcss: { plugins: [fontScalePostcss()] } },
  optimizeDeps: {
    noDiscovery: true,
    include: ['react', 'react-dom', 'react-dom/client', 'extend', 'unified'],
    exclude: ['dexie', 'use-sync-external-store'],
  },
})
