# PROJECT_LOG.md

> 精简原则：只留状态快照 + 最近一轮要点。细节查 git log / `.workbuddy/memory/`。
> 游戏稳定规则写在 AGENTS.md（§5 orbit-sort / §6 tic-tac-toe / §7 homepage / §8 minesweeper /
> §9 gold-miner），本文件不重复。

***

## Current Baseline (2026-09-05)

- **门户**：薄荷渐变首页（`index.html` + `css/`），640×640 WebP 封面（3D 风格统一），
  白色胶囊卡片标签 + hover 放大；品牌行「Doin.win 字标 ←→ 地球语言按钮」+ 二级主标题；
  中英双语（`doin.lang` 全站共享偏好）。CNAME `doin.win`。共 6 款游戏上架。
- **orbit-sort**（已稳定）：5 章 × 20 题（100 关）、积分系统、今日挑战。规则见 AGENTS.md §5。
- **tic-tac-toe**（已稳定）：3×3/4×4、难度=失误率、本地双人、WebAudio 音效。规则见 AGENTS.md §6。
- **minesweeper**（已稳定）：经典三档 + 无猜保证 + 计分存档 + WebAudio 音效 + Neon Grid 主题 + 移动端适配。规则见 AGENTS.md §8。
- **gold-miner**（已稳定）：黄金矿工。钩爪物理 + 关卡配额递增 + 商店 + 神秘袋；
  零依赖内联版拆成 9 模块，58 用例门禁。规则见 AGENTS.md §9。
- **i18n**：orbit-sort / tic-tac-toe / minesweeper / gold-miner / 首页均中英双语；统一默认语言规则与
  共享偏好 key `doin.lang`（AGENTS.md §7）。2048（zh/en）、sudoku（zh-Hans/zh-Hant/en）
  本就已双语，但偏好 key 尚未统一到 `doin.lang`。
- **交付契约**：`docs/GAME-SPEC.md`（自包含，可整篇贴给外部开发者/网页对话 AI）+
  `scripts/check-game.mjs`（两级门禁：T1 上架底线 fail 即 exit 1，T2 一致性只 WARN，存量豁免内置）。
  外部方只产出 `games/<slug>/` 内文件（SPEC §7A 人工自查），组装与验收在门户方（§7B）。
- **本地服务**：`node _dev-server.mjs`（零依赖，端口 46810 起）；目录请求缺尾斜杠时 301 补齐，
  保证页面内相对资源解析正确。
- **git**：正常，main 全部推送成功（此前 ai919≠ai717 的 403 已解除）。

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
- `assets/og-image.png` 仍是旧像素风，建议重渲为新配色 1200×630。
