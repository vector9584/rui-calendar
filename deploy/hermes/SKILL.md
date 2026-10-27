---
name: baikal-calino-ops
description: 操作/排查自托管日历栈（Baikal + 瑞历 Calino）时使用。含架构、iOS 接入、多用户、AI 助手直写日历。
---

# Baikal + 瑞历（Calino）自托管日历栈

> 本机日历基础设施：**Baikal** 做 CalDAV/CardDAV 统一存储，**瑞历（Calino 中文定制版）** 做网页编辑界面，iOS/Android 原生日历 App 直连 Baikal 读写，三端数据一致（都指向同一个 Baikal）。
> 选型背景：Y日历 的 CalDAV 时区 bug（iOS 写 timed 事件被归零成全天）无法修复（源码不公开），故弃用，改用「存储 + 前端」两层标准协议组件。

## 架构

- **Baikal**（存储 + 多用户 + 多日历 + 颜色 + 地址簿）：Docker `ckulka/baikal:0.10.1-nginx`，SQLite `specific/db/db.sqlite`，容器端口 80 映射 `127.0.0.1:5232`。
- **瑞历（Calino）**（纯前端 CalDAV/CardDAV 客户端，MIT，local-first 无自有后端）：Docker `ghcr.io/ivan-malinovski/calino:0.41.0`，容器端口 8080 映射 `127.0.0.1:5233`（内置 Caddy）。
- **calino-proxy**（通用 CORS 代理）：本仓库 `proxy/` 自构建，映射 `127.0.0.1:5234`。
- **iOS / Android**：原生日历 App 连 Baikal CalDAV（读写）。
- **HTTPS 反代**（ECS 公网 nginx，独立 ssl 端口，**绝不挂在 80/443 主站**）：`/dav.php` → Baikal；`/admin` + `/res` → Baikal 管理后台（入口是 `/admin/`，不是 `/dav.php/admin/`，`/res/` 是后台静态资源必须一起反代）；`/proxy/` → calino-proxy；`/` → 瑞历前端。
- `.well-known/caldav` 和 `.well-known/carddav` → 301 `/dav.php/`（iOS 自动发现）。

### 组件与端口（示例值，替换成你的实际值）

| 组件 | 镜像/进程 | 内网 localhost | frp 隧道（公网） | 作用 |
|---|---|---|---|---|
| Baikal | `ckulka/baikal:0.10.1-nginx` | 5232 | 7001 | CalDAV/CardDAV 服务器，唯一存储 |
| 瑞历（Calino） | `ghcr.io/ivan-malinovski/calino:0.41.0` | 5233 | 7002 | 网页日历客户端 |
| calino-proxy | 本仓库 `proxy/` 自构建 | 5234 | 7003 | 通用 CORS 代理 |
| frpc | 飞牛应用 / 独立进程 | webServer 7400 | — | default 实例，reload = GET /api/reload |
| ECS nginx | 宝塔 / 裸 nginx | — | 独立 ssl 端口 | 公网 HTTPS 入口 |

## 容器管理

```bash
docker ps -a --filter "name=baikal" --filter "name=calino"
```

## iOS 接入（CalDAV 读写）

三件套：服务器 `your-domain.example.com`（端口单独填独立端口，别把 `:端口` 塞进服务器字段）、用户名 `your-username`、密码 = 该用户的 CalDAV 密码。

iOS 自动发现日历后即可增删改、实时同步。**iOS 强制 HTTPS**，明文 http 直接拒（不是账号密码错）。

## 网页端登录（瑞历）

浏览器打开 `https://your-domain.example.com/`（独立端口），首次登录填：服务器 `https://your-domain.example.com/dav.php/`、用户名、密码。

## 中文化 / 品牌化定制（本仓库已内置）

Calino 官方镜像无中文（i18next 只 ship en/da/de/es/fr/it/nl 7 种），品牌名/图标/链接/引导弹框在源码里硬编码非 i18n key。本仓库已完成：zh 翻译、品牌名「瑞历」、删隐私/GitHub 链接、重写引导弹框、换自定义图标。速记要点：

- 加一门语言要改 **4 处**：`src/types/index.ts`（Language 联合类型）、`src/lib/languages.ts`（SUPPORTED_LANGUAGES + LANGUAGE_OPTIONS）、`src/locales/index.ts`（loader）、`src/lib/i18nHeadless.ts`（headless loader）。漏 i18nHeadless.ts 会让 `tsc -b` 报 `Property 'zh' is missing`。
- 默认中文靠 `getBrowserLanguage()` 检测；fallback 保持 `en` 勿改（否则翻译遗漏键显示空白）。
- 品牌名是**两条独立代码路径**，必须同步改：桌面顶栏 `CalendarHeader.tsx`（`.brand`/`.brandLogo`/`.brandName`）、移动端侧栏 `Sidebar.tsx`（`.sidebarBrand*`）。
- 日期格式：天视图 `M月d日`、周视图 `M月d日 – M月d日`、详情弹窗 `yyyy年M月d日`（date-fns token：`M`/`d` 纯数字 locale 无关，`MMM`/`MMMM` 才受 locale 影响）。
- 构建环境：`pnpm install --frozen-lockfile` + `CALINO_SELF_HOSTED=true pnpm build`，产物 `dist/` 持久化挂载到容器 `/srv`，升级只需替换目录 + `docker restart`。

## 直接操作 Baikal（加日程 / 待办 / 查 / 删）

AI 助手（Hermes）加日程/待办不再走第三方笔记，直接走 CalDAV 协议写 Baikal（三端实时一致）。

### 脚本首选：`baikal_calendar.py`（零依赖 helper，同目录）

```python
from baikal_calendar import BaikalCal
cal = BaikalCal()            # 读凭据，连 personal 日历
cal.list_events()            # [{uri, uid, summary, dtstart, dtend, rrule}]（uri 用于删除）
cal.list_uids()              # 所有 UID 集合（幂等判断）
cal.put_event(uid=..., summary=..., start=..., end=..., description=..., location=...,
              all_day=False, alarm_minutes=None, rrule=None)  # PUT 同名覆盖即更新
cal.get_event(uid)           # 按 UID 读回
cal.delete_event(uid)        # 按 UID 删（新事件 uri==uid 有效）
cal.delete_uri(uri)          # 按 uri 删（删除迁移来的 RRULE 事件必须用这个）
```

- 时间参数是 **naive datetime = 北京时间**，helper 内部转 UTC 存（DTSTART 带 Z）。
- `alarm_minutes=0` 准点响（VALARM TRIGGER:-PT0M）；`=30` 提前 30 分；`None` 不挂 VALARM。
- `rrule` 直接拼字符串（如 `FREQ=DAILY;UNTIL=20270124T155959Z`，UNTIL 必须 UTC 带 Z）。
- ⚠️ **uri ≠ uid 坑**：迁移来的 RRULE 合并事件，其 href（uri）和 VEVENT 内部 UID 是两个独立随机 UUID，不一致 → 用 UID 拼 URL 的 GET/DELETE 会 404。**删迁移来的 RRULE 事件必须用 `list_events()` 拿到的 `uri` 走 `delete_uri(uri)`**；新写入的事件（uid 自定义 `xxx@hermes`）uri==uid，两种删除都行。

### 底层 curl 模板（协议参考）

```bash
B="https://your-domain.example.com/dav.php"   # 独立端口
U="your-username"; P="$BAIKAL_USER_PASS"       # 凭据在 .env
CAL="$B/calendars/your-username/personal/"     # 日历集合 URI=personal

# 列日历
curl -u "$U:$P" -X PROPFIND -H "Depth:1" -H "Content-Type: application/xml" \
  --data '<d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:resourcetype/></d:prop></d:propfind>' \
  "$B/calendars/your-username/"

# 列事件（REPORT calendar-query）
curl -u "$U:$P" -X REPORT -H "Depth:1" -H "Content-Type: application/xml" \
  --data '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"/></c:comp-filter></c:filter></c:calendar-query>' \
  "$CAL"

# 加/改日程（PUT 同名覆盖即更新）
curl -u "$U:$P" -X PUT -H "Content-Type: text/calendar; charset=utf-8" \
  --data-binary @event.ics "$CAL<uid>.ics"

# 删
curl -u "$U:$P" -X DELETE "$CAL<uid>.ics"
```

VEVENT 模板（时间用 TZID=Asia/Shanghai，全天用 VALUE=DATE）：

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Hermes//Baikal//CN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:<uuid>@hermes
DTSTAMP:20261027T000000Z
DTSTART;TZID=Asia/Shanghai:20261028T140000
DTEND;TZID=Asia/Shanghai:20261028T150000
SUMMARY:标题
LOCATION:地点
DESCRIPTION:备注
END:VEVENT
END:VCALENDAR
```

坑：

- 重复日程用 RRULE（`FREQ=DAILY` / `FREQ=WEEKLY;BYDAY=...`），比展开成 N 条单日事件干净。
- UID 全局唯一，用 uuid + `@hermes` 后缀；VEVENT 与 VTODO 的 UID 不能撞。
- 全天事件 `DTSTART;VALUE=DATE:20261028`，DTEND 用次日。
- 认证是 **Basic auth**（`dav_auth_type: Basic`）。⚠️ **翻译血泪坑**：翻译 Baikal 后台时若连 `config/baikal.yaml` 的枚举值一起翻译（`dav_auth_type: Basic` 被翻成中文「基本的」），判断失效、静默回退 Digest，Basic 客户端全部 401。**配置文件里的枚举值绝不可翻译**。
- 列事件/列联系人用 REPORT，不用 GET。

## 联系人批量导入（vcf → CardDAV 地址簿）

- **地址簿 URI**：`/dav.php/addressbooks/your-username/default/`（`card:addressbook` 类型）。
- iPhone 导出 vcf 特征：`VERSION:3.0`、**0 张有 UID**、带折行 base64 头像。
- **必须补 UID**：CardDAV 同步靠 UID 识别卡片，无 UID 会乱。用确定性 uuid5（`uuid.uuid5(NAMESPACE_DNS, FN + "|" + N + "|" + 排序后的号码)`），重复导入幂等。
- **PUT**：每张卡 `PUT /dav.php/addressbooks/your-username/default/{uid}.vcf`，`Content-Type: text/vcard; charset=utf-8`，返回 201=新建 / 204=覆盖。
- 一键脚本见本机 `scripts/vcf_to_carddav.py`。

## 关键坑速查

1. **iOS 强制 HTTPS**，明文 http 被拒；「无法使用 SSL」报错极具误导性——真实原因常是：①自动发现端点 `/.well-known/caldav` 没配；②nginx 的 OPTIONS 拦截 `return 204` 时**丢了 `DAV`/`Allow` 头**，iOS 认证通过后做能力探测拿不到 `calendar-access`，判定服务器不支持 CalDAV、放弃同步。排查时先怀疑报错本身，而不是顺着报错找证书问题。
2. **浏览器直连外部 ICS 会被 CORS 拦**，必须走 `/proxy/`（base64url 编码 origin）。URL 编码用 `encodeURIComponent` 产 `%2F` 经 nginx 反代必坏（`$uri` 被 normalize），**唯一干净解是 base64url**（只含 `[A-Za-z0-9-_]`）。
3. **nginx 的 `$host`/`$remote_addr` 经 ssh 传输会被 shell 展开成空** → 用 base64 编码整份配置传输，或 heredoc 定界符加引号 `<<'EOF'`。
4. **docker `rm -rf` 挂载目录本身会破坏 bind mount**（容器 Caddy 404）→ 只清空目录内容（`rm -rf dist/*` 保留 dist 目录）；目录内旧文件属主 root 时先 `chown -R` 再 rsync。
5. **frpc 改 toml 后必须 reload**：`curl http://127.0.0.1:7400/api/reload`（GET）。
6. **Baikal 管理后台入口是 `/admin/`**，需单独反代 `/admin/` + `/res/`；后台「进不去」实为白屏 = Host 丢端口 → `/admin` 和 `/res` 用 `$http_host`（带端口），`/dav.php` 和 `/` 保持 `$host`。
7. **翻译 Baikal 配置文件时枚举值不可翻译**（见上）。

## 凭据

全部在 `.env`：`BAIKAL_ADMIN_PASS`（admin 后台）、`BAIKAL_USER_PASS`（CalDAV 密码）、`BAIKAL_USER_NAME`、`BAIKAL_USER_DISPLAY`。**不要在脚本/回复落明文**。

## 数据路径

- Baikal db：`<persistent>/baikal/specific/db/db.sqlite`
- CalDAV 日历集合：`/dav.php/calendars/<username>/personal/`；principal `/dav.php/principals/<username>/`
