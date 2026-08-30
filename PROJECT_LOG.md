# PROJECT_LOG.md

## Current status · 2026-08-30

### What shipped

* **新游戏 2048（`games/2048/`，已上线）**：依据用户提供的参考构建包重新实现。
  该参考包是 TanStack Start + React 19 + Tailwind v4 工程，含 auth / pglite /
  multiplayer 脚手架——这些与玩法无关，一概不复制；最终只保留其核心玩法与交互体验。
* **技术形态**：纯静态、零依赖、与 `games/nuts` 同构。原生 ES modules + 原生 CSS，
  系统字体栈（替代 Google Fonts 外链）、内联 SVG 图标（替代 lucide-react）、
  WebAudio 实时合成音效（零音频文件）。**页面无任何外部请求，可离线运行。**
* **模块**：`js/engine.mjs`（纯函数，可被 `node:test` 直接引入）、`storage.mjs`、
  `i18n.mjs`、`audio.mjs`、`input.mjs`、`ui.mjs`、`main.mjs`，外加 `index.html`、
  `css/style.css`、`favicon.svg`。
* **玩法与交互**：4×4；一次移动内不连锁合并；无效移动不补块、不进撤销历史；
  键盘 / WASD / 触屏滑动 / 移动端十字键；撤销一步、二次确认重开、胜利后可继续；
  统计（局数 / 通关 / 最大方块）；`doin.2048.*` 本机存档；浅深主题；中英文案；
  reduced-motion 与屏幕阅读器播报。
* **视觉**：奶油纸质风——配色、字体、阴影全部重新设计，观感贴近参考包但不复用其素材。
* **测试**：`games/2048/tests/` 四个文件、48 个 `node:test` 用例全通过。
* **已提交并部署**：`8d0f384`（nuts 与启动脚本）、`62fa64b`（2048 与构建排除），
  推送后 GitHub Actions 部署成功，`doin.win/2048/` 线上验证 200。

### Files changed

* New: `games/2048/{index.html, favicon.svg, css/style.css, js/*.mjs, tests/*.test.mjs}`
* Updated: `games.json`（2048 条目）、`scripts/build-site.mjs`（静态游戏走带过滤的
  `copyGame()`）、`.gitignore`（忽略 `.workbuddy-ai/`）、`AGENTS.md`、`README.md`
* Removed: `games/2048/2048-web/`（参考构建包，分析完成后删除，从未入库）

### Key implementation

* **引擎**：`applyMove` 返回 `{state, moved, gained, topMerge, absorbed}`。
  `absorbed` 带父块 id 与合并目标格坐标，渲染层据此让父块**滑向**合并格。
* **渲染**：keyed tile（`Map<id, node>`）复用 DOM 节点；`releaseGhosts()` 在 settle
  时清除幽灵块。**不能用整体 re-render 代替**——会掐断仍在播放的入场动画。
* **定位**：`transform: translate(calc(var(--c) * (100% + var(--gap))), ...)` 并过渡，
  替代参考包的 `@property --r/--c` 方案，兼容性更好。
* **存储**：`doin.2048.{save,best,stats,prefs}`。读取时做结构校验（丢弃非法 tile、
  同格去重、坏数字归零），`best` 取存档与独立键的 max，因此清档不丢纪录。
* **构建排除**：`copyGame()` 始终跳过 `node_modules / dist / tests / 点开头目录`，
  再叠加 `games.json` 条目里可选的 `exclude`。`tests/` 这条是必需的——2048 的测试
  就放在源码旁边，否则会被拷进产物。

### Issues hit

1. 参考包位于 `games/2048/2048-web`，而构建对无 package.json 的游戏是整目录拷贝，
   会把 937K 打进产物。先按用户选择给构建脚本加排除规则；分析完成后参考包删除，
   故 `games.json` 未留 `exclude` 条目（能力保留备用）。
2. 存储层初版「web 存储优先 + 内存兜底」在写入成功时仍留内存影子副本，导致读到
   上一条用例的脏数据。改为 `persistent` 标志：存储可用时它是唯一权威，写失败后才
   整体切到内存。
3. 随机对局不变量测试最初用 `spawn: false`，棋盘永远填不满、`isOver` 永不成立 →
   死循环。改为默认补块。
4. Node 22 下 `node --test tests/` 会把目录当模块路径报错，必须给文件名或 glob。

### Next

* 为 nuts 的求解器 / 生成器补 `node:test` 回归测试并纳入 CI。这是上一轮踩过
  「满单色杆剪枝误判」后留下的唯一待办，没有测试守护容易复发。

***

## Archive

### 2026-08-29 · 疯狂扭螺丝（`games/nuts/`）

螺丝螺母色彩排序：顶端螺母可放入任意有空位螺杆（允许混色堆叠），全部螺杆空或
单色满杆即通关。常规 20 关 / 每日挑战（日期种子）/ 极限 5 关（每通 5 关解锁 1 关）。

* **生成器**：`levelSeed = mulberry32(FNV(pack, index|dateKey))`；从已解态随机合法
  乱序，再用有界 DFS 校验（空杆对称剪枝 + 满单色杆剪枝，节点 160k / 260ms），
  解的长度即该关 PAR；失败则换种子重试，兜底降低乱序强度。
* **存档**：`doin.nuts.save.v1`，每日存档按 dateKey 失效。**星级**：≤PAR 三星、
  ≤PAR+3 二星，moves ≤ PAR 记 PERFECT ★；连胜只计首次通关。
* **start.bat**：探测 46810–46909 取第一个空闲端口后延迟开浏览器。
  ⚠️ 本地路径 `/games/<slug>/`，生产路径 `/<slug>/`，不要混用。
* 同步删除了旧的 `games/nuts/`（彩色螺母大搬家）与 `games/nuts2/`（首版）。

### 2026-08-29 · 门户初始部署

门户重建，数独 SPA 迁入 `games/sudoku/`（Vite + TanStack Router，base `/sudoku/`）；
GitHub Actions 在 main push 时构建并 force-publish 到 `gh-pages`，`CNAME = doin.win`。

### Known platform quirks

* GitHub Pages 对浏览器历史 SPA 的深链返回 404（虽会返回回退主体），已从 sitemap 排除。
* 部署工作流的 `actions/checkout@v4` / `actions/setup-node@v4` 尚未升到 Node 24
  兼容的大版本，CI 有弃用警告，非阻塞。
