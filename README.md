# 瑞历 · Ruili Calendar

> 一个运行在浏览器里的 CalDAV / CardDAV 日历客户端，中文定制版自托管方案。

瑞历是基于 [Calino](https://github.com/Ivan-Malinovski/calino)（MIT License，作者 Ivan Malinovski）二次开发的自托管日历前端：**中文化界面 + 品牌化「瑞历」+ 中文日期格式 + 内置日历订阅源 + 外网资源全本地化**，配合自托管的 [Baikal](https://sabre.io/baikal/) 后端，实现网页端编辑、iOS / Android 原生日历 App 直连读写，三端数据一致。

## 为什么做这个

原生的 Calino 是个很好的 local-first CalDAV 客户端，但对中国用户有几个硬伤：没有中文界面、日期格式是洋式的（`23 10月 2026`）、品牌和引导文案是英文、依赖 Google Fonts 等外网资源（断网环境无法使用）、也没有内置中文日历订阅源（老黄历、节假日等）。这个仓库把这些坑一个个填平，做成开箱即用的中文自托管日历。

## 与上游的差异（改造清单）

### 中文化
- 新增完整 `zh` 语言包（`src/locales/zh/`），覆盖日历、设置、引导、弹窗等全部界面文案。
- i18next 语言注册打通（`types` → `languages` → `locales` → `i18nHeadless` 四处），中文浏览器自动识别为中文，英文兜底。

### 品牌化「瑞历」
- 品牌名改为「瑞历」，替换商标图标（`public/trademark.png`）、favicon、PWA 图标。
- 标题字体采用开源毛笔书法字体 **马善政（Ma Shan Zheng，OFL 开源协议）**，子集化后本地 `@font-face` 引入，桌面顶栏与移动端侧栏统一。

### 中文日期格式
- 天视图标题 `周一|10月26日`、周视图 `10月28日 – 11月3日`。
- 日程详情弹窗日期改为 `2026年10月23日`（原 `23 10月 2026`）。

### 外网资源全本地化
- 移除 Google Fonts（Newsreader）依赖，字体文件下载到本地 `@font-face` 引入。
- 移除 jsdelivr 的 Web Worker 依赖（`browser-image-compression` 关闭 worker）。
- 全站 CSP 收紧到 `'self'`，断网/内网环境可完整使用。

### 内置日历订阅源
- 设置里新增「内置订阅源」区块，开箱即用 6 个中文订阅：老黄历（宜/忌）、法定节假日、节日节气、星座运势、天气。
- 星座带下拉选择、天气支持全国省市县三级中文联动下拉（不用手写英文 location 串）。
- 默认全开、首次自动订阅、不可删除（写死预设）。

### 交互优化
- 月视图单击某天 = 打开「天」视图，双击 = 创建日程（防误触）。
- 年月下拉框互斥（点月份关年份、点年份关月份）。

### 其他
- 重写引导弹框文案、删除隐私政策里的外链、精简页脚链接。
- 内置一个通用 CORS 代理（`proxy/server.mjs`），支持 base64url 编码的 target URL，用于绕过 CalDAV 服务器 / 外部 ICS 订阅源的 CORS 限制。

## 技术栈

- React 19 + TypeScript + Vite
- Zustand（localStorage 持久化）+ IndexedDB（大附件/联系人照片）
- tsdav（CalDAV/CardDAV 客户端）、ical.js、rrule、date-fns
- i18next（多语言）
- pnpm 10（构建）

## 架构

```
┌─────────────┐      CalDAV/CardDAV      ┌─────────────┐
│  瑞历（本仓库） │ ────────────────────────▶ │   Baikal    │
│  浏览器前端     │   （Basic auth / HTTPS）  │  存储后端    │
│  local-first │ ◀──────────────────────── │  SQLite     │
└─────────────┘                          └─────────────┘
      ▲  ▲  ▲
      │  │  └── iOS / Android 原生日历 App 直连（同一 Baikal，三端一致）
      │  └───── 桌面浏览器
      └──────── CORS 代理（绕过无 CORS 头的 CalDAV / ICS 源）
```

- **瑞历（本仓库）** 是纯前端，无自有后端，所有数据通过 CalDAV / CardDAV 协议读写 Baikal。
- **Baikal** 是独立的 CalDAV/CardDAV 服务器（Docker 部署），负责存储与多用户/多日历/地址簿。
- **iOS/Android** 通过系统日历账户直接连 Baikal，与网页端读写同一份数据。

## 快速开始

```bash
pnpm install
pnpm dev        # 本地开发
pnpm build      # 产物在 dist/
```

构建需要 pnpm 10。生产构建产物是纯静态文件，用任意静态服务器 / nginx / Docker 托管即可（见 `Dockerfile`、`docs/DOCKER.md`）。

### 环境变量

复制 `.env.example` 为 `.env.local`：

| 变量 | 说明 | 默认 |
|---|---|---|
| `VITE_SITE_URL` | 公网访问地址（SEO/OG 用，不带尾斜杠） | `https://calino.io` |
| `CALINO_GITHUB_REPO` | 页脚关于链接的仓库地址 | `ivan-malinovski/Calino` |
| `CALINO_CONTACT_EMAIL` | 联系邮箱 | `calendar@malinov.ski` |
| `CALINO_ENABLE_SW` | 启用 Service Worker 离线 | `false` |
| `CALINO_SELF_HOSTED` | 自托管静态构建（允许连明文 HTTP DAV） | `false` |

> 首次使用会弹出引导弹框，填写你的 CalDAV 服务器地址（形如 `https://your-dav.example.com/dav.php/`）、用户名、密码即可。

## 配置说明（订阅源与代理）

### 内置订阅源

内置订阅源列表在 `src/features/webcal/presetSubscriptions.ts`，默认指向 `your-feed.example.com`（占位符）。接入你自己的 ICS 订阅源时，改 `feedBase()` 返回的域名即可。订阅源通过本仓库自带的 CORS 代理（`/proxy` 路径）绕过 CORS。

### CORS 代理

`proxy/` 目录是一个零依赖的 Node CORS 代理（Node 18+），用于：

1. CalDAV 服务器没发 CORS 头时，代理转发 CalDAV 请求并补 CORS 头（含 MKCOL/MKCALENDAR 等 WebDAV 方法）。
2. 订阅外部 ICS 源时的 CORS 绕过。

运行：

```bash
cd proxy && node server.mjs          # 默认 8081 端口
# 或 docker compose up -d             # 见 proxy/docker-compose.yml
```

安全相关环境变量：`ALLOWED_ORIGINS`（限制来源）、`ALLOWED_TARGETS`（限制可访问的主机后缀，强烈建议公网部署时设置）、`MAX_BODY_BYTES`、`FETCH_TIMEOUT_MS`。代理内置 SSRF 防护：默认阻断环回/内网/链路本地/云元数据地址。

## 脱敏说明

本仓库由作者的私有部署脱敏而来：

- 引导弹框里预填的私有 CalDAV 服务器地址已替换为 `your-caldav.example.com`。
- 内置订阅源指向的私有订阅服务已替换为 `your-feed.example.com`。
- 代理的 target URL 采用 base64url 编码，仓库中不含任何真实域名、IP、密钥或凭据。

克隆后按需替换为你的地址即可。

## 许可证

本项目基于 [Calino](https://github.com/Ivan-Malinovski/calino) 二次开发，上游代码版权归 Ivan Malinovski 所有，遵循 [MIT License](./LICENSE)。中文化、品牌化等新增改动同样遵循 MIT License 发布。
