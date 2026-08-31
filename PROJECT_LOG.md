# PROJECT_LOG.md

## Current status · 2026-09-01

### 追加 · 移除疯狂扭螺丝（nuts）

* **下线子游戏**：从 `games.json` 移除 `nuts` 发布条目，并删除
  `games/nuts/` 的全部源码与本地探针文件。站点构建后不再生成 `/nuts/`，首页、
  JSON-LD 和 sitemap 也不再把它作为可访问游戏。
* **保留历史记录**：早期 `PROJECT_LOG.md` 的开发事实与《星轨调度大师》产品研究中的
  通用品类引用不属于运行时游戏实现，未做篡改；本轮删除的是已发布的 nuts 子游戏本体。
* **验证**：`npm run build` 退出 0；`games/nuts` 与 `dist/nuts` 不存在，构建后的
  `games.json` 和 `sitemap.xml` 均不含 nuts。

### 追加 · 《星轨调度大师》阶段 1：纯引擎

* **新增不可变规则引擎**：`games/orbit-sort/engine.mjs`。实现 `createState`、调入、
  槽位选择、合法落轨、完成锁定、冻结解除、单向轨道、卡住检测、无限撤销和重置；
  轨道数组始终按“远端到入口”保存，调入 `pop()`、落轨 `push()`。
* **锁定步数与快照语义**：仅调入增加 `moves`；每次调入保存完整调度前快照，故即使
  已完成轨道并触发解冻，也能由一次撤销准确恢复。
* **新增引擎回归测试**：`games/orbit-sort/tests/engine.test.mjs`，覆盖入口/槽位/落轨
  限制、完成与通关、冻结与单向、选槽、卡住、撤销、重置、星体 id 不变及不可变更新。
* **本轮边界**：未创建页面或 SVG 渲染，未实现求解器、关卡、存档或门户接入；未改动
  `games.json`、构建脚本和其他子游戏。

### 追加 · 验证

* `node --test games/orbit-sort/tests/engine.test.mjs`：14 通过，0 失败。
* 未触及门户、`games.json`、构建脚本或部署，按仓库规则无需运行 `npm run build`。

### 追加 · 《星轨调度大师》产品文档

* **新增可直接进入开发的 V1 PRD**：`docs/PRD-star-orbit-master-v1.md`。产品从
  Nut Sort 的“顶层取物 + 同色归组 + 空间周转”出发，改为环形放射星轨和中央双中转槽；
  中转槽是真实状态空间，不是视觉换皮。
* **锁定产品范围**：30 个求解器验证的主线关、冻结 / 单向两种特殊轨道、三星、
  三章星图、每日挑战、本机存档、SVG 棋盘、WebAudio、键盘和色觉辅助；不做广告、
  内购、账号、倒计时、WebGL 或未经验证的无限随机关。
* **锁定开发契约**：文档给出核心状态机、数组方向、计步规则、完成 / 卡住判定、
  关卡数据格式、求解器动作与剪枝边界、SVG 坐标、响应式尺寸、文件结构、测试命令、
  完整的手工 / 自动验收要求及分阶段开发顺序。
* **本轮边界**：只交付产品文档，未创建半成品游戏目录，未修改 `games.json`，未接入门户。

### 追加 · 文件改动

* `docs/PRD-star-orbit-master-v1.md`（新增）、`PROJECT_LOG.md`（本节）。

### 追加 · 验证

* 文档结构与关键契约已静态检查；本轮未触及门户、游戏列表或构建脚本，按仓库规则
  无需运行 `npm run build`。

### 完成

* **修复通关判定逻辑 Bug（nuts）**：旧代码 `capacity(st) = stack + extraRods`，
  一旦使用「加杆」，`isSolved` 会要求每根杆填满 `stack + extraRods`，导致
  同色已归拢的 `stack` 层杆判为未通关——玩家感觉是"某颜色必须在某杆"。
  改为单杆容量恒为 `stack`，「加杆」只追加一根空的暂存杆；通关=每根非空杆满
  `stack` 且单色（空杆忽略）。求解器生成期 `extraRods=0`，行为不变。
* **游戏区视觉重构：2D 正交深海军蓝舞台（取代上面的 3D 方案）**：CSS 3D 棱柱
  （perspective / preserve-3d / rotateX / translateZ / 6×side + 2×cap）已全部移除，
  改为纯 2D 正交渲染。动机是 3D 方案下"中心孔与螺杆中轴对不齐"（孔偏移、杆像贴在
  螺母背后、螺母悬浮在杆前）反复调不干净——2D 下孔圆心天然落在螺杆中轴上。要点：
  - **孔用 `mask-image` 真挖穿**：`.n-face` 用 `clip-path` 出正面六角形，再用
    `radial-gradient` 遮罩把中心孔挖空露出背后的 `.rod-shaft`，杆从孔里**连续穿出**
    而不是画一个黑洞；`.n-hole` 只画孔沿倒角（上唇深色 / 下唇浅色）。
  - **几乎正视的正交视角**：无透视收缩，所有螺杆严格平行、等宽、等距、等高
    （`rodH = availH`，垂直贯穿整个棋盘）；螺母以正面六角形为主，只靠 `--bevel`
    在顶部做亮面、右侧做窄暗面，表达约 10–15° 俯视感；底座用略扁椭圆表轻微俯视。
  - **高度反解布局**：已知可用高度时反解
    `nutW = (availH - TOP_PAD - BOT_PAD) / (NUT_ASPECT × ((cap-1)(1-STACK_OVERLAP) + 1))`，
    与宽度约束取 `min`，保证堆叠接近满屏、棋盘占可视区 70% 以上，而非固定尺寸居中。
    `NUT_MAX` 提到 100 让少杆关卡也撑得开；`gap` 按杆数分档（≤6:11 / ≤8:7 / 更多:5）。
  - **深海军蓝舞台**：`#121e42 → #0b142e → #05091a` 极弱纵向渐变，无毛玻璃、无留白。
    HUD 压成单行细条、工具栏按钮 52×34，关卡包 tabs 只在选关屏显示
    （`body[data-screen="play"] .tabs { display:none }`）。
  - 螺母改高饱和 9 色（红蓝绿紫橙黄洋红青黄绿）三段 `--c-hi/-mid/-lo`，低模塑料
    质感而非写实金属高光；杆顶叠退色渐变避免空杆头抢戏。

### 文件改动

* `games/nuts/engine.mjs`（capacity / 通关注释）、`games/nuts/game.js`
  （正交几何常量、`computeLayout` 高度反解、`renderBoard` 2D DOM、`switchScreen`
  的 `data-screen`）、`games/nuts/style.css`（整体重写：舞台 / rod-shaft 连续螺纹 /
  rod-base 椭圆盘 / `.nut` + `.n-face` + `.n-hole` / 紧凑 HUD 与工具栏 / 深蓝弹层）。

### 验证

* 关卡生成脚本：25 关全部非预解 + DFS 可解 + par>0（ALL 25 LEVELS OK）。
* 回归脚本：连用两次「加杆」后按解法走完 `isSolved` 仍为 true（旧代码为 false）。
* `npm run build` 退出 0。

### 追加 · 2048 首页封面图

* **新增 630×500 封面（`assets/covers/2048.png`）**：暖米底 + 游戏同款配色的 3D
  数字方块，中心高亮 2048 方块，四周 2/4/8/16/64/512 与滑动箭头。`games.json` 里
  2048 的 `cover` 已从空串改为该路径，首页卡片由 emoji 切换为图片。
* **路径选择**：封面放在门户 `assets/` 而非 `games/2048/`。构建把 `assets/` 原样复制到
  站点根，本地（仓库根）与线上（dist 根）都能用同一个 `/assets/covers/2048.png`；
  放进游戏目录则只能命中线上路径 `/2048/…`，本地会 404。
* 出图工具带右下角水印，裁掉底部 35px 一并去除；未做 inpainting。

### 追加 · 文件改动

* `assets/covers/2048.png`（新增）、`games.json`（2048 `cover`）、`.gitignore`
  （忽略 `vibe_images/` 出图中间产物）。

### 追加 · 验证

* `npm run build` 退出 0，`dist/assets/covers/2048.png` 已生成，`dist/games.json`
  的 cover 路径一致。
* 页面渲染效果由用户通过 `start.bat` 自行验收。

***

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
