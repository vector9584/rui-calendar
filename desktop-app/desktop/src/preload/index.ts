import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { AppState, DesktopApi, StatePatch, StateQuery } from '../shared/schema'

const api: DesktopApi = {
  get: ((query: StateQuery = { type: 'state' }) => ipcRenderer.invoke(IPC.get, query)) as DesktopApi['get'],
  patch: (patch: StatePatch) => ipcRenderer.invoke(IPC.patch, patch),
  subscribe: (listener: (state: AppState) => void) => {
    const receive = (_event: Electron.IpcRendererEvent, state: AppState): void => listener(state)
    ipcRenderer.on(IPC.changed, receive)
    return () => { ipcRenderer.removeListener(IPC.changed, receive) }
  },
}
contextBridge.exposeInMainWorld('ruili', Object.freeze(api))
