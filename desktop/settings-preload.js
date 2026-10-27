const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ycal', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (patch) => ipcRenderer.send('update-settings', patch),
  closeSettings: () => ipcRenderer.send('close-settings'),
  quitApp: () => ipcRenderer.send('quit-app')
});
