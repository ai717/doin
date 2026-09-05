# AGENTS.md

> 瘦身原则：只写"下次开工必须读"的规则。实现细节读 PROJECT_LOG.md，
> 历史细节读 git log / `.workbuddy/memory/`。

***

## 1 · Project

DOIN 是静态浏览器游戏门户：首页 `index.html` 列出独立游戏（不包含任何游戏实现代码），
每款游戏发布到 `/<slug>/`。`games.json` 是唯一游戏清单来源。

## 2 · Repo & 部署

- `ai717/doin`：main 只放源码；**永远不要 commit dist/ 或游戏构建产物**。
- GitHub Pages = gh-pages 根目录。main 推送 → workflow 构建整个站点到 dist/ → 用 dist/
  覆盖 gh-pages（不是增量）。
- 生产域名 `doin.win`；Workflow 变量 `PAGES_CNAME=doin.win`，每次部署都要重写 CNAME
  文件。
- 不要碰遗留仓库 `ai717/doin.win` 或 doin.win 域名配置，除非用户显式要求。

## 3 · 目录结构

```
index.html  css/  js/  assets/      Homepage 源码（无框架）
games.json                            唯一游戏清单数据源
games/<slug>/                         独立游戏源码
scripts/build-site.mjs                站点级构建入口
start.bat                             本地启动器 (自动选 46810 附近空闲端口)
_dev-server.mjs                       零依赖最小 HTTP 静态服务 (优先使用: node _dev-server.mjs)
dist/                                 构建产物 (git ignore)
```

**路径约定**：本地 `/games/<slug>/`；生产 `/<slug>/`（构建时扁平）。绝不能混用。

## 4 · Games 约定

- **Plain 静态游戏**：`games/<slug>/index.html`，无 package.json。
- **Buildable 构建游戏**：有 package.json 和 `build` 脚本，产物输出到 `games/<slug>/dist/`；
  必须把 asset base / router base 设为 `/<slug>/`。
- `spa: true` = 使用浏览器历史的 SPA。GitHub Pages 只支持一个根 404 回退，深层链接仍返回 404，
  所以它们不进 sitemap。
- `games.json` 字段：`title, slug, desc, icon, cover, tags, url, comingSoon`；可选
  `spa, exclude`。`comingSoon` 的游戏既不构建也不进 sitemap。`exclude` 指定额外构建要排除
  的源目录（默认已跳过 node_modules/dist/tests/.*）。
- 各游戏自定义视觉风格。门户 Poki 主题只约束首页。
- **新游戏交付契约**：自包含规范在 `docs/GAME-SPEC.md`（可直接外发给外部开发者/AI）；
  机器验收 `node scripts/check-game.mjs <slug>` 分两级——T1 上架底线 fail 才拒收，
  T2 一致性只 WARN；存量豁免表内置于脚本、新 slug 零豁免。
  **外发只贴 SPEC 正文**：承接方可能只是无运行环境的网页对话 AI（跑不了 node、开不了浏览器），
  它按 SPEC §7A 人工自查、只产出 `games/<slug>/` 内的文件；组装、跑验收脚本、补
  games.json/封面/`test:<slug>`/构建（SPEC §7B）永远在我们这边。

## 5 · Orbit-sort · 稳定基线（开发准入规则）

### 5.1 关卡暴露 & 参数硬边界
- 当前发布为 5 章 × 20 题，共 100 关主线。每章难度采用波浪式编排，整体随章节上升；
  关卡由 `difficulty.mjs paramsForDifficulty(1..7)` 的 7 个母题经等价变换生成。
  不得在运行路径暴露未纳入 `LEVELS` 的源码素材。
- difficulty.mjs 硬边界：capacity ∈ [3..7]，colorCount ∈ [3..6]，dockCount ∈ [1..2]，
  emptyTracks =  exactly 1。新引入参数的关卡需先让 `dockCount: 2` 缓冲一关再恢复 1。
  **不允许**任何关卡违反这条。

### 5.2 引擎规则（engine.mjs 是唯一权威）
- `validateAction` = 合法性判定；**合法就必须执行**。
- **合法操作铁律（引擎 + 渲染双重约束）**：任何满足 `validateAction(...).valid === true`
  的用户意图都不得被引擎、`game.mjs`、页面事件处理或渲染器拦截、吞掉或伪装成非法。
  渲染器必须始终与当前引擎 state 同步，不能显示不存在的中转槽、轨道或占用状态，
  也不能因为缓存的 SVG 结构误导用户。修改任一相关模块都必须增加/运行对应回归测试。
- 死局 = "操作后的状态"，不允许回退该操作或判定为非法；只提示不拦截。
- 仅 `status === "won"` 为终止态。
- `game.mjs` 收 UI 意图并调引擎。**页面代码不得构造 rule action 或直接改 game.state**
  （页面的 `state = {...state, ...}` 是镜像，下一次 dispatch 立刻被覆盖）。

### 5.3 Intent Routing 不变量（合法操作永不报错）
`applyIntent(click track | click dock)` 必须覆盖所有合理意图。若 primary 失败，按以下
fallback 链（候选按最小 dock id deterministic 选取，不得产生歧义）：
- **placing**（已选中 dock.orb）：
  ① insert selectDock→track；② 还有 idle dock → extract via idledock；
  ③ clickTrack 仍可 extract → clear selectDock + extract；
  ④ 其它 occupied dock orb 匹配 track.top → 切那个 dock 再 insert。
- **extracting**（未选中）：
  ① extract clickTrack；② 存在 ≥1 occupied dock 可 canInsert(→clickTrack) →
     选最小 id 那个直接 insert（1 个）或切 dock 再 insert（多个）。

generator.validateLevel 新增 intent rollout 门闩：对每个候选关卡跑随机游走（默认
10×40 步），只要出现"合理候选但 applyIntent 返回 invalid"就判 invalid。
**所有将来批量生产的新关卡必须经过此门闩**，禁止再出现"合法操作仍报错"。

### 5.4 Score 计分系统（score.mjs 是唯一口径）
```
单局 total = base + move + time  (3 维纯函数)
```
- **baseScoreFor(D, isDaily?)**：主线 = `80 + D·40`；今日挑战 **额外 +200**。
- **moveScore(moves, par, isDaily?)**：
  - 步数 ≤ par → 满分（主线 100 / 每日 150）。
  - 超过 `Mmax = ⌈par·1.5⌉` → 每 1 步 -1；保底 = 主线 20 / 每日 40。
- **timeScore(elapsedSec, D, isDaily?)**：
  - 起始满分主线 = 100 / 每日 = 150。
  - `Tmax = 45 + (D-1)·18`（今日 ×1.3 放宽）；超时 → 每 10 秒 -1；保底同上。
- **perfectScoreForLevel(level, isDaily?)**：满分上限（HUD 分母 / 选关未通关显示）。
  - 主线 = `80 + D·40 + 200`。例：L1=320, L7=560。
  - 今日挑战 = `80 + D·40 + 200 + 150 + 150 = D·40 + 580`。例：D5=780, D6=820。
- **总积分 (storage.progress)**：`Σ bestScoresByLevel[id].score`，单关取历史最高。
  `loadProgress()` 每次调用强制 `recomputeTotals()` 防止本地数据改坏或损坏。
- **分数上限铁律**：`recordCompletion` / `recordDailyCompletion` 写入前必须按当前关卡（或每日难度）满分钳制；读取旧存档也必须丢弃超过上限的记录，任何 UI 不得显示 `得分 > 总分`。
- **步数 (storage.progress.totalMoves)**：引擎 `stats.movesPlayed` 每次真实 extract 才 +1；
  undo/reset 取最大值永不回退；撤回不会让步数或步数得分减少。
- **今日首通奖励**：`dailyBonusScore(1stToday)` 主线通关每日首次 +50（与 daily level 的
  +200 bonus 互不冲突）；可通过 storage 参数控制。

### 5.5 HUD 显示口径（UI 与 score.mjs 强绑定）
- 原"调度 / 目标 / 已充能"已废弃。新 HUD：
  - **步数** = `stats.movesPlayed`
  - **目标** = `level.par`
  - **得分** = `estimateLiveScore(state).total / perfectScoreForLevel(level, isDaily)`
    （未通关分子是保守预估，通关后分母不动、分子替换为最终值）
  - **总积分** = `progress.totalScore`
- 选关页关卡球下方胶囊徽章：已通关 → 历史最高分；未通关 → 本题总分 perfectScore。
- 通关弹窗顶行：`得分 X/Y · 步数 m/par · 🏆 新高分`（已删除 ★★★ 星级）；明细面板
  三行 `基础分 / 步数分 / 时间分 / 合计得分`。

### 5.6 今日挑战（daily.mjs）
- 原"今日星轨"已改名；入口：选关页顶部 + 游戏内工具按钮下方常驻。
- **O(1) Blueprint 构造**（UI 永不卡死）：`hash(dateKey)` → D5/D6 二选一、
  paramsForDifficulty 上探 cap/color/dockCount=2/emptyCount≥2；Fisher-Yates 打乱 orbs、
  循环分发填充到 non-empty tracks（每轨道长度 ≤ capacity；每色恰好 capacity 个球）。
  同 dateKey 所有玩家得到完全一致的题目（same-day deterministic → true）。
- par 给保守估计：`max(14, orbsFlat.length×2 + dockCount×3 + emptyCount×2)`。需要真实可解
  与真实 par 可后台异步调用 `refineDailyLevel(dateKey, {timeLimitMs})`（不阻塞 UI），
  成功则覆盖 par/validation，失败 blueprint 照常使用。
- `renderSelect()` 不能直接调用 `createDailyLevel` 来判"继续今日挑战"。用快判：
  `progress.daily.dateKey === todayKey() && currentGame.dateKey === todayKey() && currentGame.levelId === "daily" && isValidStoredState(currentGame)`。真实合法性在"开始今日挑战/继续"按钮的点击处理里再校验。

### 5.7 UI 反馈通路（禁止在页面硬编码）
- 提示：`message(text, tone)`，tone ∈ `good | warn | bad | info`；
- 触感：`haptic()`（navigator.vibrate）；
- 计数跳字：`bump()`；
- 所有动画必须支持 `prefers-reduced-motion: reduce` 降级；

### 5.8 开发 / 验证命令
- 改了 orbit-sort 任何东西 → **先跑** `npm run test:orbit-sort`（CI 门禁）。
- 关卡或规则变更必须确认 100 关全量可解、合法操作随机游走无误拦截，并检查章节难度整体递增但章内保持波浪式；上述检查由 `levels.test.mjs`、`generator.test.mjs`、`rules-property.test.mjs` 覆盖。
- 改了门户/build/game.json/deployment → 再跑 `npm run build`。
- 本地路径 `/games/orbit-sort/`；生产 `/orbit-sort/`。源码模块用 `?v=dev` 占位，
  生产构建会把所有 `?v=dev` 替换为单一 `BUILD_ID`（覆盖 Worker URL 和 Worker 内部 import）。

## 6 · Tic-Tac-Toe · 稳定基线

Plain 静态游戏（`games/tic-tac-toe/index.html`，无 package.json；测试走根 `package.json`
的 `test:tic-tac-toe`）。模块分层与 orbit-sort 一致：engine / ai / score / storage / game
(DOM-free) / ui (唯一 DOM 拥有者) / main (装配)。

### 6.1 棋盘与胜负（engine.mjs 唯一权威）
- 变长棋盘：`size ∈ {3,4}`，`winLength` = 3（size3）/ 4（size4）。
- 连成一条长 `winLength` 的直线即胜；满盘未连 → draw（仅 `won` 是终止态）。
- 纯函数 `createState / applyMove / getStatus / getWinLine`；直线覆盖行/列/主对角
  （size4 反对角线长度不足，不计入）。

### 6.2 AI（ai.mjs，难度 = 失误率，不是算力开关）
- 难度档：`easy 0.45` / `normal 0.15` / `master 0`（失误率 ε）。
  - ε：以 ε 概率走 `rankMoves` 里**非最优**的随机合法子（自然漏胜漏堵）。
  - `guard`（能赢就赢、对手将赢就堵）：easy 关闭，normal/master 开启。
  - master = ε0 + guard 开 = 完美博弈 → 3×3 不可战胜，成就设为"逼平"。
- 搜索：negamax + α-β + 迭代加深（`maxDepth` / `budgetMs`）；size4 深度/预算从紧。
- 不变式：**合法操作永不报错**，AI 始终落一个合法子。

### 6.3 计分（score.mjs 唯一口径）
```
单局 = (base + effBonus + streakBonus) × difficultyCoef
```
- base：胜 100 / 平 30 / 负 0；effBonus：剩余空格 × 8；streakBonus：min(streak,5) × 20。
- difficultyCoef：easy 0.6 / normal 1.0 / master 1.6。总积分 = `Σ bestScoresByLevel`，持久化。

### 6.4 对局控制（game.mjs，DOM-free）
- 模式：`pve`（人机，**先手每局自动轮换**避免掷硬币）/ `pvp`（本地双人）。
- 悔棋栈**只压"等待人类决策"的局面**（pve 一次撤销 = 玩家一手 + AI 回应）。
- AI 落子前强制 250–550ms 思考延迟（全局 `setTimeout`，非 `requestAnimationFrame`）。
- 结算只在对局结束（status≠playing）时计算分数/连胜。

### 6.5 测试门禁 & 路径
- `npm run test:tic-tac-toe` 必须全绿（77 用例，含 AI 强度自对弈校验）。
- 本地 `/games/tic-tac-toe/`；生产 `/tic-tac-toe/`。源码 `?v=dev` 占位由构建替换为 BUILD_ID。

## 7 · Homepage, SEO, i18n & Style（门户）

- 无框架原生 HTML/CSS/ES Module，无构建依赖。
- `games.json` 驱动：卡片、JSON-LD、`scripts/gen-sitemap.mjs`。sitemap 只进首页和非
  comingSoon 的同域游戏根。`cover` 必须 1:1，发布图 640×640 WebP，路径
  `assets/covers/<slug>.webp`；卡片文案可选 `en.title / en.desc`（英文名）。

### 7.1 视觉规范（2026-09 配色定稿）
- 背景：`.bg-pattern` 固定层承载 175° 三段渐变 `#96f3de → #6fe4cb → #55d3d0`
  （CSS 变量 `--bg-top/--bg-mid/--bg-deep`）+ `assets/bg-diamante.svg` 白色低透明度纹理。
  `--bg` = `var(--bg-mid)`（兼容旧引用）。**不要回退到荧光纯色。**
- 色板：ink `#05384a`（深青，非纯蓝）；accent `#009cff`；白面；`--radius 16px`；
  `--gap 16px`；投影一律青调双层软阴影 `rgba(4,68,77,…)`（tile / chip 两档变量）。
- Header 层级：第一行 `.head-row` flex（space-between + center）放
  「Doin.win 字标（白色芯片，".win" 用 `#009cff→#23cfc0` 渐变文字）←→ 语言按钮」；
  第二行 h1 为次级（clamp 20–25px）。**不要让 h1 与字标抢字号。**
- 卡片：1:1 封面 + 左下角**常显白色胶囊标签**（无渐变遮罩）；hover 非对称放大
  （0.6s 回 / 0.3s 进，`scale(1.04) translateY(-4px)`，需 z-index）。
  全部 motion 支持 `prefers-reduced-motion: reduce` 降级。
- **只用系统 sans-serif，不加载 webfont。**

### 7.2 语言选择器与 i18n 规则（全站统一）
- 首页语言切换 = `.lang-picker` 下拉面板：圆形地球按钮 → 白色圆角面板，
  选项「中文 / EN」固定自称不翻译，当前语言 `.is-active` 深色胶囊（ink 底白字）。
  点外部 / Esc 关闭；`aria-haspopup/expanded` + `menuitemradio/aria-checked`。
- **全站共享偏好 `localStorage["doin.lang"]`**；默认规则：显式偏好 > `navigator.language`
  （zh* → zh，其余 → en）；切换 = `saveLocale(locale)` + `location.reload()`。
- i18n 统一 API（各游戏 `i18n.mjs` 与首页 `js/i18n.mjs` 同构）：`LOCALES / LANG_KEY /
  DEFAULT_LOCALE / isLocale / strings / format / detectLocale / loadLocale / saveLocale /
  htmlLang`。中英字符串表**键必须完全对齐且非空**（测试强制）。
- 已双语：orbit-sort / tic-tac-toe / minesweeper / gold-miner / 首页（zh/en）；sudoku（zh-Hans/zh-Hant/en）、
  2048（zh/en）本就有，但偏好 key **尚未统一到 `doin.lang`**（待办）。

### 7.3 测试门禁
- 改首页 i18n → `npm run test:home`；改门户结构/样式/game.json → `npm run build`。

## 8 · Minesweeper · 稳定基线

Plain 静态游戏（`games/minesweeper/index.html`，无 package.json）。模块分层：
`engine`（规则唯一权威）/`solver`（无猜求解）/`level`（难度参数）/`score`（计分唯一口径）/
`storage`（存档唯一口径）/`audio`（WebAudio 合成音效）/`game`（DOM-free 控制器）/
`ui`（唯一 DOM 拥有者）/`main`（装配）。

### 8.1 引擎规则（engine.mjs）
- 棋盘：`rows × cols` 扁平数组，索引 = `row * cols + col`。
- 延后布雷：`createState` 只建空盘；首次 `reveal` 才调用 `placeMines(safeIndex)`，
  排除首击格及其 8 邻域 → **首击永不踩雷且必然展开一片**。
- 雷格 `adjacency = -1`（`MINE_ADJACENCY`），保证任何"adjacency === 0 才扩散"的
  分支遇雷即走保守路径，不可能自动揭雷。
- `flood` 输出 `lastRevealed`（BFS 顺序），供 UI 做波纹扩散。
- 胜利时 `settle()` 自动把剩余隐藏格插旗，`remainingMines()` 归零。
- 无效果时返回**同一对象引用**；`applyIntent` 返回 `{state, action}`，action 为 null
  表示"这一步没生效"，**合法操作永不报错**。
- 点已揭开的数字格 = chord（现代扫雷一等公民操作）。

### 8.2 无猜保证（solver.mjs）
- 首击时 `game.mjs` 调用 `pickNoGuessSeed(config, firstIndex, baseSeed)`，
  以 baseSeed 为起点线性探测，直到生成一个从首击后可**纯逻辑通关**的雷布局。
- 推理规则：单点规则（数字格的隐藏邻数 == 剩余雷数 → 全安全/全雷）+
  子集规则（隐藏邻集合包含关系 → 额外雷数可整体判定）。
- `isNoGuessSolvable(state)` 用上述规则迭代到不动点；若卡住但仍有隐藏格 → 该布局需要猜测，
  重试下一个种子。
- 运行时兜底：`resolveDeadlock()` 在玩家走入死局时调用 `findSafeCell()`，
  自动揭示一个可证明安全格并提示"免费透视"；因生成已保证无猜，此路径极少触发，
  但存在即可防止任何运气决定胜负。

### 8.3 难度与 UI
- 经典三档：`beginner 9×9/10`、`intermediate 16×16/40`、`expert 16×30/99`。
  自定义参数走 `resolveConfig({ rows, cols, mines })`，经 `normalizeConfig` 夹取边界。
- DOM + CSS Grid 渲染棋盘；右键 / 长按（320ms）插旗；旗帜模式按钮兼容触屏；
  点已揭开数字格 = chord。结算浮层 + 计时器 + 剩余雷数 HUD + 静音按钮。
- Neon Grid 主题：深色玻璃底 + 金属浮雕未揭格 + 高饱和霓虹数字 + 发光雷核心。

### 8.4 计分与存档
- **计分唯一口径在 score.mjs**（UI / 结算面板不许自己算）：
  单局 `total = base + time`，仅通关（won）计入，踩雷 = 0 分。
  基础分按难度固定：beginner 120 / intermediate 280 / expert 560（保底，时间分不拉低它）。
  时间分 = `round(base × 0.6 × clamp((par − elapsed)/par, 0..1))`，
  par = beginner 30s / intermediate 120s / expert 300s；越快越高，超 par 归零。
  combo/道具等未来特性不许改这个口径，只能在其上叠加。
- **存档唯一口径在 storage.mjs**：key `doin.minesweeper.v1`，localStorage 不可用时
  静默降级内存。结构 `{ version, prefs:{difficulty,muted}, best:{<diff>:{bestScore,bestTimeMs,plays,wins}} }`。
  - `recordResult` 纯函数：plays 每次 +1，won 时 wins +1，bestScore/bestTimeMs 只在破纪录时更新，
    返回 `{ state, isBestScore, isBestTime }`；不破纪录不写入（非最佳局只累计 plays）。
  - 任何字段缺失/损坏/负值 → `normalize` 退回默认，绝不抛给 UI。老扁平 `{ difficulty }` 结构自动迁移。
- **音效 audio.mjs 零资源 WebAudio 合成**：reveal 音调随单次展开格数升高（flood/chord 正反馈）、
  flag/unflag/chord/win（五声音阶琶音）/lose（下行爆炸）/peek（上滑 blip）。AudioContext 需
  用户手势解锁 → 发声入口先 `unlock()`；环境不支持或 muted 时整体静默，绝不抛异常。
  结算时 `finishGame()`：win/lose 音 + 触感 + 算分 + 存档（全部走上面唯一口径）。

### 8.5 测试门禁
- `npm run test:minesweeper` 必须全绿（engine / game / solver / score / storage 共 55 用例）。
- 改了 solver、engine 或生成逻辑 → 必须确认自动通关模拟无踩雷、无透视触发、胜率 100%。
- 计分或存档口径变更 → score.test.mjs / storage.test.mjs 同步加回归用例。
- 本地 `/games/minesweeper/`；生产 `/minesweeper/`。源码 `?v=dev` 由构建替换为 BUILD_ID；
  URL 带 `?e2e` 时 main 暴露 `window.__ms`（state/intent/findSafeCell）供端到端验证，生产无影响。

## 9 · Gold Miner · 稳定基线

Plain 静态游戏（`games/gold-miner/index.html`，无 package.json）。模块分层：
`engine`（物理与规则唯一权威，DOM-free）/`score`（配额与商店唯一口径）/`storage`（存档唯一口径）/
`audio`（WebAudio 合成）/`render`（只读 state 的 Canvas 绘制 + 粒子）/`game`（DOM-free 控制器）/
`ui`（唯一 DOM 拥有者）/`main`（装配）/`i18n`。

### 9.1 玩法与引擎（engine.mjs）
- 固定 800×600 内部坐标系；移动端只靠 CSS 缩放（`aspect-ratio: 4 / 3`），不改坐标。
- 钩爪三态：SWINGING（±1.25rad 摆）/ SHOOTING（6.5/帧）/ RETRACTING；
  收绳速度 = `REEL_FACTOR / item.weight`，空爪 12/帧；抓垫 GRAB_PAD 8。
- `stepFrame` / `applyIntent` 返回 `{ state, events, action }`，action 为 null 表示没生效；
  **合法操作永不报错**（pause/buy/drop/blast 在终止态均为 no-op）。
- 生物（钻石变的游鱼）巡逻移动在引擎里做，暂停即停；TNT 爆炸半径 110 可连锁。
- 60 秒一局；现金达配额 won、超时 lost；场地抓空提前结束。

### 9.2 计分与存档（唯一口径）
- 配额 `targetForLevel(n) = round(1000 × 1.65^(n-1))`；钻石 600，亮油后 900；
  神秘袋 40% 现金 500 / 30% 炸药 2 / 30% 生力水 1（rng 可注入）。
- 商店：炸药 200 / 生力水 280 / 亮油 320。**已知偏差（刻意保留）**：文案写生力水/亮油
  "下一关生效"，实现上购买后永久生效、从不消耗；对齐前不要改任一侧。
- 存档 key `doin.gold-miner.v1`：`{version, prefs:{muted}, progress:{level, money, record,
  dynamite, potion, polish}}`；record 永不小于 money；损坏退回默认；破产 `clearRun` 保留 record。

### 9.3 测试门禁
- `npm run test:gold-miner` 必须全绿（engine / score / storage / i18n / markup 共 58 用例）。
- markup 测试守装配契约：index.html 每个 id 都在 main 的 refs 表、ui 引用的 refs 全部已声明、
  商店 data-type/data-cost 与 score.mjs 一致、`?v=dev` 占位与移动端/reduced-motion 样式在位。
- 本地 `/games/gold-miner/`；生产 `/gold-miner/`。URL 带 `?e2e` 时 main 暴露 `window.__gm`。

## 10 · Working Rules

- **一次只发一个独立特性的小补丁**，然后更新 PROJECT_LOG.md。
- 门户 / 构建脚本 / games.json / 部署 → 跑 `npm run build`。
- 单游戏测试门禁：
  - Sudoku：`games/sudoku` 下 `npm run typecheck && npm test`。
  - 2048：`games/2048` 下 `node --test tests/engine.test.mjs tests/storage.test.mjs tests/i18n.test.mjs tests/markup.test.mjs`（Node 22 必须显式列文件，不能只给 `tests` 目录）。
  - orbit-sort / tic-tac-toe / minesweeper / gold-miner / 首页：根目录 `npm run test:orbit-sort` /
    `test:tic-tac-toe` / `test:minesweeper` / `test:gold-miner` / `test:home`。
- Commit message：英文，conventional-commit 前缀（feat/fix/docs/chore），body 解释为什么改。
- Deploy workflow 已升级到 `actions/checkout@v5` + `actions/setup-node@v6`（Node 22）。
