# 公开仓库文件清单

2026-10-21 按当前本地跟踪文件、运行引用和测试读取路径核对。整理前共 287 个跟踪文件，工作区内这些文件约 8.62 MiB；`docs/` 占 160 个文件、约 4.34 MiB。体积不大，主要问题是旧源码副本、制作中间文件与本机路径影响阅读。

经用户确认，本轮为 124 个已有跟踪文件补充忽略规则并取消跟踪，文件在原路径保留，未改写 Git 历史。原有 287 个跟踪文件保留 163 个，加上新增工作流和三份说明，整理后的源码范围合计 167 个文件。

排除分类：素材原稿 11 个、历史宣传制作文件 38 个、旧试玩及独立设计实验 7 个、本机版本和发布记录 3 个、重复自动报告 65 个。忽略和取消跟踪不等于删除本地文件，也不代表 GitHub 已经更新。

## 与参考仓库的区别

参考 [TTStick/meowtopia](https://github.com/TTStick/meowtopia) 的根目录和开发说明，可以借鉴首页导航、运行步骤、文档分工和许可说明；其程序、素材和品牌没有引入本项目。

| 参考仓库可见结构 | 用途 | 方寸九宫应如何对应 |
| --- | --- | --- |
| `client/`、`server/src/`、`shared/` | 前端、服务端与共享代码 | 本项目是微信原生游戏，现有 `game.js`、`js/` 即可，不需要创建服务端 |
| `android/`、`ios/`、`macos/`、`watchos/` | 各平台工程 | 尚无对应原生工程，不需要为了目录齐全而创建 |
| `tests/`、`scripts/` | 验证和开发工具 | 保留现有 `tests/`，包括实际使用的生成器与测试辅助模块 |
| `docs/`、`DEPLOY.md` | 开发、部署及平台说明 | 用当前开发指南作为入口；历史文档不等于当前运行说明 |
| `package.json`、锁文件、Vite 与 TypeScript 配置 | 其框架及构建依赖 | 本项目没有该构建链，不应照搬这些配置 |
| Docker、部署目录、环境变量示例 | 服务端运行与配置 | 本项目运行不依赖这些文件，不需要新增 |
| `README.md`、`LICENSE`、`.gitignore` | 展示、许可和本地排除 | 应保留，并按本项目实际行为维护 |

这里比较的是已读取的根目录和开发说明，未逐一审计参考项目的全部文件、提交历史或忽略规则。目录多少不能证明维护质量；判断依据是本项目能否运行、验证和清楚定位。

## 建议继续跟踪

| 路径 | 保留原因 |
| --- | --- |
| `game.js`、`game.json`、`js/`、`open-data/` | 当前游戏代码、配置和微信开放数据域 |
| `project.config.json` | 克隆后导入微信开发者工具；AppID 为项目标识，不是密钥 |
| `assets/audio/` 根部 11 个 `.wav` | 正式反馈模块直接使用；部分还有格式与哈希回归检查 |
| `assets/branding/game-avatar-144.png` | 游戏标识成品，适合展示 |
| `tests/`、`tests/helpers/`、`tests/design/` | 规则、存档、关卡重放和开发工具；不进微信包不等于不应公开 |
| `docs/prototypes/gravity/engine.js`、`controller.js`、`preview.html` | 重力自动测试仍依赖；不能忽略整个原型目录 |
| `README.md`、`LICENSE`、`AGENTS.md`、`.gitignore` | 项目入口、许可和开发约束 |
| `.github/workflows/test.yml` | 后续远端自动测试配置，不包含部署或推送操作 |
| `docs/readme/*.jpg` | README 使用的六张截图，合计约 0.17 MiB |
| 当前开发、素材来源和仓库范围说明 | 让下载者知道如何运行、哪些能力需要微信、哪些内容是历史资料 |

## 已排除跟踪，仅本地保留

以下文件保留在原路径，可继续用于本地回看和制作；后续正常纳入 Git 的文件范围将不再包含它们。

| 路径 | 处理与原因 |
| --- | --- |
| `assets/audio/original-22khz/` | 10 个历史原稿约 0.57 MiB，当前运行和测试不直接依赖，仅保留个人制作备份 |
| `assets/branding/game-avatar-source.png` | 原图约 1.15 MiB，当前运行不依赖；成品已单独保留 |
| `docs/previews/appearance-2026-10-19/index.html`、`result-review-2026-10-19/index.html`、`ui-review-2026-10-16/index.html` | 三份旧源码试玩副本约 1.17 MiB；仅本地保留，简短验收结论继续公开 |
| `docs/promotion-luoyuting-2026-10-19/制作记录/试玩实录.html` | 宣传录制用源码副本，不是开发或自动测试入口 |
| `docs/promotion-next-piece-2026-10-19/制作记录/录制页面.html`、`v2-相让/制作记录/录制页面.html` | 同类录制副本；这三份录制页面共约 1.20 MiB，仅本地保留 |
| `docs/promotion-2026-09-27/` | 该历史制作目录整体仅本地保留；部分文案和规格已过时，当前公开展示使用 `docs/readme/` 六张截图 |
| `docs/promotion-*/` 下的制作脚本 | 历史宣传制作目录整体仅本地保留，包含脚本、录制页面和操作记录；这些脚本部分依赖本机运行库、系统字体及额外视频工具 |
| `docs/打开最新发布版.command` | 指向作者本机绝对路径与已忽略的发布副本，下载源码后不可直接使用 |
| `docs/最新发布版本.txt`、`docs/本地版本与测试.md` 等操作记录 | 这三份本机记录整体仅本地保留；当前运行入口为开发指南 |
| `docs/refactor-*`、`directory-review-*`、`updates-*`、各类 `*-review` 里的重复日志与哈希清单 | 已排除重复测试输出和源码哈希清单；维护结论、参考路线、目录映射和加固配置示例继续保留 |
| `docs/previews/three-directions.html`、`check-preview.js` | 两份独立设计实验一起仅本地保留，避免留下缺少对应页面的检查器 |

历史自动报告还包括 `docs/stress-*.json`、`docs/challenge*.json`，以及各目录的 `test-results.*`、`stress-results.json` 等。未整体排除 `docs/` 或所有 JSON；现用测试、原型源文件、参考路线和维护结论仍在拟公开范围。

## 其他已忽略产物

- `project.private.config.json`、`.env*`、私钥、凭据、日志及压缩备份。
- `docs/releases/`：历史发布副本。
- `docs/previews/playable.html`、`daily-week.html`、`gravity.html`、`garden-growth.html` 和 `audio-review/`：可生成的开发预览。
- `docs/prototypes/gravity/lab.html`：重力实验生成页，源文件仍保留。
- `dist/`：本轮新增的静态展示产物。
- `node_modules/`、Python 缓存及系统杂项。

## GitHub、历史和微信包分别处理

`.gitignore` 只影响尚未跟踪的文件。给已有文件增加忽略规则，不会让它从下次提交或公开仓库里自动消失；取消跟踪也不会清除旧提交中的副本。

本轮已先备份指定文件并记录内容校验，再用 `git rm --cached` 取消指定路径的跟踪。本地文件未移动或删除。Git 状态中这些路径的暂存删除仅表示取消跟踪待提交，不表示本地文件已丢失。提交并推送取消跟踪记录后，GitHub 最新文件树会移除这些路径，本机原文件继续保留；旧提交中的副本仍保留。文件排除阶段未提交或推送，后续同步状态以 Git 提交记录和远端分支为准；不通过改写历史清理这些资料。

微信发布包由 `project.config.json` 的 `packOptions` 决定，独立于 Git 忽略规则。原配置已排除 `docs/`、`tests/`、历史音频原稿及品牌原图；本轮补充排除 `.github/` 和 `dist/`，避免将自动测试配置和完整网页试玩副本带入小游戏包。正式发布仍须复核实际包内容；本轮没有生成或上传微信发布包。
