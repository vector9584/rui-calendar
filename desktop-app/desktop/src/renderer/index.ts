import type { AppState, Preferences, StatePatch } from '../shared/schema'

const api = window.ruili
let state: AppState | null = null
const query = new URLSearchParams(location.search)
if (!query.has('settings')) document.getElementById('settings')?.setAttribute('hidden', '')

// The browser smoke fixture opens the local shell without Electron's preload.
// Keep the route inspectable there while the real desktop path still renders
// exclusively from the typed main-process store.
if (!api && query.has('settings')) document.getElementById('settings')?.removeAttribute('hidden')

function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id)
  if (!result) throw new Error(`界面元素缺失：${id}`)
  return result as T
}

function message(text: string): void {
  const target = element('toast')
  target.hidden = !text
  target.textContent = text
}

function render(next: AppState): void {
  state = next
  const preferences = next.preferences
  document.documentElement.dataset.theme = preferences.theme === 'system' ? (next.runtime.dark ? 'dark' : 'light') : preferences.theme
  element('settings').hidden = !query.has('settings')
  const lock = document.querySelector<HTMLButtonElement>('[data-command="toggle-lock"]')
  lock?.setAttribute('aria-pressed', String(preferences.locked))
  lock?.setAttribute('aria-label', preferences.locked ? '解锁日历' : '锁定日历')
  for (const key of ['locked', 'mini', 'doNotDisturb', 'autoStart'] as const) element<HTMLInputElement>(key).checked = preferences[key]
  element<HTMLInputElement>('mode').checked = preferences.mode === 'top'
  element<HTMLInputElement>('opacity').value = String(Math.round(preferences.opacity * 100))
  element('opacityValue').textContent = `${Math.round(preferences.opacity * 100)}%`
  element<HTMLSelectElement>('theme').value = preferences.theme
  for (const key of ['remoteUrl', 'updateUrl'] as const) {
    const field = element<HTMLInputElement>(key)
    if (document.activeElement !== field) field.value = preferences[key]
  }
  element<HTMLInputElement>('autoStart').disabled = !next.runtime.autoStartAvailable
  element('autoStartHint').textContent = next.runtime.autoStartAvailable ? '登录系统后自动打开瑞历' : '当前运行方式不支持，请从安装版开启登录启动'
  element<HTMLInputElement>('opacity').disabled = !next.runtime.opacityAvailable
  element('opacityHint').textContent = next.runtime.opacityAvailable ? '拖动即可预览，自动保存' : '当前系统不提供窗口透明度，可使用主题调整日历外观'
  element('version').textContent = next.runtime.version
  element('platformSupport').textContent = `当前平台：${next.runtime.platform} · 本地日历离线可用`
  element('keychainStatus').textContent = next.runtime.keychainAvailable ? '账户密码由系统密码保险库加密保护。' : '系统密码保险库尚未解锁，无法保存账户密码；已有日历仍可离线使用。'
  element('accessFallback').textContent = `${next.runtime.trayAvailable ? '托盘已启用。' : '托盘不可用，任务栏入口保留。'}${next.runtime.hotkeyAvailable ? 'Ctrl / ⌘ + Shift + Space 可唤起或隐藏瑞历。' : '全局快捷键被占用，可使用任务栏打开瑞历。'}`
  element('message').hidden = !next.runtime.message
  element('message').textContent = next.runtime.message
  element('certificate').hidden = next.runtime.certificate === null
  if (next.runtime.certificate) {
    const cert = next.runtime.certificate
    element('certificateDetails').textContent = `${cert.origin}\n颁发给：${cert.subject}\n颁发者：${cert.issuer}\n指纹：${cert.fingerprint}\n有效期至：${new Date(cert.validExpiry * 1000).toLocaleDateString()}`
  }
  const update = next.runtime.update
  element('updateStatus').textContent = update.message || '可在这里检查新版本。'
  const progress = element<HTMLProgressElement>('updateProgress')
  progress.hidden = update.status !== 'downloading'
  progress.value = update.progress
  for (const action of ['download', 'install', 'later', 'skip']) {
    const button = document.querySelector<HTMLButtonElement>(`[data-command="update:${action}"]`)
    if (button) button.hidden = action === 'install' ? update.status !== 'ready' : action === 'download' ? update.status !== 'available' : !['ready', 'available'].includes(update.status)
  }
}

async function patch(value: StatePatch): Promise<void> {
  if (!api) { message('桌面连接不可用，请重新打开瑞历。'); return }
  try {
    const result = await api.patch(value)
    render(result.state)
    message('')
  } catch (error) {
    message(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : '操作没有完成，请重试。')
    const fresh = await api.get().catch(() => null)
    if (fresh) render(fresh)
  }
}

function change(value: Partial<Preferences>): void { void patch({ type: 'preferences', value }) }

document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach((button) => {
  button.addEventListener('click', () => {
    const command = button.dataset.command
    if (command === 'toggle-lock') { change({ locked: !state?.preferences.locked }); return }
    if (command) void patch({ type: 'action', name: command as Extract<StatePatch, { type: 'action' }>['name'] })
  })
})
element('toolbar').addEventListener('contextmenu', (event) => { event.preventDefault(); void patch({ type: 'action', name: 'menu' }) })
for (const key of ['locked', 'mini', 'doNotDisturb', 'autoStart'] as const) element<HTMLInputElement>(key).addEventListener('change', (event) => change({ [key]: (event.currentTarget as HTMLInputElement).checked }))
element<HTMLInputElement>('mode').addEventListener('change', (event) => change({ mode: (event.currentTarget as HTMLInputElement).checked ? 'top' : 'desktop' }))
element<HTMLSelectElement>('theme').addEventListener('change', (event) => change({ theme: (event.currentTarget as HTMLSelectElement).value as Preferences['theme'] }))
element<HTMLInputElement>('opacity').addEventListener('input', (event) => change({ opacity: Number((event.currentTarget as HTMLInputElement).value) / 100 }))
for (const [form, field] of [['remote-form', 'remoteUrl'], ['update-form', 'updateUrl']] as const) element(form).addEventListener('submit', (event) => { event.preventDefault(); change({ [field]: element<HTMLInputElement>(field).value.trim() }) })
element('trust-certificate').addEventListener('click', () => { const cert = state?.runtime.certificate; if (cert) void patch({ type: 'certificate:trust', origin: cert.origin, fingerprint: cert.fingerprint }) })
if (api) {
  const unsubscribe = api.subscribe(render)
  window.addEventListener('unload', unsubscribe, { once: true })
  void api.get().then(render).catch((error: unknown) => message(error instanceof Error ? error.message : '读取设置失败'))
} else message('桌面连接不可用，请重新打开瑞历。')
