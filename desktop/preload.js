// preload.js —— 注入顶部工具条（拖动、关闭、刷新、设置），隐藏滚动条让页面填满窗口
// 锁定策略：主进程 setIgnoreMouseEvents(true, {forward:true}) 点击穿透；
// 页面根据鼠标位置动态切换，仅顶部工具条恢复可交互。
const { ipcRenderer } = require('electron');

(function () {
  const GEAR_SVG =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  const CLOSE_SVG =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  const REFRESH_SVG =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';

  let locked = false;
  let lastX = -1;
  let lastY = -1;
  let lastIgnore = null;

  function sendIgnore(ignore) {
    if (lastIgnore === ignore) return;
    lastIgnore = ignore;
    ipcRenderer.send('set-ignore-mouse', ignore);
  }

  function refreshIgnore() {
    if (!locked) return;
    let overInteractive = false;
    if (lastX >= 0 && lastY >= 0) {
      const el = document.elementFromPoint(lastX, lastY);
      overInteractive = !!(el && el.closest('#__ycal_topbar'));
    }
    sendIgnore(!overInteractive);
  }

  function setTopbarVisible(visible) {
    const topbar = document.getElementById('__ycal_topbar');
    if (!topbar) return;
    topbar.style.display = visible ? '' : 'none';
  }

  // 顶部工具条颜色直接绑定被包裹页面自身的 CSS 变量：
  // 背景用 var(--canvas)，图标用 var(--color-text)，随 <html data-theme> 实时自动同步。
  // 不能用 html/body 的内联背景（页面切浅色时它不会更新，仍是深色）。
  function inject() {
    if (!document.body || !document.head) return;
    if (document.getElementById('__ycal_topbar')) return;

    const style = document.createElement('style');
    style.id = '__ycal_style';
    style.textContent = [
      // 隐藏所有滚动条，页面填满窗口
      'html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; }',
      // 页面内容整体下移，让出顶部工具条，避免顶部内容被 header 遮挡
      'body { padding-top: 30px !important; box-sizing: border-box !important; }',
      '::-webkit-scrollbar, *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; background: transparent !important; }',
      '* { scrollbar-width: none !important; -ms-overflow-style: none !important; }',
      // 顶部工具条（header）—— 底色跟随页面 --canvas，图标跟随 --color-text
      '#__ycal_topbar { position: fixed; top: 0; left: 0; right: 0; height: 30px; z-index: 2147483647; -webkit-app-region: drag; cursor: grab; display: flex; align-items: center; justify-content: center; background: var(--canvas, #faf8f3); --ycal-fg: var(--color-text, #2c2823); --ycal-bg: color-mix(in srgb, var(--ycal-fg) 12%, transparent); --ycal-hover-bg: color-mix(in srgb, var(--ycal-fg) 20%, transparent); --ycal-hover-fg: var(--ycal-fg); --ycal-hint: color-mix(in srgb, var(--ycal-fg) 18%, transparent); }',
      '#__ycal_topbar:hover { background: color-mix(in srgb, var(--canvas, #faf8f3) 95%, var(--ycal-fg) 5%); }',
      '#__ycal_topbar::after { content: ""; width: 44px; height: 4px; border-radius: 2px; background: var(--ycal-hint); opacity: 0; transition: opacity .15s; }',
      '#__ycal_topbar:hover::after { opacity: 1; }',
      // 顶部按钮（统一在左上角，从左到右：关闭、刷新、设置）
      '#__ycal_close, #__ycal_refresh, #__ycal_gear { position: absolute; top: 3px; width: 24px; height: 24px; border: none; border-radius: 50%; background: var(--ycal-bg); color: var(--ycal-fg); cursor: pointer; -webkit-app-region: no-drag; display: flex; align-items: center; justify-content: center; padding: 0; transition: background .18s ease, color .18s ease, transform .18s ease, box-shadow .18s ease; }',
      '#__ycal_close { left: 8px; }',
      '#__ycal_refresh { left: 38px; }',
      '#__ycal_gear { left: 68px; }',
      '#__ycal_close:hover, #__ycal_refresh:hover, #__ycal_gear:hover { background: var(--ycal-hover-bg); color: var(--ycal-hover-fg); transform: scale(1.1); }',
      '#__ycal_close:active, #__ycal_refresh:active, #__ycal_gear:active { transform: scale(0.88); }',
      '#__ycal_close:hover { background: rgba(239,68,68,0.18); color: #ef4444; }'
    ].join('\n');

    const topbar = document.createElement('div');
    topbar.id = '__ycal_topbar';
    topbar.setAttribute('title', '拖动移动窗口（右键打开菜单）');

    const close = document.createElement('button');
    close.id = '__ycal_close';
    close.title = '隐藏到托盘';
    close.innerHTML = CLOSE_SVG;

    const refresh = document.createElement('button');
    refresh.id = '__ycal_refresh';
    refresh.title = '刷新页面';
    refresh.innerHTML = REFRESH_SVG;

    const gear = document.createElement('button');
    gear.id = '__ycal_gear';
    gear.title = '设置';
    gear.innerHTML = GEAR_SVG;

    topbar.appendChild(close);
    topbar.appendChild(refresh);
    topbar.appendChild(gear);
    document.head.appendChild(style);
    document.body.appendChild(topbar);

    close.addEventListener('click', (e) => {
      e.stopPropagation();
      ipcRenderer.send('hide-window');
    });
    refresh.addEventListener('click', (e) => {
      e.stopPropagation();
      ipcRenderer.send('reload-page');
    });
    gear.addEventListener('click', (e) => {
      e.stopPropagation();
      ipcRenderer.send('open-settings');
    });
    topbar.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      ipcRenderer.send('open-menu', 'cursor');
    });
  }

  // 锁定状态变化时：锁定则隐藏整个顶部栏，解锁则恢复显示
  ipcRenderer.on('lock-changed', (e, value) => {
    locked = value;
    lastIgnore = null;
    setTopbarVisible(!value);
    if (locked) refreshIgnore();
  });

  // 始终记录鼠标位置；锁定后据此动态切换穿透区域
  document.addEventListener('mousemove', (e) => {
    lastX = e.clientX;
    lastY = e.clientY;
    if (locked) refreshIgnore();
  });

  document.addEventListener('mouseleave', () => {
    if (locked) sendIgnore(true);
  });

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => setTimeout(inject, 300));
  } else {
    setTimeout(inject, 300);
  }
})();
