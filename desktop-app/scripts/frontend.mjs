import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const frontendDirectory = fileURLToPath(new URL('../../', import.meta.url))

export function runFrontend(args) {
  return new Promise((resolve, reject) => {
    const binaries = { build: 'vite', typecheck: 'tsc', lint: 'eslint', 'test:run': 'vitest', e2e: 'playwright' }
    const binary = binaries[args[0]]
    if (!binary) return reject(new Error(`未知前端命令：${args[0]}`))
    const command = fileURLToPath(new URL(`../../node_modules/.bin/${binary}`, import.meta.url))
    const forwarded = args[0] === 'build'
      ? ['build']
      : args[0] === 'typecheck'
        ? ['-b']
        : args[0] === 'test:run'
          ? ['--config', 'vitest.config.ts', '--run', '--pool=forks', '--maxWorkers=1', '--no-file-parallelism']
          : args[0] === 'e2e'
            ? ['test']
            : ['.']
    const child = spawn(command, forwarded, {
      cwd: frontendDirectory,
      stdio: 'inherit',
      env: {
        ...process.env,
        CI: 'true',
        VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true',
        VITE_SITE_URL: process.env.VITE_SITE_URL ?? 'https://ruili.local',
      },
    })
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`前端检查退出码：${code}`)))
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await runFrontend(process.argv.slice(2))
