# Moongate Blocks

*方寸九宫 · Fangcun Jiugong*

A calm block-placement puzzle game for **WeChat Mini Games**, set in a small Chinese courtyard behind a moon gate.
Drag pieces onto a 9×9 board and clear full rows, columns or 3×3 palaces.

Written in plain JavaScript on Canvas 2D: no framework, no build step, no runtime dependencies.

[中文说明](#中文说明)

<table>
  <tr>
    <td><img src="docs/readme/home.jpg" width="200" alt="Home screen with the courtyard illustration"></td>
    <td><img src="docs/readme/garden.jpg" width="200" alt="Free play on the garden board"></td>
    <td><img src="docs/readme/challenge.jpg" width="200" alt="A challenge level with ice tiles and target markers"></td>
  </tr>
  <tr>
    <td><img src="docs/readme/gravity.jpg" width="200" alt="Gravity mode, where blocks fall after a clear"></td>
    <td><img src="docs/readme/collection.jpg" width="200" alt="My Courtyard collection page"></td>
    <td><img src="docs/readme/theme-neon.jpg" width="200" alt="Dark neon theme on the challenge home screen"></td>
  </tr>
</table>

## Game modes

- **Free play (自由消除)** — endless play on three boards: an open 9×9, a board with a blocked centre, and one with five "star point" obstacles. Clearing marked palaces charges energy that grants a small lucky piece.
- **Challenge (目标闯关)** — 90 hand-built levels in five chapters. Every level has a fixed deck and a move limit, and introduces ice that takes two clears, stones that never clear, and gates. Finish in fewer moves for three stars.
- **Daily pick (每日精选)** — one curated level each day.
- **落玉庭 (Gravity)** — after a clear, blocks above fall down and can set off chain clears. Six teaching puzzles, then free play.

Around the modes:

- **My Courtyard** — cleared lines grow plants and earned stars add furnishings. Unlocked items are drawn into the home-screen illustration and the share card.
- **Helpers** — undo with a per-level budget, and hints that only suggest moves backed by a verified winning line.
- **Themes** — Classic, Ink (black and white), and Neon (unlocked by play).
- **Social** — a WeChat friends leaderboard, share cards for results, and "can you beat my move count" invitations.

## Technical highlights

- **Rendering** — one `requestAnimationFrame` loop with an off-screen scene cache and a separate dynamic layer. The loop goes idle when nothing changes, so a still screen costs almost no GPU.
- **Deterministic randomness** — tray dealing and energy targets use a seeded PRNG that is stored in the save, so undo or relaunch can never reroll the next pieces.
- **Verified hints** — a bounded search, capped by both node count and wall-clock time, replays a complete winning continuation before it offers a hint. When the current board cannot be verified, it steps back to the nearest position that still wins.
- **Level tooling** — every level ships with a reference solution. Tests replay each one, fuzz random play with undo, and check pacing across chapters.
- **Save safety** — writes go through a retry queue, so a failed storage call is retried instead of losing progress. Old saves migrate forward when rules change.
- **Accessibility** — palettes are checked for colour-vision deficiency with simulated vision and CIEDE2000 colour distance.

## Project layout

```
game.js              scenes, input, lifecycle, feature coordination
js/rules/            board, shapes, garden scoring
js/challenge/        challenge rules and level data
js/daily/            daily levels
js/gravity/          gravity-mode engine and view
js/progression/      collection, onboarding, goals, themes
js/persistence/      storage and save formats
js/platform/         audio, sharing, ads, leaderboard, analytics
js/views/            layout, menus, board and panel drawing
open-data/           WeChat open-data context (friends leaderboard)
tests/               Node test suites and level-design tools
```

About 9,500 lines of game code and 5,400 lines of tests.

## Running it

**In WeChat DevTools:** choose *Import project → Mini Game* and select this folder. `project.config.json` contains the author's AppID. To preview without it, switch to a test AppID (测试号) in DevTools.

**Tests** (Node.js 18 or newer, nothing to install):

```sh
node tests/run.js
```

This runs all 39 suites, each in its own process: rules, saves, every level's reference solution, hints, layout on several screen sizes, colour accessibility, and a 300-game stress run.

**Browser preview** — builds a playable page from the real sources, so you can try it without WeChat:

```sh
node tests/build-playable-preview.js
# then open docs/previews/playable.html
```

## Status

A personal project. Development builds have been uploaded to WeChat for testing; it has not been published to the public yet.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). You may read, run, modify and share it for **noncommercial** purposes as long as you keep the copyright notice. Commercial use is not permitted. Issues and suggestions are welcome.

---

## 中文说明

Moongate Blocks 的中文名是《方寸九宫》，是一款微信小游戏：把方块拖进 9×9 棋盘，填满整行、整列或一个 3×3 宫格就能消除，整体是安静的中式庭院风格。

全部用原生 JavaScript 和 Canvas 2D 编写，没有框架，不需要构建，也没有运行时依赖。

### 玩法

- **自由消除**：不限时，有方庭、石台、星位三种棋盘。清除带标记的目标宫可以充能，充满后获得幸运小方块。
- **目标闯关**：五章共 90 关，发牌固定、步数有限，逐步引入薄冰（要消两次）、圆石（不可消除）和门等机关；步数越少星级越高。
- **每日精选**：每天一道精选关卡。
- **落玉庭**：消除后上方方块会落下，可能接着连锁消除。先玩 6 道教学题，再进入自由模式。
- **我的庭院**：庭院里的消除让花木生长，闯关星数用来添置陈设；解锁的物件会画进首页插画和分享卡片。
- **辅助**：撤回有每关额度；提示只给经过验证、一定能通关的下一步。
- **外观**：清雅原色、水墨黑白、暗色霓虹（通过游玩解锁）。
- **社交**：微信好友排行、成绩分享卡，以及"看你几步能过"的好友邀请。

### 技术要点

- **渲染**：单一渲染循环，静态画面缓存在离屏画布里，画面不变时停止绘制，几乎不耗电。
- **随机数可复现**：发牌和充能目标使用写进存档的种子随机数，撤回或重开都不会重新抽牌。
- **提示经过验证**：提示由限定步数和时间的搜索得出，先完整走通一条通关路线才给出；当前局面无法验证时，先退回到最近一个仍能通关的局面。
- **关卡工具**：每关都有参考解，测试会逐关回放，并用带撤回的随机对局做模糊测试，同时检查各章的难度节奏。
- **存档安全**：写入失败会排队重试，规则调整后旧存档会自动迁移。
- **色觉无障碍**：配色用色觉缺陷模拟和 CIEDE2000 色差检查过。

### 本地运行

- **开发者工具**：选「导入项目 → 小游戏」，目录选本文件夹。`project.config.json` 里是作者的 AppID，没有权限时请在开发者工具中改用测试号。
- **测试**：需要 Node.js 18 或以上，无需安装依赖，运行 `node tests/run.js`，共 39 组测试。
- **浏览器试玩**：运行 `node tests/build-playable-preview.js`，然后打开 `docs/previews/playable.html`。

### 许可

本项目按 [PolyForm Noncommercial 1.0.0](LICENSE) 授权：保留版权声明即可非商业地查看、运行、修改和分享；不允许商业使用。欢迎提 issue 和建议。
