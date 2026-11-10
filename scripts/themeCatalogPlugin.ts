import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

const VIRTUAL_ID = 'virtual:calino-theme-catalog'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

export function themeCatalogPlugin(projectRoot: string): Plugin {
  const themeDirectory = path.resolve(projectRoot, 'public/themes')
  let server: ViteDevServer | undefined

  const themeFiles = (): string[] =>
    readdirSync(themeDirectory)
      .filter((file) => file.endsWith('.css') && !file.startsWith('.'))
      .sort()

  const source = (): string => {
    const entries = themeFiles().map((file) => {
      const absolutePath = path.join(themeDirectory, file)
      const contents = readFileSync(absolutePath, 'utf8')
      return `${JSON.stringify(`/public/themes/${file}`)}: ${JSON.stringify(contents)}`
    })
    return `export default {\n${entries.join(',\n')}\n}`
  }

  return {
    name: 'calino-theme-catalog',
    enforce: 'pre',
    configureServer(devServer) {
      server = devServer
      for (const file of themeFiles()) {
        devServer.watcher.add(path.join(themeDirectory, file))
      }
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined
      for (const file of themeFiles()) this.addWatchFile(path.join(themeDirectory, file))
      return source()
    },
    handleHotUpdate(context) {
      if (path.dirname(context.file) !== themeDirectory || !context.file.endsWith('.css')) {
        return undefined
      }
      const virtualModule = server?.moduleGraph.getModuleById(RESOLVED_ID)
      if (virtualModule) {
        server!.moduleGraph.invalidateModule(virtualModule)
        return [virtualModule]
      }
      return undefined
    },
  }
}
