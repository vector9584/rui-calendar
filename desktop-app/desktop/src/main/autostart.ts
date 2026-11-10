import { app } from 'electron'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function autoStartAvailable(): boolean {
  return app.isPackaged && !process.execPath.startsWith(app.getPath('temp'))
}

export function applyAutoStart(enabled: boolean): void {
  if (enabled && !autoStartAvailable()) {
    throw new Error('当前从开发目录或临时目录运行。请安装瑞历后开启登录启动；当前设置未改变。')
  }
  if (process.platform !== 'linux') {
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath })
    return
  }
  const configDirectory = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  const directory = join(configDirectory, 'autostart')
  const path = join(directory, 'ruili-calendar.desktop')
  if (!enabled) {
    if (existsSync(path)) unlinkSync(path)
    return
  }
  mkdirSync(directory, { recursive: true })
  const executable = process.env.APPIMAGE || process.execPath
  const quoted = executable.replace(/[\\"`$]/g, (character) => `\\${character}`).replace(/%/g, '%%')
  writeFileSync(path, `[Desktop Entry]\nType=Application\nName=瑞历\nExec="${quoted}"\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`, { mode: 0o600 })
}
