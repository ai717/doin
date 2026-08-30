# PROJECT\_LOG.md

## Current status · 2026-08-30

### Completed

* **新游戏 2048（games/2048/）**：基于用户提供的参考构建包 `games/2048/2048-web`
  （TanStack Start + React 19 + Tailwind v4，含 auth / pglite / multiplayer 脚手架）
  做的**重新实现**，未复制其源码、素材、品牌标识、框架与构建链。
* **技术形态**：纯静态零依赖，与 `games/nuts` 同构——原生 ES modules + 原生 CSS。
  字体走系统栈（替代参考包的 Google Fonts 外链）、图标内联 SVG（替代 lucide-react）、
  音效 WebAudio 实时合成（零音频文件）。**页面无任何外部请求，可离线运行。**
* **模块拆分**：`js/engine.mjs`（纯函数，可被 node:test 直接引入）、
  `js/storage.mjs`、`js/i18n.mjs`、`js/audio.mjs`、`js/input.mjs`、`js/ui.mjs`、
  `js/main.mjs`，外加 `index.html`、`css/style.css`、`favicon.svg`。
* **玩法与体验**：4×4，一次移动内不连锁合并，无效移动不补块；滑动/方向键/WASD/移动端
  十字键；撤销一步、二次确认重开、胜利后继续、统计（局数/通关/最大方块）、
  `doin.2048.*` 本机存档、浅深主题、中英文案、reduced-motion 与屏幕阅读器播报。
* **视觉**：奶油纸质风（自定配色与阴影，高度贴近参考包观感但全部重新设计）。
* **测试**：`games/2048/tests/` 四个文件共 48 个 `node:test` 用例全通过，覆盖引擎边界、
  存档往返与损坏数据、隐私模式降级、文案键集合一致性、以及**离线保证**
  （断言页面不含任何远端 script / 样式表 / 字体）。

### Modified files (this round)

* New: `games/2048/{index.html, favicon.svg, css/style.css, js/*.mjs, tests/*.test.mjs}`
* Updated: `games.json`（新增 2048 条目）、`scripts/build-site.mjs`（静态游戏改用带
  过滤的 `copyGame()`）、`.gitignore`（忽略 `.workbuddy-ai/`）、
  `AGENTS.md`、`README.md`、`PROJECT_LOG.md`
* Removed: `games/2048/2048-web/`（参考构建包，分析完成后删除，未入库）

### Key implementation

* **引擎**：`applyMove` 返回 `{state, moved, gained, topMerge, absorbed}`，`absorbed`
  携带父块 id 与合并目标格坐标，供渲染层做「父块滑向合并格」动画。
* **渲染**：keyed tile（Map\<id, node\>）；新增块走 pop 入场；`releaseGhosts()` 在
  settle 时清除幽灵块——不能用整体 re-render 代替，否则会掐断还在播放的入场动画。
* **定位**：`transform: translate(calc(var(--c) * (100% + var(--gap))), ...)`
  并过渡，替代参考包的 `@property --r/--c` 方案，兼容性更好。
* **构建排除**：`scripts/build-site.mjs` 新增 `copyGame()`，始终跳过
  `node_modules / dist / tests / 点开头目录`，再叠加 `games.json` 条目里可选的
  `exclude`。`tests/` 这条是必需的——2048 的测试就放在源码旁边。

### Issues encountered & resolved

1. 参考包位于 `games/2048/2048-web`，而构建对无 package.json 的游戏是整目录拷贝，
   会把 937K 参考包打进产物。先按用户选择给构建脚本加排除规则，分析完成后参考包
   已删除，因此 `games.json` 里没有留下 `exclude` 条目（该能力仍保留，供未来使用）。
2. 存储层初版「web 存储优先 + 内存兜底」会在写入成功时留下内存影子副本，
   导致读到上一条用例的脏数据。改为 `persistent` 标志：存储可用时它是唯一权威，
   写失败后才整体切到内存。
3. 随机对局不变量测试最初用 `spawn: false`，棋盘永远填不满，`isOver` 永不成立 → 死循环。
   改为默认补块后才终止。
4. Node 22 下 `node --test tests/` 会把目录当模块路径报错，必须给具体文件名或 glob。

### Next

* 为 nuts 补求解器/生成器的 `node:test` 回归测试并纳入 CI（上一轮遗留待办）。

***

## Earlier work

### 2026-08-29 · 疯狂扭螺丝与门户重建

* **New game 疯狂扭螺丝 (games/nuts/)**：全新实现，未复用旧 nuts/nuts2 代码。
  参考抖音《疯狂等你消》截图，按实际玩法实现**顶端螺母可放入任意有空位螺杆**
  （混色堆叠允许），全部螺杆空或单色满杆即通关。
* **Guaranteed-solvable level generator**：mulberry32 + FNV 种子 RNG，从已解态随机
  合法乱序，有界 DFS 求解器（节点 160k / 260ms，空杆对称剪枝 + 满单色杆剪枝）
  校验后发布，解的长度作为该关 PAR。
* **关卡包**：常规 20 关（2→9 色 / 堆 3→5 / 空位 2→1）、每日挑战（日期种子）、
  极限 5 关（1 空位，每通 5 常规关解锁 1 关）。
* **存档**：`doin.nuts.save.v1`，每包解锁/最佳步数用时/星级/连胜/断点续玩，每日
  存档按日期失效。
* **成就**：PERFECT ★（moves ≤ PAR）、1–3 星（≤PAR / ≤PAR+3）、连胜 ×N（首次通关
  才计入，重玩不累加）、极限解锁徽章。
* **UI**：常规/每日/极限 tabs；HUD 显示 LEVEL/MOVES/TIME/PAR；首步起时、隐藏暂停、
  胜利停时；螺纹螺杆 + 光泽圆角螺母（12 色档）；pointer 事件触屏优先、无效抖动；
  UNDO/RESTART/LEVELS；桌面 1–9 选杆。
* **一键启动脚本 `start.bat`**：优先端口 46810，被占用时探测 46810–46909 自动选择
  第一个空闲端口，延迟 2 秒打开浏览器；本地源码路径 `/games/<slug>/`（与生产
  `/<slug>/` 不同）。
* **像素主题作用域澄清**：AGENTS.md 已写明仅约束门户首页，games 视觉风格自由。
* **测试项目彻底移除**：删除旧 `games/nuts/`（彩色螺母大搬家）与 `games/nuts2/`
  （疯狂等你消首版），清空 dist 与 sitemap 残留。
* **新游戏改名**：从最初的 nuts3 重命名为 `nuts`（slug、URL、canonical、og:url、
  存档键、种子命名空间全部同步），显示标题改为「疯狂扭螺丝」。

#### Modified files

* New: `games/nuts/index.html`、`games/nuts/style.css`、`games/nuts/game.js`
* New: `start.bat`
* Updated: `games.json`、`AGENTS.md`、`README.md`、`PROJECT_LOG.md`
* Removed: `games/nuts/` (旧)、`games/nuts2/` (整目录含 engine.mjs + 测试)

#### Key implementation

* **生成器**：`levelSeed = mulberry32(FNV(pack,index|dateKey))`，`scrambledRods` 从
  已解态随机合法 moves（避开立即撤销），`findSolution` 为有界 DFS：状态键规范化
  （sort rods）、空杆等价剪枝、满单色杆剪枝；重试 24 次种子/乱序组合，兜底降低
  乱序强度。
* **存档**：`localStorage` JSON，`daily` resume 按 dateKey 失效。
* **UI 与输入**：pointerdown，大点击区，shake 反馈，CSS 变量控制螺纹/螺母尺寸。
* **start.bat**：`for /f` 嵌套 PowerShell 单行命令探测端口，`start "" cmd /c "timeout && start http://..."` 延迟开浏览器。
* **构建**：`npm run build`（`scripts/build-site.mjs`）统一构建到 `dist/`，包含
  各游戏 `npm ci + npm run build`（可构建）或直接复制（静态）；GitHub Actions 在
  main push 时重建并 force-publish 到 `gh-pages`（含 `CNAME = doin.win`）。

#### Issues encountered & resolved

1. DFS 求解器初始剪枝「满单色杆一律跳过」误判——同一颜色可能跨多杆分布，满单色
   杆并非真正"已归位"，误删会剪掉有效路径。修正为满单色杆剪枝 + 空杆对称剪枝组合。
2. 用户文字规则（只能放同色顶部或空杆）与参考图矛盾——按参考图的实际玩法实现
   （自由放置）。已在对话中向用户说明。
3. start.bat 初版硬编码端口 48710，被其它本地项目占用后浏览器自动打开错误 URL。
   改为运行时探测空闲端口。
4. 本地服务源码 vs 构建产物路径不一致（`/games/<slug>/` vs `/<slug>/`），容易误用；
   start.bat 提示行已显式说明。

#### Next

* 为 nuts 提交一个 `node:test` 求解器与生成器回归测试（类似原 nuts2 的方式），
  纳入 CI，防止未来改动再次触发求解器剪枝错误。

***

### 初始部署与已知遗留

* **初始部署**（2026-08-29）：ai717/doin 门户重建，数独 SPA 迁入 `games/sudoku/`
  （Vite + TanStack Router，basepath `/sudoku/`），GitHub Actions 部署 gh-pages，
  `PAGES_CNAME = doin.win`。当时还发布了 `彩色螺母大搬家`（旧 nuts）与 `疯狂等你消`
  （nuts2 首版），本轮已彻底移除，不再维护；详情见 git 历史。
* **已知遗留**：GitHub Pages 对浏览器历史 SPA 深度链接返回 404（虽然会返回回退
  主体），已从 sitemap 排除；GitHub Actions 存在 Node 20 弃用警告（非阻塞）。
