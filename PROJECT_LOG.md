# PROJECT_LOG.md

> 精简原则：只留状态快照 + 最近一轮要点。细节查 git log / `.workbuddy/memory/`。
> 游戏稳定规则写在 AGENTS.md（§5 orbit-sort / §6 tic-tac-toe / §7 homepage / §8 minesweeper /
> §9 gold-miner），本文件不重复。

***

## Current Baseline (2026-09-05)

- **门户**：薄荷渐变首页（`index.html` + `css/`），640×640 WebP 封面（3D 风格统一），
  白色胶囊卡片标签 + hover 放大；品牌行「Doin.win 字标 ←→ 地球语言按钮」+ 二级主标题；
  中英双语（`doin.lang` 全站共享偏好）。CNAME `doin.win`。共 12 款游戏上架（新增 FreeCell）。

- **FreeCell**（新增组装）：空当接龙静态游戏已登记至 `games.json`，补齐 640×640 WebP
  封面与根 `test:freecell` 门禁。`check-game` 19 项全通过，engine / storage / i18n /
  markup 共 13 项测试通过；站点构建、sitemap 与本地 HTTP 预览均已验证。
- **Snake Orchard**（新增组装）：果园贪吃蛇已登记至 `games.json`，补齐 640×640 WebP 封面与根 `test:snake-orchard` 门禁。`check-game` 19 项全通过，engine / storage / i18n / markup 共 16 项测试通过；站点构建、sitemap 与本地 HTTP 预览均已验证。
- **zuma**（新增组装）：祖玛传奇静态游戏已登记至 `games.json`，补齐 640×640 WebP 封面、返回首页链接与 `?v=dev` 资源占位；根目录新增 `test:zuma` 脚本。T1 验收 18 项通过（T2 tests-dir 仅提示），引擎测试 2 项通过，站点构建与本地预览验证通过。
- **Gravity Echoes**（新增组装）：重力奇点打砖块已登记至 `games.json`，补齐 640×640 WebP 封面、首页返回入口、存档边界归一化，以及 engine / storage / i18n / markup 共 12 个测试。`check-game` 19 项全通过，构建与 sitemap 已验证。
- **Tile Matching**（新增组装）：三消游戏已登记至 `games.json`，补齐 640×640 WebP 封面、首页返回入口、favicon 与根测试入口；补充共享 `doin.lang` API 与 i18n / storage 回归测试，保留外部交付的玩法实现不变。`check-game` 19 项全通过，测试 5 项通过，站点构建、sitemap 与本地 HTTP 预览均已验证。
- **tetris-neo**（外部交付首款，已整改）：赛博霓虹俄罗斯方块，7-Bag / 三尺寸 / 三难度 /
  硬降墙踢幽灵落点。模块 engine / storage / i18n / main + 39 用例门禁；玩法数值与外部版逐字一致。
- **orbit-sort**（已稳定）：5 章 × 20 题（100 关）、积分系统、今日挑战。规则见 AGENTS.md §5。
- **tic-tac-toe**（已稳定）：3×3/4×4、难度=失误率、本地双人、WebAudio 音效。规则见 AGENTS.md §6。
- **minesweeper**（已稳定）：经典三档 + 无猜保证 + 计分存档 + WebAudio 音效 + Neon Grid 主题 + 移动端适配。规则见 AGENTS.md §8。
- **gold-miner**（已稳定）：黄金矿工。钩爪物理 + 关卡配额递增 + 商店 + 神秘袋；
  零依赖内联版拆成 9 模块，58 用例门禁。规则见 AGENTS.md §9。
- **i18n**：全站游戏（orbit-sort / tic-tac-toe / minesweeper / gold-miner / 2048 / sudoku / 首页）
  均已支持多语言并统一对齐全站共享偏好 key `doin.lang`（AGENTS.md §7）。
- **交付契约**：`docs/GAME-SPEC.md`（自包含，可整篇贴给外部开发者/网页对话 AI）+
  `scripts/check-game.mjs`（两级门禁：T1 上架底线 fail 即 exit 1，T2 一致性只 WARN，存量豁免内置）。
  外部方只产出 `games/<slug>/` 内文件（SPEC §7A 人工自查），组装与验收在门户方（§7B）。
- **外部 AI 子游戏模板**：已定稿任务参数 + 三轮交付格式。新 slug 仅小写英文/数字/连字符；
  视觉按玩法在 Canvas/WebGL 与 DOM/CSS 间选择，Canvas 需 DPR、resize、坐标换算与受限 dt；
  本地资源相对引用并保留 `?v=dev`（返回首页例外为 `href="/"`）。外部方交付
  `index.html`/favicon/CSS、按需模块和 engine/storage/i18n/markup 四类原生测试；最终只作
  人工自查，不得虚报运行结果。
- **本地服务**：`node _dev-server.mjs`（零依赖，端口 46810 起）；目录请求缺尾斜杠时 301 补齐，
  保证页面内相对资源解析正确。
- **git**：正常，main 全部推送成功（此前 ai919≠ai717 的 403 已解除）。

## 2026-09-07 · 重渲门户 Open Graph 封面图 (og-image.png)

### 做了什么
1. **视觉规范统一**：将 `assets/og-image.png` 由旧版深色像素风重构为定稿的 Poki 主题设计；
2. **渐变与底纹渲染**：准确复现 175° 三段薄荷向纵深渐变（`#96f3de → #6fe4cb → #55d3d0`）并几何绘制 60×60 `bg-diamante.svg` 菱形低透明度纹理；
3. **品牌与展品排版**：中央置入高对比度立体芯片字标「Doin.win」（深青 ink `#05384a` + `.win` 蓝青渐变 `#009cff → #23cfc0`）与胶囊徽标，两侧斜角悬浮 6 款代表性 3D 游戏封面与柔和软阴影；
4. **脚本工具收录**：提供可复现生成的 `scripts/make_og_image.py` 自动化脚本。

### 修改/新增文件
- `assets/og-image.png`
- `scripts/make_og_image.py`
- `PROJECT_LOG.md`

## 2026-09-07 · Sudoku 对齐全站 doin.lang 与单元测试

### 做了什么
1. **i18n 对齐**：`games/sudoku/src/i18n/locale.ts` 引入 `LANG_KEY = "doin.lang"`，新增 `readSharedLocale()` 与 `writeSharedLocale()`；`resolveLocale` 实现全站共享偏好（`doin.lang`）优先，并保留繁体中文（`zh-Hant`）分支精准识别；
2. **状态与存储联动**：`games/sudoku/src/game/persist.ts` 的 `savePersisted` 与 `games/sudoku/src/game/store.ts` 的 `setSettings` 在语言变动时同步写共享偏好 `doin.lang`；
3. **单元测试门禁**：新增 `games/sudoku/src/i18n/locale.test.ts`（10 项测试），覆盖读写校验、回退机制、Hans/Hant 变体解析及隐私模式异常降级；`games/sudoku/package.json` 的 `npm test` 扩充包含该测试；
4. **验收脚本优化**：`scripts/check-game.mjs` 支持解析 `.ts` / `.tsx` 源文件，移除 `sudoku` 的 `doin-lang` 豁免项，机器验收原生通过。

### 修改文件
- `games/sudoku/src/i18n/locale.ts`
- `games/sudoku/src/i18n/index.ts`
- `games/sudoku/src/game/persist.ts`
- `games/sudoku/src/game/store.ts`
- `games/sudoku/src/i18n/locale.test.ts`
- `games/sudoku/package.json`
- `scripts/check-game.mjs`
- `AGENTS.md`
- `PROJECT_LOG.md`

## 2026-09-07 · 2048 对齐全站 doin.lang 与根测试门禁

### 做了什么
1. **i18n 对齐**：`games/2048/js/i18n.mjs` 补齐 `LANG_KEY = "doin.lang"`、`format`、`loadLocale` 与 `saveLocale`，实现全站统一偏好 > 浏览器语言的级联回退与异常降级；
2. **存档联动**：`games/2048/js/storage.mjs` 的 `loadPrefs` / `savePrefs` 读写 `doin.lang`，与门户双向同步语言偏好；`games/2048/js/main.mjs` 启动加载 `loadLocale()`；
3. **测试与验收**：`games/2048/tests/i18n.test.mjs` 与 `tests/storage.test.mjs` 补充偏好共享、写入校验与异常降级测试，测试用例扩充至 55 项全绿；根 `package.json` 注册 `test:2048`；
4. **门禁豁免收敛**：`scripts/check-game.mjs` 移除 2048 的 `doin-lang` 与 `tests-root-script` 豁免项，2048 达到 18 pass / 1 waived（仅保留老项目 `v-dev` 豁免）。

### 修改文件
- `games/2048/js/i18n.mjs`
- `games/2048/js/storage.mjs`
- `games/2048/js/main.mjs`
- `games/2048/tests/i18n.test.mjs`
- `games/2048/tests/storage.test.mjs`
- `package.json`
- `scripts/check-game.mjs`
- `AGENTS.md`
- `PROJECT_LOG.md`

## 2026-09-06 · 外部 AI 子游戏交付模板定稿

### 做了什么
1. 定稿面向网页对话 AI 的子游戏提示词：任务参数、目录与路径边界、自包含资源、渲染选择、
   按需模块、语言/存档规则、Canvas 输入与时间步、状态执行、四类 Node 原生测试及三轮输出流程。
2. 明确外部方只生成 `games/<slug>/`；门户方仍负责 `games.json`、封面、根测试脚本、
   `check-game`、构建、浏览器验收与发布。
3. 将 `AGENTS.md` 的外发规则改为“SPEC 为基线 + 定稿模板补充”，避免旧的“只贴 SPEC”表述
   与本轮协作流程冲突。

### 修改文件
- `AGENTS.md`
- `PROJECT_LOG.md`

### 关键实现方式
- 模板要求 slug 为 lower-kebab-case；内部资源使用相对路径与 `?v=dev`，仅返回门户使用 `href="/"`。
- 连续图形按需使用 Canvas/WebGL，文字、HUD、弹窗和语言控件保留 DOM；合法 engine 操作必须执行，
  渲染只反映最新状态。
- 每个交付必须含 engine、storage、i18n、markup 四个原生 `node:test` 文件；无执行环境时仅允许
  输出可审计的人工核对，禁止虚报测试已运行。

### 遇到的问题
- 无游戏代码或构建配置变动，未运行测试或构建；本轮仅更新协作规范与收尾记录。

## 2026-09-05 · 外部游戏交付契约（GAME-SPEC + 两级验收脚本）

### 做了什么
1. **`docs/GAME-SPEC.md`**：自包含交付契约，可整篇贴给外部开发者或网页对话 AI。
   含目录形状、T1/T2 门禁表、禁止清单、可照抄骨架（index.html / storage 降级 / i18n API 形状）、
   测试要求、上架物料、§7A 外部方人工自查清单 + §7B 门户方验收流程。
2. **`scripts/check-game.mjs`**：零依赖机器验收，`node scripts/check-game.mjs <slug>`。
   两级——T1（index-html / games-json / cover / v-dev / back-home / doin-lang /
   storage-guard / tests-min / tests-root-script）FAIL 即 exit 1；T2 只 WARN。
   `LEGACY_WAIVERS` 内置存量豁免（orbit-sort 4 项 / 2048 3 项 / sudoku 12 项）打印为
   `WAIVED` + 原因，新 slug 零豁免。WebP 尺寸自解析（VP8X/VP8 /VP8L），不引依赖。
3. **AGENTS.md §4** 加指针条目：外发只贴 SPEC 正文，对方可能无运行环境，
   组装/验收/上架物料永远在门户方。

### 为什么是两级
用户明确反对过严约束（"单独的子游戏能运行即可"），但也要有底线。故只把"不满足就无法进
构建与部署流水线、或会破坏全站"的 9 条设为 fail，其余一致性建议降级 WARN。

### 现状复扫（本轮验证）
gold-miner / minesweeper / tic-tac-toe 19 pass 0 fail 0 warn；orbit-sort 15 pass 4 waived；
2048 16 pass 3 waived；sudoku 7 pass 12 waived（均 exit 0）。
`games/tetris-neo/`（外部渠道首个成品，尚未提交）5 pass / 7 fail(T1) / 7 warn(T2)，
    另有 2 个脚本查不出的真实 bug：`hardDrop()` 先置 `isDropLocked` 再调 `drop(true)`
被自己的 `isManual && isDropLocked` 拦截 → 硬降永不合并；localStorage 偏好未校验，
    坏值直接 `BOARD_CONFIGS[currentBoard].cols` 会崩。整改待用户点头，作为独立补丁。

### 2026-09-05 · 新游戏协作指令
- 在 `AGENTS.md §4.1` 固化三类请求的处理边界：组装新游戏、只读检查新增游戏、处理新增游戏后续工作。
- 明确外部网页 AI 只产出 `games/<slug>/`；门户代理负责验收、登记、封面、根测试、构建与预览，部署需用户明确要求。
- `docs/GAME-SPEC.md §7` 增加同一职责边界提示，避免外部 AI 修改门户或自行发布。

## 2026-09-05 · tetris-neo 整改上架（外部交付首款）

### 做了什么（三个补丁）
1. **补丁 1 · 修 bug + 收口**：`hardDrop()` 先置 `isDropLocked` 再调 `drop(true)` 被自身守卫吞掉
   （硬降永不合并）；旋转墙踢全失败时只还原 matrix 却留下累加 `pos.x` 偏移（方块漂进墙/堆里）；
   localStorage 偏好未校验导致坏存档白屏、SoundEngine 裸读存储在隐私模式崩溃。
   存储收口到 `js/storage.mjs`（key `doin.tetris-neo.v1`，白名单 + 数值夹取 + 内存降级），
   文案收口到 `js/i18n.mjs`（`doin.lang` 统一 API），入口 `game.js` → `js/main.mjs`（module）。
2. **补丁 2 · 抽规则层 + 测试门禁**：棋盘/难度/消行分数/7-Bag/墙踢全部抽到 DOM-free
   `js/engine.mjs`（数值与外部版逐字一致），main 改 import；新增 4 个测试文件共 39 用例
   （engine 11 / storage 10 / i18n 8 / markup 10），根 `package.json` 注册 `test:tetris-neo`。
3. **补丁 3 · 上架物料**：`games.json` 登记（en.title Tetris Neo，exclude scripts）、
   `games/tetris-neo/scripts/make_cover.py` 生成 640×640 WebP 封面（霓虹井 + 消行白光 +
   幽灵落点，无随机可复现）、`npm run build` 通过、sitemap 收录 `/tetris-neo/`。

### 验收结果
`node scripts/check-game.mjs tetris-neo`：19 pass / 0 fail(T1) / 0 warn(T2) / 0 waived。
`npm run test:tetris-neo` 39/39 绿。存量六款复扫无回归（gold-miner / minesweeper /
tic-tac-toe 19 pass；orbit-sort 15+4 waived；2048 16+3 waived；sudoku 7+12 waived）。
顺带修了验收脚本一处误判：engine-module 扫描未剥注释，规则层写一句"不碰 document"
的说明就被判违规，现改为先剥注释再扫。

### 状态
已提交 `f3b21de` 并推送；Publish workflow 与 pages 部署均 success。
生产验证：`https://doin.win/tetris-neo/` 200、`js/main.mjs` 200、封面 200、
sitemap 收录 `/tetris-neo/`、`games.json` 含登记。本地预览同路径 `/games/tetris-neo/`。

## 2026-09-05 · 黄金矿工上架（第 6 款游戏）

### 做了什么
1. **收敛三套并存原型**为单一实现：保留零依赖内联版玩法数值，删 `main.js` 与 `src/`
   TS+pixi 版、`node_modules` 及无关同步工具脚本（移至仓库外备份目录，未删除）。
2. **按仓库分层拆模块**：engine / score / storage / audio / render / game / ui / main / i18n，
   玩法数值原样保留；两处刻意修正——生物巡逻移入引擎（暂停即停）、`alert()` 改非阻塞 toast。
3. **测试门禁 58 用例**：engine 20 / score 7 / storage 9 / i18n 10 / markup 12；
   markup 守装配契约（refs 表 ↔ ui 引用 ↔ 商店 data-* ↔ `?v=dev` 占位）。
4. **上架闭环**：`games.json` 登记（含 en.title）、640×640 WebP 封面（ImageGen + 裁水印）、
   `npm run build` 通过、sitemap 收录 `/gold-miner/`。
5. **dev server 修尾斜杠**：目录请求无尾斜杠时 301 补齐，修掉"整页无样式"（相对资源 404）。

### 已知偏差（刻意保留）
- 商店文案写生力水/钻石亮油"下一关生效"，实现上购买后永久生效、从不消耗。
  两侧均未改，避免扩大改动面；对齐前先读 AGENTS.md §9.2。

## 2026-09-04 · 首页视觉 + 全站 i18n（本轮收尾）

### 做了什么
1. **Minesweeper 从零上线**（MVP + P2）：延后布雷无猜保证、solver 判定、chord、
   计分存档、WebAudio 合成音效、Neon Grid 主题、移动端适配、封面登记上架。
   稳定基线固化在 AGENTS.md §8。commit 起点见 git log（`7a2701f` 等系列）。
2. **首页 Poki 风改版**：封面 1:1 统一、卡片白色胶囊标签（去黑色渐变遮罩）、
   hover 非对称放大（0.6s 回 / 0.3s 进）、品牌字标 Doin.win（白色立体芯片 + ".win" 渐变）、
   footer `© 2026 DOIN · Free Mini Games`、一行 tagline。
3. **全站中英 i18n**：orbit-sort / tic-tac-toe / minesweeper 各新增 `i18n.mjs` + 测试，
   中文文案外置；首页 `js/i18n.mjs` + `tests/home-i18n.test.mjs`；
   `games.json` 增加可选 `en.title` 等字段。
4. **配色优化**：弃荧光薄荷纯色 + 灰蓝重投影 → 175° 三段渐变背景
   （`#96f3de→#6fe4cb→#55d3d0`）、深青 ink `#05384a`、青调双层软阴影、
   ".win" 渐变改 `#009cff→#23cfc0`、菱形纹理线条统一白色低透明度。
5. **语言切换改下拉面板**：圆形地球按钮 + 白色浮层面板，当前语言深色胶囊高亮；
   点外部/Esc 关闭；`menuitemradio` + `aria-checked`；reduced-motion 降级。
6. **Header 层级重构**：`.head-row` flex 行「字标 ←→ 语言按钮」垂直居中对齐；
   h1 降为第二层级（20–25px），字标收敛 24–30px。

### 修改/新增文件
```
games/minesweeper/                  [新增整目录：engine/solver/level/score/storage/audio/game/ui/main/i18n + tests + 封面脚本]
assets/covers/minesweeper.webp      [新增]  games.json 登记 + exclude
games/orbit-sort/js/i18n.mjs + tests/i18n.test.mjs         [新增]
games/tic-tac-toe/js/i18n.mjs + tests/i18n.test.mjs        [新增]
games/*/js/{main,ui,renderer,score}.mjs                    中文文案外置改造
js/i18n.mjs  js/main.js  tests/home-i18n.test.mjs          [新增/改造] 首页 i18n
index.html  css/style.css                                   首页结构/样式多轮迭代
assets/bg-diamante.svg                                      纹理配色更新
AGENTS.md  PROJECT_LOG.md                                   基线记录
```

### 关键实现
- 无猜三件套：首击安全（延后布雷）→ 全盘可推（单点+子集规则不动点判定）→ 死局免费透视兜底。
- i18n 统一 API：`LOCALES / LANG_KEY / DEFAULT_LOCALE / isLocale / strings / format /
  detectLocale / loadLocale / saveLocale / htmlLang`；偏好 `localStorage["doin.lang"]`；
  默认规则：显式偏好 > `navigator.language`（zh*→zh 其余 en）；切换 = saveLocale + reload。
- 浏览器 `?e2e` 钩子（minesweeper `window.__ms`）做端到端验证，生产零影响。

### 遇到的问题
- 单点规则 expert 60% 退化 → 补子集规则后零退化；`game.config.seed` 不存在 → 用 `state.seed`。
- 测试文件物理放项目外（node:test 会被抖音/部分编译器扫描报错的经验）；本仓库虽无此约束，仍保持 tests/ 目录规范。
- agent-browser daemon 跨调用丢页面/视口 → 一律「set viewport → open → eval → screenshot」单链执行；
  点击隐藏元素会假成功（菜单未展开时点 option 无效）。
- `games.json` `exclude` 不能带尾部 `/`；触屏长按后 Android 补发 contextmenu 需屏蔽。
- CSS 并行 Edit 会快照覆盖 → 同文件改动必须串行。

### 验证
- `test:orbit-sort` 99 · `test:tic-tac-toe` 85 · `test:minesweeper` 64 · `test:home` 5，全绿。
- `npm run build` 通过；语言切换/下拉面板/header 排版浏览器实测通过。

***

## Archive（索引，不展开）

- **2026-09-04 orbit-sort 收尾审计**：单局计分按满分钳制；`loadProgress` 强制 recomputeTotals；
  100 关可解性与难度编排全量通过。
- **2026-09-03 tic-tac-toe 上线**：77 测试；3×3 大师档不可战胜 = 特性；先手自动轮换；
  deploy workflow 升级 checkout@v5 + setup-node@v6。
- **git push 凭据错配（恢复方式）**：缓存 token 属 `ai919`、仓库 owner `ai717` → 403。
  用 clash 7897 授权 `ai717`，或 Windows 凭据管理器换 PAT。
- 2048 零依赖上线 `doin.win/2048/`；Sudoku 有 typecheck + mocha。
