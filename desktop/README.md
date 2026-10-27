# 瑞历桌面悬浮日历

把自托管的「瑞历」网页前端包装成一个 Windows 桌面悬浮小组件，支持悬浮/置顶、透明度调节、锁定点击穿透、开机启动等。

> 本项目为桌面客户端。内嵌的网页前端见 [vector9584/rui-calendar](https://github.com/vector9584/rui-calendar)。

## 功能特性

- 悬浮 / 置顶：可在桌面普通悬浮，或置顶在所有窗口之上
- 透明度：5% ~ 100% 可调
- 锁定：锁定后点击穿透并隐藏顶部栏，只能通过系统托盘菜单解锁
- 开机启动：登录 Windows 后自动运行
- 顶部栏按钮：关闭（隐藏到托盘）、刷新、设置
- 托盘菜单：悬浮 / 锁定 / 开机启动（红=关，绿=开）、设置、退出
- 主题跟随：顶部栏颜色随网页明暗主题实时切换
- 无滚动条，页面自适应填满窗口

## 配置日历地址

默认内嵌的日历地址在 [main.js](./main.js) 顶部：

```js
const CALENDAR_URL = 'https://your-calendar.example.com/';
```

将其替换为你自己部署的网页前端地址后重新构建即可。

## 安装

### 便携版（免安装）

下载 `Rui-Calendar-x.x.x-portable.exe`，双击直接运行，无需安装。

### 安装版

下载 `Rui-Calendar-x.x.x-setup.exe`，双击按向导安装。

### 卸载

- 安装版：控制面板 → 程序和功能 → 卸载「瑞历」
- 便携版：直接删除 exe 即可

## 开发与构建

```bash
npm install
npm start               # 本地运行
npm run dist            # 构建安装版 + 便携版（产物在 dist/）
npm run dist:portable   # 仅构建便携版
```

## 许可证

[MIT](./LICENSE)
