import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { caldavMockPlugin } from './e2e/fixtures/vite-caldav-mock'
import { carddavMockPlugin } from './e2e/fixtures/vite-carddav-mock'
import { contentSecurityPolicy } from './src/config/contentSecurityPolicy.ts'
import { fontScalePostcss } from './src/config/fontScale.ts'
import { themeCatalogPlugin } from './scripts/themeCatalogPlugin'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const projectDirectory = fileURLToPath(new URL('.', import.meta.url))

// Load self-hosted config at build time (baked into bundle, not served as separate file)
const configPath = new URL('./calino.config.json', import.meta.url)
let calinoConfig: Record<string, unknown> | null = null
if (existsSync(configPath)) {
  try {
    calinoConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
    const accountCount = Array.isArray(calinoConfig?.accounts) ? calinoConfig.accounts.length : 0
    console.log('[build] Loaded calino.config.json —', accountCount, 'account(s)')
  } catch (e) {
    console.warn('[build] Failed to parse calino.config.json:', e)
  }
}

// A config counts as self-hosted when it preconfigures accounts or webcal
// subscriptions, as in loadConfig; one that only lists linkSchemes does not.
const entryCount = (key: string): number => {
  const entries = calinoConfig?.[key]
  return Array.isArray(entries) ? entries.length : 0
}
const isSelfHosted =
  entryCount('accounts') + entryCount('webcalSubscriptions') > 0 ||
  process.env.CALINO_SELF_HOSTED === 'true'

// The E2E specs need an app-link scheme; it is added to whatever config the
// checkout has.
if (process.env.CALINO_E2E_MOCK === '1') {
  calinoConfig = {
    version: 1,
    ...calinoConfig,
    linkSchemes: { ...(calinoConfig?.linkSchemes as object | undefined), obsidian: 'Obsidian' },
  }
}

// The cross-origin diagnostics fixture is deliberately plain HTTP. Permit that
// transport without changing hosted-only UI behavior across the rest of E2E.
const allowHttpConnections = isSelfHosted || process.env.CALINO_E2E_MOCK === '1'
const serviceWorkerPrecachePlugin: Plugin = {
  name: 'calino-service-worker-precache',
  apply: 'build',
  writeBundle(outputOptions, bundle) {
    const outputDirectory = outputOptions.dir ?? path.resolve(projectDirectory, 'dist')
    const assets = Object.values(bundle)
      .map((output) => output.fileName)
      .filter((fileName) => /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|ico)$/.test(fileName))
      .map((fileName) => `/${fileName}`)
    const entry = Object.values(bundle).find(
      (output) => output.type === 'chunk' && output.isEntry && output.name === 'main'
    )
    const buildId = entry?.fileName.match(/-([\w]+)\.js$/)?.[1] ?? Date.now().toString(36)
    const serviceWorkerPath = path.join(outputDirectory, 'sw.js')
    const source = readFileSync(serviceWorkerPath, 'utf8')
      .replace('__BUILD_ID__', buildId)
      .replace('/* __CALINO_BUILD_ASSETS__ */ []', JSON.stringify(assets))
    writeFileSync(serviceWorkerPath, source)
  },
}

// Unset (the default) keeps the dev server localhost-only; see the SECURITY
// note on `server.host` below before setting it.
const devHost = process.env.CALINO_DEV_HOST

const config = {
  base: '/',
  // The app reads these non-VITE_ build-time values from import.meta.env.
  // Keep the allowlist narrow: CALINO_DEV_* and other server-only settings
  // must not be exposed to browser code.
  envPrefix: ['VITE_', 'CALINO_GITHUB_REPO', 'CALINO_CONTACT_EMAIL', 'CALINO_ENABLE_SW'],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __CALINO_CONFIG__: JSON.stringify(calinoConfig),
    __CALINO_SELF_HOSTED__: JSON.stringify(isSelfHosted),
  },
  plugins: [
    {
      name: 'calino-content-security-policy',
      enforce: 'pre',
      transformIndexHtml: (html: string) =>
        html.replace(
          '__CALINO_CONTENT_SECURITY_POLICY__',
          contentSecurityPolicy(allowHttpConnections)
        ),
    },
    react(),
    nodePolyfills(),
    themeCatalogPlugin(projectDirectory),
    caldavMockPlugin(),
    carddavMockPlugin(),
    serviceWorkerPrecachePlugin,
  ],
  server: {
    // SECURITY: default to localhost-only. The dev server has known
    // WebSocket arbitrary file read CVEs (CVE-2026-39363, see
    // GHSA-p9ff-h696-f583) — binding to 0.0.0.0 means anyone on the
    // local network can read source files via the dev WebSocket. Set
    // CALINO_DEV_HOST=0.0.0.0 only when you actually need LAN access
    // (e.g. testing on a phone).
    host: devHost ?? 'localhost',
    // Guards against DNS rebinding, so this is a hostname allowlist — bare IPs
    // are permitted by Vite already. Add whatever name you reach the dev box by
    // (plus CALINO_DEV_ALLOWED_HOSTS for one-offs that don't belong in git).
    allowedHosts: [
      'jankyboi',
      'desktop',
      'desktop.camel-vibe.ts.net',
      'localhost',
      ...(process.env.CALINO_DEV_ALLOWED_HOSTS?.split(',').map((h) => h.trim()) ?? []),
    ].filter(Boolean),
    // `hmr.host`/`hmr.port` describe what the *browser* dials, not what we
    // bind. Pinning the host to the bind address breaks every other route (a
    // 0.0.0.0 bind told clients to open ws://0.0.0.0:8080); pinning a separate
    // port breaks reverse proxies like `tailscale serve`, which only forwards
    // the main one. Off localhost, share the server's port and let the client
    // infer the origin from window.location — that also keeps the socket
    // same-origin, so strict extension CSPs allow it under 'self'.
    hmr: devHost ? true : { host: 'localhost', port: 8080 },
  },
  optimizeDeps: {
    // The E2E server transforms modules on demand. Skipping the full dependency
    // crawl avoids a multi-minute pnpm symlink scan before the port is ready.
    noDiscovery: process.env.CALINO_E2E_MOCK === '1',
    exclude: ['dexie', 'use-sync-external-store'],
  },
  css: {
    // Makes every font size follow the Font Size setting; see fontScale.ts.
    postcss: { plugins: [fontScalePostcss()] },
  },
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
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      // Second entry for the Android background sync worker, which loads
      // headless.html in an offscreen WebView at the same origin as the app so
      // it can read the stored accounts. It shares the app's modules, so this
      // costs a small extra chunk, not a second copy. See src/headless.ts.
      input: {
        main: path.resolve(projectDirectory, 'index.html'),
        headless: path.resolve(projectDirectory, 'headless.html'),
      },
    },
  },
}

export default defineConfig(config)
