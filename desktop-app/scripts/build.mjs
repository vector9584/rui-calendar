import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { frontendDirectory, runFrontend } from './frontend.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const buildDirectory = join(root, 'build/desktop')
await rm(buildDirectory, { recursive: true, force: true })
await mkdir(buildDirectory, { recursive: true })
const tsc = join(root, 'node_modules/.bin/tsc')
const compile = spawnSync(
  tsc,
  [
    '--target', 'ES2022',
    '--module', 'Node16',
    '--moduleResolution', 'Node16',
    '--lib', 'ES2022,DOM',
    '--strict',
    '--skipLibCheck',
    '--resolveJsonModule',
    '--esModuleInterop',
    '--rootDir', join(root, 'desktop/src'),
    '--outDir', buildDirectory,
    ...[
      'desktop/src/main/index.ts',
      'desktop/src/shared/ipc.ts',
      'desktop/src/main/store.ts',
      'desktop/src/main/vault.ts',
      'desktop/src/main/backup.ts',
      'desktop/src/main/logger.ts',
      'desktop/src/main/autostart.ts',
      'desktop/src/main/updater.ts',
      'desktop/src/preload/index.ts',
    ].map((path) => join(root, path)),
  ],
  { cwd: root, stdio: 'inherit' },
)
if (compile.error) throw compile.error
if (compile.status !== 0) throw new Error(`桌面 TypeScript 编译退出码：${compile.status}`)
const rendererCompile = spawnSync(
  tsc,
  [
    '--target', 'ES2022',
    '--module', 'ESNext',
    '--moduleResolution', 'Bundler',
    '--lib', 'ES2022,DOM',
    '--strict',
    '--skipLibCheck',
    '--rootDir', join(root, 'desktop/src'),
    '--outDir', join(buildDirectory, 'renderer-compile'),
    join(root, 'desktop/src/renderer/index.ts'),
  ],
  { cwd: root, stdio: 'inherit' },
)
if (rendererCompile.error) throw rendererCompile.error
if (rendererCompile.status !== 0)
  throw new Error(`桌面 renderer TypeScript 编译退出码：${rendererCompile.status}`)
const preloadPath = join(buildDirectory, 'preload/index.js')
const preloadSource = await readFile(preloadPath, 'utf8')
const channelValues = JSON.parse(await readFile(join(root, 'desktop/src/shared/channels.json'), 'utf8'))
const channelRequire = /const ipc_1 = require\("\.\.\/shared\/ipc"\);/
if (!channelRequire.test(preloadSource))
  throw new Error('sandbox preload IPC channel import changed unexpectedly')
const inlineChannels = `const ipc_1 = { IPC: Object.freeze(${JSON.stringify(channelValues)}) };`
const inlinePreload = preloadSource.replace(channelRequire, inlineChannels)
if (/require\(["']\.\.?\//.test(inlinePreload))
  throw new Error('sandbox preload cannot require local modules')
await writeFile(preloadPath, inlinePreload)
await cp(join(buildDirectory, 'renderer-compile/renderer/index.js'), join(buildDirectory, 'renderer/index.js'))
await rm(join(buildDirectory, 'renderer-compile'), { recursive: true, force: true })
await mkdir(join(buildDirectory, 'renderer'), { recursive: true })
for (const name of ['index.html', 'tokens.css', 'shell.css'])
  await cp(join(root, 'desktop/src/renderer', name), join(root, 'build/desktop/renderer', name))
if (!process.argv.includes('--desktop-only')) {
  await runFrontend(['build'])
  await cp(join(frontendDirectory, 'dist'), join(root, 'build/web'), { recursive: true })
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  await writeFile(
    join(root, 'build/build-info.json'),
    JSON.stringify({ version: pkg.version, builtAt: new Date().toISOString() }) + '\n',
  )
}
