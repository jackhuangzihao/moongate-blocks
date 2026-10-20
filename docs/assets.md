# 素材来源

游戏内的庭院插画和界面都用 Canvas 代码绘制（`js/views/art.js` 等视图模块），没有外部图片、字体或第三方素材。

| 素材 | 文件 | 来源 |
| --- | --- | --- |
| 音效（8 个） | `assets/audio/` 下的 `tap`、`place`、`undo`、`combo`、`ice`、`over`、`win`、`bloom` | 程序合成，可由 `tests/build-result-sounds.py` 重新生成 |
| 背景音乐与早期音效 | `assets/audio/bgm-v2.wav`、`clear.wav`、`energy.wav` | 程序合成（项目早期制作，合成脚本未收入仓库） |
| 游戏图标 | `assets/branding/game-avatar-144.png` | AI 图像生成 |
| README 截图 | `docs/readme/*.jpg` | 当前版本的游戏画面 |

合成脚本由作者在 AI 编程助手的协助下编写，不使用第三方音频平台或采样库。

`tests/build-result-sounds.py` 会直接覆盖 `assets/audio/` 中对应的文件，重新生成前请先备份。`tests/build-audio-review.py` 只用于试听对比，需要额外的 Python 库，不是运行游戏或测试的前置步骤。

以后如果加入第三方代码、字体、图片或音频，请先确认来源和允许的用途，并保留对方要求的署名和许可；这些素材不自动适用本项目的许可。
