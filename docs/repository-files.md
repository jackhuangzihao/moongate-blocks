# 仓库文件说明

## 仓库里有什么

| 路径 | 内容 |
| --- | --- |
| `game.js`、`game.json`、`js/`、`open-data/` | 游戏代码、配置和微信开放数据域（好友排行） |
| `project.config.json` | 微信开发者工具的项目配置；其中的 AppID 是项目标识，不是密钥 |
| `assets/audio/`、`assets/branding/game-avatar-144.png` | 游戏使用的音频和图标，来源见[素材来源](assets.md) |
| `tests/` | 自动测试、测试辅助模块、关卡评估工具和试玩页生成器 |
| `docs/prototypes/gravity/` | 落玉庭的原型代码，部分测试依赖它 |
| `docs/readme/` | README 使用的截图 |
| `docs/` 其他文档 | 开发指南、玩法设计和各阶段的设计复盘 |
| `.github/workflows/` | 自动测试和 GitHub Pages 部署 |

## 不在仓库里的内容

- 本机配置与凭据：`project.private.config.json`、`.env*`、私钥等。
- 微信发布副本：`docs/releases/`，包括加固后的代码和源码备份。
- 素材原稿、宣传视频制作文件、本机发布记录，以及重复的自动测试报告。
- 可以重新生成的内容：`docs/previews/` 下的开发试玩页、`docs/prototypes/gravity/lab.html` 和 `dist/`。

`.gitignore` 只决定以后哪些文件会被跟踪，旧提交里已经存在的文件仍可以在历史中看到。

## GitHub 与微信发布包是两回事

微信上传的代码包由 `project.config.json` 的 `packOptions` 决定，与 `.gitignore` 无关。目前 `docs/`、`tests/`、`.github/`、`dist/` 等都不会打进小游戏包。
