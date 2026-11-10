import {
  app,
  BrowserWindow,
  WebContentsView,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  screen,
  protocol,
  session,
  globalShortcut,
  nativeTheme,
  dialog,
  shell,
  Notification,
  crashReporter,
} from 'electron'
import type { WebContents, IpcMainInvokeEvent, MenuItemConstructorOptions } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { z } from 'zod'
import {
  IPC,
  APP_ORIGIN,
  SHELL_ORIGIN,
  TOOLBAR_HEIGHT,
  GLOBAL_SHORTCUT,
  patchSchema,
} from '../shared/schema'
import type { AppState, Preferences, StatePatch, PatchResult } from '../shared/schema'
import {
  isLocalAppUrl,
  canNavigate,
  localResourcePath,
  localResourceContentType,
  SHELL_CSP,
} from '../shared/security'
import { visibleBounds, snapBounds } from '../shared/bounds'
import { ConfigStore } from './store'
import { RollingLogger } from './logger'
import { CredentialVault } from './vault'
import { applyAutoStart, autoStartAvailable } from './autostart'
import { encryptBackup, decryptBackup } from './backup'
import { UpdateService } from './updater'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'ruili',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      allowServiceWorkers: true,
      stream: true,
    },
  },
])
const applicationRoot = app.getAppPath()
const preloadPath = join(applicationRoot, 'build/desktop/preload/index.js')
const iconPath = join(applicationRoot, 'assets/瑞历.png')
let window: BrowserWindow | null = null
let toolbar: BrowserWindow | null = null
let calendar: WebContentsView | null = null
let remote: WebContentsView | null = null
let tray: Tray | null = null
let store: ConfigStore
let logger: RollingLogger
let vault: CredentialVault
let updater: UpdateService
let quitting = false
let settingsOpen = false
let hotkeyAvailable = false
let runtimeMessage = ''
let certificate: AppState['runtime']['certificate'] = null
let saveTimer: ReturnType<typeof setTimeout> | undefined
let crashCount = 0
let lastCrash = 0

const securePreferences = {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true,
}
const privilegedContents = new Set<number>()

function currentState(): AppState {
  return {
    ...store.get(),
    runtime: {
      platform: process.platform,
      version: app.getVersion(),
      trayAvailable: tray !== null,
      hotkeyAvailable,
      keychainAvailable: vault.available(),
      autoStartAvailable: autoStartAvailable(),
      opacityAvailable: process.platform !== 'linux',
      dark: nativeTheme.shouldUseDarkColors,
      message: runtimeMessage || store.recoveryMessage,
      certificate,
      update: updater.get(),
    },
  }
}

function broadcast(): void {
  if (!updater) return
  const state = currentState()
  for (const contents of [window?.webContents, toolbar?.webContents, calendar?.webContents]) {
    if (contents && !contents.isDestroyed() && isLocalAppUrl(contents.getURL()))
      contents.send(IPC.changed, state)
  }
  updateTrayMenu()
}

function report(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  runtimeMessage = message
  logger?.write('error', message)
  if (store && updater) broadcast()
}

function safely(action: () => void | Promise<unknown>): void {
  try {
    void Promise.resolve(action()).catch(report)
  } catch (error) {
    report(error)
  }
}

function showWindow(): void {
  if (!window) createWindow()
  window?.show()
  window?.focus()
  if (store.get().preferences.locked) toolbar?.showInactive()
}

function hideWindow(): void {
  toolbar?.hide()
  window?.hide()
}
function toggleWindow(): void {
  if (window?.isVisible()) hideWindow()
  else showWindow()
}

function secure(contents: WebContents, allowRemote = ''): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (canNavigate(url, allowRemote) && !isLocalAppUrl(url)) safely(() => shell.openExternal(url))
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    if (!canNavigate(url, allowRemote)) event.preventDefault()
  })
  contents.on('will-redirect', (event, url) => {
    if (!canNavigate(url, allowRemote)) event.preventDefault()
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.on('render-process-gone', (_event, details) => {
    logger.write('error', `Renderer exited: ${details.reason}`)
    if (Date.now() - lastCrash > 60_000) crashCount = 0
    lastCrash = Date.now()
    crashCount++
    if (crashCount <= 3 && !quitting) {
      runtimeMessage = '日历进程已恢复；已保存的数据和窗口位置仍在。'
      setTimeout(() => {
        if (!contents.isDestroyed()) contents.reload()
      }, 500)
    } else {
      runtimeMessage = '日历连续异常退出。请导出日志，或使用刷新按钮重试。'
      openSettings()
    }
    broadcast()
  })
  contents.on('did-fail-load', (_event, code, description, validatedUrl) => {
    if (code === -3) return
    logger.write('error', `Page load failed (${code}) ${validatedUrl}: ${description}`)
    report(new Error(`页面暂时无法打开：${description}。本地日历仍可使用。`))
    if (contents === remote?.webContents) {
      remote.setVisible(false)
      calendar?.setVisible(true)
    }
  })
  contents.on('console-message', (details) => {
    if (details.level === 'error' || details.level === 'warning')
      logger.write(details.level === 'error' ? 'error' : 'warn', details.message)
  })
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || (!input.control && !input.meta)) return
    if (
      ['Equal', 'NumpadAdd', 'Minus', 'NumpadSubtract', 'Digit0', 'Numpad0'].includes(input.code)
    ) {
      event.preventDefault()
      if (input.code.includes('0')) contents.setZoomLevel(0)
      else
        contents.setZoomLevel(
          Math.max(
            -2,
            Math.min(
              4,
              contents.getZoomLevel() + (['Equal', 'NumpadAdd'].includes(input.code) ? 0.5 : -0.5),
            ),
          ),
        )
    }
  })
}

function layout(): void {
  if (!window) return
  const { width, height } = window.getContentBounds()
  const bounds = { x: 0, y: TOOLBAR_HEIGHT, width, height: Math.max(1, height - TOOLBAR_HEIGHT) }
  calendar?.setBounds(bounds)
  remote?.setBounds(bounds)
  const frame = window.getBounds()
  toolbar?.setBounds({ x: frame.x, y: frame.y, width: frame.width, height: TOOLBAR_HEIGHT })
}

function scheduleBounds(): void {
  layout()
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (!window || window.isDestroyed() || window.isMaximized()) return
    const previous = window.getBounds()
    const snapped = snapBounds(previous, screen.getDisplayMatching(previous).workArea)
    if (snapped.x !== previous.x || snapped.y !== previous.y) window.setBounds(snapped)
    safely(() => {
      store.patch({ bounds: snapped })
    })
  }, 250)
}

function createToolbar(): void {
  if (toolbar || !window) return
  toolbar = new BrowserWindow({
    width: 400,
    height: TOOLBAR_HEIGHT,
    minHeight: TOOLBAR_HEIGHT,
    frame: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    parent: window,
    webPreferences: { ...securePreferences, preload: preloadPath },
  })
  privilegedContents.add(toolbar.webContents.id)
  secure(toolbar.webContents)
  safely(() => toolbar?.loadURL(`${SHELL_ORIGIN}/index.html?toolbar=1`))
  toolbar.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      hideWindow()
    }
  })
  toolbar.webContents.on('did-finish-load', broadcast)
  toolbar.on('move', () => {
    if (!toolbar || !window || !store.get().preferences.locked) return
    const point = toolbar.getBounds()
    const main = window.getBounds()
    if (point.x !== main.x || point.y !== main.y) window.setPosition(point.x, point.y)
  })
}

function createWindow(): void {
  const preferences = store.get().preferences
  window = new BrowserWindow({
    ...visibleBounds(
      preferences.bounds,
      screen.getAllDisplays().map((display) => display.workArea),
    ),
    minWidth: 320,
    minHeight: 480,
    frame: false,
    show: false,
    skipTaskbar: false,
    icon: iconPath,
    webPreferences: { ...securePreferences, preload: preloadPath },
  })
  privilegedContents.add(window.webContents.id)
  secure(window.webContents)
  safely(() => window?.loadURL(`${SHELL_ORIGIN}/index.html`))
  calendar = new WebContentsView({ webPreferences: { ...securePreferences, preload: preloadPath } })
  privilegedContents.add(calendar.webContents.id)
  secure(calendar.webContents)
  window.contentView.addChildView(calendar)
  safely(() => calendar?.webContents.loadURL(`${APP_ORIGIN}/`))
  createToolbar()
  layout()
  applyPreferences(preferences)
  window.once('ready-to-show', showWindow)
  window.webContents.on('did-finish-load', broadcast)
  calendar.webContents.on('did-finish-load', broadcast)
  window.on('resize', scheduleBounds)
  window.on('move', scheduleBounds)
  window.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      hideWindow()
      return
    }
    if (window)
      safely(() => {
        store.patch({
          bounds: visibleBounds(
            window?.getBounds() ?? null,
            screen.getAllDisplays().map((display) => display.workArea),
          ),
        })
      })
  })
  window.on('closed', () => {
    calendar?.webContents.close()
    remote?.webContents.close()
    calendar = null
    remote = null
    toolbar = null
    window = null
  })
}

function updateRemote(url: string): void {
  if (!window) return
  if (remote && (!url || new URL(remote.webContents.getURL() || url).href !== new URL(url).href)) {
    window.contentView.removeChildView(remote)
    remote.webContents.close()
    remote = null
  }
  if (url && !remote) {
    remote = new WebContentsView({
      webPreferences: { ...securePreferences, partition: 'persist:ruili-remote' },
    })
    secure(remote.webContents, url)
    remote.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false),
    )
    remote.webContents.session.setPermissionCheckHandler(() => false)
    window.contentView.addChildView(remote)
    safely(() => remote?.webContents.loadURL(url))
  }
  calendar?.setVisible(!settingsOpen && !url)
  remote?.setVisible(!settingsOpen && Boolean(url))
  layout()
}

function applyPreferences(preferences: Preferences): void {
  nativeTheme.themeSource = preferences.theme
  window?.setAlwaysOnTop(preferences.mode === 'top')
  toolbar?.setAlwaysOnTop(preferences.mode === 'top')
  window?.setOpacity(preferences.opacity)
  window?.setIgnoreMouseEvents(preferences.locked && !settingsOpen)
  if (preferences.locked && !settingsOpen && window?.isVisible()) toolbar?.showInactive()
  else toolbar?.hide()
  updateRemote(preferences.remoteUrl)
}

function openSettings(): void {
  settingsOpen = true
  calendar?.setVisible(false)
  remote?.setVisible(false)
  window?.setIgnoreMouseEvents(false)
  toolbar?.hide()
  safely(() => window?.loadURL(`${SHELL_ORIGIN}/index.html?settings=1`))
  showWindow()
  toolbar?.hide()
}

function openCalendar(): void {
  settingsOpen = false
  safely(() => window?.loadURL(`${SHELL_ORIGIN}/index.html`))
  applyPreferences(store.get().preferences)
}

function menuTemplate(): MenuItemConstructorOptions[] {
  const preferences = store.get().preferences
  return [
    { label: '显示 / 隐藏瑞历', accelerator: GLOBAL_SHORTCUT, click: toggleWindow },
    { type: 'separator' },
    {
      label: '始终置顶',
      type: 'checkbox',
      checked: preferences.mode === 'top',
      click: (item) =>
        safely(() => {
          store.patch({ mode: item.checked ? 'top' : 'desktop' })
        }),
    },
    {
      label: '锁定日历（工具条仍可操作）',
      type: 'checkbox',
      checked: preferences.locked,
      click: (item) =>
        safely(() => {
          store.patch({ locked: item.checked })
        }),
    },
    {
      label: '免打扰',
      type: 'checkbox',
      checked: preferences.doNotDisturb,
      click: (item) =>
        safely(() => {
          store.patch({ doNotDisturb: item.checked })
        }),
    },
    {
      label: '登录时启动',
      type: 'checkbox',
      checked: preferences.autoStart,
      enabled: autoStartAvailable(),
      click: (item) => safely(() => changePreferences({ autoStart: item.checked })),
    },
    { type: 'separator' },
    { label: '设置与关于', click: openSettings },
    {
      label: '刷新日历',
      click: () => {
        ;(remote?.webContents ?? calendar?.webContents)?.reload()
      },
    },
    { label: '退出', accelerator: 'CommandOrControl+Q', click: () => app.quit() },
  ]
}

function updateTrayMenu(): void {
  tray?.setContextMenu(Menu.buildFromTemplate(menuTemplate()))
}

function createTray(): void {
  try {
    const icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) throw new Error('托盘图标无法读取')
    tray = new Tray(
      icon.resize({
        width: process.platform === 'darwin' ? 18 : 24,
        height: process.platform === 'darwin' ? 18 : 24,
      }),
    )
    tray.setToolTip('瑞历')
    tray.on('click', toggleWindow)
    updateTrayMenu()
  } catch (error) {
    tray = null
    runtimeMessage = `系统托盘不可用，可使用 ${GLOBAL_SHORTCUT} 或任务栏唤起瑞历。`
    logger.write('warn', String(error))
    window?.setSkipTaskbar(false)
  }
}

function validateSender(event: IpcMainInvokeEvent): void {
  if (
    !privilegedContents.has(event.sender.id) ||
    event.senderFrame !== event.sender.mainFrame ||
    !isLocalAppUrl(event.senderFrame.url)
  )
    throw new Error('此页面没有桌面操作权限')
}

function changePreferences(patch: Partial<Preferences>): void {
  const previous = store.get().preferences
  if (patch.autoStart !== undefined && patch.autoStart !== previous.autoStart)
    applyAutoStart(patch.autoStart)
  try {
    store.patch(patch)
  } catch (error) {
    if (patch.autoStart !== undefined) applyAutoStart(previous.autoStart)
    throw error
  }
  if (patch.mini !== undefined && patch.mini !== previous.mini && window) {
    if (patch.mini) window.setSize(320, 480)
    else
      window.setSize(previous.bounds?.width ?? 400, Math.max(680, previous.bounds?.height ?? 680))
  }
}

async function perform(patch: StatePatch): Promise<string | undefined> {
  switch (patch.type) {
    case 'preferences':
      changePreferences(patch.value)
      break
    case 'credential:save':
      await vault.save(patch.value)
      break
    case 'credential:delete':
      await vault.delete(patch.id)
      break
    case 'certificate:trust': {
      if (
        !certificate ||
        certificate.origin !== patch.origin ||
        certificate.fingerprint !== patch.fingerprint
      )
        throw new Error('证书已改变，请重新连接并核对证书')
      const result = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['取消', '信任此证书'],
        defaultId: 0,
        cancelId: 0,
        title: '信任服务器证书',
        message: certificate.origin,
        detail: `颁发给：${certificate.subject}\n颁发者：${certificate.issuer}\n指纹：${certificate.fingerprint}\n仅信任这个地址的这张证书。`,
      })
      if (result.response === 1) {
        store.patch({
          trustedCertificates: {
            ...store.get().preferences.trustedCertificates,
            [certificate.origin]: certificate.fingerprint,
          },
        })
        certificate = null
        broadcast()
      }
      break
    }
    case 'open:external':
      await shell.openExternal(patch.url)
      break
    case 'notification':
      if (!store.get().preferences.doNotDisturb && Notification.isSupported()) {
        const notification = new Notification({
          title: patch.title,
          body: patch.body,
          icon: iconPath,
        })
        notification.on('click', showWindow)
        notification.show()
        if (process.platform === 'darwin') app.dock?.setBadge('•')
        tray?.setToolTip(`瑞历 · ${patch.title}`)
      }
      break
    case 'log':
      logger.write(patch.level, patch.message)
      break
    case 'backup:create': {
      const result = await dialog.showSaveDialog({
        title: '保存加密备份',
        defaultPath: `瑞历-${new Date().toISOString().slice(0, 10)}.ruili-backup`,
        filters: [{ name: '瑞历加密备份', extensions: ['ruili-backup'] }],
      })
      if (result.filePath)
        writeFileSync(result.filePath, await encryptBackup(patch.data, patch.password), {
          mode: 0o600,
        })
      return result.canceled ? 'cancelled' : 'saved'
    }
    case 'backup:restore': {
      const result = await dialog.showOpenDialog({
        title: '恢复加密备份',
        properties: ['openFile'],
        filters: [{ name: '瑞历加密备份', extensions: ['ruili-backup'] }],
      })
      const file = result.filePaths[0]
      if (!file) return undefined
      return decryptBackup(readFileSync(file, 'utf8'), patch.password)
    }
    case 'action':
      switch (patch.name) {
        case 'hide':
          hideWindow()
          break
        case 'show':
          showWindow()
          break
        case 'quit':
          app.quit()
          break
        case 'settings':
          openSettings()
          break
        case 'calendar':
          openCalendar()
          break
        case 'reload':
          ;(remote?.webContents ?? calendar?.webContents)?.reload()
          break
        case 'menu':
          if (window) Menu.buildFromTemplate(menuTemplate()).popup({ window })
          break
        case 'logs:export': {
          const result = await dialog.showSaveDialog({
            title: '导出日志',
            defaultPath: 'ruili-diagnostics.log',
          })
          if (result.filePath) writeFileSync(result.filePath, logger.export(), { mode: 0o600 })
          break
        }
        case 'update:check':
          await updater.check()
          break
        case 'update:download':
          await updater.download()
          break
        case 'update:install':
          updater.install()
          break
        case 'update:later':
          updater.later()
          break
        case 'update:skip':
          updater.skip()
          break
      }
      break
  }
  return undefined
}

async function initialize(): Promise<void> {
  if (process.platform === 'darwin' && app.dock) app.dock.setIcon(iconPath)
  logger = new RollingLogger(join(app.getPath('userData'), 'logs'))
  store = new ConfigStore(join(app.getPath('userData'), 'config.json'))
  vault = new CredentialVault(join(app.getPath('userData'), 'credentials.encrypted.json'))
  updater = new UpdateService(store, broadcast, logger)
  crashReporter.start({ uploadToServer: false, compress: true })
  protocol.handle('ruili', async (request) => {
    const resource = localResourcePath(request.url)
    if (!resource) return new Response('Not found', { status: 404 })
    const directory = resolve(
      applicationRoot,
      resource.area === 'app' ? 'build/web' : 'build/desktop/renderer',
    )
    let file = resolve(directory, `.${resource.pathname}`)
    if (!file.startsWith(directory + sep) && file !== directory)
      return new Response('Not found', { status: 404 })
    if (
      !existsSync(file) ||
      resource.pathname.endsWith('/') ||
      !resource.pathname.split('/').at(-1)?.includes('.')
    )
      file = join(directory, 'index.html')
    if (!existsSync(file)) {
      logger.write('error', `Packaged resource missing: ${file}`)
      return new Response('本地日历资源缺失，请重新安装瑞历。', {
        status: 503,
        headers: { 'content-type': 'text/plain;charset=utf-8' },
      })
    }
    try {
      const headers = new Headers({
        'content-type': localResourceContentType(file),
        'x-content-type-options': 'nosniff',
      })
      if (resource.area === 'shell') headers.set('Content-Security-Policy', SHELL_CSP)
      return new Response(readFileSync(file), { headers })
    } catch (error) {
      logger.write('error', `Packaged resource read failed: ${file}: ${String(error)}`)
      return new Response('本地日历暂时无法读取，请重新启动瑞历。', {
        status: 500,
        headers: { 'content-type': 'text/plain;charset=utf-8' },
      })
    }
  })
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) =>
    callback(permission === 'notifications' && isLocalAppUrl(contents.getURL())),
  )
  session.defaultSession.setPermissionCheckHandler(
    (contents, permission) =>
      permission === 'notifications' && Boolean(contents && isLocalAppUrl(contents.getURL())),
  )
  ipcMain.handle(IPC.get, (event, raw: unknown) => {
    validateSender(event)
    const query = z
      .object({ type: z.enum(['state', 'credentials']) })
      .strict()
      .parse(raw ?? { type: 'state' })
    if (query.type === 'credentials') {
      if (!event.sender.getURL().startsWith(`${APP_ORIGIN}/`))
        throw new Error('只有本地日历可以访问账户凭据')
      return vault.read()
    }
    return currentState()
  })
  ipcMain.handle(IPC.patch, async (event, raw: unknown): Promise<PatchResult> => {
    validateSender(event)
    const patch = patchSchema.parse(raw)
    if (
      ['credential:save', 'credential:delete', 'backup:create', 'backup:restore'].includes(
        patch.type,
      ) &&
      !event.sender.getURL().startsWith(`${APP_ORIGIN}/`)
    )
      throw new Error('只有本地日历可以管理数据')
    const data = await perform(patch)
    return { state: currentState(), ...(data !== undefined ? { data } : {}) }
  })
  store.subscribe((state) => {
    applyPreferences(state.preferences)
    broadcast()
  })
  createWindow()
  safely(async () => {
    await vault.initialize()
    broadcast()
  })
  createTray()
  hotkeyAvailable = globalShortcut.register(GLOBAL_SHORTCUT, toggleWindow)
  if (!hotkeyAvailable) runtimeMessage = '全局快捷键被其他应用占用；可通过任务栏或托盘打开瑞历。'
  nativeTheme.on('updated', broadcast)
  screen.on('display-removed', () => {
    if (window)
      window.setBounds(
        visibleBounds(
          window.getBounds(),
          screen.getAllDisplays().map((display) => display.workArea),
        ),
      )
  })
  if (store.get().preferences.autoStart) safely(() => applyAutoStart(true))
  if (store.get().preferences.updateUrl && app.isPackaged) safely(() => updater.check())
  logger.write('info', `Started ${app.getVersion()} on ${process.platform}/${process.arch}`)
  broadcast()
}

app.on('certificate-error', (event, contents, url, error, cert, callback) => {
  const origin = new URL(url).origin
  if (store?.get().preferences.trustedCertificates[origin] === cert.fingerprint) {
    event.preventDefault()
    callback(true)
    return
  }
  if (contents && (privilegedContents.has(contents.id) || contents === remote?.webContents)) {
    certificate = {
      origin,
      fingerprint: cert.fingerprint,
      subject: cert.subjectName,
      issuer: cert.issuerName,
      validExpiry: cert.validExpiry,
      reason: error,
    }
    broadcast()
  }
  callback(false)
})
app.on('before-quit', () => {
  quitting = true
  if (saveTimer) clearTimeout(saveTimer)
})
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  tray?.destroy()
})
app.on('activate', () => {
  if (store) showWindow()
})
app.on('window-all-closed', () => {
  if (quitting) app.quit()
})
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.setAppUserModelId('com.ruibing.ruili')
  app.on('second-instance', () => {
    if (store) showWindow()
  })
  void app
    .whenReady()
    .then(initialize)
    .catch((error: unknown) => {
      report(error)
      dialog.showErrorBox('瑞历无法启动', error instanceof Error ? error.message : String(error))
      app.quit()
    })
}
