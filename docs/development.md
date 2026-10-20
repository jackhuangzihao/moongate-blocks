# 开发指南

本项目是原生微信小游戏，使用 JavaScript、CommonJS 和 Canvas 2D。游戏运行与 Node 自动测试均不需要安装 npm 依赖。浏览器试玩是对现有源码的打包和平台模拟，不是另一套玩法实现。

## 获取与微信运行

1. 从仓库下载源码 ZIP 后解压，或克隆仓库；进入含有 `game.js` 和 `project.config.json` 的项目根目录。
2. 在微信开发者工具中选择「导入项目 → 小游戏」，导入该目录。
3. 公共配置中的 AppID 为作者项目标识。有项目权限时使用原配置；无权限时在本地开发者工具里使用测试号，不把个人配置提交回仓库。
4. 从首页检查首次练习、自由消除、目标闯关、每日精选和落玉庭。好友排行、广告、分享及统计需要对应的微信环境与权限。

`project.private.config.json` 属于本机配置，已忽略；它可能覆盖公共配置中的基础库版本。公共配置目前为 3.7.9，这不代表每位开发者实际使用的版本。验收时记录实际开发者工具、基础库和设备版本。

作者机器上的 `docs/打开最新发布版.command`、`docs/最新发布版本.txt` 和 `docs/本地版本与测试.md` 仅在本地保留，不随公开仓库提供。它们涉及本机路径或历史环境，不能作为下载源码后的通用入口。克隆后从本指南和当前 Git 版本开始即可，无需这些本机记录。

## 自动测试

建议使用 **Node.js 24**（在 v24.20.0 上验证过，CI 也使用 Node 24）。无需运行 `npm install`。

```sh
# 单项测试，先确认该测试是否生成文件
node tests/saves.test.js

# 语法和模块路径检查
node --check game.js
node tests/module-structure.test.js

# 全量回归
node tests/run.js
```

`tests/run.js` 按文件名发现 `tests/*.test.js`，每组在独立进程运行。内容包括棋盘规则、存档兼容、关卡参考解、每日、重力、输入、布局、颜色和随机对局等。测试使用模拟 API，不请求真实广告或微信好友资料。

全量测试可以直接在仓库里运行。唯一写入项目目录的是 `docs/prototypes/gravity/lab.html`，它已被 Git 忽略，跑完后工作区仍是干净的。

各命令的写入位置：

| 命令或测试 | 写入位置 |
| --- | --- |
| `tests/gravity-controller.test.js` | 通过生成器覆盖 `docs/prototypes/gravity/lab.html` |
| `tests/playable-startup.test.js` | 自建系统临时目录生成页面，结束后清理 |
| `node tests/build-playable-preview.js` | 覆盖 `docs/previews/playable.html`、`daily-week.html`、`gravity.html` |
| `node tests/build-playable-preview.js --site` | 覆盖 `dist/browser/index.html` 和 `dist/browser/LICENSE` |

不要把 `docs/prototypes` 当作可随意删除的历史资料：重力测试仍读取其中的三个源文件。生成的 `lab.html` 则已忽略。

GitHub 上有两个工作流：

- `.github/workflows/test.yml`：每次推送和拉取请求都用 Node 24 运行全量测试，并生成一次浏览器页面，只有仓库读取权限。
- `.github/workflows/pages.yml`：推送到 `main` 时先跑全量测试，通过后生成展示页面并发布到 GitHub Pages。测试失败时不会发布。

## 浏览器试玩与静态发布

```sh
# 面向展示的页面：正常首次流程、没有关卡试验室和音效对比面板
node tests/build-playable-preview.js --site

# 面向开发的页面：保留小屏、关卡试验室、每日和重力入口
node tests/build-playable-preview.js
```

展示页面输出到 `dist/browser/`，可直接打开 `index.html`。源码与全部模拟逻辑内嵌在页面中，不依赖外部脚本、CDN 或服务器接口。许可文件随页面生成，未来分发时应一并保留。`dist/` 已忽略，不需要把每次生成的整份代码副本提交到 Git。

开发预览使用 `fangcunPreview:` 浏览器存储前缀，展示页面使用 `moongateBlocksWeb:`，二者不会覆盖彼此；都不读写微信存档。浏览器存储受站点地址和浏览器策略影响，隐私模式、清理站点数据或本地文件限制可能使进度无法保留。

在线试玩地址：<https://jackhuangzihao.github.io/moongate-blocks/>。它由 `pages.yml` 自动部署，内容就是 `dist/browser/`，不会发布整个项目文件夹。更新在线版本只需推送到 `main`。

浏览器检查建议：

1. 标准屏和小屏均检查首页、教学跳过或完成、进入对局及返回首页。
2. 用鼠标和触摸检查拖动、点选与取消；窄窗口下画布不横向溢出。
3. 普通入口首次流程与开发试验室分开，确认展示入口未解锁全部关卡。
4. 刷新页面检查浏览器进度，确认不同预览的存档相互独立。
5. 本地模拟不代表好友榜、广告、游戏音频或真实分享发送已可用；这些在微信中单独验证。

## 模块定位

| 路径 | 职责 |
| --- | --- |
| `game.js` | 场景、输入、生命周期和功能协调 |
| `js/rules/` | 棋盘、形状、消除、庭院计分及撤回额度 |
| `js/challenge/`、`js/daily/` | 闯关与每日规则、关卡数据 |
| `js/gravity/` | 正式重力引擎、模式和视图 |
| `js/persistence/` | 存储封装及存档格式 |
| `js/progression/` | 收藏、教学、目标与外观偏好 |
| `js/views/`、`js/renderer.js` | 布局、菜单、画布绘制和拖动 |
| `js/platform/` | 微信音频、反馈、广告、分享、排行榜与统计 |
| `open-data/` | 微信好友排行的开放数据域 |
| `tests/` | Node 测试、预览生成器、关卡设计工具 |

更细的入口见根目录 `AGENTS.md`。历史实验页、报告和宣传素材不代表当前玩法；需要公开保留或本地归档的范围见[仓库文件清单](repository-files.md)。

## 微信验收与发布边界

浏览器和模拟测试通过后，仍需微信编译与真机验收：小屏和安全区、首次教学、拖动、撤回、切后台、存档恢复、音频、好友榜、分享与广告。真实平台验证可能发生存档写入、广告请求和统计上报，应与离线检查区分。

Git 提交只记录源码版本，推送只同步仓库。它们不会自动更新微信小游戏；微信加固、上传、提审与正式上线各有独立步骤。本仓库的自动测试也不执行这些发布操作。
