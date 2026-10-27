const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('menu', {
  getState: () => ipcRenderer.invoke('menu-get-state'),
  set: (key, value) => ipcRenderer.send('menu-set', { key, value }),
  close: () => ipcRenderer.send('menu-close'),
  openSettings: () => ipcRenderer.send('open-settings'),
  quit: () => ipcRenderer.send('quit-app')
});
