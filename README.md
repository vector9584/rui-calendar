# 瑞历 · 自托管日历系统

> 一套完整的自托管日历方案：**Baikal 存储 + 瑞历（Calino 中文定制版）前端 + CORS 代理 + nginx/frp 公网发布 + iOS 原生直连 + AI 助手集成**。

这不是一个单独的日历应用，而是一整套「自己完全掌控」的日历基础设施——日历和联系人的数据存在你自己的服务器上，网页端、iOS/Android 原生日历 App、以及（规划中的）桌面客户端读写同一份数据，三端实时一致。

## 为什么做这个

需求很朴素：想要一个「自己完全掌控的日历中枢」——能订阅别人的日历、能把自己建的日程整合发布、支持多用户、能穿透内网在公网用、手机和电脑同步。

最初用的是 NAS 上的 **Y日历**（一个 Go + Vue3 的自托管日历），功能面很全，但撞上了三个无法绕过的硬伤（详见 [JOURNEY.md](./JOURNEY.md)）：

1. **CalDAV 时区 bug**：iOS 往里写带时间的日程，会被归零成全天事件，而它的源码不公开，没法自己修。
2. **删日历缺失**：OpenAPI 只有 GET/POST calendars，没有 DELETE。
3. **订阅不能回写**：它是 CalDAV 服务器不是客户端，订阅别人只拉只读快照。

于是拆成「存储 + 前端」两层，用两个成熟的标准协议组件拼出同样能力、却更可控的方案。

## 架构

```
                      ┌─────────────────────────────────────────────┐
                      │  ECS 公网服务器（nginx 7086 ssl 入口）        │
                      │                                              │
   iOS 原生日历 ──CalDAV──▶ /dav.php  ─┐                            │
   桌面浏览器 ──瑞历网页──▶ /          ─┤                            │
                       │  /admin+/res ─┤  反代到 frps 隧道端口        │
   外部 ICS 订阅 ──CORS──▶ /proxy/    ─┘                            │
                      └──────────────────┬──────────────────────────┘
                                         │ frp 隧道（NAS 主动出站）
                      ┌──────────────────▼──────────────────────────┐
                      │  NAS（飞牛，内网）                            │
                      │   frpc ──┬─ 7031 ─▶ Baikal(5232)  存储后端   │
                      │           ├─ 7032 ─▶ 瑞历 Calino(5233) 前端  │
                      │           └─ 7033 ─▶ calino-proxy(5234) 代理 │
                      └─────────────────────────────────────────────┘
```

一句话：**Baikal 是唯一存储（日历 + 联系人），瑞历是漂亮的网页前端，iOS 原生 App 直连 Baikal，三端数据一致。** 瑞历是纯前端、无自有后端，所有数据通过 CalDAV / CardDAV 协议读写 Baikal。

### 组件清单

| 组件 | 职责 | 说明 |
|---|---|---|
| **Baikal** | CalDAV/CardDAV 存储后端 | Docker `ckulka/baikal:0.10.1-nginx`，SQLite，多用户/多日历/地址簿，唯一存储 |
| **瑞历（Calino 定制版）** | 网页日历客户端 | 本仓库核心，基于 [Calino](https://github.com/Ivan-Malinovski/calino)（MIT）二次开发 |
| **calino-proxy** | 通用 CORS 代理 | 本仓库 `proxy/`，零依赖 Node 服务，绕过外部 ICS 源的 CORS 限制 |
| **frpc** | 内网穿透客户端 | 跑在 NAS，主动出站连公网 frps，映射 3 条隧道 |
| **nginx（ECS）** | 公网 HTTPS 入口 | 7086 独立 ssl 端口，反代 + 证书终止 |
| **iOS/Android 原生日历** | 移动端读写 | 系统日历账户直连 Baikal，与网页端同一份数据 |
| **Hermes / AI 助手** | 程序化操作日历 | 通过 `deploy/hermes/baikal_calendar.py` 直写 Baikal |

## 从 Y日历 到这里（演进）

整个方案不是一步到位，而是调研 → 撞墙 → 换架构 → 逐层定制的五段演进，完整决策史见 [JOURNEY.md](./JOURNEY.md)。梗概：

1. **调研 Y日历**：确认它能订阅、能整合打包、CalDAV 可读写、多用户、可脱钩飞牛。
2. **全量接入 Y日历**：开端口、建 Token、接 MCP、迁移弄文笔记日程。
3. **撞墙**：撞上上面的三个硬伤（时区 bug 是致命的），且源码不公开无法修。
4. **换架构**：Baikal（存储）+ Calino（前端），标准 CalDAV 协议随意组合。
5. **定制 + 打通**：中文化、品牌化、内置订阅源、CORS 代理、nginx/frp 公网、iOS 接入。

## 瑞历前端（本仓库核心）

基于 Calino 二次开发的中文定制版，与上游的差异：

### 中文化
- 完整 `zh` 语言包（`src/locales/zh/`），覆盖日历、设置、引导、弹窗全部界面文案。
- i18next 语言注册打通四处（types / languages / locales / i18nHeadless），中文浏览器自动识别，英文兜底。

### 品牌化「瑞历」
- 品牌名改「瑞历」，替换商标图标、favicon、PWA 图标。
- 标题字体采用开源毛笔书法 **马善政（Ma Shan Zheng，OFL）**，5.8MB ttf 子集化成 1.5KB woff2 本地引入。

### 中文日期格式
- 天视图「周一|10月26日」、周视图「10月28日 – 11月3日」、详情弹窗「2026年10月23日」。

### 外网资源全本地化
- 移除 Google Fonts（Newsreader）和 jsdelivr（Web Worker）依赖，全站 CSP 收紧到 `'self'`，断网/内网可用。

### 内置中文订阅源
- 开箱即用 6 个订阅：老黄历（宜/忌）、法定节假日、节日节气、星座运势、天气。
- 天气支持全国省市县三级中文联动下拉。

### 交互优化
- 月视图单击 = 开「天」视图、双击 = 创建日程（防误触）；年月下拉框互斥。

完整改造清单见部署总纲笔记（私库），本仓库代码即最终实现。

## 目录结构

```
ruili-calendar/
├── src/                    # 瑞历前端源码（Calino 定制）
├── proxy/                  # 通用 CORS 代理（零依赖 Node，base64url 编码）
├── deploy/                 # 部署资产（脱敏）
│   ├── nginx/calino.example.conf   # ECS 7086 站点反代配置
│   ├── frpc/frpc.example.toml      # frp 隧道配置
│   ├── hermes/baikal_calendar.py   # AI 助手日历写入 helper
│   └── README.md                   # 部署手册
├── android/                # Calino 上游的 Android（Capacitor）包装
├── docs/                   # 上游文档（Docker/发布检查清单等）
├── README.md               # 本文档
└── JOURNEY.md              # 完整决策演进与心路历程
```

## 快速开始

前端开发：

```bash
pnpm install
pnpm dev          # 本地开发
pnpm build        # 产物在 dist/
```

完整部署（Baikal + 瑞历 + proxy + frp + nginx + iOS）见 [deploy/README.md](./deploy/README.md)。

## 桌面客户端

规划中：后续会补充一个桌面客户端（Windows 可执行文件），同样通过 CalDAV 连 Baikal，与网页端 / iOS 读写同一份数据。落地后会在此仓库补充对应说明。

## 脱敏说明

本仓库由作者的私有部署脱敏而来，不含任何真实域名、IP、密钥或凭据：

- 引导弹框预填的 CalDAV 服务器地址、订阅源域名、代理路径等已替换为占位符。
- 部署配置（nginx / frpc / Hermes 脚本）均为 `*.example` 模板，clone 后替换成你的地址即可。

## 许可证

本项目基于 [Calino](https://github.com/Ivan-Malinovski/calino)（MIT License，作者 Ivan Malinovski）二次开发。上游代码版权归 Ivan Malinovski 所有，中文化、品牌化及部署资产等新增部分遵循 [MIT License](./LICENSE) 发布。
