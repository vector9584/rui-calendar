const { app, BrowserWindow, Tray, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// 替换为你自己部署的「瑞历」网页地址
const CALENDAR_URL = 'https://your-calendar.example.com/';
const APP_ICON = path.join(__dirname, 'assets', '瑞历.png');

let mainWindow = null;
let settingsWindow = null;
let menuWindow = null;
let tray = null;
let isQuitting = false;

const configPath = path.join(app.getPath('userData'), 'config.json');

const defaultConfig = {
  opacity: 0.95,
  mode: 'top', // 'top' 置顶 | 'desktop' 普通悬浮
  autoStart: false,
  locked: false, // 锁定后点击穿透，仅顶部工具条可交互
  bounds: null
};

function loadConfig() {
  try {
    return { ...defaultConfig, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) };
  } catch (e) {
    return { ...defaultConfig };
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) { /* 忽略写入失败 */ }
}

let config = loadConfig();

function applyMode() {
  if (!mainWindow) return;
  // 使用默认置顶层级（floating），避免 screen-saver 层级造成合成/透明度异常
  mainWindow.setAlwaysOnTop(config.mode === 'top');
  if (!mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('mode-changed', config.mode === 'top');
  }
}

function applyOpacity() {
  if (!mainWindow) return;
  mainWindow.setOpacity(config.opacity);
}

function applyLock() {
  if (!mainWindow) return;
  if (config.locked) {
    // 点击穿透，但把鼠标移动消息转发给页面，页面据此让顶部工具条恢复可交互
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    mainWindow.setIgnoreMouseEvents(false);
  }
  if (!mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('lock-changed', config.locked);
  }
}

function toggleLock() {
  config.locked = !config.locked;
  applyLock();
  saveConfig();
}

function setOpacity(value) {
  config.opacity = Math.min(1, Math.max(0.05, value));
  applyOpacity();
  saveConfig();
}

function setMode(mode) {
  config.mode = mode;
  applyMode();
  saveConfig();
}

function setAutoStart(enable) {
  config.autoStart = enable;
  saveConfig();
  // 便携版：process.execPath 指向临时解压目录（退出后即失效），
  // 开机启动应指向原始便携 exe（由 electron-builder 注入 PORTABLE_EXECUTABLE_FILE）。
  const portableFile = process.env.PORTABLE_EXECUTABLE_FILE;
  const execPath = portableFile || process.execPath;
  const args = (!portableFile && !app.isPackaged) ? [app.getAppPath()] : [];
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: execPath,
    args: args
  });
}

// 防抖保存窗口位置
let saveBoundsTimer = null;
function scheduleSaveBounds() {
  if (!mainWindow) return;
  clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(() => {
    if (mainWindow) {
      config.bounds = mainWindow.getBounds();
      saveConfig();
    }
  }, 500);
}

function createMainWindow() {
  const opts = {
    width: 400,
    height: 680,
    minWidth: 300,
    minHeight: 420,
    frame: false,
    transparent: false,
    resizable: true,
    show: false,
    skipTaskbar: true,
    backgroundColor: '#ffffff',
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  };

  if (config.bounds && typeof config.bounds.width === 'number') {
    opts.x = config.bounds.x;
    opts.y = config.bounds.y;
    opts.width = config.bounds.width;
    opts.height = config.bounds.height;
  }

  mainWindow = new BrowserWindow(opts);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(CALENDAR_URL);
  applyMode();
  applyOpacity();
  applyLock();

  // 页面加载完成后同步锁/悬浮状态，让右上角图标正确显示
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('lock-changed', config.locked);
      mainWindow.webContents.send('mode-changed', config.mode === 'top');
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('resize', scheduleSaveBounds);
  mainWindow.on('move', scheduleSaveBounds);

  mainWindow.on('close', (e) => {
    if (mainWindow) config.bounds = mainWindow.getBounds();
    saveConfig();
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function toggleMainWindow() {
  if (!mainWindow) {
    createMainWindow();
    return;
  }
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 380,
    height: 580,
    frame: false,
    resizable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.once('ready-to-show', () => settingsWindow.show());
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

// 自定义菜单（托盘右键 与 header 右键 共用）
function showMenu(anchor) {
  if (menuWindow) {
    menuWindow.close();
  }

  const win = new BrowserWindow({
    width: 244,
    height: 204,
    frame: false,
    resizable: false,
    show: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'menu-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  menuWindow = win;

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'menu.html'));

  win.once('ready-to-show', () => {
    const size = win.getBounds();
    let x, y;
    if (anchor === 'tray' && tray) {
      const tb = tray.getBounds();
      x = Math.round(tb.x + tb.width / 2 - size.width / 2);
      y = tb.y - size.height - 8;
    } else {
      const p = screen.getCursorScreenPoint();
      x = p.x;
      y = p.y;
    }
    const wa = screen.getDisplayNearestPoint({ x, y }).workArea;
    x = Math.min(Math.max(x, wa.x + 8), wa.x + wa.width - size.width - 8);
    y = Math.min(Math.max(y, wa.y + 8), wa.y + wa.height - size.height - 8);
    win.setPosition(x, y);
    win.show();
  });

  win.on('blur', () => { if (menuWindow === win) win.close(); });
  win.on('closed', () => { if (menuWindow === win) menuWindow = null; });
}

function createTray() {
  let icon = nativeImage.createFromPath(APP_ICON);
  if (icon.isEmpty()) {
    // 兜底：生成一个简单的占位图标
    icon = nativeImage.createEmpty();
  } else {
    icon = icon.resize({ width: 32, height: 32 });
  }
  tray = new Tray(icon);
  tray.setToolTip('瑞历');
  tray.on('click', () => toggleMainWindow());
  tray.on('right-click', () => showMenu('tray'));
}

// IPC
ipcMain.handle('get-settings', () => ({
  opacity: config.opacity,
  mode: config.mode,
  autoStart: config.autoStart,
  locked: config.locked
}));

ipcMain.on('update-settings', (e, patch) => {
  if (!patch || typeof patch !== 'object') return;
  let changed = false;
  if (typeof patch.opacity === 'number') {
    config.opacity = Math.min(1, Math.max(0.05, patch.opacity));
    applyOpacity();
    changed = true;
  }
  if (patch.mode === 'top' || patch.mode === 'desktop') {
    config.mode = patch.mode;
    applyMode();
    changed = true;
  }
  if (typeof patch.autoStart === 'boolean') {
    setAutoStart(patch.autoStart);
    changed = true;
  }
  if (typeof patch.locked === 'boolean') {
    config.locked = patch.locked;
    applyLock();
    changed = true;
  }
  if (changed) saveConfig();
});

ipcMain.on('close-settings', () => { if (settingsWindow) settingsWindow.close(); });
ipcMain.on('quit-app', () => app.quit());
ipcMain.on('toggle-lock', () => toggleLock());
ipcMain.on('toggle-mode', () => setMode(config.mode === 'top' ? 'desktop' : 'top'));
ipcMain.on('hide-window', () => { if (mainWindow) mainWindow.hide(); });
ipcMain.on('reload-page', () => {
  if (mainWindow && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.reload();
  }
});
ipcMain.on('open-settings', () => openSettings());
ipcMain.on('open-menu', (e, anchor) => showMenu(anchor === 'tray' ? 'tray' : 'cursor'));

// 页面根据鼠标位置动态切换穿透区域：锁定后仅顶部工具条可交互
ipcMain.on('set-ignore-mouse', (e, ignore) => {
  if (!mainWindow || !config.locked) return;
  mainWindow.setIgnoreMouseEvents(!!ignore, { forward: true });
});

// 自定义菜单 IPC
ipcMain.handle('menu-get-state', () => ({
  mode: config.mode,
  locked: config.locked,
  autoStart: config.autoStart
}));

ipcMain.on('menu-set', (e, { key, value }) => {
  if (key === 'mode') {
    setMode(value ? 'top' : 'desktop');
  } else if (key === 'locked') {
    config.locked = !!value;
    applyLock();
    saveConfig();
  } else if (key === 'autoStart') {
    setAutoStart(!!value);
  }
});

ipcMain.on('menu-close', () => { if (menuWindow) menuWindow.close(); });

// 应用生命周期
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.setAppUserModelId('com.rui.calendar');

  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createMainWindow();
    createTray();
    // 启动时同步开机启动注册项，确保 exe 路径/名称变化后仍正确
    setAutoStart(config.autoStart);
  });

  app.on('before-quit', () => { isQuitting = true; });

  app.on('window-all-closed', () => {
    // 保持托盘常驻，不在此退出
  });
}
