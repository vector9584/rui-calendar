import { autoUpdater } from 'electron-updater'
import type { AppState } from '../shared/schema'
import type { ConfigStore } from './store'
import type { RollingLogger } from './logger'

type UpdateState = AppState['runtime']['update']
interface UpdateInfo { version: string }
interface DownloadProgress { percent: number }
export class UpdateService {
  private state: UpdateState = { status: 'idle', version: '', progress: 0, message: '' }
  constructor(private readonly store: ConfigStore, private readonly changed: () => void, logger: RollingLogger) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.logger = {
      info: (message: string) => logger.write('info', message),
      warn: (message: string) => logger.write('warn', message),
      error: (message: string) => logger.write('error', message),
      debug: (message: string) => logger.write('info', message),
    }
    autoUpdater.on('checking-for-update', () => this.set({ status: 'checking', message: '正在检查更新' }))
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      if (info.version === this.store.get().preferences.skippedVersion) {
        this.set({ status: 'idle', version: info.version, message: '已跳过此版本' })
      } else this.set({ status: 'available', version: info.version, message: '新版本已就绪，可选择下载或稍后更新' })
    })
    autoUpdater.on('update-not-available', () => this.set({ status: 'idle', message: '已是最新版本' }))
    autoUpdater.on('download-progress', (progress: DownloadProgress) => this.set({ status: 'downloading', progress: progress.percent, message: '正在下载更新，日历仍可使用' }))
    autoUpdater.on('update-downloaded', () => this.set({ status: 'ready', progress: 100, message: '更新已下载，重启瑞历即可安装' }))
    autoUpdater.on('error', (error: Error) => this.set({ status: 'error', message: `更新未完成：${error.message}` }))
  }
  get(): UpdateState { return { ...this.state } }
  private set(patch: Partial<UpdateState>): void { this.state = { ...this.state, ...patch }; this.changed() }
  async check(): Promise<void> {
    const url = this.store.get().preferences.updateUrl
    if (!url) { this.set({ status: 'error', message: '尚未配置更新服务，请在关于页填写 HTTPS 更新地址。' }); return }
    autoUpdater.setFeedURL({ provider: 'generic', url })
    await autoUpdater.checkForUpdates()
  }
  async download(): Promise<void> {
    if (this.state.status !== 'available') throw new Error('请先检查并选择可用更新')
    await autoUpdater.downloadUpdate()
  }
  install(): void {
    if (this.state.status !== 'ready') throw new Error('更新尚未下载完成')
    autoUpdater.quitAndInstall()
  }
  later(): void { this.set({ message: '可在关于页继续更新' }) }
  skip(): void {
    if (!this.state.version) return
    this.store.patch({ skippedVersion: this.state.version })
    this.set({ status: 'idle', message: '已跳过此版本' })
  }
}
