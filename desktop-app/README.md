# 瑞历桌面端（desktop-app）

瑞历的桌面客户端。Electron + TypeScript，本地优先：配置和数据存在本机，断网照样能看能改，联网后走 CalDAV 增量同步。

1.2.0 是一次重写。之前那版是把网页塞进 Electron 壳、靠注入改样式的方案（`desktop/main.js`），已经整体移除。

## 结构

```
desktop-app/
├── desktop/
│   ├── src/main/       主进程：index / store / vault / backup / logger / autostart / updater
│   ├── src/preload/    sandbox preload，IPC 通道白名单内联
│   ├── src/renderer/   本地渲染层：index.html / index.ts / tokens.css / shell.css
│   ├── src/shared/     ipc / schema(zod) / security / bounds / channels.json
│   ├── tests/          主进程单元测试
│   └── e2e/            桌面壳 Playwright 用例
├── scripts/build.mjs   编译主进程 + 调前端 vite build + 一起打进 asar
├── scripts/frontend.mjs 转发前端命令（typecheck / lint / test / e2e）
├── docs/verification/  功能完成度矩阵、变更清单、验证记录与截图
└── package.json        electron-builder 三平台配置
```

## 构建

需要一个能跑前端的环境——前端就在仓库根目录，桌面工程借用它的 `node_modules`：

```bash
# 在仓库根，先装前端依赖
pnpm install
pnpm build                       # 产物 dist/

# 再进桌面工程
cd desktop-app
pnpm install
pnpm build                       # 编译主进程 + 把 dist/ 拷进 build/web
pnpm build:win                   # Windows：NSIS 安装版 + 便携版
pnpm build:mac                   # macOS：universal dmg + zip
pnpm build:linux                 # Linux：AppImage + deb（x64 / arm64）
```

产物落在 `desktop-app/release/`。`pnpm start` 直接跑 `electron .`，前提是 `build/` 已经生成。

## 测试

```bash
pnpm test:desktop    # 主进程单测（store / vault / backup / security / updater）
pnpm typecheck       # 桌面 TS + 前端 TS 一起过
pnpm e2e:desktop     # 桌面壳 Playwright
```

## 验收状态

`docs/verification/功能完成度矩阵.md` 逐条列了每个功能点的入口、UI、交互、数据、持久化、异常态、跨平台和测试，末尾是状态列：**5 项 ✅ 完整、7 项 ⚠️ 半成品**。

那 7 项不是功能没做，是实现完了但验收证据没全绿——跨浏览器矩阵、三平台 GUI 逐项交互、全部组件十态组合这些还缺记录。每一行的状态列写清了缺口是什么，`验证记录.md` 里有对应的原始日志与截图。

## 安全边界

- `sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`
- 渲染层不接触 Node，能用的 IPC 由 `channels.json` 白名单决定，主进程侧再做 zod 校验
- 导航白名单 + CSP，禁止远程页面加载
- 配置写入是原子的（临时文件 + rename），损坏文件保留为 `.previous` 供回滚

## 许可证

MIT，与仓库根 [LICENSE](../LICENSE) 一致。
