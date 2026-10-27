# 瑞历自托管日历系统 — 部署手册

本目录是完整方案的部署资产：nginx 反代配置、frp 内网穿透配置、Hermes 集成脚本。

顶层 README 讲的是「是什么、为什么」，这篇讲的是「怎么装」。所有配置均为脱敏示例，替换成你的真实域名 / 证书 / frps 地址即可。

## 架构回顾

```
iOS 原生日历 ──CalDAV──┐
桌面浏览器 ──网页前端──┤
                       ├──> ECS nginx （独立 ssl 端口） ──┬─> /          → frpc 7002 → Calino(5233)
                        │                              ├─> /dav.php   → frpc 7001 → Baikal(5232)
                        │                              ├─> /admin+/res→ frpc 7001 → Baikal 管理后台
                        │                              └─> /proxy/    → frpc 7003 → calino-proxy(5234) → 任意 https 目标
```

一句话：Baikal 是唯一存储（日历 + 联系人），网页前端（Calino 中文定制版）负责界面，iOS 原生 App 直连 Baikal，三端数据一致。网页前端纯前端无状态，数据全在 Baikal。

## 组件与端口

| 组件 | 镜像/进程 | 内网 | frpc | 作用 |
|---|---|---|---|---|
| Baikal | `ckulka/baikal:0.10.1-nginx` | 127.0.0.1:5232 | 7001 | CalDAV/CardDAV 服务器，唯一存储 |
| 网页前端（Calino） | `ghcr.io/ivan-malinovski/calino:0.41.0`（或自构建镜像） | 127.0.0.1:5233 | 7002 | 网页日历客户端（本仓库） |
| calino-proxy | 本仓库 `proxy/` 自构建 | 127.0.0.1:5234 | 7003 | 通用 CORS 代理（订阅外部 ICS） |
| frpc | 飞牛应用 / 独立进程 | webServer 7400 | — | default 实例，reload=GET /api/reload |
| ECS nginx | 宝塔 / 裸 nginx | — | — | 独立 ssl 端口，公网 HTTPS 入口 |

## 一、部署 Baikal（存储后端）

```bash
docker run -d --name baikal --restart unless-stopped \
  -p 127.0.0.1:5232:80 \
  -v /path/to/baikal/config:/var/www/baikal/config \
  -v /path/to/baikal/specific:/var/www/baikal/Specific \
  ckulka/baikal:0.10.1-nginx
```

首次访问 `http://127.0.0.1:5232/admin/` 完成两步初始化：

1. **Config Standard**：时区、管理员密码、认证方式选 **Basic**（网页前端/iOS 都用 Basic 认证）。
2. **Config Database**：选 SQLite，点提交才真正初始化 `db.sqlite`（只交第一步会报 `no connection to a database`）。

然后在后台建一个 CalDAV 用户（如 `your-username`），并建一个日历（uri 建议 `personal`，颜色可自选）。

> ⚠️ 认证方式务必选 Basic。若误选/翻译成其他值（如 Digest），Basic 客户端（网页前端/iOS）会全部 401。

## 二、构建并部署网页前端（Calino 定制版）

本仓库即网页前端源码。构建：

```bash
pnpm install --frozen-lockfile
CALINO_SELF_HOSTED=true pnpm run build   # = update-sample-events.mjs + tsc -b + vite build
# 产物在 dist/
```

部署：把 `dist/` 内容放到宿主机目录，容器挂载它（持久化，升级/重建容器不丢）：

```bash
docker run -d --name calino --restart unless-stopped \
  -p 127.0.0.1:5233:8080 \
  -v /path/to/calino/dist:/srv \
  ghcr.io/ivan-malinovski/calino:0.41.0
```

升级时只需替换 `dist/` 目录内容 + `docker restart calino`。

> ⚠️ 坑：不要 `rm -rf` 挂载目录本身再重建（会破坏 bind mount，容器 Caddy 404）。只清空目录内容（`rm -rf dist/*` 保留 dist 目录）。若目录内旧文件属主是 root，先 `chown -R` 再 rsync，否则 Permission denied。

## 三、部署 calino-proxy（CORS 代理）

```bash
# 在仓库 proxy/ 目录
docker build -t calino-proxy:base64url .
docker run -d --name calino-proxy --restart unless-stopped \
  -p 127.0.0.1:5234:8081 \
  calino-proxy:base64url
# 健康检查
curl http://127.0.0.1:5234/health   # → Calino CORS proxy OK
```

代理 URL 约定：`/proxy/<base64url编码的目标origin>/<路径>`。安全相关环境变量：`ALLOWED_ORIGINS`（限制来源）、`ALLOWED_TARGETS`（限制可访问主机后缀，**公网部署强烈建议设置**）、`MAX_BODY_BYTES`、`FETCH_TIMEOUT_MS`。代理内置 SSRF 防护（默认阻断环回/内网/链路本地/云元数据地址）。

## 四、配置 frpc 隧道

用 `deploy/frpc/frpc.example.toml` 做模板，填好 frps 地址和 token，追加到你的 frpc 配置（或直接用它）。改完必须 reload：

```bash
curl http://127.0.0.1:7400/api/reload   # frpc 0.71 是 GET，不是 PUT/POST
```

reload 后 7001/7002/7003 隧道在 frps 端监听，ECS nginx 才能反代到它们。

## 五、配置 ECS nginx 反代

用 `deploy/nginx/calino.example.conf` 做模板，替换域名、证书路径、frps 地址，放到你的 nginx 站点目录。关键点：

- 走独立 ssl 端口，**不挂在 80/443 主站**（会覆盖主站）。
- `/admin/` 和 `/res/` 的 `Host` 用 `$http_host`（带端口），否则 Baikal 后台白屏。
- `/dav.php/` 的 OPTIONS 拦截必须补 `DAV` + `Allow` 头，否则 iOS 报「无法使用 SSL」。
- `/proxy/` 用尾斜杠 `proxy_pass http://127.0.0.1:7003/` 剥前缀，不要用 set/map。

```bash
nginx -t && nginx -s reload
```

> ⚠️ 远程传 nginx 配置时，`$host`/`$remote_addr` 等变量会被 shell 展开成空。用 base64 编码整份文件传输，或 heredoc 定界符加引号 `<<'EOF'`。

## 六、iOS 接入

iOS 原生日历 App 直接连 Baikal（CalDAV 读写，三端一致）：

- 设置 → 日历 → 账户 → 添加账户 → 其他 → 添加 CalDAV 账户
- 服务器：`your-domain.example.com`（端口单独填独立端口，别把端口塞进服务器字段）
- 用户名：`your-username`（你的 CalDAV 用户）
- 密码：该用户的 CalDAV 密码

iOS 强制 HTTPS，明文 http 直接拒（不是账号密码错）。自动发现走 `/.well-known/caldav`，所以 nginx 里那条 301 必须有。

## 七、Hermes / AI 助手集成（可选）

`deploy/hermes/baikal_calendar.py` 是一个零依赖的 CalDAV 写入 helper，供任何 AI 助手（如 Hermes Agent）直接操作日历，替代「写进第三方笔记再导出」的绕路。

```bash
# 写凭据文件（不落明文到代码）
cat > ~/.baikal.env <<'EOF'
BAIKAL_BASE_URL=https://your-domain.example.com:8443/dav.php
BAIKAL_USER_NAME=your-username
BAIKAL_USER_PASS=你的密码
EOF

# 自测（建一条 24h 后过期的测试事件，增→查→删）
python3 deploy/hermes/baikal_calendar.py
```

```python
from baikal_calendar import BaikalCal
cal = BaikalCal()
cal.put_event(uid="my-event-123@example", summary="标题",
              start=datetime(2026, 10, 28, 14, 0),
              end=datetime(2026, 10, 28, 15, 0),
              alarm_minutes=30)
cal.list_uids()        # 所有 UID（幂等判断）
cal.list_events()      # 结构化摘要（含 uri，删除迁移事件用）
cal.delete_event(uid)  # 按 UID 删
```

要点：时间传 naive 北京时间（内部转 UTC 存）；`alarm_minutes=0` 准点响 / `=30` 提前 30 分 / `None` 不挂提醒；循环用 `rrule` 传 RFC5545 字符串。

## 关键坑速查

1. iOS 强制 HTTPS，明文 http 被拒。
2. 浏览器直连外部 ICS 会被 CORS 拦，必须走 `/proxy/`（base64url 编码 origin）。
3. nginx 的 `$host` 经 ssh 传输会被 shell 展开成空 → base64 编码整份配置传输。
4. docker `rm -rf` 挂载目录会破坏 bind mount → 只清空目录内容。
5. frpc 改配置后必须 `GET /api/reload` 才生效。
6. Baikal 管理后台入口是 `/admin/`，需单独反代 `/admin/` + `/res/`。
7. Baikal 后台「进不去」实为白屏 = Host 丢端口 → `/admin` 和 `/res` 用 `$http_host`。
8. 翻译 Baikal 配置文件时，枚举值（Basic/Digest/Apache）**绝不可翻译**，否则认证错乱。
